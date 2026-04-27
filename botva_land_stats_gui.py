#!/usr/bin/env python3
"""
GUI-приложение для сбора статистики боёв за земли в Ботва Онлайн (сервер Аватар).
Вводишь даты — получаешь таблицу: кто сколько раз сходил в бои, урон, хил и т.д.
"""

import csv
import http.client
import re
import ssl
import threading
import time
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError


FIGHT_LOG_URL = "https://avatar.botva.ru/fight_log.php?conflict={conflict_id}"
REQUEST_DELAY = 0.3
SEARCH_STEP = 50
FIGHTS_PER_DAY = 5


@dataclass
class PlayerStats:
    name: str
    fights: int = 0
    kills: int = 0
    damage: int = 0
    healing: int = 0
    protection: int = 0
    valor_points: int = 0
    fights_list: list = field(default_factory=list)


def fetch_page(conflict_id: int) -> Optional[str]:
    url = FIGHT_LOG_URL.format(conflict_id=conflict_id)
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urlopen(req, timeout=15) as resp:
            raw = resp.read()
            return raw.decode("windows-1251", errors="replace")
    except (URLError, HTTPError):
        return None


def page_exists(conflict_id: int) -> bool:
    try:
        ctx = ssl.create_default_context()
        conn = http.client.HTTPSConnection("avatar.botva.ru", timeout=10, context=ctx)
        conn.request("HEAD", f"/fight_log.php?conflict={conflict_id}",
                     headers={"User-Agent": "Mozilla/5.0"})
        resp = conn.getresponse()
        status = resp.status
        conn.close()
        return status == 200
    except Exception:
        return False


def find_latest_conflict(log_fn=None) -> int:
    if log_fn:
        log_fn("Поиск последнего конфликта...")

    probe = 201800
    while page_exists(probe + SEARCH_STEP):
        probe += SEARCH_STEP
        time.sleep(0.15)

    latest = probe
    for cid in range(probe + 1, probe + SEARCH_STEP):
        if page_exists(cid):
            latest = cid
        else:
            break
        time.sleep(0.15)

    if log_fn:
        log_fn(f"Последний конфликт: {latest}")
    return latest


def parse_fight_log(html: str, conflict_id: int):
    battle_name = ""
    m = re.search(r"ССЫЛКА НА БОЙ:\s*(.+?)</span>", html)
    if m:
        battle_name = m.group(1).strip()

    title_match = re.search(
        r'<b>(.*?)</b>\s*одержал[иа]?\s*победу\s*над\s*<b>(.*?)</b>', html, re.IGNORECASE
    )

    team1_name = ""
    team2_name = ""
    tab_matches = re.findall(
        r'conflict_log_tabs\.click\((\d+)\).*?>(.*?)</div>', html
    )
    for tab_id, tab_name in tab_matches:
        if tab_id == "1":
            team1_name = tab_name.strip()
        elif tab_id == "2":
            team2_name = tab_name.strip()

    def parse_table(table_html):
        players = []
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', table_html, re.DOTALL)
        for row in rows:
            cells = re.findall(
                r'<td[^>]*data-sort-value="([^"]*)"[^>]*>',
                row
            )
            if len(cells) >= 8:
                name = cells[0].strip()
                if not name:
                    continue
                players.append({
                    "name": name,
                    "kills": int(cells[1]) if cells[1].lstrip("-").isdigit() else 0,
                    "damage": int(cells[2]) if cells[2].lstrip("-").isdigit() else 0,
                    "healing": int(cells[3]) if cells[3].lstrip("-").isdigit() else 0,
                    "protection": int(cells[4]) if cells[4].lstrip("-").isdigit() else 0,
                    "efficiency": cells[5],
                    "valor": int(cells[7]) if cells[7].lstrip("-").isdigit() else 0,
                })
        return players

    table1_match = re.search(
        r'<table[^>]*class="[^"]*conflict_log_table1[^"]*"[^>]*>(.*?)</table>',
        html, re.DOTALL
    )
    table2_match = re.search(
        r'<table[^>]*class="[^"]*conflict_log_table2[^"]*"[^>]*>(.*?)</table>',
        html, re.DOTALL
    )

    team1_players = parse_table(table1_match.group(1)) if table1_match else []
    team2_players = parse_table(table2_match.group(1)) if table2_match else []

    return battle_name, team1_name, team2_name, team1_players, team2_players


