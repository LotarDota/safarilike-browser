using System;
using System.Threading;
using System.Threading.Tasks;
using BotvaAutoClicker.Core;

namespace BotvaAutoClicker.Modules;

/// <summary>
/// Generic module that periodically tries to click a single CSS selector.
/// Used as a sensible default for most modules in the screenshot until we
/// reverse-engineer the specific game flow for each one.
/// </summary>
public class SimpleClickModule : BotModule
{
    private readonly string _selector;
    private readonly TimeSpan _interval;

    public SimpleClickModule(string id, string displayName, string selector, TimeSpan interval)
        : base(id, displayName)
    {
        _selector = selector;
        _interval = interval;
    }

    public override async Task TickAsync(CancellationToken ct)
    {
        var clicked = await Browser.ClickAsync(_selector).ConfigureAwait(false);
        if (clicked)
        {
            Log($"Клик по «{_selector}»");
        }
        ScheduleNext(_interval);
    }
}
