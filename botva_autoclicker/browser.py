"""Selenium browser automation for Botva.ru."""

import time
import random
import logging
from typing import Optional

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    NoSuchElementException,
    TimeoutException,
    WebDriverException,
)

logger = logging.getLogger("botva")

SERVERS = {
    "Адын": "https://g1.botva.ru",
    "Дыдва": "https://g2.botva.ru",
    "Тытра": "https://g3.botva.ru",
    "Turbo": "https://g4.botva.ru",
    "Аватар": "https://g5.botva.ru",
}


class BotvaBot:
    """Controls Chrome browser to automate Botva.ru game actions."""

    def __init__(self) -> None:
        self.driver: Optional[webdriver.Chrome] = None
        self.base_url = ""
        self.logged_in = False

    # ------------------------------------------------------------------
    #  Browser lifecycle
    # ------------------------------------------------------------------
    def start_browser(self, headless: bool = False) -> None:
        opts = Options()
        if headless:
            opts.add_argument("--headless=new")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument("--disable-gpu")
        opts.add_argument("--window-size=1280,900")
        opts.add_argument(
            "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        )
        try:
            self.driver = webdriver.Chrome(options=opts)
            self.driver.implicitly_wait(5)
            logger.info("Браузер запущен")
        except WebDriverException as exc:
            logger.error("Не удалось запустить Chrome: %s", exc)
            raise

    def stop_browser(self) -> None:
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass
            self.driver = None
            self.logged_in = False
            logger.info("Браузер закрыт")

    # ------------------------------------------------------------------
    #  Helpers
    # ------------------------------------------------------------------
    def _rand_delay(self, base: float = 1.0, extra: float = 2.0) -> None:
        time.sleep(base + random.uniform(0, extra))

    def _click_button(self, text: str) -> bool:
        if not self.driver:
            return False
        for tag in ("input", "button", "a"):
            try:
                elements = self.driver.find_elements(By.TAG_NAME, tag)
                for el in elements:
                    val = (el.get_attribute("value") or el.text or "").strip()
                    if text.lower() in val.lower():
                        el.click()
                        return True
            except Exception:
                continue
        return False

    def _click_link(self, text: str) -> bool:
        if not self.driver:
            return False
        try:
            links = self.driver.find_elements(By.TAG_NAME, "a")
            for link in links:
                if text.lower() in (link.text or "").lower():
                    link.click()
                    return True
        except Exception:
            pass
        return False

    def _page_contains(self, text: str) -> bool:
        if not self.driver:
            return False
        try:
            return text.lower() in self.driver.page_source.lower()
        except Exception:
            return False

    def _navigate(self, path: str) -> None:
        if self.driver:
            url = self.base_url + "/" + path.lstrip("/")
            self.driver.get(url)
            self._rand_delay(1, 1)

    def get_hp_percent(self) -> int:
        if not self.driver:
            return 100
        try:
            src = self.driver.page_source
            import re
            m = re.search(
                r'(?:HP|Здоровье|Жизни)[:\s]*(\d+)\s*/\s*(\d+)', src, re.IGNORECASE
            )
            if m:
                return round(int(m.group(1)) / int(m.group(2)) * 100)
        except Exception:
            pass
        return 100

    # ------------------------------------------------------------------
    #  Login
    # ------------------------------------------------------------------
    def login(self, username: str, password: str, server: str) -> bool:
        if not self.driver:
            return False
        self.base_url = SERVERS.get(server, "https://g1.botva.ru")
        try:
            self.driver.get(self.base_url)
            self._rand_delay(2, 2)

            # Fill login form
            try:
                login_input = self.driver.find_element(By.ID, "email")
            except NoSuchElementException:
                login_input = self.driver.find_element(
                    By.CSS_SELECTOR, 'input[name="email"], input[name="login"]'
                )
            login_input.clear()
            login_input.send_keys(username)

            try:
                pass_input = self.driver.find_element(By.ID, "passWord")
            except NoSuchElementException:
                pass_input = self.driver.find_element(
                    By.CSS_SELECTOR, 'input[name="passWord"], input[type="password"]'
                )
            pass_input.clear()
            pass_input.send_keys(password)

            # Select server
            try:
                server_select = Select(self.driver.find_element(By.ID, "server"))
                server_select.select_by_visible_text(server)
            except Exception:
                pass

            # Submit
            try:
                form = self.driver.find_element(By.ID, "loginForm")
                form.submit()
            except NoSuchElementException:
                self._click_button("Войти") or self._click_button("войти")

            self._rand_delay(3, 2)
            self.logged_in = True
            logger.info("Вход выполнен (%s, сервер %s)", username, server)
            return True
        except Exception as exc:
            logger.error("Ошибка входа: %s", exc)
            return False

    # ------------------------------------------------------------------
    #  Game modules
    # ------------------------------------------------------------------
    def do_attack(self, min_level: int = 1, max_level: int = 99) -> str:
        if not self.driver or not self.logged_in:
            return "Браузер не запущен"
        try:
            # Navigate to fight page
            if not self._page_contains("ИСКАТЬ ПРОТИВНИКА") and not self._page_contains("НАПАСТЬ"):
                self._click_link("Бодалка") or self._click_link("бодалка")
                self._rand_delay(2, 2)

            # Set level range
            try:
                min_input = self.driver.find_element(
                    By.CSS_SELECTOR, 'input[name="min"], input[name="level_min"]'
                )
                min_input.clear()
                min_input.send_keys(str(min_level))
            except Exception:
                pass
            try:
                max_input = self.driver.find_element(
                    By.CSS_SELECTOR, 'input[name="max"], input[name="level_max"]'
                )
                max_input.clear()
                max_input.send_keys(str(max_level))
            except Exception:
                pass

            # Search
            if self._page_contains("ИСКАТЬ ПРОТИВНИКА"):
                self._click_button("ИСКАТЬ ПРОТИВНИКА") or self._click_button("Искать")
                self._rand_delay(2, 3)

            # Attack
            if self._page_contains("НАПАСТЬ"):
                self._click_button("НАПАСТЬ") or self._click_button("Напасть")
                self._rand_delay(2, 2)

                if self._page_contains("победил") or self._page_contains("победа"):
                    return "Победа!"
                if self._page_contains("проиграл") or self._page_contains("поражение"):
                    return "Поражение"
                return "Атака выполнена"

            return "Противник не найден"
        except Exception as exc:
            return f"Ошибка: {exc}"

    def do_heal(self) -> str:
        if not self.driver or not self.logged_in:
            return "Браузер не запущен"
        try:
            if (
                self._click_button("Лечиться")
                or self._click_button("Выпить")
                or self._click_button("Использовать зелье")
                or self._click_button("Восстановить")
            ):
                self._rand_delay(1, 1)
                return "Зелье использовано"

            self._click_link("Жилище") or self._click_link("жилище")
            self._rand_delay(2, 1)
            if self._click_button("Лечиться") or self._click_button("Выпить"):
                return "Зелье использовано"

            return "Зелья не найдены"
        except Exception as exc:
            return f"Ошибка: {exc}"

    def do_farm(self) -> str:
        if not self.driver or not self.logged_in:
            return "Браузер не запущен"
        try:
            if not self._page_contains("ферма"):
                self._click_link("Ферма") or self._click_link("ферма")
                self._rand_delay(2, 1)

            if (
                self._click_button("Собрать")
                or self._click_button("Собрать урожай")
                or self._click_button("Работать")
                or self._click_button("Начать работу")
            ):
                self._rand_delay(1, 1)
                return "Ресурсы собраны"
            return "Нечего собирать"
        except Exception as exc:
            return f"Ошибка: {exc}"

    def do_patrol(self) -> str:
        if not self.driver or not self.logged_in:
            return "Браузер не запущен"
        try:
            if not self._page_contains("дозор"):
                self._click_link("Дозор") or self._click_link("дозор") or self._click_link("Бодалка")
                self._rand_delay(2, 1)

            if (
                self._click_button("В дозор")
                or self._click_button("Идти в дозор")
                or self._click_button("Начать дозор")
                or self._click_button("Дозор")
            ):
                self._rand_delay(1, 1)
                return "Дозор начат"
            return "Дозор недоступен"
        except Exception as exc:
            return f"Ошибка: {exc}"

    def do_mine(self) -> str:
        if not self.driver or not self.logged_in:
            return "Браузер не запущен"
        try:
            if not self._page_contains("шахта"):
                self._click_link("Шахта") or self._click_link("шахта")
                self._rand_delay(2, 1)

            if (
                self._click_button("Добыть")
                or self._click_button("Копать")
                or self._click_button("Начать добычу")
                or self._click_button("Добыть кристаллы")
            ):
                self._rand_delay(1, 1)
                return "Добыча начата"
            return "Добыча недоступна"
        except Exception as exc:
            return f"Ошибка: {exc}"
