"""
Main application window – embeds the browser and all control panels.
"""

from PyQt5.QtCore import Qt
from PyQt5.QtWidgets import (
    QCheckBox,
    QComboBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QPlainTextEdit,
    QPushButton,
    QScrollArea,
    QSplitter,
    QVBoxLayout,
    QWidget,
)

from .browser_widget import GameBrowser
from .controls.avatar_panel import AvatarPanel
from .controls.base_panel import BasePanel
from .controls.fortress_panel import FortressPanel
from .controls.mine_panel import MinePanel
from .engine.clicker import ClickerEngine


class MainWindow(QMainWindow):
    """Top-level window for the Botva auto-clicker."""

    WINDOW_TITLE = "Авто кликер Ботва"

    def __init__(self):
        super().__init__()
        self.setWindowTitle(self.WINDOW_TITLE)
        self.resize(1400, 850)

        # Central widget
        central = QWidget()
        self.setCentralWidget(central)
        root_layout = QHBoxLayout(central)
        root_layout.setContentsMargins(4, 4, 4, 4)

        # ---- Left: controls ----
        controls_widget = self._build_controls()
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setWidget(controls_widget)
        scroll.setMinimumWidth(320)
        scroll.setMaximumWidth(500)

        # ---- Right: browser ----
        browser_panel = self._build_browser_panel()

        splitter = QSplitter(Qt.Horizontal)
        splitter.addWidget(scroll)
        splitter.addWidget(browser_panel)
        splitter.setStretchFactor(0, 0)
        splitter.setStretchFactor(1, 1)

        root_layout.addWidget(splitter)

        # ---- Engine ----
        self.engine = ClickerEngine(self.browser, self)
        self.engine.status_update.connect(self._log)
        self._connect_checkboxes()

    # ==================================================================
    # UI builders
    # ==================================================================

    def _build_browser_panel(self) -> QWidget:
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 0, 0, 0)

        # Top toolbar
        tb = QHBoxLayout()
        self.url_edit = QLineEdit("https://botva.ru/")
        self.btn_go = QPushButton("Go")
        self.btn_go.setFixedWidth(40)
        self.btn_go.clicked.connect(self._on_go)

        self.server_combo = QComboBox()
        self.server_combo.addItems(["Аватар", "Призрак", "Зомби"])

        tb.addWidget(self.url_edit)
        tb.addWidget(self.btn_go)
        tb.addWidget(QLabel("Сервер:"))
        tb.addWidget(self.server_combo)
        layout.addLayout(tb)

        # Browser
        self.browser = GameBrowser()
        layout.addWidget(self.browser, stretch=1)

        return panel

    def _build_controls(self) -> QWidget:
        w = QWidget()
        layout = QVBoxLayout(w)
        layout.setContentsMargins(2, 2, 2, 2)
        layout.setSpacing(2)

        # Login row
        login_row = QHBoxLayout()
        self.login_edit = QLineEdit()
        self.login_edit.setPlaceholderText("Логин")
        self.pass_edit = QLineEdit()
        self.pass_edit.setPlaceholderText("Пароль")
        self.pass_edit.setEchoMode(QLineEdit.Password)
        self.btn_login = QPushButton("Войти")
        self.btn_login.clicked.connect(self._on_login)
        login_row.addWidget(self.login_edit)
        login_row.addWidget(self.pass_edit)
        login_row.addWidget(self.btn_login)
        layout.addLayout(login_row)

        # Start / stop row
        ctrl_row = QHBoxLayout()
        self.cb_go = QCheckBox("Поехали")
        self.cb_go.stateChanged.connect(self._on_go_toggle)
        ctrl_row.addWidget(self.cb_go)
        ctrl_row.addStretch()
        layout.addLayout(ctrl_row)

        # Panels
        self.base_panel = BasePanel()
        self.mine_panel = MinePanel()
        self.fortress_panel = FortressPanel()
        self.avatar_panel = AvatarPanel()

        layout.addWidget(self.base_panel)
        layout.addWidget(self.mine_panel)
        layout.addWidget(self.fortress_panel)
        layout.addWidget(self.avatar_panel)

        # Status log
        self.log_view = QPlainTextEdit()
        self.log_view.setReadOnly(True)
        self.log_view.setMaximumHeight(120)
        self.log_view.setPlaceholderText("Статус:")
        layout.addWidget(self.log_view)

        layout.addStretch()
        return w

    # ==================================================================
    # Slots
    # ==================================================================

    def _on_go(self):
        url = self.url_edit.text().strip()
        if url and not url.startswith("http"):
            url = "https://" + url
        self.browser.navigate(url)

    def _on_login(self):
        login = self.login_edit.text().strip()
        password = self.pass_edit.text().strip()
        if not login or not password:
            self._log("[Логин] Введите логин и пароль")
            return
        js = (
            f"botva.fillInput('input[name=\"login\"]', '{login}');"
            f"botva.fillInput('input[name=\"pass\"]', '{password}');"
            f"botva.submitForm('form');"
        )
        self.browser.inject_js(js)
        self._log(f"[Логин] Попытка входа как {login}")

    def _on_go_toggle(self, state):
        if state == Qt.Checked:
            self.engine.start()
        else:
            self.engine.stop()

    def _log(self, text: str):
        self.log_view.appendPlainText(text)
        sb = self.log_view.verticalScrollBar()
        sb.setValue(sb.maximum())

    # ==================================================================
    # Checkbox wiring
    # ==================================================================

    def _connect_checkboxes(self):
        """Connect every action checkbox to the engine."""
        panels = [
            self.base_panel,
            self.mine_panel,
            self.fortress_panel,
            self.avatar_panel,
        ]
        for panel in panels:
            for key, cb in panel.iter_checkboxes():
                action = panel.action_for_key(key)
                if action is None:
                    continue
                cb.stateChanged.connect(
                    self._make_toggle_handler(key, action)
                )

    def _make_toggle_handler(self, key, action):
        def handler(state):
            if state == Qt.Checked:
                self.engine.enable_action(action)
                self._log(f"[+] {action['name_ru']}")
            else:
                self.engine.disable_action(key)
                self._log(f"[-] {action['name_ru']}")
        return handler
