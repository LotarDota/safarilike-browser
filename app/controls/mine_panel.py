"""
Middle panel – Подъем / Шахта / Малые Приключения controls.
"""

from PyQt5.QtWidgets import (
    QCheckBox,
    QComboBox,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QVBoxLayout,
    QWidget,
)

from ..engine.actions import MINE_ACTIONS, SMALL_ADVENTURES


class MinePanel(QWidget):
    """Controls for mine, elevator, and small adventures."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._checkboxes: dict[str, QCheckBox] = {}
        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(4, 4, 4, 4)
        layout.setSpacing(4)

        # --- Подъем ---
        mine_group = QGroupBox("Подъем")
        mg = QVBoxLayout()
        for action in MINE_ACTIONS:
            cb = QCheckBox(action["name_ru"])
            cb.setObjectName(action["key"])
            self._checkboxes[action["key"]] = cb
            mg.addWidget(cb)

        row = QHBoxLayout()
        self.mine_combo1 = QComboBox()
        self.mine_combo1.addItems(["Авто", "1", "2", "3", "4", "5"])
        self.mine_combo2 = QComboBox()
        self.mine_combo2.addItems(["Авто", "1", "2", "3", "4", "5"])
        row.addWidget(QLabel("Уровень:"))
        row.addWidget(self.mine_combo1)
        row.addWidget(self.mine_combo2)
        mg.addLayout(row)

        self.cb_poekhali = QCheckBox("Поехали")
        self.cb_poekhali.setObjectName("mine_go")
        mg.addWidget(self.cb_poekhali)

        self.cb_timer = QCheckBox("Использовать таймер")
        self.cb_timer.setObjectName("use_timer")
        mg.addWidget(self.cb_timer)

        mine_group.setLayout(mg)
        layout.addWidget(mine_group)

        # --- Мал. Приключения ---
        adv_group = QGroupBox("Мал.Прикл")
        ag = QVBoxLayout()
        for action in SMALL_ADVENTURES:
            row = QHBoxLayout()
            cb = QCheckBox(action["name_ru"])
            cb.setObjectName(action["key"])
            self._checkboxes[action["key"]] = cb
            row.addWidget(cb)
            row.addStretch()
            ag.addLayout(row)
        adv_group.setLayout(ag)
        layout.addWidget(adv_group)

        # --- Taverna bottom ---
        self.cb_taverna = QCheckBox("Таверна")
        self.cb_taverna.setObjectName("taverna_bottom")
        layout.addWidget(self.cb_taverna)

        layout.addStretch()

    def iter_checkboxes(self):
        yield from self._checkboxes.items()

    def action_for_key(self, key: str):
        for a in MINE_ACTIONS + SMALL_ADVENTURES:
            if a["key"] == key:
                return a
        return None
