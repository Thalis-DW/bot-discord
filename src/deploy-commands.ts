import { REST, Routes, SlashCommandBuilder } from "discord.js";
import * as dotenv from "dotenv";

dotenv.config();

const commands = [
  new SlashCommandBuilder()
    .setName("teste")
    .setDescription("Verifica se o bot está funcionando")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("solicitar-funcional")
    .setDescription("Solicita a atribuição de uma graduação policial")
    .toJSON(),
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

async function deploy(): Promise<void> {
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!clientId) throw new Error("CLIENT_ID não definido no .env");
  if (!guildId) throw new Error("GUILD_ID não definido no .env");

  console.log("Registrando comandos slash...");

  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands,
  });

  console.log("Comandos registrados com sucesso!");
}

deploy().catch(console.error);
