using System;
using System.Threading;
using System.Threading.Tasks;
using BotvaAutoClicker.Core;

namespace BotvaAutoClicker.Modules;

/// <summary>
/// Placeholder for modules whose precise game logic is not yet implemented.
/// When enabled, it logs a friendly heartbeat every minute so the user knows
/// the checkbox is wired up correctly. Replace with a proper subclass of
/// <see cref="BotModule"/> once the corresponding flow is reversed.
/// </summary>
public sealed class StubModule : BotModule
{
    public StubModule(string id, string displayName) : base(id, displayName)
    {
    }

    public override Task TickAsync(CancellationToken ct)
    {
        Log("TODO: реализовать логику модуля (пока только UI-заглушка).");
        ScheduleNext(TimeSpan.FromMinutes(1));
        return Task.CompletedTask;
    }
}
