/**
 * Lightweight structured logger that replaces raw console.error / console.log
 * calls with a centralised interface. Can be swapped to a service like
 * pino or winston when a persistent logging pipeline is added.
 */

type LogLevel = "info" | "warn" | "error"

interface LogPayload {
  [key: string]: unknown
}

/**
 * Formats and outputs a structured log entry
 * @param {LogLevel} level - Severity level
 * @param {string} message - Human-readable log message
 * @param {LogPayload} [payload] - Optional structured data
 */
function log(level: LogLevel, message: string, payload?: LogPayload): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...payload,
  }

  switch (level) {
    case "error":
      // eslint-disable-next-line no-console
      console.error(JSON.stringify(entry))
      break
    case "warn":
      // eslint-disable-next-line no-console
      console.warn(JSON.stringify(entry))
      break
    default:
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(entry))
  }
}

const logger = {
  /**
   * Log an informational event
   * @param {string} message - Log message
   * @param {LogPayload} [payload] - Additional context
   */
  info: (message: string, payload?: LogPayload) => log("info", message, payload),

  /**
   * Log a warning
   * @param {string} message - Log message
   * @param {LogPayload} [payload] - Additional context
   */
  warn: (message: string, payload?: LogPayload) => log("warn", message, payload),

  /**
   * Log an error
   * @param {string} message - Log message
   * @param {LogPayload} [payload] - Additional context
   */
  error: (message: string, payload?: LogPayload) => log("error", message, payload),
}

export default logger
