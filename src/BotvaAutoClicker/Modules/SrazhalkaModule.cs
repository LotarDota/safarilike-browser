using System;
using System.Threading;
using System.Threading.Tasks;
using BotvaAutoClicker.Core;

namespace BotvaAutoClicker.Modules;

/// <summary>
/// «Сражалка» — ходит в PvP-сражалку, выбирает соперника и жмёт «Атаковать».
/// Логика best-effort до полноценной реверс-инженерии игрового клиента.
/// </summary>
public sealed class SrazhalkaModule : BotModule
{
    private const string Url = "https://botva.ru/?action=fight";

    public SrazhalkaModule() : base("srazhalka", "Сражалка")
    {
    }

    public override async Task TickAsync(CancellationToken ct)
    {
        if (!Browser.CurrentUrl.Contains("fight", StringComparison.OrdinalIgnoreCase))
        {
            await Browser.NavigateAsync(Url, ct).ConfigureAwait(false);
            await Task.Delay(TimeSpan.FromSeconds(1), ct).ConfigureAwait(false);
        }

        // Pick first opponent in the list.
        var picked = await Browser.ClickAsync(
            "a.fight-opponent, .opponents-list a:first-of-type, button.fight-pick")
            .ConfigureAwait(false);

        if (!picked)
        {
            Warn("Соперник не найден. Возможно, все бои израсходованы.");
            ScheduleNext(TimeSpan.FromMinutes(15));
            return;
        }

        await Task.Delay(TimeSpan.FromSeconds(1), ct).ConfigureAwait(false);

        var attacked = await Browser.ClickAsync(
            "button.fight-attack, #attackBtn, button[data-action='attack']")
            .ConfigureAwait(false);

        if (attacked)
        {
            Log("Атаковал соперника.");
        }
        else
        {
            Warn("Кнопка «Атаковать» не найдена.");
        }

        ScheduleNext(TimeSpan.FromMinutes(1));
    }
}
