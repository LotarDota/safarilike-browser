"""
Right panel – Аватар (Avatar) controls.
"""

from PyQt5.QtWidgets import (
    QCheckBox,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QVBoxLayout,
    QWidget,
)

from ..engine.actions import AVATAR_ACTIONS


class AvatarPanel(QWidget):
    """Check-box group for avatar-section actions."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._checkboxes: dict[str, QCheckBox] = {}
        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(4, 4, 4, 4)
        layout.setSpacing(2)

        group = QGroupBox("Аватар")
        grid = QVBoxLayout()
        grid.setSpacing(1)

        for action in AVATAR_ACTIONS:
            row = QHBoxLayout()
            cb = QCheckBox(action["name_ru"])
            cb.setObjectName(action["key"])
            self._checkboxes[action["key"]] = cb
            row.addWidget(cb)
            row.addStretch()
            grid.addLayout(row)

        # Exit + count field
        exit_row = QHBoxLayout()
        self.cb_exit = QCheckBox("Exit")
        self.cb_exit.setObjectName("exit_action")
        exit_row.addWidget(self.cb_exit)
        self.exit_count = QLineEdit("100")
        self.exit_count.setFixedWidth(50)
        exit_row.addWidget(self.exit_count)
        exit_row.addStretch()
        grid.addLayout(exit_row)

        group.setLayout(grid)
        layout.addWidget(group)
        layout.addStretch()

    def iter_checkboxes(self):
        yield from self._checkboxes.items()

    def action_for_key(self, key: str):
        for a in AVATAR_ACTIONS:
            if a["key"] == key:
                return a
        return None
