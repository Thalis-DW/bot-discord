import { Client, GatewayIntentBits, Interaction, MessageFlags } from "discord.js";
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
import {
  handleAvaliarEstagio,
  handleBtnAvaliarEstagio,
  handleSelectAvaliarUsuario,
  handleModalAvaliarEstagio,
} from "./commands/avaliar-estagio";
import {
  handleEmitirConvocacao,
  handleBtnEmitirConvocacao,
  handleModalEmitirConvocacao,
} from "./commands/emitir-convocacao";
import {
  handleRso,
  handleBtnAbrirRso,
  handleModalRsoViatura,
  handleSelectRsoMotorista,
  handleSelectRsoComandante,
  handleSelectRsoAuxiliares,
  handleBtnRsoConfirmarEquipe,
  handleModalRsoObs,
  handleBtnFecharRso,
  handleBtnAdicionarApreensoes,
  handleSelectTipoApreensao,
  handleModalValorApreensao,
  handleBtnEditarRso,
  handleSelectRsoEditarMotorista,
  handleSelectRsoEditarComandante,
  handleSelectRsoEditarAuxiliares,
  handleBtnRsoEditarConfirmar,
  handleBtnRsoEditarObs,
  handleModalEditarRso,
  handleBtnContarRsos,
  handleRegistroAtividadeRso,
} from "./commands/rso";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("clientReady", () => {
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
      } else if (interaction.commandName === "avaliar-estagio") {
        await handleAvaliarEstagio(interaction);
      } else if (interaction.commandName === "rso") {
        await handleRso(interaction);
      } else if (interaction.commandName === "registro-atividade-rso") {
        await handleRegistroAtividadeRso(interaction);
      } else if (interaction.commandName === "emitir-convocacao") {
        await handleEmitirConvocacao(interaction);
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
      } else if (interaction.customId === "modal_avaliar_estagio") {
        await handleModalAvaliarEstagio(interaction);
      } else if (interaction.customId === "modal_rso_viatura") {
        await handleModalRsoViatura(interaction);
      } else if (interaction.customId === "modal_emitir_convocacao") {
        await handleModalEmitirConvocacao(interaction);
      } else if (interaction.customId === "modal_rso_obs") {
        await handleModalRsoObs(interaction);
      } else if (interaction.customId === "modal_editar_rso") {
        await handleModalEditarRso(interaction);
      } else if (interaction.customId.startsWith("modal_valor_apreensao:")) {
        const [, tipo] = interaction.customId.split(":");
        await handleModalValorApreensao(interaction, tipo);
      }
      return;
    }

    // String select menus
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "select_graduacao") {
        await handleSelectGraduacao(interaction);
      } else if (interaction.customId === "select_ticket_tipo") {
        await handleSelectTicketTipo(interaction);
      } else if (interaction.customId === "select_tipo_apreensao") {
        await handleSelectTipoApreensao(interaction);
      }
      return;
    }

    // User select menus
    if (interaction.isUserSelectMenu()) {
      if (interaction.customId === "select_add_membro_ticket") {
        await handleSelectAddMembroTicket(interaction);
      } else if (interaction.customId === "select_avaliar_usuario") {
        await handleSelectAvaliarUsuario(interaction);
      } else if (interaction.customId === "select_rso_motorista") {
        await handleSelectRsoMotorista(interaction);
      } else if (interaction.customId === "select_rso_comandante") {
        await handleSelectRsoComandante(interaction);
      } else if (interaction.customId === "select_rso_auxiliares") {
        await handleSelectRsoAuxiliares(interaction);
      } else if (interaction.customId === "select_rso_editar_motorista") {
        await handleSelectRsoEditarMotorista(interaction);
      } else if (interaction.customId === "select_rso_editar_comandante") {
        await handleSelectRsoEditarComandante(interaction);
      } else if (interaction.customId === "select_rso_editar_auxiliares") {
        await handleSelectRsoEditarAuxiliares(interaction);
      }
      return;
    }

    // Botões
    if (interaction.isButton()) {
      if (interaction.customId === "btn_emitir_convocacao") {
        await handleBtnEmitirConvocacao(interaction);
      } else if (interaction.customId === "btn_abrir_funcional") {
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
      } else if (interaction.customId === "btn_avaliar_estagio") {
        await handleBtnAvaliarEstagio(interaction);
      } else if (interaction.customId === "btn_abrir_rso") {
        await handleBtnAbrirRso(interaction);
      } else if (interaction.customId === "btn_fechar_rso") {
        await handleBtnFecharRso(interaction);
      } else if (interaction.customId === "btn_adicionar_apreensoes") {
        await handleBtnAdicionarApreensoes(interaction);
      } else if (interaction.customId === "btn_editar_rso") {
        await handleBtnEditarRso(interaction);
      } else if (interaction.customId === "btn_rso_editar_confirmar") {
        await handleBtnRsoEditarConfirmar(interaction);
      } else if (interaction.customId === "btn_rso_editar_obs") {
        await handleBtnRsoEditarObs(interaction);
      } else if (interaction.customId === "btn_rso_confirmar_equipe") {
        await handleBtnRsoConfirmarEquipe(interaction);
      } else if (interaction.customId === "btn_contar_rsos") {
        await handleBtnContarRsos(interaction);
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

    if (!interaction.isRepliable()) return;

    if (interaction.deferred && !interaction.replied) {
      await interaction
        .editReply({ content: "Ocorreu um erro. Tente novamente." })
        .catch(() => null);
    } else if (!interaction.replied) {
      await interaction
        .reply({ content: "Ocorreu um erro. Tente novamente.", flags: MessageFlags.Ephemeral })
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
