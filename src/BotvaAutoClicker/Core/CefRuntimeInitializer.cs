using System;
using System.IO;
using CefSharp;
using CefSharp.WinForms;

namespace BotvaAutoClicker.Core;

/// <summary>
/// Centralizes CEF (Chromium Embedded Framework) lifecycle management so the
/// main form only has to worry about UI code.
/// </summary>
internal static class CefRuntimeInitializer
{
    private static bool _initialized;

    public static void Initialize()
    {
        if (_initialized)
        {
            return;
        }

        var settings = new CefSettings
        {
            CachePath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "BotvaAutoClicker",
                "CefCache"),
            LogFile = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "BotvaAutoClicker",
                "cef.log"),
            PersistSessionCookies = true,
            AcceptLanguageList = "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
            LogSeverity = LogSeverity.Warning,
        };

        // Botva.ru relies on Flash-era features; emulate a modern Chrome UA so
        // the site doesn't try to redirect to a legacy client.
        settings.UserAgent =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

        // Default site-level settings: disable pop-ups & geolocation prompts.
        settings.CefCommandLineArgs["autoplay-policy"] = "no-user-gesture-required";
        settings.CefCommandLineArgs["disable-features"] = "IsolateOrigins,site-per-process";

        Cef.Initialize(settings, performDependencyCheck: true, browserProcessHandler: null);
        _initialized = true;
    }

    public static void Shutdown()
    {
        if (!_initialized)
        {
            return;
        }

        try
        {
            Cef.Shutdown();
        }
        catch
        {
            // Best-effort: CEF can throw on shutdown if initialization failed.
        }
        finally
        {
            _initialized = false;
        }
    }
}
