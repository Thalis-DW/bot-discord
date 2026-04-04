import mongoose from "mongoose";

export async function connectDatabase(): Promise<void> {
  const uri =
    process.env.MONGODB_URI || "mongodb://localhost:27017/botdiscord";

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("MongoDB conectado com sucesso");
  } catch (err) {
    console.warn(`[DB] Não foi possível conectar ao MongoDB (${uri}). Logs não serão persistidos.`);
    console.warn("[DB] Causa:", err instanceof Error ? err.message : String(err));
    return; // não bloqueia o bot
  }

  mongoose.connection.on("disconnected", () => {
    console.warn("[DB] MongoDB desconectado. Aguardando reconexão...");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("[DB] MongoDB reconectado");
  });

  mongoose.connection.on("error", (err) => {
    console.error("[DB] Erro na conexão MongoDB:", err);
  });
}
