const isDev = process.env.NODE_ENV !== "production";

function emit(level, context, message, meta) {
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
