#!/usr/bin/env python3
"""
Скрипт для сбора статистики боёв за земли в Ботва Онлайн (сервер Аватар).

Парсит логи боёв (fight_log.php) по диапазону ID конфликтов и выводит
сводную таблицу: кто сколько раз сходил, суммарный урон, хил, защита,
убийства и очки доблести.

Использование:
    python3 botva_land_stats.py --last 20
    python3 botva_land_stats.py --last 20 --team свинтусы
    python3 botva_land_stats.py --from 201830 --to 201851
    python3 botva_land_stats.py --from 201830 --to 201851 --csv output.csv
    python3 botva_land_stats.py --from 201830 --to 201851 --sort damage
"""

import argparse
import csv
import sys
import time
from dataclasses import dataclass, field
from typing import Optional
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError


FIGHT_LOG_URL = "https://avatar.botva.ru/fight_log.php?conflict={conflict_id}"
REQUEST_DELAY = 0.5  # секунды между запросами
SEARCH_STEP = 50  # шаг для поиска последнего конфликта


@dataclass
class PlayerStats:
    name: str
    fights: int = 0
    kills: int = 0
    damage: int = 0
    healing: int = 0
    protection: int = 0
    valor_points: int = 0
    fights_list: list = field(default_factory=list)


def fetch_page(conflict_id: int) -> Optional[str]:
    """Загрузить страницу лога боя."""
    url = FIGHT_LOG_URL.format(conflict_id=conflict_id)
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urlopen(req, timeout=15) as resp:
            raw = resp.read()
            return raw.decode("windows-1251", errors="replace")
    except (URLError, HTTPError) as e:
        print(f"  [!] Ошибка загрузки conflict={conflict_id}: {e}", file=sys.stderr)
        return None


def parse_fight_log(html: str, conflict_id: int):
    """
    Парсит HTML лога боя без BeautifulSoup (только stdlib).
    Возвращает (battle_name, team1_name, team2_name, team1_players, team2_players).
    Каждый player — dict с ключами: name, kills, damage, healing, protection, efficiency, valor.
    """
    import re

    battle_name = ""
    m = re.search(r"ССЫЛКА НА БОЙ:\s*(.+?)</span>", html)
    if m:
        battle_name = m.group(1).strip()

    # Определяем победителя / команды из заголовка
    title_match = re.search(
        r'<b>(.*?)</b>\s*одержал[иа]?\s*победу\s*над\s*<b>(.*?)</b>', html, re.IGNORECASE
    )
    winner = title_match.group(1).strip() if title_match else ""
    loser = title_match.group(2).strip() if title_match else ""

    # Определяем названия команд из табов
    team1_name = ""
    team2_name = ""
    tab_matches = re.findall(
        r'conflict_log_tabs\.click\((\d+)\).*?>(.*?)</div>', html
    )
    for tab_id, tab_name in tab_matches:
        if tab_id == "1":
            team1_name = tab_name.strip()
        elif tab_id == "2":
            team2_name = tab_name.strip()

    def parse_table(table_html):
        """Парсит таблицу игроков, возвращает список dict."""
        players = []
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', table_html, re.DOTALL)
        for row in rows:
            cells = re.findall(
                r'<td[^>]*data-sort-value="([^"]*)"[^>]*>',
                row
            )
            if len(cells) >= 8:
                name = cells[0].strip()
                if not name:
                    continue
                players.append({
                    "name": name,
                    "kills": int(cells[1]) if cells[1].lstrip("-").isdigit() else 0,
                    "damage": int(cells[2]) if cells[2].lstrip("-").isdigit() else 0,
                    "healing": int(cells[3]) if cells[3].lstrip("-").isdigit() else 0,
                    "protection": int(cells[4]) if cells[4].lstrip("-").isdigit() else 0,
                    "efficiency": cells[5],
                    "valor": int(cells[7]) if cells[7].lstrip("-").isdigit() else 0,
                })
        return players

    # Ищем таблицы по классам
    table1_match = re.search(
        r'<table[^>]*class="[^"]*conflict_log_table1[^"]*"[^>]*>(.*?)</table>',
        html, re.DOTALL
    )
    table2_match = re.search(
        r'<table[^>]*class="[^"]*conflict_log_table2[^"]*"[^>]*>(.*?)</table>',
        html, re.DOTALL
    )

    team1_players = parse_table(table1_match.group(1)) if table1_match else []
    team2_players = parse_table(table2_match.group(1)) if table2_match else []

    return battle_name, team1_name, team2_name, team1_players, team2_players


