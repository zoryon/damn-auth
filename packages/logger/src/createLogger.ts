import type { LogConfig, LogEvent, Logger, LogLevel } from "./types.js";

const weights: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99
};

function shouldLog(configLevel: LogLevel, eventLevel: LogEvent["level"]) {
  // Higher weights are more important, so a warn logger still prints errors.
  return weights[eventLevel] >= weights[configLevel];
}

function writeConsole(event: LogEvent, format: LogConfig["format"]) {
  if (format === "json") {
    console[event.level](JSON.stringify(event));
    return;
  }

  const parts = [
    `[${event.timestamp}]`,
    event.level.toUpperCase(),
    event.event,
    event.userId ? `user=${event.userId}` : undefined,
    event.provider ? `provider=${event.provider}` : undefined,
    event.strategy ? `strategy=${event.strategy}` : undefined,
    event.duration === undefined ? undefined : `duration=${event.duration}ms`
  ].filter(Boolean);

  console[event.level](parts.join(" "), event.error ?? event.meta ?? "");
}

export function createLogger(config: LogConfig = {}): Logger {
  const level = config.level ?? "info";
  const format = config.format ?? "pretty";

  const emit = (event: Omit<LogEvent, "timestamp">) => {
    if (level === "silent" || !shouldLog(level, event.level)) {
      return;
    }

    // Add the timestamp at the last moment so custom transports receive the final event.
    const fullEvent: LogEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };

    if (config.transport) {
      config.transport(fullEvent);
      return;
    }

    writeConsole(fullEvent, format);
  };

  return {
    debug: (event, meta) => emit({ ...meta, event, level: "debug" }),
    info: (event, meta) => emit({ ...meta, event, level: "info" }),
    warn: (event, meta) => emit({ ...meta, event, level: "warn" }),
    error: (event, meta) => emit({ ...meta, event, level: "error" }),
    emit
  };
}
