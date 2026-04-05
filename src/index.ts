import { Client, GatewayIntentBits, Interaction } from "discord.js";
import * as dotenv from "dotenv";
import { connectDatabase } from "./database";
import { logger } from "./logger";
import {
  handleSolicitarFuncional,
  handleBtnAbrirFuncional,
  handleModalSolicitarFuncional,
  handleSelectGraduacao,
  handleBtnAprovar,
  handleBtnRecusar,
} from "./commands/solicitar-funcional";
import {
  handleTicket,
  handleSelectTicketTipo,
  handleModalTicketResumo,
  handleBtnEncerrarTicket,
  handleBtnAddMembro,
  handleSelectAddMembroTicket,
  handleBtnRenomearTicket,
  handleModalRenomearTicket,
  handleBtnNotificarMembro,
  handleModalEncerrarTicket,
} from "./commands/ticket";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("ready", () => {
  logger.info(`Bot online como ${client.user?.tag}`);
});

client.on("interactionCreate", async (interaction: Interaction) => {
  try {
    // Comandos slash
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "teste") {
        await interaction.reply("✅ Bot funcionando corretamente!");
        logger.info("Comando /teste usado", {
          user: interaction.user.tag,
          guild: interaction.guild?.name,
        });
      } else if (interaction.commandName === "solicitar-funcional") {
        await handleSolicitarFuncional(interaction);
      } else if (interaction.commandName === "ticket") {
        await handleTicket(interaction);
      }
      return;
    }

    // Modais
    if (interaction.isModalSubmit()) {
      if (interaction.customId === "modal_solicitar_funcional") {
        await handleModalSolicitarFuncional(interaction);
      } else if (interaction.customId.startsWith("modal_ticket_resumo:")) {
        const [, tipo] = interaction.customId.split(":");
        await handleModalTicketResumo(interaction, tipo);
      } else if (interaction.customId.startsWith("modal_encerrar_ticket:")) {
        const [, openerUserId] = interaction.customId.split(":");
        await handleModalEncerrarTicket(interaction, openerUserId);
      } else if (interaction.customId === "modal_renomear_ticket") {
        await handleModalRenomearTicket(interaction);
      }
      return;
    }

    // String select menus
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "select_graduacao") {
        await handleSelectGraduacao(interaction);
      } else if (interaction.customId === "select_ticket_tipo") {
        await handleSelectTicketTipo(interaction);
      }
      return;
    }

    // User select menus
    if (interaction.isUserSelectMenu()) {
      if (interaction.customId === "select_add_membro_ticket") {
        await handleSelectAddMembroTicket(interaction);
      }
      return;
    }

    // Botões
    if (interaction.isButton()) {
      if (interaction.customId === "btn_abrir_funcional") {
        await handleBtnAbrirFuncional(interaction);
      } else if (interaction.customId.startsWith("aprovar:")) {
        const [, userId, rankValue] = interaction.customId.split(":");
        await handleBtnAprovar(interaction, userId, rankValue);
      } else if (interaction.customId.startsWith("recusar:")) {
        const [, userId] = interaction.customId.split(":");
        await handleBtnRecusar(interaction, userId);
      } else if (interaction.customId.startsWith("encerrar_ticket:")) {
        const [, userId] = interaction.customId.split(":");
        await handleBtnEncerrarTicket(interaction, userId);
      } else if (interaction.customId === "add_membro_ticket") {
        await handleBtnAddMembro(interaction);
      } else if (interaction.customId === "renomear_ticket") {
        await handleBtnRenomearTicket(interaction);
      } else if (interaction.customId.startsWith("notificar_membro:")) {
        const [, userId] = interaction.customId.split(":");
        await handleBtnNotificarMembro(interaction, userId);
      }
    }
  } catch (error) {
    logger.error("Erro ao processar interação", { error: String(error) });

    if (
      interaction.isRepliable() &&
      !interaction.replied &&
      !interaction.deferred
    ) {
      await interaction
        .reply({ content: "Ocorreu um erro. Tente novamente.", ephemeral: true })
        .catch(() => null);
    }
  }
});

async function main(): Promise<void> {
  await connectDatabase();
  await client.login(process.env.DISCORD_TOKEN);
}

main().catch((error) => {
  logger.error("Erro fatal ao iniciar o bot", { error: String(error) });
  process.exit(1);
});
