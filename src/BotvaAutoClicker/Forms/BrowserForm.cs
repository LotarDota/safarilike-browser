using System;
using System.Windows.Forms;
using BotvaAutoClicker.Core;
using CefSharp;
using CefSharp.WinForms;

namespace BotvaAutoClicker.Forms;

/// <summary>
/// Secondary window that hosts the embedded CefSharp browser. We keep it
/// separate from the control panel so the UI stays compact even when the
/// user is browsing the game.
/// </summary>
public sealed class BrowserForm : Form
{
    private readonly ChromiumWebBrowser _browser;

    public BrowserForm(Logger logger)
    {
        Text = "Botva Online - встроенный Chromium";
        Width = 1100;
        Height = 820;
        StartPosition = FormStartPosition.Manual;
        Location = new System.Drawing.Point(640, 40);

        _browser = new ChromiumWebBrowser(BotvaBrowser.StartUrl)
        {
            Dock = DockStyle.Fill,
        };

        _browser.LoadError += (_, e) =>
        {
            if (e.ErrorCode != CefErrorCode.Aborted)
            {
                logger.Warn("Browser", $"Load error {e.ErrorCode}: {e.ErrorText} ({e.FailedUrl})");
            }
        };

        _browser.TitleChanged += (_, e) =>
        {
            if (!string.IsNullOrWhiteSpace(e.Title))
            {
                BeginInvoke(() => Text = $"Botva — {e.Title}");
            }
        };

        Controls.Add(_browser);

        Wrapper = new BotvaBrowser(_browser, logger);
    }

    public BotvaBrowser Wrapper { get; }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        // Hide rather than dispose — the scheduler may still hold references.
        if (e.CloseReason == CloseReason.UserClosing)
        {
            e.Cancel = true;
            Hide();
        }
        base.OnFormClosing(e);
    }
}
