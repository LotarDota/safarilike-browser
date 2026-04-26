"""
Right panel – Крепость (Fortress) controls.
"""

from PyQt5.QtWidgets import (
    QCheckBox,
    QGroupBox,
    QHBoxLayout,
    QVBoxLayout,
    QWidget,
)

from ..engine.actions import FORTRESS_ACTIONS


class FortressPanel(QWidget):
    """Check-box group for fortress actions."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._checkboxes: dict[str, QCheckBox] = {}
        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(4, 4, 4, 4)
        layout.setSpacing(2)

        group = QGroupBox("Крепость")
        grid = QVBoxLayout()
        grid.setSpacing(1)

        for action in FORTRESS_ACTIONS:
            row = QHBoxLayout()
            cb = QCheckBox(action["name_ru"])
            cb.setObjectName(action["key"])
            self._checkboxes[action["key"]] = cb
            row.addWidget(cb)
            row.addStretch()
            grid.addLayout(row)

        group.setLayout(grid)
        layout.addWidget(group)
        layout.addStretch()

    def iter_checkboxes(self):
        yield from self._checkboxes.items()

    def action_for_key(self, key: str):
        for a in FORTRESS_ACTIONS:
            if a["key"] == key:
                return a
        return None
