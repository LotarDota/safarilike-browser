using System;
using System.Collections.Generic;
using BotvaAutoClicker.Config;
using BotvaAutoClicker.Core;

namespace BotvaAutoClicker.Modules;

/// <summary>
/// Single source of truth for every module that shows up in the UI. The main
/// form iterates this to build checkboxes and to register modules with the
/// scheduler. To add a new real implementation: subclass <see cref="BotModule"/>,
/// then swap the <see cref="Factory"/> below to return an instance of it.
/// </summary>
public sealed record ModuleDescriptor(
    string Id,
    string DisplayName,
    string Group,
    Func<BotModule> Factory);

public static class ModuleCatalog
{
    public static IReadOnlyList<ModuleDescriptor> Build(AppSettings settings) => new ModuleDescriptor[]
    {
        // ─── Auth ───────────────────────────────────────────────────────
        new("auth", "Авто-логин", "Auth", () => new AuthModule(settings)),

        // ─── Основа ─────────────────────────────────────────────────────
        new("dozor", "Дозор", "Основа", () => new StubModule("dozor", "Дозор")),
        new("srazhalka", "Сражалка", "Основа", () => new SrazhalkaModule()),
        new("bodalka", "Бодалка", "Основа", () => new StubModule("bodalka", "Бодалка")),
        new("zorro", "Зорро", "Основа", () => new StubModule("zorro", "Зорро")),
        new("strashilki", "Страшилки", "Основа", () => new StubModule("strashilki", "Страшилки")),
        new("arena", "Арена", "Основа", () => new StubModule("arena", "Арена")),
        new("kach", "Кач", "Основа", () => new StubModule("kach", "Кач")),
        new("pokupka", "Покупка", "Основа", () => new StubModule("pokupka", "Покупка")),
        new("otkryvayu", "Открываю", "Основа", () => new StubModule("otkryvayu", "Открываю")),
        new("prodayu", "Продаю", "Основа", () => new StubModule("prodayu", "Продаю")),
        new("rabota", "Работа", "Основа", () => new RabotaModule()),
        new("klass", "Класс", "Основа", () => new StubModule("klass", "Класс")),
        new("razryvatel", "Разрыватель", "Основа", () => new StubModule("razryvatel", "Разрыватель")),
        new("korablik", "Кораблик", "Основа", () => new StubModule("korablik", "Кораблик")),
        new("vospitalka", "Воспиталка", "Основа", () => new StubModule("vospitalka", "Воспиталка")),
        new("umeniya", "Умения", "Основа", () => new StubModule("umeniya", "Умения")),
        new("ferma", "Ферма", "Основа", () => new StubModule("ferma", "Ферма")),
        new("korova", "Корова", "Основа", () => new StubModule("korova", "Корова")),
        new("alhimia", "Алхимия", "Основа", () => new StubModule("alhimia", "Алхимия")),
        new("muzey", "Музей", "Основа", () => new StubModule("muzey", "Музей")),
        new("podarok", "Подарок", "Основа", () => new StubModule("podarok", "Подарок")),
        new("karyera", "Карьера!", "Основа", () => new StubModule("karyera", "Карьера!")),
        new("ikarus", "Икарус", "Основа", () => new StubModule("ikarus", "Икарус")),
        new("kazna", "Казна", "Основа", () => new StubModule("kazna", "Казна")),
        new("taverna", "Таверна", "Основа", () => new TavernaModule()),

        // ─── Подзем ─────────────────────────────────────────────────────
        new("opusk", "Опуск за кри", "Подзем", () => new StubModule("opusk", "Опуск за кри")),
        new("shahta", "Шахта", "Подзем", () => new StubModule("shahta", "Шахта")),
        new("useTimer", "Использовать таймер", "Подзем", () => new StubModule("useTimer", "Использовать таймер")),
        new("poehali_dz", "Поехали (Подзем)", "Подзем", () => new StubModule("poehali_dz", "Поехали (Подзем)")),

        // ─── Приключения ────────────────────────────────────────────────
        new("malPrikl1", "Мал.Прикл #1", "Приключения", () => new StubModule("malPrikl1", "Мал.Прикл #1")),
        new("malPrikl2", "Мал.Прикл #2", "Приключения", () => new StubModule("malPrikl2", "Мал.Прикл #2")),
        new("malPrikl3", "Мал.Прикл #3", "Приключения", () => new StubModule("malPrikl3", "Мал.Прикл #3")),
        new("bolPrikl", "БолПрикл", "Приключения", () => new StubModule("bolPrikl", "БолПрикл")),
        new("karKar", "КарКар", "Приключения", () => new StubModule("karKar", "КарКар")),

        // ─── Крепость ───────────────────────────────────────────────────
        new("krep_zhal", "Жаловаться", "Крепость", () => new StubModule("krep_zhal", "Жаловаться")),
        new("krep_turist", "Турист", "Крепость", () => new StubModule("krep_turist", "Турист")),
        new("krep_taverna", "Крепость: Таверна", "Крепость", () => new StubModule("krep_taverna", "Крепость: Таверна")),
        new("krep_katakomby", "Катакомбы", "Крепость", () => new StubModule("krep_katakomby", "Катакомбы")),
        new("krep_dub", "ВеликийДуб", "Крепость", () => new StubModule("krep_dub", "ВеликийДуб")),
        new("krep_tonneli", "Подземные Тонели", "Крепость", () => new StubModule("krep_tonneli", "Подземные Тонели")),
        new("krep_akademia", "АкадемияПрикл", "Крепость", () => new StubModule("krep_akademia", "АкадемияПрикл")),
        new("krep_arena", "АренаГладиаторов", "Крепость", () => new StubModule("krep_arena", "АренаГладиаторов")),

        // ─── Аватар ─────────────────────────────────────────────────────
        new("av_auto_bodalka", "Авто Бодалка", "Аватар", () => new StubModule("av_auto_bodalka", "Авто Бодалка")),
        new("av_auto_shahta", "Авто Шахта", "Аватар", () => new StubModule("av_auto_shahta", "Авто Шахта")),
        new("av_korablik", "Аватар: Кораблик", "Аватар", () => new StubModule("av_korablik", "Аватар: Кораблик")),
        new("av_polyany", "Поляны", "Аватар", () => new StubModule("av_polyany", "Поляны")),
        new("av_muzey", "Аватар: Музей", "Аватар", () => new StubModule("av_muzey", "Аватар: Музей")),
        new("av_ikarus", "Аватар: Икарус", "Аватар", () => new StubModule("av_ikarus", "Аватар: Икарус")),
        new("av_strashilka", "Аватар: Страшилка", "Аватар", () => new StubModule("av_strashilka", "Аватар: Страшилка")),
        new("av_ferma", "Аватар: Ферма", "Аватар", () => new StubModule("av_ferma", "Аватар: Ферма")),
        new("av_kach", "Аватар: Кач", "Аватар", () => new StubModule("av_kach", "Аватар: Кач")),
        new("av_sozdat", "Создать", "Аватар", () => new StubModule("av_sozdat", "Создать")),
        new("av_tainyi", "ТайныйОрден", "Аватар", () => new StubModule("av_tainyi", "ТайныйОрден")),
        new("av_sunduk", "Сундук", "Аватар", () => new StubModule("av_sunduk", "Сундук")),
        new("av_bitva", "БитваЗаЗемли", "Аватар", () => new StubModule("av_bitva", "БитваЗаЗемли")),
        new("av_prodat", "Продать", "Аватар", () => new StubModule("av_prodat", "Продать")),
        new("av_zadaniya", "Задания", "Аватар", () => new StubModule("av_zadaniya", "Задания")),
    };
}
