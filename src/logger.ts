import mongoose, { Schema, Document } from "mongoose";

type LogLevel = "info" | "warn" | "error";

interface ILog extends Document {
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const logSchema = new Schema<ILog>({
  level: { type: String, enum: ["info", "warn", "error"], required: true },
  message: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

const Log = mongoose.model<ILog>("Log", logSchema);

async function saveLog(
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (mongoose.connection.readyState !== 1) return;
  try {
    await Log.create({ level, message, metadata });
  } catch {
    // fallback silencioso — não quebra o bot se o banco estiver indisponível
  }
}

function formatMeta(metadata?: Record<string, unknown>): string {
  if (!metadata || Object.keys(metadata).length === 0) return "";
  return " " + JSON.stringify(metadata);
}

export const logger = {
  info(message: string, metadata?: Record<string, unknown>): void {
    console.log(`[INFO] ${new Date().toISOString()} — ${message}${formatMeta(metadata)}`);
    saveLog("info", message, metadata);
  },
  warn(message: string, metadata?: Record<string, unknown>): void {
    console.warn(`[WARN] ${new Date().toISOString()} — ${message}${formatMeta(metadata)}`);
    saveLog("warn", message, metadata);
  },
  error(message: string, metadata?: Record<string, unknown>): void {
    console.error(`[ERROR] ${new Date().toISOString()} — ${message}${formatMeta(metadata)}`);
    saveLog("error", message, metadata);
  },
};
