import mongoose, { Schema, Document } from "mongoose";
import * as dotenv from "dotenv";

dotenv.config();

// ─── Modelo mínimo (apenas o necessário para o update) ───────────────────────

interface IRSO extends Document {
  contado: boolean;
  status: string;
}

const rsoSchema = new Schema<IRSO>(
  { contado: Boolean, status: String },
  { strict: false }
);

const RSO = mongoose.model<IRSO>("RSO", rsoSchema);

// ─── Script ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/botdiscord";

  console.log(`Conectando em: ${uri}`);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log("Conectado.\n");

  // Prévia: quantos serão afetados
  const totalFechados = await RSO.countDocuments({ status: "fechado", contado: true });
  console.log(`RSOs fechados com contado=true: ${totalFechados}`);

  if (totalFechados === 0) {
    console.log("Nada a resetar. Encerrando.");
    await mongoose.disconnect();
    return;
  }

  const result = await RSO.updateMany(
    { status: "fechado", contado: true },
    { $set: { contado: false } }
  );

  console.log(`\n✅ ${result.modifiedCount} RSO(s) resetados para contado=false.`);

  await mongoose.disconnect();
  console.log("Desconectado. Script finalizado.");
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