def _page_exists(conflict_id: int) -> bool:
    """Быстрая проверка: существует ли лог боя (без скачивания тела)."""
    import http.client
    import ssl
    try:
        ctx = ssl.create_default_context()
        conn = http.client.HTTPSConnection("avatar.botva.ru", timeout=10, context=ctx)
        conn.request("HEAD", f"/fight_log.php?conflict={conflict_id}",
                     headers={"User-Agent": "Mozilla/5.0"})
        resp = conn.getresponse()
        status = resp.status
        conn.close()
        return status == 200
    except Exception:
        return False


def find_latest_conflict() -> int:
    """Находит ID последнего доступного конфликта."""
    print("  Поиск последнего конфликта...", end="", flush=True)

    # Быстрый поиск: шагаем по SEARCH_STEP от известной точки
    probe = 201800
    while _page_exists(probe + SEARCH_STEP):
        probe += SEARCH_STEP
        time.sleep(0.2)

    # Точный поиск в диапазоне [probe+1, probe+SEARCH_STEP)
    latest = probe
    for cid in range(probe + 1, probe + SEARCH_STEP):
        if _page_exists(cid):
            latest = cid
        else:
            break
        time.sleep(0.2)

    print(f" {latest}")
    return latest


def collect_stats(start_id: int, end_id: int, team_filter: Optional[str] = None):
    """Собирает статистику по диапазону конфликтов."""
    stats: dict[str, PlayerStats] = {}
    total_conflicts = 0
    skipped = 0

    for i, conflict_id in enumerate(range(start_id, end_id + 1)):
        if i > 0:
            time.sleep(REQUEST_DELAY)

        print(f"  Загружаю conflict={conflict_id}...", end="", flush=True)
        html = fetch_page(conflict_id)

        if html is None or "Лог боя не найден" in html:
            print(" пропущен (не найден)")
            skipped += 1
            continue

        battle_name, team1_name, team2_name, team1_players, team2_players = parse_fight_log(
            html, conflict_id
        )

        if not team1_players and not team2_players:
            print(" пропущен (нет данных)")
            skipped += 1
            continue

        total_conflicts += 1
        print(f" OK — {battle_name} ({len(team1_players)} vs {len(team2_players)})")

        players_to_process = []
        if team_filter:
            tf = team_filter.lower()
            if tf in team1_name.lower():
                players_to_process = [(p, team1_name) for p in team1_players]
            elif tf in team2_name.lower():
                players_to_process = [(p, team2_name) for p in team2_players]
            else:
                players_to_process = [
                    (p, team1_name) for p in team1_players
                ] + [
                    (p, team2_name) for p in team2_players
                ]
        else:
            players_to_process = [
                (p, team1_name) for p in team1_players
            ] + [
                (p, team2_name) for p in team2_players
            ]

        for player, team in players_to_process:
            name = player["name"]
            if name not in stats:
                stats[name] = PlayerStats(name=name)
            s = stats[name]
            s.fights += 1
            s.kills += player["kills"]
            s.damage += player["damage"]
            s.healing += player["healing"]
            s.protection += player["protection"]
            s.valor_points += player["valor"]
            s.fights_list.append(conflict_id)

    return stats, total_conflicts, skipped


def format_number(n: int) -> str:
    """Форматирует число с разделителями тысяч."""
    if n == 0:
        return "0"
    s = str(abs(n))
    parts = []
    while s:
        parts.append(s[-3:])
        s = s[:-3]
    formatted = ".".join(reversed(parts))
    return f"-{formatted}" if n < 0 else formatted


SORT_KEYS = {
    "fights": lambda s: s.fights,
    "kills": lambda s: s.kills,
    "damage": lambda s: s.damage,
    "healing": lambda s: s.healing,
    "protection": lambda s: s.protection,
    "valor": lambda s: s.valor_points,
    "name": lambda s: s.name,
}


