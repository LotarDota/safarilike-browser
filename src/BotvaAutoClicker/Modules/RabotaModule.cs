using System;
using System.Threading;
using System.Threading.Tasks;
using BotvaAutoClicker.Core;

namespace BotvaAutoClicker.Modules;

/// <summary>
/// «Работа» — периодически принимает/сдаёт рабочую смену. Фактические URL и
/// селекторы подставь после наблюдения за игрой; текущая реализация ищет
/// универсальные кнопки и логирует действия для отладки.
/// </summary>
public sealed class RabotaModule : BotModule
{
    // Botva historically served the job interface at /?action=work. If the
    // path has changed, update WorkUrl — the rest of the flow is resilient.
    private const string WorkUrl = "https://botva.ru/?action=work";

    public RabotaModule() : base("rabota", "Работа")
    {
    }

    public override async Task TickAsync(CancellationToken ct)
    {
        // Make sure we're on the work page (a no-op if already there).
        if (!Browser.CurrentUrl.Contains("action=work", StringComparison.OrdinalIgnoreCase))
        {
            Log("Переход на страницу работы…");
            await Browser.NavigateAsync(WorkUrl, ct).ConfigureAwait(false);
            await Task.Delay(TimeSpan.FromSeconds(1), ct).ConfigureAwait(false);
        }

        // Try to collect the previous shift payout first.
        var collected = await Browser.ClickAsync("button.work-collect, a.work-collect, #work-collect")
            .ConfigureAwait(false);
        if (collected)
        {
            Log("Получена ЗП за прошлую смену.");
            await Task.Delay(TimeSpan.FromSeconds(1), ct).ConfigureAwait(false);
        }

        // Start a new shift.
        var started = await Browser.ClickAsync("button.work-start, a.work-start, #work-start")
            .ConfigureAwait(false);
        if (started)
        {
            Log("Запущена новая смена.");
        }
        else
        {
            Warn("Не нашёл кнопку старта смены (возможно, смена уже идёт).");
        }

        // Most work shifts on Botva are ~1 hour. Re-check every 10 minutes so
        // we can catch early completions without hammering the server.
        ScheduleNext(TimeSpan.FromMinutes(10));
    }
}
