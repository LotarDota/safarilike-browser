using System;
using System.Threading;
using System.Threading.Tasks;
using BotvaAutoClicker.Core;

namespace BotvaAutoClicker.Modules;

/// <summary>
/// «Таверна» — периодически пьёт напиток (если доступен) и забирает бонус.
/// </summary>
public sealed class TavernaModule : BotModule
{
    private const string TavernaUrl = "https://botva.ru/?action=taverna";

    public TavernaModule() : base("taverna", "Таверна")
    {
    }

    public override async Task TickAsync(CancellationToken ct)
    {
        if (!Browser.CurrentUrl.Contains("taverna", StringComparison.OrdinalIgnoreCase))
        {
            await Browser.NavigateAsync(TavernaUrl, ct).ConfigureAwait(false);
            await Task.Delay(TimeSpan.FromSeconds(1), ct).ConfigureAwait(false);
        }

        var drank = await Browser.ClickAsync(
            "button.taverna-drink, a.taverna-drink, #taverna-drink, button[data-action='drink']")
            .ConfigureAwait(false);

        if (drank)
        {
            Log("Выпил напиток в таверне.");
        }
        else
        {
            Log("Нечего пить (или кулдаун).");
        }

        // Tavern cooldown is typically 4 hours; check every 30 minutes.
        ScheduleNext(TimeSpan.FromMinutes(30));
    }
}
