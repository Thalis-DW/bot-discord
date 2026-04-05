type LogLevel = "info" | "warn" | "error";

function formatMeta(metadata?: Record<string, unknown>): string {
  if (!metadata || Object.keys(metadata).length === 0) return "";
  return " " + JSON.stringify(metadata);
}

export const logger = {
  info(message: string, metadata?: Record<string, unknown>): void {
    console.log(`[INFO] ${new Date().toISOString()} — ${message}${formatMeta(metadata)}`);
  },
  warn(message: string, metadata?: Record<string, unknown>): void {
    console.warn(`[WARN] ${new Date().toISOString()} — ${message}${formatMeta(metadata)}`);
  },
  error(message: string, metadata?: Record<string, unknown>): void {
    console.error(`[ERROR] ${new Date().toISOString()} — ${message}${formatMeta(metadata)}`);
  },
};
