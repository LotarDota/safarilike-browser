"""
Core auto-clicker engine.
Manages a timer-based loop that executes enabled game actions via JS injection.
"""

from PyQt5.QtCore import QObject, QTimer, pyqtSignal, pyqtSlot

from .actions import JS_HELPERS


class ClickerEngine(QObject):
    """Drives the auto-click loop for an embedded QWebEngineView."""

    status_update = pyqtSignal(str)      # emitted with human-readable log lines
    action_done = pyqtSignal(str, bool)  # (action_key, success)

    # Default interval between action ticks (ms)
    DEFAULT_INTERVAL = 3000

    def __init__(self, web_view, parent=None):
        super().__init__(parent)
        self._web = web_view
        self._enabled_actions = {}     # key -> action dict
        self._action_queue = []        # ordered keys to process
        self._queue_index = 0
        self._running = False

        self._timer = QTimer(self)
        self._timer.setInterval(self.DEFAULT_INTERVAL)
        self._timer.timeout.connect(self._tick)

        self._helpers_injected = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def set_interval(self, ms: int):
        self._timer.setInterval(max(500, ms))

    def enable_action(self, action: dict):
        key = action["key"]
        self._enabled_actions[key] = action
        self._rebuild_queue()

    def disable_action(self, key: str):
        self._enabled_actions.pop(key, None)
        self._rebuild_queue()

    def is_action_enabled(self, key: str) -> bool:
        return key in self._enabled_actions

    @pyqtSlot()
    def start(self):
        if self._running:
            return
        self._running = True
        self._inject_helpers()
        self._queue_index = 0
        self._timer.start()
        self.status_update.emit("[Движок] Автокликер запущен")

    @pyqtSlot()
    def stop(self):
        self._running = False
        self._timer.stop()
        self.status_update.emit("[Движок] Автокликер остановлен")

    @property
    def running(self) -> bool:
        return self._running

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _rebuild_queue(self):
        self._action_queue = list(self._enabled_actions.keys())
        if self._queue_index >= len(self._action_queue):
            self._queue_index = 0

    def _inject_helpers(self):
        if self._web is None:
            return
        page = self._web.page()
        if page is None:
            return
        page.runJavaScript(JS_HELPERS)
        self._helpers_injected = True

    def _tick(self):
        if not self._action_queue:
            return

        # Re-inject helpers in case page navigated
        self._inject_helpers()

        key = self._action_queue[self._queue_index]
        action = self._enabled_actions.get(key)
        if action is None:
            self._advance()
            return

        js = action["js"]
        name = action["name_ru"]
        self.status_update.emit(f"[Действие] {name} ...")

        def _on_result(result):
            ok = bool(result)
            self.action_done.emit(key, ok)
            if ok:
                self.status_update.emit(f"  -> {name}: OK")
            else:
                self.status_update.emit(f"  -> {name}: элемент не найден")

        page = self._web.page()
        if page:
            page.runJavaScript(js, _on_result)

        self._advance()

    def _advance(self):
        if not self._action_queue:
            return
        self._queue_index = (self._queue_index + 1) % len(self._action_queue)
