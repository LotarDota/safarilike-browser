using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;
using BotvaAutoClicker.Config;
using BotvaAutoClicker.Core;
using BotvaAutoClicker.Modules;

namespace BotvaAutoClicker.Forms;

/// <summary>
/// Main control panel window — recreates the look of the reference "Авто
/// кликер Ботва" program: top login bar, grouped module checkboxes, status
/// log, and a button to open the embedded browser.
/// </summary>
public sealed class MainForm : Form
{
    private readonly AppSettings _settings;
    private readonly Logger _logger;
    private readonly BrowserForm _browserForm;
    private readonly ModuleScheduler _scheduler;
    private readonly Dictionary<string, CheckBox> _moduleCheckboxes = new();

    private TextBox _loginBox = null!;
    private TextBox _passwordBox = null!;
    private ComboBox _serverBox = null!;
    private Button _goButton = null!;
    private Button _browserButton = null!;
    private CheckBox _startCheckbox = null!;
    private TextBox _statusBox = null!;
    private NumericUpDown _exitSeconds = null!;

    public MainForm()
    {
        _settings = AppSettings.Load();
        _logger = new Logger();
        _browserForm = new BrowserForm(_logger);
        _scheduler = new ModuleScheduler(_browserForm.Wrapper, _logger);

        Text = "Авто кликер Ботва";
        Width = 960;
        Height = 640;
        StartPosition = FormStartPosition.Manual;
        Location = new Point(20, 40);
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        Font = new Font("Segoe UI", 8.25f);

        BuildUi();
        RegisterModules();
        ApplySettingsToUi();

        _logger.LogWritten += OnLog;
        _logger.Info("App", "Авто-кликер готов к работе. Введите логин/пароль и нажмите Go.");
    }

    // ──────────────────────────────────────────────────────────────────
    // UI construction
    // ──────────────────────────────────────────────────────────────────

    private void BuildUi()
    {
        var topBar = BuildTopBar();
        var leftPanel = BuildGroupPanel("Основа", "Основа",
            new Point(12, 95), new Size(270, 450));
        var middlePanel = BuildMiddlePanel();
        var dungeonPanel = BuildGroupPanel("Подзем", "Подзем",
            new Point(295, 290), new Size(290, 120));
        var advPanel = BuildGroupPanel("Приключения", "Приключения",
            new Point(295, 415), new Size(290, 130));
        var fortressPanel = BuildGroupPanel("Крепость", "Крепость",
            new Point(595, 95), new Size(330, 180));
        var avatarPanel = BuildGroupPanel("Аватар", "Аватар",
            new Point(595, 280), new Size(330, 260));

        var bottomBar = BuildBottomBar();

        Controls.AddRange(new Control[]
        {
            topBar, leftPanel, middlePanel, dungeonPanel, advPanel,
            fortressPanel, avatarPanel, bottomBar,
        });
    }

    private Panel BuildTopBar()
    {
        var panel = new Panel
        {
            Location = new Point(0, 0),
            Size = new Size(960, 85),
        };

        _loginBox = new TextBox
        {
            Location = new Point(12, 10),
            Width = 140,
            PlaceholderText = "Логин",
        };

        _passwordBox = new TextBox
        {
            Location = new Point(12, 38),
            Width = 140,
            UseSystemPasswordChar = true,
            PlaceholderText = "Пароль",
        };

        _goButton = new Button
        {
            Text = "Go",
            Location = new Point(158, 36),
            Width = 42,
        };
        _goButton.Click += OnGoClicked;

        _serverBox = new ComboBox
        {
            Location = new Point(12, 64),
            Width = 140,
            DropDownStyle = ComboBoxStyle.DropDownList,
        };
        _serverBox.Items.AddRange(new object[] { "Аватар", "Поляны", "Икарус", "Ферма" });
        _serverBox.SelectedIndex = 0;

        _browserButton = new Button
        {
            Text = "Браузер",
            Location = new Point(320, 10),
            Width = 80,
        };
        _browserButton.Click += (_, _) =>
        {
            _browserForm.Show();
            _browserForm.BringToFront();
        };

        _startCheckbox = new CheckBox
        {
            Text = "Поехали",
            Location = new Point(410, 13),
            Width = 80,
        };
        _startCheckbox.CheckedChanged += OnStartCheckedChanged;

        var statusLabel = new Label
        {
            Text = "Статус:",
            Location = new Point(320, 38),
            AutoSize = true,
        };

        _statusBox = new TextBox
        {
            Location = new Point(320, 55),
            Size = new Size(270, 26),
            Multiline = true,
            ReadOnly = true,
            ScrollBars = ScrollBars.Vertical,
        };

        panel.Controls.AddRange(new Control[]
        {
            _loginBox, _passwordBox, _goButton, _serverBox,
            _browserButton, _startCheckbox, statusLabel, _statusBox,
        });
        return panel;
    }

    private Panel BuildMiddlePanel()
    {
        var panel = new Panel
        {
            Location = new Point(295, 95),
            Size = new Size(290, 185),
        };

        var bigStatus = new TextBox
        {
            Dock = DockStyle.Fill,
            Multiline = true,
            ReadOnly = true,
            ScrollBars = ScrollBars.Vertical,
            Font = new Font("Consolas", 8.25f),
            Name = "bigStatus",
        };

        panel.Controls.Add(bigStatus);
        _logger.LogWritten += (_, e) =>
        {
            if (IsDisposed || !IsHandleCreated) return;
            BeginInvoke(() =>
            {
                if (bigStatus.IsDisposed) return;
                bigStatus.AppendText(e + Environment.NewLine);
            });
        };
        return panel;
    }

