"""
Left panel – "Основа" (Base) controls.
"""

from PyQt5.QtWidgets import (
    QCheckBox,
    QComboBox,
    QGroupBox,
    QHBoxLayout,
    QVBoxLayout,
    QWidget,
)

from ..engine.actions import BASE_ACTIONS


class BasePanel(QWidget):
    """Check-box grid for base game actions."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._checkboxes: dict[str, QCheckBox] = {}
        self._init_ui()

    # ------------------------------------------------------------------

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(4, 4, 4, 4)
        layout.setSpacing(2)

        group = QGroupBox("Основа")
        grid = QVBoxLayout()
        grid.setSpacing(1)

        rows = [
            [("dozor", "Дозор")],
            [("srazhalka", "Сражалка")],
            [("bodalka", "Бодалка")],
            [("zorro", "Зорро")],
            [("strashilki", "Страшилки")],
            [("arena", "Арена")],
            [("kach", "Кач")],
            [("open", "Открываем")],
            [("pokupka", "Покупка")],
            [("prodat", "Продать")],
            [("rabota", "Работа")],
            [("klass", "Класс"), ("razryvatel", "Разрыватель")],
            [("korablik", "Кораблик"), ("vospitalka", "Воспиталка")],
            [("umeniya", "Умения")],
            [("korova", "Корова"), ("ferma", "Ферма")],
            [("muzey", "Музей")],
            [("karera", "Карьера!"), ("alkhimiya", "Алхимия")],
            [("ikarus", "Икарус"), ("podarok", "Подарок")],
            [("kazna", "Казна")],
            [("taverna", "Таверна")],
        ]

        for row_defs in rows:
            row_layout = QHBoxLayout()
            for key, label in row_defs:
                cb = QCheckBox(label)
                cb.setObjectName(key)
                self._checkboxes[key] = cb
                row_layout.addWidget(cb)
            row_layout.addStretch()
            grid.addLayout(row_layout)

        # Server / arena selector combo
        combo_row = QHBoxLayout()
        self.arena_combo = QComboBox()
        self.arena_combo.addItems(["Любая", "Лёгкая", "Средняя", "Сложная"])
        combo_row.addWidget(self._checkboxes.get("arena") or QWidget())
        combo_row.addWidget(self.arena_combo)
        combo_row.addStretch()

        group.setLayout(grid)
        layout.addWidget(group)
        layout.addStretch()

    # ------------------------------------------------------------------
    # Public helpers
    # ------------------------------------------------------------------

    def iter_checkboxes(self):
        """Yield (key, QCheckBox) pairs."""
        yield from self._checkboxes.items()

    def action_for_key(self, key: str):
        for a in BASE_ACTIONS:
            if a["key"] == key:
                return a
        return None