def format_number(n: int) -> str:
    if n == 0:
        return "0"
    s = str(abs(n))
    parts = []
    while s:
        parts.append(s[-3:])
        s = s[:-3]
    formatted = ".".join(reversed(parts))
    return f"-{formatted}" if n < 0 else formatted


# --- Цвета и стили ---
BG_DARK = "#1a1a2e"
BG_MEDIUM = "#16213e"
BG_CARD = "#0f3460"
BG_INPUT = "#1a1a3e"
FG_TEXT = "#e0e0e0"
FG_ACCENT = "#e94560"
FG_GOLD = "#ffc947"
FG_GREEN = "#53d769"
FG_HEADER = "#ffffff"
FG_DIM = "#8899aa"
BTN_BG = "#e94560"
BTN_HOVER = "#ff6b81"
BTN_CSV_BG = "#0f3460"
ENTRY_BG = "#233554"
ROW_EVEN = "#162040"
ROW_ODD = "#1a2850"
ROW_SELECT = "#e94560"


class BotvaStatsApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Ботва Онлайн — Статистика боёв за земли")
        self.root.geometry("1050x750")
        self.root.minsize(900, 550)
        self.root.configure(bg=BG_DARK)

        self.stats = {}
        self.total_conflicts = 0
        self.running = False
        self.sort_col = "fights"
        self.sort_reverse = True

        self._setup_styles()
        self._build_ui()

    def _setup_styles(self):
        style = ttk.Style()
        style.theme_use("clam")

        style.configure(".", background=BG_DARK, foreground=FG_TEXT, font=("Segoe UI", 10))
        style.configure("Title.TLabel", background=BG_DARK, foreground=FG_GOLD,
                         font=("Segoe UI", 20, "bold"))
        style.configure("Subtitle.TLabel", background=BG_DARK, foreground=FG_DIM,
                         font=("Segoe UI", 10))
        style.configure("Header.TLabel", background=BG_DARK, foreground=FG_TEXT,
                         font=("Segoe UI", 11))
        style.configure("Status.TLabel", background=BG_DARK, foreground=FG_GREEN,
                         font=("Segoe UI", 10))
        style.configure("Info.TLabel", background=BG_DARK, foreground=FG_DIM,
                         font=("Segoe UI", 10))
        style.configure("Card.TFrame", background=BG_CARD)

        style.configure("Load.TButton", background=BTN_BG, foreground="#ffffff",
                         font=("Segoe UI", 11, "bold"), padding=(20, 8))
        style.map("Load.TButton",
                  background=[("active", BTN_HOVER), ("disabled", "#555555")])

        style.configure("Csv.TButton", background=BTN_CSV_BG, foreground=FG_GOLD,
                         font=("Segoe UI", 10), padding=(15, 6))
        style.map("Csv.TButton",
                  background=[("active", "#1a4a7e"), ("disabled", "#333333")])

        style.configure("Custom.Horizontal.TProgressbar",
                         background=FG_ACCENT, troughcolor=BG_MEDIUM, thickness=6)

        style.configure("Treeview",
                         background=ROW_EVEN, foreground=FG_TEXT, fieldbackground=ROW_EVEN,
                         font=("Segoe UI", 10), rowheight=28)
        style.configure("Treeview.Heading",
                         background=BG_CARD, foreground=FG_GOLD,
                         font=("Segoe UI", 10, "bold"), padding=6)
        style.map("Treeview.Heading",
                  background=[("active", "#1a4a7e")])
        style.map("Treeview",
                  background=[("selected", ROW_SELECT)],
                  foreground=[("selected", "#ffffff")])

        style.configure("TCombobox", fieldbackground=ENTRY_BG, background=BG_CARD,
                         foreground=FG_TEXT, arrowcolor=FG_GOLD)

    def _build_ui(self):
        # --- Заголовок ---
        header = tk.Frame(self.root, bg=BG_DARK)
        header.pack(fill=tk.X, padx=20, pady=(15, 5))

        tk.Label(header, text="\u2694  \u0411\u043e\u0442\u0432\u0430 \u041e\u043d\u043b\u0430\u0439\u043d \u2014 \u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u0431\u043e\u0451\u0432 \u0437\u0430 \u0437\u0435\u043c\u043b\u0438",
                 bg=BG_DARK, fg=FG_GOLD, font=("Segoe UI", 18, "bold")).pack(anchor=tk.W)
        tk.Label(header, text="\u0421\u0435\u0440\u0432\u0435\u0440 \u0410\u0432\u0430\u0442\u0430\u0440  \u2022  avatar.botva.ru",
                 bg=BG_DARK, fg=FG_DIM, font=("Segoe UI", 10)).pack(anchor=tk.W)

        # --- Разделитель ---
        tk.Frame(self.root, bg=FG_ACCENT, height=2).pack(fill=tk.X, padx=20, pady=(8, 12))

        # --- Панель управления ---
        ctrl = tk.Frame(self.root, bg=BG_MEDIUM, highlightbackground=BG_CARD,
                        highlightthickness=1)
        ctrl.pack(fill=tk.X, padx=20, pady=(0, 10))

        inner = tk.Frame(ctrl, bg=BG_MEDIUM, padx=15, pady=12)
        inner.pack(fill=tk.X)

        # Дата с
        tk.Label(inner, text="\u0414\u0430\u0442\u0430 \u0441:", bg=BG_MEDIUM, fg=FG_TEXT,
                 font=("Segoe UI", 11)).grid(row=0, column=0, padx=(0, 5))
        self.date_from = tk.Entry(inner, width=12, font=("Segoe UI", 12),
                                   bg=ENTRY_BG, fg=FG_HEADER, insertbackground=FG_GOLD,
                                   relief=tk.FLAT, highlightbackground=BG_CARD,
                                   highlightthickness=1)
        self.date_from.grid(row=0, column=1, padx=(0, 15), ipady=4)
        self.date_from.insert(0, (datetime.now() - timedelta(days=7)).strftime("%d.%m.%Y"))

        # Дата по
        tk.Label(inner, text="\u0414\u0430\u0442\u0430 \u043f\u043e:", bg=BG_MEDIUM, fg=FG_TEXT,
                 font=("Segoe UI", 11)).grid(row=0, column=2, padx=(0, 5))
        self.date_to = tk.Entry(inner, width=12, font=("Segoe UI", 12),
                                 bg=ENTRY_BG, fg=FG_HEADER, insertbackground=FG_GOLD,
                                 relief=tk.FLAT, highlightbackground=BG_CARD,
                                 highlightthickness=1)
        self.date_to.grid(row=0, column=3, padx=(0, 15), ipady=4)
        self.date_to.insert(0, datetime.now().strftime("%d.%m.%Y"))

        # Команда
        tk.Label(inner, text="\u041a\u043e\u043c\u0430\u043d\u0434\u0430:", bg=BG_MEDIUM, fg=FG_TEXT,
                 font=("Segoe UI", 11)).grid(row=0, column=4, padx=(0, 5))
        self.team_var = tk.StringVar(value="\u0412\u0441\u0435")
        self.team_combo = ttk.Combobox(inner, textvariable=self.team_var, width=14,
                                       values=["\u0412\u0441\u0435", "\u0421\u0432\u0438\u043d\u0442\u0443\u0441\u044b", "\u0411\u0430\u0440\u0430\u043d\u0442\u0443\u0441\u044b"],
                                       state="readonly", font=("Segoe UI", 11))
        self.team_combo.grid(row=0, column=5, padx=(0, 20))

        # Кнопка Загрузить
        self.btn_load = ttk.Button(inner, text="\u26a1 \u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c", command=self._on_load,
                                    style="Load.TButton")
        self.btn_load.grid(row=0, column=6, padx=(0, 10))

        # Кнопка CSV
        self.btn_csv = ttk.Button(inner, text="\ud83d\udcbe CSV", command=self._on_csv,
                                   style="Csv.TButton", state=tk.DISABLED)
        self.btn_csv.grid(row=0, column=7, padx=(0, 0))

        # --- Прогресс и статус ---
        status_frame = tk.Frame(self.root, bg=BG_DARK)
        status_frame.pack(fill=tk.X, padx=20, pady=(0, 5))

        self.progress = ttk.Progressbar(status_frame, mode="determinate",
                                         style="Custom.Horizontal.TProgressbar")
        self.progress.pack(fill=tk.X, pady=(0, 4))

        self.status_var = tk.StringVar(value="\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0434\u0430\u0442\u044b \u0438 \u043d\u0430\u0436\u043c\u0438\u0442\u0435 \u00ab\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c\u00bb")
        tk.Label(status_frame, textvariable=self.status_var,
                 bg=BG_DARK, fg=FG_GREEN, font=("Segoe UI", 10)).pack(anchor=tk.W)

        # --- Таблица ---
        table_frame = tk.Frame(self.root, bg=BG_DARK)
        table_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=(0, 5))

        columns = ("num", "name", "fights", "kills", "damage", "healing", "protection", "valor")
        self.tree = ttk.Treeview(table_frame, columns=columns, show="headings", height=25)

        headings = {
            "num": ("\u2116", 45),
            "name": ("\u0418\u043c\u044f \u0438\u0433\u0440\u043e\u043a\u0430", 180),
            "fights": ("\u0411\u043e\u0451\u0432", 65),
            "kills": ("\u0423\u0431\u0438\u0439\u0441\u0442\u0432", 80),
            "damage": ("\u0423\u0440\u043e\u043d", 140),
            "healing": ("\u0425\u0438\u043b", 140),
            "protection": ("\u0417\u0430\u0449\u0438\u0442\u0430", 140),
            "valor": ("\u0414\u043e\u0431\u043b\u0435\u0441\u0442\u044c", 85),
        }
        for col, (text, width) in headings.items():
            sort_arrow = ""
            if col == self.sort_col:
                sort_arrow = " \u25bc" if self.sort_reverse else " \u25b2"
            self.tree.heading(col, text=text + sort_arrow,
                              command=lambda c=col: self._sort_column(c))
            anchor = tk.W if col == "name" else tk.CENTER
            if col in ("damage", "healing", "protection", "valor", "kills", "fights"):
                anchor = tk.E
            self.tree.column(col, width=width, anchor=anchor, minwidth=40)

        scroll_y = ttk.Scrollbar(table_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll_y.set)

        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll_y.pack(side=tk.RIGHT, fill=tk.Y)

        self.tree.tag_configure("even", background=ROW_EVEN)
        self.tree.tag_configure("odd", background=ROW_ODD)

        # --- Нижняя панель ---
        bottom = tk.Frame(self.root, bg=BG_MEDIUM, height=36)
        bottom.pack(fill=tk.X, padx=0, pady=0, side=tk.BOTTOM)

        self.info_var = tk.StringVar()
        tk.Label(bottom, textvariable=self.info_var,
                 bg=BG_MEDIUM, fg=FG_DIM, font=("Segoe UI", 10),
                 padx=20, pady=6).pack(side=tk.LEFT)

        tk.Label(bottom, text="Botva Land Stats v2.0",
                 bg=BG_MEDIUM, fg="#555566", font=("Segoe UI", 9),
                 padx=20, pady=6).pack(side=tk.RIGHT)

    def _log(self, msg):
        self.status_var.set(msg)
        self.root.update_idletasks()

    def _on_load(self):
        if self.running:
            return

        try:
            d_from = datetime.strptime(self.date_from.get().strip(), "%d.%m.%Y")
            d_to = datetime.strptime(self.date_to.get().strip(), "%d.%m.%Y")
        except ValueError:
            messagebox.showerror("\u041e\u0448\u0438\u0431\u043a\u0430", "\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u0444\u043e\u0440\u043c\u0430\u0442 \u0434\u0430\u0442\u044b. \u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u0414\u0414.\u041c\u041c.\u0413\u0413\u0413\u0413")
            return

        if d_from > d_to:
            messagebox.showerror("\u041e\u0448\u0438\u0431\u043a\u0430", "\u0414\u0430\u0442\u0430 \u00ab\u0441\u00bb \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u043f\u043e\u0437\u0436\u0435 \u0434\u0430\u0442\u044b \u00ab\u043f\u043e\u00bb")
            return

        team = self.team_var.get()
        team_filter = None if team == "\u0412\u0441\u0435" else team.lower()

        self.running = True
        self.btn_load.configure(state=tk.DISABLED)
        self.btn_csv.configure(state=tk.DISABLED)
        for item in self.tree.get_children():
            self.tree.delete(item)

        threading.Thread(
            target=self._worker, args=(d_from, d_to, team_filter), daemon=True
        ).start()

    def _worker(self, d_from, d_to, team_filter):
        try:
            latest_id = find_latest_conflict(log_fn=self._log)
            today = datetime.now().replace(hour=23, minute=59, second=59, microsecond=0)

            days_back_to = max(0, (today - d_to).days)
            days_back_from = (today - d_from).days + 1

            end_id = latest_id - int(days_back_to * FIGHTS_PER_DAY)
            start_id = latest_id - int(days_back_from * FIGHTS_PER_DAY)

            margin = int(FIGHTS_PER_DAY * 2)
            start_id -= margin
            if end_id > latest_id:
                end_id = latest_id
            end_id += margin
            if end_id > latest_id:
                end_id = latest_id

            self._log(f"\u0414\u0438\u0430\u043f\u0430\u0437\u043e\u043d ID: {start_id} \u2014 {end_id} ({end_id - start_id + 1} ID \u0434\u043b\u044f \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0438)")

            stats = {}
            total = 0
            skipped = 0
            total_ids = end_id - start_id + 1

            for i, conflict_id in enumerate(range(start_id, end_id + 1)):
                if i > 0:
                    time.sleep(REQUEST_DELAY)

                self._log(f"\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 {i+1}/{total_ids}: conflict={conflict_id}...")
                self.progress["value"] = (i + 1) / total_ids * 100
                self.root.update_idletasks()

                html = fetch_page(conflict_id)

                if html is None or "\u041b\u043e\u0433 \u0431\u043e\u044f \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d" in html:
                    skipped += 1
                    continue

                battle_name, team1_name, team2_name, t1p, t2p = parse_fight_log(html, conflict_id)

                if not t1p and not t2p:
                    skipped += 1
                    continue

                total += 1

                players_to_process = []
                if team_filter:
                    tf = team_filter
                    if tf in team1_name.lower():
                        players_to_process = [(p, team1_name) for p in t1p]
                    elif tf in team2_name.lower():
                        players_to_process = [(p, team2_name) for p in t2p]
                    else:
                        players_to_process = [(p, team1_name) for p in t1p] + [(p, team2_name) for p in t2p]
                else:
                    players_to_process = [(p, team1_name) for p in t1p] + [(p, team2_name) for p in t2p]

                for player, team in players_to_process:
                    name = player["name"]
                    if name not in stats:
                        stats[name] = PlayerStats(name=name)
                    s = stats[name]
                    s.fights += 1
                    s.kills += player["kills"]
                    s.damage += player["damage"]
                    s.healing += player["healing"]
                    s.protection += player["protection"]
                    s.valor_points += player["valor"]
                    s.fights_list.append(conflict_id)

            self.stats = stats
            self.total_conflicts = total

            self.root.after(0, lambda: self._show_results(stats, total, skipped))

        except Exception as e:
            self.root.after(0, lambda: messagebox.showerror("\u041e\u0448\u0438\u0431\u043a\u0430", str(e)))
        finally:
            self.running = False
            self.root.after(0, lambda: self.btn_load.configure(state=tk.NORMAL))

    def _show_results(self, stats, total, skipped):
        for item in self.tree.get_children():
            self.tree.delete(item)

        sort_map = {
            "num": lambda s: s.fights,
            "name": lambda s: s.name.lower(),
            "fights": lambda s: s.fights,
            "kills": lambda s: s.kills,
            "damage": lambda s: s.damage,
            "healing": lambda s: s.healing,
            "protection": lambda s: s.protection,
            "valor": lambda s: s.valor_points,
        }

        key_fn = sort_map.get(self.sort_col, sort_map["fights"])
        sorted_players = sorted(stats.values(), key=key_fn, reverse=self.sort_reverse)

        for i, p in enumerate(sorted_players, 1):
            tag = "even" if i % 2 == 0 else "odd"
            self.tree.insert("", tk.END, values=(
                i, p.name, p.fights, p.kills,
                format_number(p.damage),
                format_number(p.healing),
                format_number(p.protection),
                p.valor_points,
            ), tags=(tag,))

        self.info_var.set(
            f"\u0411\u043e\u0451\u0432 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u0430\u043d\u043e: {total}   |   \u041f\u0440\u043e\u043f\u0443\u0449\u0435\u043d\u043e: {skipped}   |   \u0418\u0433\u0440\u043e\u043a\u043e\u0432: {len(stats)}"
        )
        self._log(f"\u0413\u043e\u0442\u043e\u0432\u043e! \u041d\u0430\u0439\u0434\u0435\u043d\u043e {total} \u0431\u043e\u0451\u0432, {len(stats)} \u0438\u0433\u0440\u043e\u043a\u043e\u0432")
        self.progress["value"] = 100
        if stats:
            self.btn_csv.configure(state=tk.NORMAL)

    def _sort_column(self, col):
        if not self.stats:
            return

        if col == self.sort_col:
            self.sort_reverse = not self.sort_reverse
        else:
            self.sort_col = col
            self.sort_reverse = col != "name"

        columns_cfg = {
            "num": ("\u2116", 45),
            "name": ("\u0418\u043c\u044f \u0438\u0433\u0440\u043e\u043a\u0430", 180),
            "fights": ("\u0411\u043e\u0451\u0432", 65),
            "kills": ("\u0423\u0431\u0438\u0439\u0441\u0442\u0432", 80),
            "damage": ("\u0423\u0440\u043e\u043d", 140),
            "healing": ("\u0425\u0438\u043b", 140),
            "protection": ("\u0417\u0430\u0449\u0438\u0442\u0430", 140),
            "valor": ("\u0414\u043e\u0431\u043b\u0435\u0441\u0442\u044c", 85),
        }
        for c, (text, _) in columns_cfg.items():
            arrow = ""
            if c == self.sort_col:
                arrow = " \u25bc" if self.sort_reverse else " \u25b2"
            self.tree.heading(c, text=text + arrow)

        self._show_results(self.stats, self.total_conflicts, 0)

    def _on_csv(self):
        if not self.stats:
            return

        path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV \u0444\u0430\u0439\u043b\u044b", "*.csv"), ("\u0412\u0441\u0435 \u0444\u0430\u0439\u043b\u044b", "*.*")],
            title="\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0443 \u0432 CSV"
        )
        if not path:
            return

        sorted_players = sorted(self.stats.values(), key=lambda s: s.fights, reverse=True)

        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f, delimiter=";")
            writer.writerow(["\u2116", "\u0418\u043c\u044f", "\u0411\u043e\u0451\u0432", "\u0423\u0431\u0438\u0439\u0441\u0442\u0432", "\u0423\u0440\u043e\u043d", "\u0425\u0438\u043b", "\u0417\u0430\u0449\u0438\u0442\u0430", "\u0414\u043e\u0431\u043b\u0435\u0441\u0442\u044c", "ID \u0431\u043e\u0451\u0432"])
            for i, p in enumerate(sorted_players, 1):
                writer.writerow([
                    i, p.name, p.fights, p.kills,
                    p.damage, p.healing, p.protection, p.valor_points,
                    ",".join(str(x) for x in p.fights_list),
                ])

        self._log(f"CSV \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d: {path}")
        messagebox.showinfo("\u0413\u043e\u0442\u043e\u0432\u043e", f"\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0430:\n{path}")


def main():
    root = tk.Tk()
    app = BotvaStatsApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
