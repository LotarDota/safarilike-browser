using System;
using System.Threading;
using System.Threading.Tasks;
using CefSharp;
using CefSharp.WinForms;

namespace BotvaAutoClicker.Core;

/// <summary>
/// Thin, module-friendly wrapper around <see cref="ChromiumWebBrowser"/>.
/// Provides scripted navigation + JS evaluation primitives that every bot
/// module can reuse without poking CefSharp directly.
/// </summary>
public sealed class BotvaBrowser
{
    public const string StartUrl = "https://botva.ru/";

    private readonly ChromiumWebBrowser _browser;
    private readonly Logger _logger;

    public BotvaBrowser(ChromiumWebBrowser browser, Logger logger)
    {
        _browser = browser;
        _logger = logger;
    }

    public ChromiumWebBrowser Inner => _browser;

    public string CurrentUrl => _browser.Address ?? string.Empty;

    public bool IsLoaded => _browser.IsBrowserInitialized && !_browser.IsLoading;

    public async Task NavigateAsync(string url, CancellationToken ct = default)
    {
        _logger.Debug("Browser", $"Navigate → {url}");
        _browser.Load(url);
        await WaitForLoadAsync(ct).ConfigureAwait(false);
    }

    public async Task WaitForLoadAsync(CancellationToken ct = default)
    {
        var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

        void Handler(object? sender, LoadingStateChangedEventArgs e)
        {
            if (!e.IsLoading)
            {
                tcs.TrySetResult(true);
            }
        }

        _browser.LoadingStateChanged += Handler;
        try
        {
            using (ct.Register(() => tcs.TrySetCanceled(ct)))
            {
                if (!_browser.IsLoading)
                {
                    return;
                }
                await tcs.Task.ConfigureAwait(false);
            }
        }
        finally
        {
            _browser.LoadingStateChanged -= Handler;
        }
    }

    /// <summary>
    /// Evaluates a JS expression in the main frame. Returns (success, result)
    /// so callers don't have to deal with CefSharp-specific response types.
    /// </summary>
    public async Task<(bool Success, object? Result, string? Message)> EvaluateAsync(
        string script, TimeSpan? timeout = null)
    {
        if (!_browser.IsBrowserInitialized)
        {
            return (false, null, "Browser not initialized");
        }

        try
        {
            var frame = _browser.GetMainFrame();
            if (frame == null || !frame.IsValid)
            {
                return (false, null, "No valid main frame");
            }

            var response = await frame.EvaluateScriptAsync(script, timeout: timeout).ConfigureAwait(false);
            return (response.Success, response.Result, response.Message);
        }
        catch (Exception ex)
        {
            _logger.Error("Browser", $"EvaluateAsync failed: {ex.Message}");
            return (false, null, ex.Message);
        }
    }

    public Task ExecuteAsync(string script)
    {
        if (!_browser.IsBrowserInitialized)
        {
            return Task.CompletedTask;
        }

        var frame = _browser.GetMainFrame();
        if (frame != null && frame.IsValid)
        {
            frame.ExecuteJavaScriptAsync(script, "about:botva-autoclicker");
        }
        return Task.CompletedTask;
    }

    /// <summary>
    /// Clicks the first element matching <paramref name="selector"/> inside the
    /// main frame. Returns true iff the element existed.
    /// </summary>
    public async Task<bool> ClickAsync(string selector)
    {
        var js =
            "(function(){var e=document.querySelector(" + ToJsString(selector) + ");" +
            "if(!e)return false;e.click();return true;})();";
        var (success, result, _) = await EvaluateAsync(js).ConfigureAwait(false);
        return success && result is bool ok && ok;
    }

    public async Task<bool> ElementExistsAsync(string selector)
    {
        var js = "!!document.querySelector(" + ToJsString(selector) + ")";
        var (success, result, _) = await EvaluateAsync(js).ConfigureAwait(false);
        return success && result is bool ok && ok;
    }

    public async Task SetInputValueAsync(string selector, string value)
    {
        var js =
            "(function(){var e=document.querySelector(" + ToJsString(selector) + ");" +
            "if(!e)return;e.focus();e.value=" + ToJsString(value) + ";" +
            "e.dispatchEvent(new Event('input',{bubbles:true}));" +
            "e.dispatchEvent(new Event('change',{bubbles:true}));})();";
        await EvaluateAsync(js).ConfigureAwait(false);
    }

    private static string ToJsString(string value)
    {
        return "\"" + value
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\r", "\\r")
            .Replace("\n", "\\n") + "\"";
    }
}
