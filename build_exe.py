"""Build standalone .exe with PyInstaller.

Usage:
    pip install pyinstaller
    python build_exe.py

Output: dist/BotvaAutoClicker.exe (single file)
"""

import PyInstaller.__main__

PyInstaller.__main__.run([
    "run.py",
    "--onefile",
    "--windowed",
    "--name=BotvaAutoClicker",
    "--clean",
    "--noconfirm",
    # Selenium hidden imports (PyInstaller misses these)
    "--hidden-import=selenium",
    "--hidden-import=selenium.webdriver",
    "--hidden-import=selenium.webdriver.chrome",
    "--hidden-import=selenium.webdriver.chrome.webdriver",
    "--hidden-import=selenium.webdriver.chrome.service",
    "--hidden-import=selenium.webdriver.chrome.options",
    "--hidden-import=selenium.webdriver.common",
    "--hidden-import=selenium.webdriver.common.by",
    "--hidden-import=selenium.webdriver.common.keys",
    "--hidden-import=selenium.webdriver.common.action_chains",
    "--hidden-import=selenium.webdriver.support",
    "--hidden-import=selenium.webdriver.support.ui",
    "--hidden-import=selenium.webdriver.support.expected_conditions",
    "--hidden-import=selenium.webdriver.support.select",
    "--hidden-import=selenium.webdriver.remote",
    "--hidden-import=selenium.webdriver.remote.webdriver",
    "--hidden-import=selenium.webdriver.remote.webelement",
    "--hidden-import=selenium.webdriver.remote.command",
    "--hidden-import=selenium.webdriver.remote.errorhandler",
    "--hidden-import=selenium.webdriver.remote.remote_connection",
    "--collect-all=selenium",
])
