using System;
using System.Windows.Forms;
using BotvaAutoClicker.Core;
using BotvaAutoClicker.Forms;

namespace BotvaAutoClicker;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        // ApplicationConfiguration.Initialize() handles high-DPI, visual
        // styles, and text rendering defaults based on project properties.
        ApplicationConfiguration.Initialize();

        CefRuntimeInitializer.Initialize();

        try
        {
            Application.Run(new MainForm());
        }
        finally
        {
            CefRuntimeInitializer.Shutdown();
        }
    }
}
