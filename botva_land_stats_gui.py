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
REQUEST_DELAY = 0.5
SEARCH_STEP = 50
FIGHTS_PER_DAY = 3


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
        time.sleep(0.2)

    latest = probe
    for cid in range(probe + 1, probe + SEARCH_STEP):
        if page_exists(cid):
            latest = cid
        else:
            break
        time.sleep(0.2)

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
    winner = title_match.group(1).strip() if title_match else ""
    loser = title_match.group(2).strip() if title_match else ""

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


class BotvaStatsApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Ботва Онлайн — Статистика боёв за земли (Аватар)")
        self.root.geometry("950x700")
        self.root.minsize(800, 500)

        self.stats = {}
        self.total_conflicts = 0
        self.running = False

        self._build_ui()

    def _build_ui(self):
        top = ttk.Frame(self.root, padding=10)
        top.pack(fill=tk.X)

        ttk.Label(top, text="Дата с:", font=("Arial", 11)).grid(row=0, column=0, padx=5)
        self.date_from = ttk.Entry(top, width=12, font=("Arial", 11))
        self.date_from.grid(row=0, column=1, padx=5)
        self.date_from.insert(0, (datetime.now() - timedelta(days=7)).strftime("%d.%m.%Y"))

        ttk.Label(top, text="Дата по:", font=("Arial", 11)).grid(row=0, column=2, padx=5)
        self.date_to = ttk.Entry(top, width=12, font=("Arial", 11))
        self.date_to.grid(row=0, column=3, padx=5)
        self.date_to.insert(0, datetime.now().strftime("%d.%m.%Y"))

        ttk.Label(top, text="Команда:", font=("Arial", 11)).grid(row=0, column=4, padx=5)
        self.team_var = tk.StringVar(value="Все")
        self.team_combo = ttk.Combobox(top, textvariable=self.team_var, width=14,
                                       values=["Все", "Свинтусы", "Барантусы"],
                                       state="readonly", font=("Arial", 11))
        self.team_combo.grid(row=0, column=5, padx=5)

        self.btn_load = ttk.Button(top, text="Загрузить", command=self._on_load)
        self.btn_load.grid(row=0, column=6, padx=10)

        self.btn_csv = ttk.Button(top, text="Сохранить CSV", command=self._on_csv, state=tk.DISABLED)
        self.btn_csv.grid(row=0, column=7, padx=5)

        self.progress = ttk.Progressbar(self.root, mode="determinate")
        self.progress.pack(fill=tk.X, padx=10, pady=(5, 0))

        self.status_var = tk.StringVar(value="Введите даты и нажмите «Загрузить»")
        ttk.Label(self.root, textvariable=self.status_var, font=("Arial", 10)).pack(
            fill=tk.X, padx=10, pady=2
        )

        columns = ("num", "name", "fights", "kills", "damage", "healing", "protection", "valor")
        self.tree = ttk.Treeview(self.root, columns=columns, show="headings", height=20)

        headings = {
            "num": ("№", 40),
            "name": ("Имя", 160),
            "fights": ("Боёв", 60),
            "kills": ("Убийств", 70),
            "damage": ("Урон", 150),
            "healing": ("Хил", 150),
            "protection": ("Защита", 150),
            "valor": ("Доблесть", 80),
        }
        for col, (text, width) in headings.items():
            self.tree.heading(col, text=text, command=lambda c=col: self._sort_column(c))
            anchor = tk.W if col in ("name",) else tk.E
            if col == "num":
                anchor = tk.CENTER
            self.tree.column(col, width=width, anchor=anchor, minwidth=40)

        scroll = ttk.Scrollbar(self.root, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)
        self.tree.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)

        bottom = ttk.Frame(self.root, padding=5)
        bottom.pack(fill=tk.X)
        self.info_var = tk.StringVar()
        ttk.Label(bottom, textvariable=self.info_var, font=("Arial", 10)).pack()

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
            messagebox.showerror("Ошибка", "Неверный формат даты. Используйте ДД.ММ.ГГГГ")
            return

        if d_from > d_to:
            messagebox.showerror("Ошибка", "Дата «с» не может быть позже даты «по»")
            return

        team = self.team_var.get()
        team_filter = None if team == "Все" else team.lower()

        self.running = True
        self.btn_load.configure(state=tk.DISABLED)
        self.btn_csv.configure(state=tk.DISABLED)

        threading.Thread(
            target=self._worker, args=(d_from, d_to, team_filter), daemon=True
        ).start()

    def _worker(self, d_from, d_to, team_filter):
        try:
            latest_id = find_latest_conflict(log_fn=self._log)
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

            days_back_to = (today - d_to).days
            days_back_from = (today - d_from).days

            end_id = latest_id - int(days_back_to * FIGHTS_PER_DAY)
            start_id = latest_id - int(days_back_from * FIGHTS_PER_DAY)

            if end_id > latest_id:
                end_id = latest_id

            self._log(f"Диапазон ID: {start_id} — {end_id} (примерно {end_id - start_id + 1} боёв)")

            stats = {}
            total = 0
            skipped = 0
            total_ids = end_id - start_id + 1

            for i, conflict_id in enumerate(range(start_id, end_id + 1)):
                if i > 0:
                    time.sleep(REQUEST_DELAY)

                self._log(f"Загрузка {i+1}/{total_ids}: conflict={conflict_id}...")
                self.progress["value"] = (i + 1) / total_ids * 100
                self.root.update_idletasks()

                html = fetch_page(conflict_id)

                if html is None or "Лог боя не найден" in html:
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
            self.root.after(0, lambda: messagebox.showerror("Ошибка", str(e)))
        finally:
            self.running = False
            self.root.after(0, lambda: self.btn_load.configure(state=tk.NORMAL))

    def _show_results(self, stats, total, skipped):
        for item in self.tree.get_children():
            self.tree.delete(item)

        sorted_players = sorted(stats.values(), key=lambda s: s.fights, reverse=True)

        for i, p in enumerate(sorted_players, 1):
            self.tree.insert("", tk.END, values=(
                i, p.name, p.fights, p.kills,
                format_number(p.damage),
                format_number(p.healing),
                format_number(p.protection),
                p.valor_points,
            ))

        self.info_var.set(f"Обработано боёв: {total} | Пропущено: {skipped} | Игроков: {len(stats)}")
        self._log("Готово!")
        self.progress["value"] = 100
        if stats:
            self.btn_csv.configure(state=tk.NORMAL)

    def _sort_column(self, col):
        if not self.stats:
            return

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

        reverse = col != "name"
        sorted_players = sorted(self.stats.values(), key=sort_map.get(col, sort_map["fights"]), reverse=reverse)

        for item in self.tree.get_children():
            self.tree.delete(item)

        for i, p in enumerate(sorted_players, 1):
            self.tree.insert("", tk.END, values=(
                i, p.name, p.fights, p.kills,
                format_number(p.damage),
                format_number(p.healing),
                format_number(p.protection),
                p.valor_points,
            ))

    def _on_csv(self):
        if not self.stats:
            return

        path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV файлы", "*.csv"), ("Все файлы", "*.*")],
            title="Сохранить статистику в CSV"
        )
        if not path:
            return

        sorted_players = sorted(self.stats.values(), key=lambda s: s.fights, reverse=True)

        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f, delimiter=";")
            writer.writerow(["№", "Имя", "Боёв", "Убийств", "Урон", "Хил", "Защита", "Доблесть", "ID боёв"])
            for i, p in enumerate(sorted_players, 1):
                writer.writerow([
                    i, p.name, p.fights, p.kills,
                    p.damage, p.healing, p.protection, p.valor_points,
                    ",".join(str(x) for x in p.fights_list),
                ])

        self._log(f"CSV сохранён: {path}")
        messagebox.showinfo("Готово", f"Статистика сохранена:\n{path}")


def main():
    root = tk.Tk()
    app = BotvaStatsApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
