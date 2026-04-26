using System;
using System.Threading;
using System.Threading.Tasks;
using BotvaAutoClicker.Config;
using BotvaAutoClicker.Core;

namespace BotvaAutoClicker.Modules;

/// <summary>
/// Takes care of navigating to Botva.ru, selecting the server, and filling
/// in the login form. Runs once when the user clicks "Go"; afterwards it
/// quiesces until credentials change.
/// </summary>
public sealed class AuthModule : BotModule
{
    private readonly AppSettings _settings;
    private bool _loginAttempted;

    public AuthModule(AppSettings settings) : base("auth", "Авто-логин")
    {
        _settings = settings;
    }

    public void ResetLoginState()
    {
        _loginAttempted = false;
    }

    public override async Task TickAsync(CancellationToken ct)
    {
        if (_loginAttempted)
        {
            ScheduleNext(TimeSpan.FromSeconds(30));
            return;
        }

        if (string.IsNullOrWhiteSpace(_settings.Login) || string.IsNullOrWhiteSpace(_settings.Password))
        {
            Warn("Логин или пароль не заданы.");
            ScheduleNext(TimeSpan.FromSeconds(5));
            return;
        }

        Log($"Переход на botva.ru ({_settings.Server})…");

        // Navigate to the server entry page. Botva uses URL-encoded server names
        // of the form https://<server>.botva.ru for avatar-style worlds.
        var baseUrl = BotvaBrowser.StartUrl;
        await Browser.NavigateAsync(baseUrl, ct).ConfigureAwait(false);

        // Wait a beat for the JS-rendered login form.
        await Task.Delay(TimeSpan.FromSeconds(2), ct).ConfigureAwait(false);

        // Select server in the dropdown if present.
        var serverJs =
            "(function(){var sel=document.querySelector('select[name=\"server\"],select#server');" +
            "if(!sel)return false;for(var i=0;i<sel.options.length;i++){" +
            "if(sel.options[i].text.trim()===" + JsString(_settings.Server) + "){sel.selectedIndex=i;" +
            "sel.dispatchEvent(new Event('change',{bubbles:true}));return true;}}return false;})();";
        await Browser.EvaluateAsync(serverJs).ConfigureAwait(false);

        // Fill in common login form field names. We try several selectors
        // because Botva has historically shipped several iterations of this
        // page (classic auth, Destiny SSO, etc.).
        await Browser.SetInputValueAsync("input[name='login']", _settings.Login).ConfigureAwait(false);
        await Browser.SetInputValueAsync("input#login", _settings.Login).ConfigureAwait(false);
        await Browser.SetInputValueAsync("input[name='password']", _settings.Password).ConfigureAwait(false);
        await Browser.SetInputValueAsync("input#password", _settings.Password).ConfigureAwait(false);

        var clicked =
            await Browser.ClickAsync("button[type='submit']").ConfigureAwait(false) ||
            await Browser.ClickAsync("input[type='submit']").ConfigureAwait(false) ||
            await Browser.ClickAsync(".login-button").ConfigureAwait(false) ||
            await Browser.ClickAsync("#loginBtn").ConfigureAwait(false);

        if (clicked)
        {
            Log("Кнопка входа нажата.");
        }
        else
        {
            Warn("Кнопка входа не найдена — проверь селекторы.");
        }

        _loginAttempted = true;
        ScheduleNext(TimeSpan.FromSeconds(30));
    }

    private static string JsString(string value) =>
        "\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
}
