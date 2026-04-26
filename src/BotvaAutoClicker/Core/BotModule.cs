using System;
using System.Threading;
using System.Threading.Tasks;

namespace BotvaAutoClicker.Core;

/// <summary>
/// Base class for every auto-clicker module (Дозор, Сражалка, Работа, ...).
///
/// Modules are cooperative: they expose a single <see cref="TickAsync"/> coroutine
/// which the <see cref="ModuleScheduler"/> invokes on its fixed cadence when
/// the module is enabled. A module should return quickly; long waits should be
/// implemented by skipping ticks using <see cref="NextRunAt"/>.
/// </summary>
public abstract class BotModule
{
    protected BotModule(string id, string displayName)
    {
        Id = id;
        DisplayName = displayName;
    }

    /// <summary>Stable identifier used for settings persistence + logging.</summary>
    public string Id { get; }

    /// <summary>Human-readable name (usually the Russian label from the UI).</summary>
    public string DisplayName { get; }

    /// <summary>Whether the module is checked on in the UI.</summary>
    public bool Enabled { get; set; }

    /// <summary>Earliest UTC time at which the next <see cref="TickAsync"/> should run.</summary>
    public DateTime NextRunAt { get; protected set; } = DateTime.MinValue;

    /// <summary>Optional dependencies injected by <see cref="ModuleScheduler"/>.</summary>
    protected BotvaBrowser Browser { get; private set; } = null!;
    protected Logger Logger { get; private set; } = null!;

    internal void AttachContext(BotvaBrowser browser, Logger logger)
    {
        Browser = browser;
        Logger = logger;
    }

    /// <summary>Called periodically while <see cref="Enabled"/> is true.</summary>
    public abstract Task TickAsync(CancellationToken ct);

    protected void ScheduleNext(TimeSpan delay)
    {
        NextRunAt = DateTime.UtcNow + delay;
    }

    protected void Log(string message) => Logger.Info(DisplayName, message);
    protected void Warn(string message) => Logger.Warn(DisplayName, message);
    protected void Err(string message) => Logger.Error(DisplayName, message);
}
