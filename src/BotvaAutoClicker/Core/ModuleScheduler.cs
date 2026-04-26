using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BotvaAutoClicker.Core;

/// <summary>
/// Runs all registered <see cref="BotModule"/> instances round-robin on a
/// single background loop. A single scheduler avoids concurrent DOM access
/// inside the embedded browser (which would race with the game's JS).
/// </summary>
public sealed class ModuleScheduler : IDisposable
{
    private readonly List<BotModule> _modules = new();
    private readonly BotvaBrowser _browser;
    private readonly Logger _logger;

    private CancellationTokenSource? _cts;
    private Task? _loopTask;

    public ModuleScheduler(BotvaBrowser browser, Logger logger)
    {
        _browser = browser;
        _logger = logger;
    }

    public IReadOnlyList<BotModule> Modules => _modules;

    public bool IsRunning => _loopTask is { IsCompleted: false };

    public void Register(BotModule module)
    {
        module.AttachContext(_browser, _logger);
        _modules.Add(module);
    }

    public T? Get<T>() where T : BotModule => _modules.OfType<T>().FirstOrDefault();

    public void Start()
    {
        if (IsRunning)
        {
            return;
        }

        _cts = new CancellationTokenSource();
        _loopTask = Task.Run(() => LoopAsync(_cts.Token));
        _logger.Info("Scheduler", "Started.");
    }

    public void Stop()
    {
        if (_cts == null)
        {
            return;
        }

        try
        {
            _cts.Cancel();
        }
        catch (ObjectDisposedException)
        {
            // already stopped
        }
        _logger.Info("Scheduler", "Stopping…");
    }

    private async Task LoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            foreach (var module in _modules)
            {
                if (ct.IsCancellationRequested)
                {
                    break;
                }

                if (!module.Enabled)
                {
                    continue;
                }

                if (DateTime.UtcNow < module.NextRunAt)
                {
                    continue;
                }

                try
                {
                    await module.TickAsync(ct).ConfigureAwait(false);
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    _logger.Error(module.DisplayName, $"Unhandled exception: {ex.Message}");
                }
            }

            try
            {
                await Task.Delay(TimeSpan.FromMilliseconds(500), ct).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }

    public void Dispose()
    {
        Stop();
        try
        {
            _loopTask?.Wait(TimeSpan.FromSeconds(2));
        }
        catch
        {
            // ignore
        }
        _cts?.Dispose();
    }
}
