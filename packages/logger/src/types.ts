export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";
export type LogFormat = "pretty" | "json";

export interface LogEvent {
  level: Exclude<LogLevel, "silent">;
  event: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  provider?: string;
  strategy?: string;
  duration?: number;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  meta?: Record<string, unknown>;
}

export type LogTransport = (event: LogEvent) => void;

export interface LogConfig {
  level?: LogLevel;
  format?: LogFormat;
  transport?: LogTransport;
}

export interface Logger {
  debug(event: string, meta?: Omit<LogEvent, "level" | "event" | "timestamp">): void;
  info(event: string, meta?: Omit<LogEvent, "level" | "event" | "timestamp">): void;
  warn(event: string, meta?: Omit<LogEvent, "level" | "event" | "timestamp">): void;
  error(event: string, meta?: Omit<LogEvent, "level" | "event" | "timestamp">): void;
  emit(event: Omit<LogEvent, "timestamp">): void;
}
