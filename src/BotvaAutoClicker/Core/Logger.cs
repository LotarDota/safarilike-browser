using System;

namespace BotvaAutoClicker.Core;

public sealed class LogEntry
{
    public DateTime Timestamp { get; init; }
    public string Source { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public LogLevel Level { get; init; }

    public override string ToString()
    {
        return $"[{Timestamp:HH:mm:ss}] [{Level}] {Source}: {Message}";
    }
}

public enum LogLevel
{
    Debug,
    Info,
    Warn,
    Error,
}

/// <summary>
/// Simple observable logger. Modules push entries, UI subscribes via <see cref="LogWritten"/>.
/// </summary>
public sealed class Logger
{
    public event EventHandler<LogEntry>? LogWritten;

    public void Debug(string source, string message) => Write(source, message, LogLevel.Debug);
    public void Info(string source, string message) => Write(source, message, LogLevel.Info);
    public void Warn(string source, string message) => Write(source, message, LogLevel.Warn);
    public void Error(string source, string message) => Write(source, message, LogLevel.Error);

    private void Write(string source, string message, LogLevel level)
    {
        var entry = new LogEntry
        {
            Timestamp = DateTime.Now,
            Source = source,
            Message = message,
            Level = level,
        };
        LogWritten?.Invoke(this, entry);
    }
}
