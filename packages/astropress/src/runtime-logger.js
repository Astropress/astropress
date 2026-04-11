const isDev = process.env.NODE_ENV !== "production";

const LOG_LEVEL_ORDER = { error: 0, warn: 1, info: 2 };

function resolveConfiguredLevel() {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw === "error" || raw === "warn" || raw === "info") return raw;
  return "info";
}

const configuredOrder = LOG_LEVEL_ORDER[resolveConfiguredLevel()];

function shouldEmit(level) {
  return LOG_LEVEL_ORDER[level] <= configuredOrder;
}

function emit(level, context, message, meta) {
  if (!shouldEmit(level)) return;

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

export function createLogger(context) {
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