    private GroupBox BuildGroupPanel(string title, string groupKey, Point location, Size size)
    {
        var group = new GroupBox
        {
            Text = title,
            Location = location,
            Size = size,
        };

        // Two-column layout: once we run out of vertical space in column 1,
        // continue in column 2. 140px columns mirror the reference app.
        const int ColumnWidth = 150;
        const int RowHeight = 20;
        const int TopPadding = 20;
        var usableHeight = size.Height - TopPadding - 5;
        var maxRows = Math.Max(1, usableHeight / RowHeight);

        var index = 0;
        foreach (var desc in ModuleCatalog.Build(_settings).Where(m => m.Group == groupKey))
        {
            var col = index / maxRows;
            var row = index % maxRows;
            var cb = new CheckBox
            {
                Text = desc.DisplayName,
                Location = new Point(10 + col * ColumnWidth, TopPadding + row * RowHeight),
                AutoSize = true,
                Tag = desc.Id,
            };
            cb.CheckedChanged += (_, _) => OnModuleToggled(desc.Id, cb.Checked);
            group.Controls.Add(cb);
            _moduleCheckboxes[desc.Id] = cb;
            index++;
        }

        return group;
    }

    private Panel BuildBottomBar()
    {
        var panel = new Panel
        {
            Location = new Point(0, 555),
            Size = new Size(960, 55),
        };

        var tavernaToggle = new CheckBox
        {
            Text = "Таверна (вход)",
            Location = new Point(12, 12),
            AutoSize = true,
        };

        var button1 = new Button
        {
            Text = "Сохранить настройки",
            Location = new Point(160, 9),
            Width = 180,
        };
        button1.Click += (_, _) =>
        {
            SaveSettingsFromUi();
            _settings.Save();
            _logger.Info("App", "Настройки сохранены.");
        };

        var exitLabel = new Label
        {
            Text = "Exit через (сек):",
            Location = new Point(360, 14),
            AutoSize = true,
        };
        _exitSeconds = new NumericUpDown
        {
            Location = new Point(460, 12),
            Width = 60,
            Minimum = 10,
            Maximum = 9999,
            Value = _settings.ExitTimerSeconds,
        };

        panel.Controls.AddRange(new Control[] { tavernaToggle, button1, exitLabel, _exitSeconds });
        return panel;
    }

    // ──────────────────────────────────────────────────────────────────
    // Module plumbing
    // ──────────────────────────────────────────────────────────────────

    private void RegisterModules()
    {
        foreach (var desc in ModuleCatalog.Build(_settings))
        {
            _scheduler.Register(desc.Factory());
        }
    }

    private void OnModuleToggled(string id, bool enabled)
    {
        var module = _scheduler.Modules.FirstOrDefault(m => m.Id == id);
        if (module == null) return;
        module.Enabled = enabled;
        _settings.ModuleEnabled[id] = enabled;
    }

    // ──────────────────────────────────────────────────────────────────
    // Settings
    // ──────────────────────────────────────────────────────────────────

    private void ApplySettingsToUi()
    {
        _loginBox.Text = _settings.Login;
        _passwordBox.Text = _settings.Password;
        if (!string.IsNullOrEmpty(_settings.Server))
        {
            var idx = _serverBox.Items.IndexOf(_settings.Server);
            if (idx >= 0) _serverBox.SelectedIndex = idx;
        }

        foreach (var (id, on) in _settings.ModuleEnabled)
        {
            if (_moduleCheckboxes.TryGetValue(id, out var cb))
            {
                cb.Checked = on;
            }
        }
    }

    private void SaveSettingsFromUi()
    {
        _settings.Login = _loginBox.Text;
        _settings.Password = _passwordBox.Text;
        _settings.Server = _serverBox.SelectedItem?.ToString() ?? "Аватар";
        _settings.ExitTimerSeconds = (int)_exitSeconds.Value;

        foreach (var (id, cb) in _moduleCheckboxes)
        {
            _settings.ModuleEnabled[id] = cb.Checked;
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Buttons
    // ──────────────────────────────────────────────────────────────────

    private void OnGoClicked(object? sender, EventArgs e)
    {
        SaveSettingsFromUi();
        _settings.Save();

        _browserForm.Show();
        _browserForm.BringToFront();

        var auth = _scheduler.Get<AuthModule>();
        if (auth != null)
        {
            auth.ResetLoginState();
            auth.Enabled = true;
        }

        if (!_scheduler.IsRunning)
        {
            _scheduler.Start();
        }
        _startCheckbox.Checked = true;
    }

    private void OnStartCheckedChanged(object? sender, EventArgs e)
    {
        if (_startCheckbox.Checked)
        {
            if (!_scheduler.IsRunning)
            {
                _scheduler.Start();
            }
            _logger.Info("App", "Автоматизация запущена.");
        }
        else
        {
            _scheduler.Stop();
            _logger.Info("App", "Автоматизация остановлена.");
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Log wiring
    // ──────────────────────────────────────────────────────────────────

    private void OnLog(object? sender, LogEntry entry)
    {
        if (IsDisposed || !IsHandleCreated) return;
        BeginInvoke(() =>
        {
            if (_statusBox.IsDisposed) return;
            if (_statusBox.Lines.Length > 200)
            {
                var keep = _statusBox.Lines.Skip(100).ToArray();
                _statusBox.Lines = keep;
            }
            _statusBox.AppendText(entry + Environment.NewLine);
        });
    }

    // ──────────────────────────────────────────────────────────────────
    // Lifecycle
    // ──────────────────────────────────────────────────────────────────

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        SaveSettingsFromUi();
        _settings.Save();
        _scheduler.Dispose();
        _browserForm.Dispose();
        base.OnFormClosing(e);
    }
}
