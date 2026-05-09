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
  UserSelectMenuBuilder,
  UserSelectMenuInteraction,
} from "discord.js";
import { logger } from "../logger";
import { atualizarRegistroAtividade } from "./rso";

// ─── Constante de role ────────────────────────────────────────────────────────

const ROLE_AUSENCIA_JUSTIFICADA = "Ausência Justificada";

// ─── Constantes ───────────────────────────────────────────────────────────────

const CANAL_SOLICITAR_AUSENCIAS   = "📋・solicitar-ausencias";
const CANAL_AUSENCIAS_SOLICITADAS = "📋・ausencias-solicitadas";
const CANAL_REMOVER_AUSENCIA      = "‼️・remover-ausencia";

// ─── 1. Comando /msg-ausencia ─────────────────────────────────────────────────

export async function handleMsgAusencia(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (interaction.user.id !== process.env.AUTHORIZED_USER_ID) {
    await interaction.reply({
      content: "Você não tem permissão para usar este comando.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guild = interaction.guild!;
  const canal = guild.channels.cache.find(
    (c) => c.name === CANAL_SOLICITAR_AUSENCIAS
  ) as TextChannel | undefined;

  if (!canal) {
    await interaction.reply({
      content: `Canal \`${CANAL_SOLICITAR_AUSENCIAS}\` não encontrado.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("📋 Solicitação de Ausência")
    .setDescription(
      "Precisa se ausentar? Clique no botão abaixo para registrar sua ausência.\n\n" +
      "Informe o **motivo** e o **período** em que estará ausente."
    )
    .setColor(0xe67e22);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("btn_solicitar_ausencia")
      .setLabel("Solicitar Ausência")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📋"),
    new ButtonBuilder()
      .setCustomId("btn_self_remover_ausencia")
      .setLabel("Remover Ausência")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("❌")
  );

  await canal.send({ embeds: [embed], components: [row] });

  // ─── Painel de remoção de ausência ───────────────────────────────────────
  const canalRemover = guild.channels.cache.find(
    (c) => c.name === CANAL_REMOVER_AUSENCIA
  ) as TextChannel | undefined;

  if (canalRemover) {
    const embedRemover = new EmbedBuilder()
      .setTitle("‼️ Remover Ausência Justificada")
      .setDescription(
        "Utilize o botão abaixo para remover a tag **Ausência Justificada** de um membro."
      )
      .setColor(0xe74c3c);

    const rowRemover = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("btn_remover_ausencia")
        .setLabel("Remover Ausência")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("‼️")
    );

    await canalRemover.send({ embeds: [embedRemover], components: [rowRemover] });
  }

  const avisos: string[] = [`✅ Painel de ausência publicado em <#${canal.id}>.`];
  if (canalRemover) avisos.push(`✅ Painel de remoção publicado em <#${canalRemover.id}>.`);
  else avisos.push(`⚠️ Canal \`${CANAL_REMOVER_AUSENCIA}\` não encontrado — painel de remoção não publicado.`);

  await interaction.reply({
    content: avisos.join("\n"),
    flags: MessageFlags.Ephemeral,
  });

  logger.info("Painéis de ausência publicados", {
    guild: guild.name,
  });
}

// ─── 2. Botão "Solicitar Ausência" → abre modal ───────────────────────────────

export async function handleBtnSolicitarAusencia(
  interaction: ButtonInteraction
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId("modal_solicitar_ausencia")
    .setTitle("Solicitação de Ausência");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("input_motivo_ausencia")
        .setLabel("Motivo da ausência")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Descreva o motivo da sua ausência...")
        .setRequired(true)
        .setMinLength(5)
        .setMaxLength(500)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("input_periodo_ausencia")
        .setLabel("Período de ausência")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: 10/04 a 17/04")
        .setRequired(true)
        .setMaxLength(100)
    )
  );

  await interaction.showModal(modal);
}

// ─── 3. Modal → envia solicitação no canal de ausências ───────────────────────

export async function handleModalSolicitarAusencia(
  interaction: ModalSubmitInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const motivo  = interaction.fields.getTextInputValue("input_motivo_ausencia").trim();
  const periodo = interaction.fields.getTextInputValue("input_periodo_ausencia").trim();

  const guild  = interaction.guild!;
  const member = await guild.members.fetch(interaction.user.id).catch(() => null);
  const nome   = member?.nickname ?? interaction.user.username;

  const canalSolicitadas = guild.channels.cache.find(
    (c) => c.name === CANAL_AUSENCIAS_SOLICITADAS
  ) as TextChannel | undefined;

  if (!canalSolicitadas) {
    await interaction.editReply({
      content: `⚠️ Canal \`${CANAL_AUSENCIAS_SOLICITADAS}\` não encontrado. Sua solicitação não foi enviada.`,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("📋 Solicitação de Ausência")
    .addFields(
      { name: "👤 Solicitante",     value: nome,    inline: false },
      { name: "📅 Período",         value: periodo,  inline: false },
      { name: "📝 Motivo",          value: motivo,   inline: false }
    )
    .setColor(0xe67e22)
    .setFooter({ text: `ID: ${interaction.user.id}` })
    .setTimestamp();

  await canalSolicitadas.send({ embeds: [embed] });

  // ─── Atribui a role "Ausência Justificada" ao solicitante ────────────────
  const roleAusencia = guild.roles.cache.find(
    (r) => r.name === ROLE_AUSENCIA_JUSTIFICADA
  );

  if (roleAusencia && member) {
    await member.roles.add(roleAusencia).catch(() => null);
  }

  // ─── Atualiza o painel de registro de atividade ───────────────────────────
  await atualizarRegistroAtividade(guild);

  await interaction.editReply({
    content: `✅ Sua ausência foi solicitada com sucesso em <#${canalSolicitadas.id}>.`,
  });

  logger.info("Ausência solicitada", {
    user: nome,
    periodo,
    guild: guild.name,
  });
}

// ─── 4. Botão "Remover Ausência" (self) → remove própria tag ─────────────────

export async function handleBtnSelfRemoverAusencia(
  interaction: ButtonInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild  = interaction.guild!;
  const member = await guild.members.fetch(interaction.user.id).catch(() => null);

  if (!member) {
    await interaction.editReply({ content: "⚠️ Não foi possível encontrar seu perfil no servidor." });
    return;
  }

  const roleAusencia = guild.roles.cache.find((r) => r.name === ROLE_AUSENCIA_JUSTIFICADA);

  if (!roleAusencia) {
    await interaction.editReply({
      content: `⚠️ Role \`${ROLE_AUSENCIA_JUSTIFICADA}\` não encontrada no servidor.`,
    });
    return;
  }

  if (!member.roles.cache.has(roleAusencia.id)) {
    await interaction.editReply({
      content: `⚠️ Você não possui a tag **${ROLE_AUSENCIA_JUSTIFICADA}**.`,
    });
    return;
  }

  await member.roles.remove(roleAusencia);
  await atualizarRegistroAtividade(guild);

  await interaction.editReply({
    content: `✅ Tag **${ROLE_AUSENCIA_JUSTIFICADA}** removida com sucesso.`,
  });

  logger.info("Ausência justificada removida (self)", {
    user: member.nickname ?? member.user.username,
    guild: guild.name,
  });
}

// ─── 5. Botão "Remover Ausência" (staff) → exibe UserSelectMenu ──────────────────────

export async function handleBtnRemoverAusencia(
  interaction: ButtonInteraction
): Promise<void> {
  const select = new UserSelectMenuBuilder()
    .setCustomId("select_remover_ausencia")
    .setPlaceholder("Selecione o membro para remover a ausência...")
    .setMinValues(1)
    .setMaxValues(1);

  await interaction.reply({
    content: "Selecione o membro cuja **Ausência Justificada** será removida:",
    components: [new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(select)],
    flags: MessageFlags.Ephemeral,
  });
}

// ─── 5. UserSelectMenu → remove a role e atualiza o registro ─────────────────

export async function handleSelectRemoverAusencia(
  interaction: UserSelectMenuInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild    = interaction.guild!;
  const targetId = interaction.values[0];
  const member   = await guild.members.fetch(targetId).catch(() => null);

  if (!member) {
    await interaction.editReply({ content: "⚠️ Membro não encontrado no servidor." });
    return;
  }

  const roleAusencia = guild.roles.cache.find(
    (r) => r.name === ROLE_AUSENCIA_JUSTIFICADA
  );

  if (!roleAusencia) {
    await interaction.editReply({
      content: `⚠️ Role \`${ROLE_AUSENCIA_JUSTIFICADA}\` não encontrada no servidor.`,
    });
    return;
  }

  if (!member.roles.cache.has(roleAusencia.id)) {
    await interaction.editReply({
      content: `⚠️ **${member.nickname ?? member.user.username}** não possui a tag **${ROLE_AUSENCIA_JUSTIFICADA}**.`,
    });
    return;
  }

  await member.roles.remove(roleAusencia);
  await atualizarRegistroAtividade(guild);

  const nome = member.nickname ?? member.user.username;

  await interaction.editReply({
    content: `✅ Tag **${ROLE_AUSENCIA_JUSTIFICADA}** removida de **${nome}**. Registro de atividade atualizado.`,
  });

  logger.info("Ausência justificada removida", {
    user: nome,
    por: interaction.user.tag,
    guild: guild.name,
  });
}
