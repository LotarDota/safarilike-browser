"""Build standalone .exe with PyInstaller.

Usage:
    pip install pyinstaller
    python build_exe.py

Output: dist/BotvaAutoClicker.exe (single file)
"""

import PyInstaller.__main__
import sys

PyInstaller.__main__.run([
    "run.py",
    "--onefile",
    "--windowed",
    "--name=BotvaAutoClicker",
    "--clean",
    "--noconfirm",
])
