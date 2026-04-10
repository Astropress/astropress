const isDev = process.env.NODE_ENV !== "production";

export interface AstropressLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

function emit(level: "info" | "warn" | "error", context: string, message: string, meta?: Record<string, unknown>) {
  if (isDev) {
    const prefix = `[astropress:${context}]`;
    if (meta && Object.keys(meta).length > 0) {
      const fn_ = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
      fn_(prefix, message, meta);
    } else {
      const fn_ = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
      fn_(prefix, message);
    }
    return;
  }

  const entry = JSON.stringify({
    level,
    context,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  });
  process.stderr.write(entry + "\n");
}

export function createLogger(context: string): AstropressLogger {
  return {
    info(message, meta) {
      emit("info", context, message, meta);
    },
    warn(message, meta) {
      emit("warn", context, message, meta);
    },
    error(message, meta) {
      emit("error", context, message, meta);
    },
  };
}
