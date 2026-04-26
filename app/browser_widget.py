"""
Embedded Chromium browser widget wrapping QWebEngineView.
"""

from PyQt5.QtCore import QUrl
from PyQt5.QtWebEngineWidgets import QWebEnginePage, QWebEngineProfile, QWebEngineView


class GameBrowser(QWebEngineView):
    """QWebEngineView pre-configured for Botva.ru."""

    GAME_URL = "https://botva.ru/"

    def __init__(self, parent=None):
        super().__init__(parent)

        profile = QWebEngineProfile.defaultProfile()
        profile.setHttpUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
        profile.setPersistentCookiesPolicy(
            QWebEngineProfile.ForcePersistentCookies
        )

        self.load(QUrl(self.GAME_URL))

    def navigate(self, url: str):
        self.load(QUrl(url))

    def inject_js(self, script: str, callback=None):
        if callback:
            self.page().runJavaScript(script, callback)
        else:
            self.page().runJavaScript(script)