def print_table(stats: dict[str, PlayerStats], sort_by: str = "fights"):
    """Выводит красиво отформатированную таблицу."""
    if not stats:
        print("\nНет данных для отображения.")
        return

    sort_fn = SORT_KEYS.get(sort_by, SORT_KEYS["fights"])
    reverse = sort_by != "name"
    sorted_players = sorted(stats.values(), key=sort_fn, reverse=reverse)

    # Заголовки
    headers = ["№", "Имя", "Боёв", "Убийств", "Урон", "Хил", "Защита", "Доблесть"]
    
    # Вычисляем ширины колонок
    rows_data = []
    for i, p in enumerate(sorted_players, 1):
        rows_data.append([
            str(i),
            p.name,
            str(p.fights),
            str(p.kills),
            format_number(p.damage),
            format_number(p.healing),
            format_number(p.protection),
            str(p.valor_points),
        ])

    col_widths = [len(h) for h in headers]
    for row in rows_data:
        for j, cell in enumerate(row):
            col_widths[j] = max(col_widths[j], len(cell))

    def fmt_row(cells, widths):
        parts = []
        for k, (cell, w) in enumerate(zip(cells, widths)):
            if k <= 1:
                parts.append(cell.ljust(w))
            else:
                parts.append(cell.rjust(w))
        return " │ ".join(parts)

    sep = "─┼─".join("─" * w for w in col_widths)

    print()
    print(fmt_row(headers, col_widths))
    print(sep)
    for row in rows_data:
        print(fmt_row(row, col_widths))

    print(f"\nВсего игроков: {len(sorted_players)}")


def export_csv(stats: dict[str, PlayerStats], filepath: str, sort_by: str = "fights"):
    """Экспортирует статистику в CSV."""
    sort_fn = SORT_KEYS.get(sort_by, SORT_KEYS["fights"])
    reverse = sort_by != "name"
    sorted_players = sorted(stats.values(), key=sort_fn, reverse=reverse)

    with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerow(["№", "Имя", "Боёв", "Убийств", "Урон", "Хил", "Защита", "Доблесть", "ID боёв"])
        for i, p in enumerate(sorted_players, 1):
            writer.writerow([
                i, p.name, p.fights, p.kills,
                p.damage, p.healing, p.protection, p.valor_points,
                ",".join(str(x) for x in p.fights_list),
            ])

    print(f"\nCSV сохранён: {filepath}")


def main():
    parser = argparse.ArgumentParser(
        description="Сбор статистики боёв за земли — Ботва Онлайн (Аватар)"
    )
    parser.add_argument(
        "--from", dest="start_id", type=int, default=None,
        help="ID первого конфликта"
    )
    parser.add_argument(
        "--to", dest="end_id", type=int, default=None,
        help="ID последнего конфликта"
    )
    parser.add_argument(
        "--last", dest="last_n", type=int, default=None,
        help="Взять последние N конфликтов (автоматически находит диапазон)"
    )
    parser.add_argument(
        "--team", type=str, default=None,
        help="Фильтр по команде (например: свинтусы или барантусы)"
    )
    parser.add_argument(
        "--sort", type=str, default="fights",
        choices=list(SORT_KEYS.keys()),
        help="Сортировка (по умолчанию: fights)"
    )
    parser.add_argument(
        "--csv", type=str, default=None,
        help="Путь для экспорта в CSV"
    )
    parser.add_argument(
        "--delay", type=float, default=0.5,
        help="Задержка между запросами в секундах (по умолчанию: 0.5)"
    )

    args = parser.parse_args()

    if args.last_n is None and (args.start_id is None or args.end_id is None):
        parser.error("Укажите --last N или оба параметра --from и --to")

    global REQUEST_DELAY
    REQUEST_DELAY = args.delay

    print(f"╔══════════════════════════════════════════════════╗")
    print(f"║  Статистика боёв за земли — Ботва Онлайн        ║")
    print(f"║  Сервер: Аватар                                 ║")
    print(f"╚══════════════════════════════════════════════════╝")

    if args.last_n is not None:
        end_id = find_latest_conflict()
        start_id = end_id - args.last_n + 1
        args.start_id = start_id
        args.end_id = end_id

    print(f"\nДиапазон: {args.start_id} — {args.end_id}")
    if args.team:
        print(f"Фильтр по команде: {args.team}")
    print()

    stats, total, skipped = collect_stats(args.start_id, args.end_id, args.team)

    print(f"\n{'='*50}")
    print(f"Обработано боёв: {total} (пропущено: {skipped})")
    print(f"{'='*50}")

    print_table(stats, sort_by=args.sort)

    if args.csv:
        export_csv(stats, args.csv, sort_by=args.sort)


if __name__ == "__main__":
    main()
