import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { logger } from "../logger";

const LOGO_URL = process.env.CONVOCACAO_LOGO_URL ?? null;

const CANAL_EMITIR = "🏛️・emitir-convocação";
const CANAL_CONVOCACAO = "🏛️・convocação";

// ─── 1. Comando /emitir-convocacao (apenas usuário autorizado) ────────────────
//        Publica o painel com botão no canal de emissão

export async function handleEmitirConvocacao(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (interaction.user.id !== process.env.AUTHORIZED_USER_ID) {
    await interaction.reply({
      content: "Você não tem permissão para usar este comando.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("🏛️ Emitir Convocação — Força Tática")
    .setDescription(
      "Clique no botão abaixo para emitir uma convocação oficial.\n\n" +
        "A convocação será publicada no canal de convocações."
    )
    .setColor(0x2f3136);

  const btn = new ButtonBuilder()
    .setCustomId("btn_emitir_convocacao")
    .setLabel("Emitir Convocação")
    .setStyle(ButtonStyle.Primary)
    .setEmoji("📋");

  await interaction.reply({
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(btn)],
  });

  logger.info("Painel de convocação publicado", {
    canal: interaction.channelId,
    guild: interaction.guild?.name,
  });
}

// ─── 2. Botão "Emitir Convocação" → abre modal com campos ────────────────────

export async function handleBtnEmitirConvocacao(
  interaction: ButtonInteraction
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId("modal_emitir_convocacao")
    .setTitle("Emitir Convocação — Força Tática");

  const corpoInput = new TextInputBuilder()
    .setCustomId("input_corpo")
    .setLabel("Corpo da Convocação")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Escreva o conteúdo da convocação...")
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(2000);

  const horarioInput = new TextInputBuilder()
    .setCustomId("input_horario")
    .setLabel("Horário e Data")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Ex: 20/04/2026 às 20h00")
    .setRequired(true)
    .setMaxLength(100);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(corpoInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(horarioInput)
  );

  await interaction.showModal(modal);
}

// ─── 3. Modal → publica convocação no canal oficial ───────────────────────────

export async function handleModalEmitirConvocacao(
  interaction: ModalSubmitInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild!;
  const corpo = interaction.fields.getTextInputValue("input_corpo").trim();
  const horario = interaction.fields.getTextInputValue("input_horario").trim();

  const membro = await guild.members.fetch(interaction.user.id).catch(() => null);
  const apelido = membro?.nickname ?? interaction.user.displayName;

  const canal = guild.channels.cache.find(
    (c) => c.isTextBased() && c.name === CANAL_CONVOCACAO
  ) as TextChannel | undefined;

  if (!canal) {
    await interaction.editReply({
      content: `Canal \`${CANAL_CONVOCACAO}\` não encontrado. Contate um administrador.`,
    });
    return;
  }

  const role = guild.roles.cache.find((r) => r.name === "👮🏻‍♀️| Policial Militar");

  const embed = new EmbedBuilder()
    .setTitle("Convocação - Força Tática")
    .setDescription(`${corpo}\n\n**📅 ${horario}**`)
    .setColor(0x2f3136)
    .setTimestamp()
    .setFooter({ text: `Assina: ${apelido}\nForça Tática` });

  if (LOGO_URL) embed.setThumbnail(LOGO_URL);

  await canal.send({
    content: role ? `<@&${role.id}>` : undefined,
    embeds: [embed],
  });

  await interaction.editReply({
    content: `✅ Convocação emitida com sucesso em <#${canal.id}>!`,
  });

  logger.info("Convocação emitida", {
    emitidoPor: interaction.user.tag,
    apelido,
    canal: canal.name,
    guild: guild.name,
  });
}
