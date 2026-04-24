"""Tkinter GUI for Botva AutoClicker."""

import json
import threading
import time
import random
import logging
import os
from datetime import datetime
from tkinter import (
    Tk, Frame, Label, Entry, Button, Text, Scrollbar,
    Checkbutton, BooleanVar, StringVar, IntVar, DoubleVar,
    LEFT, RIGHT, BOTH, END, X, Y, W, E, N, S, WORD, DISABLED, NORMAL,
    ttk, messagebox,
)

from .browser import BotvaBot, SERVERS

logger = logging.getLogger("botva")

CONFIG_FILE = os.path.join(os.path.expanduser("~"), ".botva_autoclicker.json")

DEFAULT_CONFIG = {
    "username": "",
    "password": "",
    "server": "Адын",
    "headless": False,
    "attack_enabled": False,
    "attack_min_level": 1,
    "attack_max_level": 99,
    "attack_interval": 15,
    "heal_enabled": False,
    "heal_threshold": 30,
    "heal_interval": 10,
    "farm_enabled": False,
    "farm_interval": 60,
    "patrol_enabled": False,
    "patrol_interval": 60,
    "mine_enabled": False,
    "mine_interval": 60,
    "random_delay": 3,
}


class BotvaGUI:
    """Main application window."""

    def __init__(self) -> None:
        self.bot = BotvaBot()
        self.running = False
        self.thread: threading.Thread | None = None
        self.stats = {
            "attacks": 0, "wins": 0, "losses": 0,
            "heals": 0, "farms": 0, "patrols": 0, "mines": 0,
        }

        self.root = Tk()
        self.root.title("Botva AutoClicker v1.0")
        self.root.geometry("520x720")
        self.root.resizable(False, False)
        self.root.configure(bg="#1a1a2e")

        self._create_vars()
        self._load_config()
        self._build_ui()

    # ------------------------------------------------------------------
    #  Config
    # ------------------------------------------------------------------
    def _create_vars(self) -> None:
        self.v_user = StringVar()
        self.v_pass = StringVar()
        self.v_server = StringVar(value="Адын")
        self.v_headless = BooleanVar(value=False)

        self.v_attack = BooleanVar()
        self.v_atk_min = IntVar(value=1)
        self.v_atk_max = IntVar(value=99)
        self.v_atk_int = IntVar(value=15)

        self.v_heal = BooleanVar()
        self.v_heal_thr = IntVar(value=30)
        self.v_heal_int = IntVar(value=10)

        self.v_farm = BooleanVar()
        self.v_farm_int = IntVar(value=60)

        self.v_patrol = BooleanVar()
        self.v_patrol_int = IntVar(value=60)

        self.v_mine = BooleanVar()
        self.v_mine_int = IntVar(value=60)

        self.v_rnd_delay = DoubleVar(value=3.0)

    def _load_config(self) -> None:
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                cfg = json.load(f)
        except Exception:
            cfg = {}
        c = {**DEFAULT_CONFIG, **cfg}
        self.v_user.set(c["username"])
        self.v_pass.set(c["password"])
        self.v_server.set(c["server"])
        self.v_headless.set(c["headless"])
        self.v_attack.set(c["attack_enabled"])
        self.v_atk_min.set(c["attack_min_level"])
        self.v_atk_max.set(c["attack_max_level"])
        self.v_atk_int.set(c["attack_interval"])
        self.v_heal.set(c["heal_enabled"])
        self.v_heal_thr.set(c["heal_threshold"])
        self.v_heal_int.set(c["heal_interval"])
        self.v_farm.set(c["farm_enabled"])
        self.v_farm_int.set(c["farm_interval"])
        self.v_patrol.set(c["patrol_enabled"])
        self.v_patrol_int.set(c["patrol_interval"])
        self.v_mine.set(c["mine_enabled"])
        self.v_mine_int.set(c["mine_interval"])
        self.v_rnd_delay.set(c["random_delay"])

    def _save_config(self) -> None:
        cfg = {
            "username": self.v_user.get(),
            "password": self.v_pass.get(),
            "server": self.v_server.get(),
            "headless": self.v_headless.get(),
            "attack_enabled": self.v_attack.get(),
            "attack_min_level": self.v_atk_min.get(),
            "attack_max_level": self.v_atk_max.get(),
            "attack_interval": self.v_atk_int.get(),
            "heal_enabled": self.v_heal.get(),
            "heal_threshold": self.v_heal_thr.get(),
            "heal_interval": self.v_heal_int.get(),
            "farm_enabled": self.v_farm.get(),
            "farm_interval": self.v_farm_int.get(),
            "patrol_enabled": self.v_patrol.get(),
            "patrol_interval": self.v_patrol_int.get(),
            "mine_enabled": self.v_mine.get(),
            "mine_interval": self.v_mine_int.get(),
            "random_delay": self.v_rnd_delay.get(),
        }
        try:
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(cfg, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    # ------------------------------------------------------------------
    #  UI helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _style_frame(frame: Frame) -> None:
        frame.configure(bg="#16213e", bd=1, relief="groove", padx=8, pady=6)

    def _label(self, parent: Frame, text: str, **kw) -> Label:
        return Label(parent, text=text, bg="#16213e", fg="#bbbbbb",
                     font=("Segoe UI", 9), anchor=W, **kw)

    def _entry(self, parent: Frame, var, show: str = "", width: int = 18) -> Entry:
        return Entry(parent, textvariable=var, width=width, show=show,
                     bg="#0f3460", fg="#e0e0e0", insertbackground="#e0e0e0",
                     font=("Segoe UI", 9), bd=0, relief="flat")

    def _small_entry(self, parent: Frame, var, width: int = 6) -> Entry:
        return Entry(parent, textvariable=var, width=width,
                     bg="#0f3460", fg="#e0e0e0", insertbackground="#e0e0e0",
                     font=("Segoe UI", 9), bd=0, relief="flat", justify="center")

    def _check(self, parent: Frame, text: str, var: BooleanVar) -> Checkbutton:
        return Checkbutton(parent, text=text, variable=var,
                           bg="#16213e", fg="#cccccc", selectcolor="#0f3460",
                           activebackground="#16213e", activeforeground="#ffffff",
                           font=("Segoe UI", 9))

    # ------------------------------------------------------------------
    #  Build UI
    # ------------------------------------------------------------------
    def _build_ui(self) -> None:
        main = Frame(self.root, bg="#1a1a2e", padx=10, pady=8)
        main.pack(fill=BOTH, expand=True)

        # Title
        Label(main, text="BOTVA AUTOCLICKER",
              bg="#1a1a2e", fg="#ffffff",
              font=("Segoe UI", 16, "bold")).pack(pady=(0, 8))

        # --- Notebook (tabs) ---
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("TNotebook", background="#1a1a2e", borderwidth=0)
        style.configure("TNotebook.Tab", background="#16213e", foreground="#aaaaaa",
                        font=("Segoe UI", 9, "bold"), padding=[12, 4])
        style.map("TNotebook.Tab",
                  background=[("selected", "#533483")],
                  foreground=[("selected", "#ffffff")])
        style.configure("TFrame", background="#1a1a2e")

        nb = ttk.Notebook(main)
        nb.pack(fill=BOTH, expand=True)

        tab_login = Frame(nb, bg="#1a1a2e", padx=6, pady=6)
        tab_modules = Frame(nb, bg="#1a1a2e", padx=6, pady=6)
        tab_log = Frame(nb, bg="#1a1a2e", padx=6, pady=6)
        tab_stats = Frame(nb, bg="#1a1a2e", padx=6, pady=6)

        nb.add(tab_login, text="  Вход  ")
        nb.add(tab_modules, text="  Модули  ")
        nb.add(tab_log, text="  Лог  ")
        nb.add(tab_stats, text="  Стат  ")

        self._build_login_tab(tab_login)
        self._build_modules_tab(tab_modules)
        self._build_log_tab(tab_log)
        self._build_stats_tab(tab_stats)

        # --- Bottom controls ---
        ctrl = Frame(main, bg="#1a1a2e", pady=6)
        ctrl.pack(fill=X)

        self.btn_start = Button(
            ctrl, text="ЗАПУСТИТЬ", font=("Segoe UI", 11, "bold"),
            bg="#28a745", fg="#ffffff", activebackground="#20c997",
            bd=0, padx=20, pady=6, command=self._toggle_bot,
        )
        self.btn_start.pack(fill=X)

        self.lbl_status = Label(
            main, text="ОСТАНОВЛЕН", bg="#1a1a2e", fg="#dc3545",
            font=("Segoe UI", 10, "bold"),
        )
        self.lbl_status.pack(pady=(4, 0))

    def _build_login_tab(self, parent: Frame) -> None:
        f = Frame(parent, bg="#16213e", bd=1, relief="groove", padx=10, pady=10)
        f.pack(fill=X, pady=4)
        Label(f, text="АВТОРИЗАЦИЯ", bg="#16213e", fg="#ffffff",
              font=("Segoe UI", 10, "bold")).grid(row=0, column=0, columnspan=2, pady=(0, 8))

        self._label(f, "Логин:").grid(row=1, column=0, sticky=W, pady=2)
        self._entry(f, self.v_user).grid(row=1, column=1, sticky=E, pady=2)

        self._label(f, "Пароль:").grid(row=2, column=0, sticky=W, pady=2)
        self._entry(f, self.v_pass, show="*").grid(row=2, column=1, sticky=E, pady=2)

        self._label(f, "Сервер:").grid(row=3, column=0, sticky=W, pady=2)
        srv = ttk.Combobox(f, textvariable=self.v_server,
                           values=list(SERVERS.keys()), state="readonly", width=16)
        srv.grid(row=3, column=1, sticky=E, pady=2)

        self._check(f, "Скрытый режим (headless)", self.v_headless).grid(
            row=4, column=0, columnspan=2, sticky=W, pady=4)

        # General settings
        f2 = Frame(parent, bg="#16213e", bd=1, relief="groove", padx=10, pady=10)
        f2.pack(fill=X, pady=4)
        Label(f2, text="ОБЩИЕ НАСТРОЙКИ", bg="#16213e", fg="#ffffff",
              font=("Segoe UI", 10, "bold")).grid(row=0, column=0, columnspan=2, pady=(0, 8))

        self._label(f2, "Случайная задержка (сек):").grid(row=1, column=0, sticky=W, pady=2)
        self._small_entry(f2, self.v_rnd_delay).grid(row=1, column=1, sticky=E, pady=2)

    def _build_modules_tab(self, parent: Frame) -> None:
        canvas_frame = Frame(parent, bg="#1a1a2e")
        canvas_frame.pack(fill=BOTH, expand=True)

        # --- Attack ---
        f = Frame(canvas_frame, bg="#16213e", bd=1, relief="groove", padx=8, pady=6)
        f.pack(fill=X, pady=3)
        self._check(f, "Авто-Атака", self.v_attack).grid(row=0, column=0, columnspan=2, sticky=W)
        self._label(f, "Ур. от:").grid(row=1, column=0, sticky=W)
        self._small_entry(f, self.v_atk_min).grid(row=1, column=1, sticky=E)
        self._label(f, "Ур. до:").grid(row=2, column=0, sticky=W)
        self._small_entry(f, self.v_atk_max).grid(row=2, column=1, sticky=E)
        self._label(f, "Интервал (сек):").grid(row=3, column=0, sticky=W)
        self._small_entry(f, self.v_atk_int).grid(row=3, column=1, sticky=E)

        # --- Heal ---
        f = Frame(canvas_frame, bg="#16213e", bd=1, relief="groove", padx=8, pady=6)
        f.pack(fill=X, pady=3)
        self._check(f, "Авто-Лечение", self.v_heal).grid(row=0, column=0, columnspan=2, sticky=W)
        self._label(f, "Лечить при HP ниже %:").grid(row=1, column=0, sticky=W)
        self._small_entry(f, self.v_heal_thr).grid(row=1, column=1, sticky=E)
        self._label(f, "Интервал (сек):").grid(row=2, column=0, sticky=W)
        self._small_entry(f, self.v_heal_int).grid(row=2, column=1, sticky=E)

        # --- Farm ---
        f = Frame(canvas_frame, bg="#16213e", bd=1, relief="groove", padx=8, pady=6)
        f.pack(fill=X, pady=3)
        self._check(f, "Авто-Ферма", self.v_farm).grid(row=0, column=0, columnspan=2, sticky=W)
        self._label(f, "Интервал (сек):").grid(row=1, column=0, sticky=W)
        self._small_entry(f, self.v_farm_int).grid(row=1, column=1, sticky=E)

        # --- Patrol ---
        f = Frame(canvas_frame, bg="#16213e", bd=1, relief="groove", padx=8, pady=6)
        f.pack(fill=X, pady=3)
        self._check(f, "Авто-Дозор", self.v_patrol).grid(row=0, column=0, columnspan=2, sticky=W)
        self._label(f, "Интервал (сек):").grid(row=1, column=0, sticky=W)
        self._small_entry(f, self.v_patrol_int).grid(row=1, column=1, sticky=E)

        # --- Mine ---
        f = Frame(canvas_frame, bg="#16213e", bd=1, relief="groove", padx=8, pady=6)
        f.pack(fill=X, pady=3)
        self._check(f, "Авто-Шахта", self.v_mine).grid(row=0, column=0, columnspan=2, sticky=W)
        self._label(f, "Интервал (сек):").grid(row=1, column=0, sticky=W)
        self._small_entry(f, self.v_mine_int).grid(row=1, column=1, sticky=E)

    def _build_log_tab(self, parent: Frame) -> None:
        self.log_text = Text(
            parent, bg="#0a0a1a", fg="#88cc88", font=("Consolas", 9),
            wrap=WORD, state=DISABLED, height=20, bd=0,
        )
        scroll = Scrollbar(parent, command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=scroll.set)
        scroll.pack(side=RIGHT, fill=Y)
        self.log_text.pack(fill=BOTH, expand=True)

    def _build_stats_tab(self, parent: Frame) -> None:
        f = Frame(parent, bg="#16213e", bd=1, relief="groove", padx=10, pady=10)
        f.pack(fill=X, pady=4)
        Label(f, text="СТАТИСТИКА СЕССИИ", bg="#16213e", fg="#ffffff",
              font=("Segoe UI", 10, "bold")).pack(pady=(0, 8))

        grid = Frame(f, bg="#16213e")
        grid.pack()

        labels = [
            ("Атак", "attacks"), ("Побед", "wins"), ("Поражений", "losses"),
            ("Лечений", "heals"), ("Ферма", "farms"),
            ("Дозоров", "patrols"), ("Шахта", "mines"),
        ]
        self.stat_labels = {}
        for i, (text, key) in enumerate(labels):
            row, col = divmod(i, 3)
            cf = Frame(grid, bg="#0f3460", padx=12, pady=8)
            cf.grid(row=row, column=col, padx=4, pady=4)
            lbl_val = Label(cf, text="0", bg="#0f3460", fg="#ffffff",
                            font=("Segoe UI", 16, "bold"))
            lbl_val.pack()
            Label(cf, text=text, bg="#0f3460", fg="#888888",
                  font=("Segoe UI", 8)).pack()
            self.stat_labels[key] = lbl_val

    # ------------------------------------------------------------------
    #  Logging
    # ------------------------------------------------------------------
    def _log(self, msg: str) -> None:
        ts = datetime.now().strftime("%H:%M:%S")
        line = f"[{ts}] {msg}\n"
        self.root.after(0, self._append_log, line)

    def _append_log(self, line: str) -> None:
        self.log_text.configure(state=NORMAL)
        self.log_text.insert(END, line)
        self.log_text.see(END)
        self.log_text.configure(state=DISABLED)

    def _update_stats(self) -> None:
        def _do() -> None:
            for key, lbl in self.stat_labels.items():
                lbl.configure(text=str(self.stats.get(key, 0)))
        self.root.after(0, _do)

    # ------------------------------------------------------------------
    #  Bot control
    # ------------------------------------------------------------------
    def _toggle_bot(self) -> None:
        if self.running:
            self._stop_bot()
        else:
            self._start_bot()

    def _start_bot(self) -> None:
        username = self.v_user.get().strip()
        password = self.v_pass.get().strip()
        if not username or not password:
            messagebox.showwarning("Внимание", "Введите логин и пароль!")
            return

        self._save_config()
        self.running = True
        self.btn_start.configure(text="ОСТАНОВИТЬ", bg="#dc3545",
                                 activebackground="#e74c3c")
        self.lbl_status.configure(text="РАБОТАЕТ", fg="#28a745")
        self.stats = {k: 0 for k in self.stats}
        self._update_stats()

        self.thread = threading.Thread(target=self._bot_loop, daemon=True)
        self.thread.start()

    def _stop_bot(self) -> None:
        self.running = False
        self.btn_start.configure(text="ЗАПУСТИТЬ", bg="#28a745",
                                 activebackground="#20c997")
        self.lbl_status.configure(text="ОСТАНОВЛЕН", fg="#dc3545")
        self._log("Бот остановлен")
        self.bot.stop_browser()

    def _bot_loop(self) -> None:
        self._log("Запуск браузера...")
        try:
            self.bot.start_browser(headless=self.v_headless.get())
        except Exception as exc:
            self._log(f"Ошибка запуска браузера: {exc}")
            self.root.after(0, self._stop_bot)
            return

        self._log("Выполняю вход...")
        ok = self.bot.login(self.v_user.get(), self.v_pass.get(), self.v_server.get())
        if not ok:
            self._log("Не удалось войти в игру")
            self.root.after(0, self._stop_bot)
            return
        self._log("Вход выполнен!")

        timers = {
            "attack": 0, "heal": 0, "farm": 0, "patrol": 0, "mine": 0,
        }

        while self.running:
            now = time.time()
            rnd_extra = random.uniform(0, self.v_rnd_delay.get())

            # Attack
            if self.v_attack.get() and now >= timers["attack"]:
                self._log("Атака...")
                result = self.bot.do_attack(self.v_atk_min.get(), self.v_atk_max.get())
                self._log(f"Атака: {result}")
                self.stats["attacks"] += 1
                if "Победа" in result:
                    self.stats["wins"] += 1
                elif "Поражение" in result:
                    self.stats["losses"] += 1
                self._update_stats()
                timers["attack"] = now + self.v_atk_int.get() + rnd_extra

            # Heal
            if self.v_heal.get() and now >= timers["heal"]:
                hp = self.bot.get_hp_percent()
                if hp < self.v_heal_thr.get():
                    self._log(f"HP {hp}% — лечусь...")
                    result = self.bot.do_heal()
                    self._log(f"Лечение: {result}")
                    if "использовано" in result:
                        self.stats["heals"] += 1
                    self._update_stats()
                timers["heal"] = now + self.v_heal_int.get() + rnd_extra

            # Farm
            if self.v_farm.get() and now >= timers["farm"]:
                self._log("Ферма...")
                result = self.bot.do_farm()
                self._log(f"Ферма: {result}")
                if "собраны" in result:
                    self.stats["farms"] += 1
                self._update_stats()
                timers["farm"] = now + self.v_farm_int.get() + rnd_extra

            # Patrol
            if self.v_patrol.get() and now >= timers["patrol"]:
                self._log("Дозор...")
                result = self.bot.do_patrol()
                self._log(f"Дозор: {result}")
                if "начат" in result:
                    self.stats["patrols"] += 1
                self._update_stats()
                timers["patrol"] = now + self.v_patrol_int.get() + rnd_extra

            # Mine
            if self.v_mine.get() and now >= timers["mine"]:
                self._log("Шахта...")
                result = self.bot.do_mine()
                self._log(f"Шахта: {result}")
                if "начата" in result:
                    self.stats["mines"] += 1
                self._update_stats()
                timers["mine"] = now + self.v_mine_int.get() + rnd_extra

            time.sleep(1)

        self.bot.stop_browser()

    # ------------------------------------------------------------------
    #  Run
    # ------------------------------------------------------------------
    def run(self) -> None:
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)
        self.root.mainloop()

    def _on_close(self) -> None:
        self._save_config()
        if self.running:
            self.running = False
            self.bot.stop_browser()
        self.root.destroy()
