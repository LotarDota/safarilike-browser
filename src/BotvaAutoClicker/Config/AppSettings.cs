using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace BotvaAutoClicker.Config;

/// <summary>
/// Persisted user settings: credentials, server selection, which modules are
/// enabled. Stored under %LOCALAPPDATA%\BotvaAutoClicker\settings.json so the
/// repo stays credential-free.
/// </summary>
public sealed class AppSettings
{
    public string Login { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Server { get; set; } = "Аватар";
    public int ExitTimerSeconds { get; set; } = 100;

    public Dictionary<string, bool> ModuleEnabled { get; set; } = new();
    public Dictionary<string, string> ModuleParams { get; set; } = new();

    private static string DefaultPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "BotvaAutoClicker",
        "settings.json");

    public static AppSettings Load()
    {
        try
        {
            if (!File.Exists(DefaultPath))
            {
                return new AppSettings();
            }

            var json = File.ReadAllText(DefaultPath);
            return JsonSerializer.Deserialize<AppSettings>(json) ?? new AppSettings();
        }
        catch
        {
            // Corrupt settings shouldn't brick the app. Start fresh.
            return new AppSettings();
        }
    }

    public void Save()
    {
        try
        {
            var dir = Path.GetDirectoryName(DefaultPath);
            if (!string.IsNullOrEmpty(dir))
            {
                Directory.CreateDirectory(dir);
            }
            var json = JsonSerializer.Serialize(this, new JsonSerializerOptions
            {
                WriteIndented = true,
            });
            File.WriteAllText(DefaultPath, json);
        }
        catch
        {
            // Ignore — settings are a convenience, not critical.
        }
    }
}
