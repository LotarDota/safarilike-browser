# Botva Auto-Clicker

Рабочее окружение на **C# WinForms + CefSharp** (embedded Chromium) для
автоматизации игры [Botva.ru](https://botva.ru). Повторяет UX эталонного
приложения "Авто кликер Ботва": одно окно-панель со всеми модулями и отдельное
окно со встроенным браузером.

> ⚠️ **Только Windows x64.** CefSharp использует нативный Chromium, который не
> собирается/запускается под Linux или macOS. Репозиторий можно
> _скомпилировать_ под Linux благодаря `EnableWindowsTargeting=true`, но
> запуск возможен только на Windows.

---

## Возможности

- Встроенный Chromium (CefSharp) — botva.ru открывается внутри приложения,
  сессия и cookies сохраняются между запусками.
- Авто-логин: заполняет поля формы и жмёт «Войти» по выбранному серверу.
- Асинхронный планировщик модулей (`ModuleScheduler`) с кооперативной моделью.
  Один поток ходит по DOM'у, поэтому клики не конфликтуют между собой.
- UI-панель со всеми ~50 чекбоксами из эталонного скрина (Основа, Подзем,
  Приключения, Крепость, Аватар).
- Настройки (логин, сервер, какие модули включены) хранятся в
  `%LOCALAPPDATA%\BotvaAutoClicker\settings.json`.
- Лог действий в окне «Статус» + отдельная панель в главной форме.

### Что реализовано «по-настоящему»

| Модуль      | Поведение                                                                 |
|-------------|---------------------------------------------------------------------------|
| Авто-логин  | Навигация на `botva.ru`, выбор сервера, ввод логина/пароля, клик «Войти». |
| Работа      | Переход на страницу работы, сбор награды, запуск новой смены.             |
| Таверна     | Клик «Выпить напиток».                                                    |
| Сражалка    | Выбор соперника из списка + клик «Атаковать».                             |

Остальные модули подключены как `StubModule` — UI полностью функционален, но
реальная игровая логика не реализована: когда чекбокс включён, модуль раз в
минуту пишет в лог «TODO». Это сделано намеренно, чтобы не угадывать селекторы
вслепую: каждый игровой модуль требует наблюдения за DOM/XHR в реальном
аккаунте. Добавление нового модуля — это 20 строк кода, см. раздел
«Расширение» ниже.

---

## Сборка и запуск

### Требования

- Windows 10 / 11 x64
- .NET 8 SDK (https://dotnet.microsoft.com/download)
- (Опционально) Visual Studio 2022 17.8+ с пакетом "Разработка для классической
  рабочей среды .NET".

### Командная строка

```powershell
git clone https://github.com/LotarDota/safarilike-browser.git
cd safarilike-browser
dotnet restore
dotnet run --project src\BotvaAutoClicker
```

### Visual Studio

1. Открой `BotvaAutoClicker.sln`.
2. Выбери конфигурацию `Debug | x64`.
3. F5.

---

## Структура

```
src/BotvaAutoClicker/
├── BotvaAutoClicker.csproj     # net8.0-windows + CefSharp
├── app.manifest                # DPI / longPath / supported OS
├── Program.cs                  # точка входа, инициализация CEF
├── Core/
│   ├── BotModule.cs            # базовый класс модуля
│   ├── BotvaBrowser.cs         # обёртка над ChromiumWebBrowser (JS eval, click)
│   ├── CefRuntimeInitializer.cs
│   ├── Logger.cs               # observable логгер
│   └── ModuleScheduler.cs      # один async-loop для всех модулей
├── Config/
│   └── AppSettings.cs          # JSON в %LOCALAPPDATA%
├── Forms/
│   ├── BrowserForm.cs          # отдельное окно с ChromiumWebBrowser
│   └── MainForm.cs             # панель управления (все чекбоксы)
└── Modules/
    ├── AuthModule.cs           # реальный логин
    ├── RabotaModule.cs         # реальный модуль «Работа»
    ├── TavernaModule.cs        # реальный модуль «Таверна»
    ├── SrazhalkaModule.cs      # реальный модуль «Сражалка»
    ├── SimpleClickModule.cs    # утилита для однокнопочных модулей
    ├── StubModule.cs           # заглушка с TODO-логом
    └── ModuleCatalog.cs        # единый список всех модулей из UI
```

---

## Расширение: как добавить настоящий модуль

1. Открой botva.ru в DevTools, найди селекторы (CSS или XPath) нужных кнопок
   и/или AJAX-эндпоинтов.
2. Создай файл `Modules/MyModule.cs`:

   ```csharp
   public sealed class MyModule : BotModule
   {
       public MyModule() : base("myId", "Мой модуль") { }

       public override async Task TickAsync(CancellationToken ct)
       {
           if (await Browser.ClickAsync("button.my-action"))
           {
               Log("Клик сделан.");
           }
           ScheduleNext(TimeSpan.FromMinutes(5));
       }
   }
   ```

3. В `Modules/ModuleCatalog.cs` замени соответствующую запись со
   `StubModule(...)` на `() => new MyModule()`.
4. Собери и запусти — чекбокс автоматически появится в том же групбоксе.

---

## Лицензия / ToS

Использование автоматизации может нарушать пользовательское соглашение игры.
Используй на свой страх и риск.
