import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CategoryChannel,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  UserSelectMenuInteraction,
} from "discord.js";
import { logger } from "../logger";

interface TipoTicket {
  label: string;
  prefix: string;
  emoji: string;
}

const TICKET_TIPOS: Record<string, TipoTicket> = {
  "alteracao-discord": {
    label: "Alteração Discord",
    prefix: "discord",
    emoji: "🔧",
  },
  "alteracao-hierarquia": {
    label: "Alteração Hierarquia",
    prefix: "hierarquia",
    emoji: "📊",
  },
  outros: {
    label: "Outros",
    prefix: "outros",
    emoji: "📝",
  },
};

const CATEGORIA_TICKETS = "🎫┇TICKETS-P1";

// ─── 1. Comando /ticket (apenas usuário autorizado) ───────────────────────────
//        Publica o select menu permanente no canal

export async function handleTicket(
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
    .setTitle("🎫 Sistema de Tickets — RH")
    .setDescription(
      "Selecione abaixo o tipo de atendimento que você deseja.\n\n" +
        "🔧 **Alteração Discord** — Solicitar alteração no seu perfil Discord\n" +
        "📊 **Alteração Hierarquia** — Solicitar alteração de cargo/hierarquia\n" +
        "📝 **Outros** — Outros assuntos com o RH"
    )
    .setColor(0x5865f2)
    .setFooter({ text: "Após selecionar, você receberá um formulário rápido." });

  const select = new StringSelectMenuBuilder()
    .setCustomId("select_ticket_tipo")
    .setPlaceholder("Selecione o tipo de ticket...")
    .addOptions(
      Object.entries(TICKET_TIPOS).map(([value, { label, emoji }]) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(label)
          .setValue(value)
          .setEmoji(emoji)
      )
    );

  await interaction.reply({
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
    ],
  });

  logger.info("Menu de tickets publicado", {
    canal: interaction.channelId,
    guild: interaction.guild?.name,
  });
}

// ─── 2. Select de tipo → abre modal com campo de resumo ──────────────────────

export async function handleSelectTicketTipo(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const tipo = interaction.values[0];
  const tipoInfo = TICKET_TIPOS[tipo];

  if (!tipoInfo) {
    await interaction.reply({ content: "Tipo inválido.", flags: MessageFlags.Ephemeral });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`modal_ticket_resumo:${tipo}`)
    .setTitle(`${tipoInfo.emoji} ${tipoInfo.label}`);

  const resumoInput = new TextInputBuilder()
    .setCustomId("input_resumo")
    .setLabel("Resumo do que você precisa")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Descreva brevemente o que você deseja...")
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(resumoInput)
  );

  await interaction.showModal(modal);
}

// ─── 3. Modal com resumo → cria canal de ticket na categoria ─────────────────

export async function handleModalTicketResumo(
  interaction: ModalSubmitInteraction,
  tipo: string
): Promise<void> {
  const tipoInfo = TICKET_TIPOS[tipo];
  if (!tipoInfo) {
    await interaction.reply({ content: "Tipo inválido.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild!;
  const resumo = interaction.fields.getTextInputValue("input_resumo").trim();
  const userId = interaction.user.id;

  const categoria = guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildCategory && c.name === CATEGORIA_TICKETS
  ) as CategoryChannel | undefined;

  if (!categoria) {
    await interaction.editReply({
      content: `Categoria \`${CATEGORIA_TICKETS}\` não encontrada. Contate um administrador.`,
    });
    return;
  }

  // Nome do canal: prefixo-do-tipo + nome do usuário sanitizado
  const userSlug = interaction.user.username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
  const channelName = `${tipoInfo.prefix}-${userSlug}`;

  // Copia permissões da categoria e adiciona acesso explícito para quem abriu
  const categoryOverwrites = categoria.permissionOverwrites.cache.map((o) => ({
    id: o.id,
    allow: o.allow,
    deny: o.deny,
  }));

  const canal = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoria.id,
    permissionOverwrites: [
      ...categoryOverwrites,
      {
        id: userId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ],
  });

  const embed = new EmbedBuilder()
    .setTitle(`${tipoInfo.emoji} Ticket — ${tipoInfo.label}`)
    .setColor(0x5865f2)
    .setThumbnail(interaction.user.displayAvatarURL())
    .addFields(
      { name: "👤 Aberto por", value: `<@${userId}>`, inline: true },
      { name: "📋 Tipo", value: tipoInfo.label, inline: true },
      { name: "📝 Resumo", value: resumo, inline: false }
    )
    .setTimestamp()
    .setFooter({ text: `ID: ${userId}` });

  const btnEncerrar = new ButtonBuilder()
    .setCustomId(`encerrar_ticket:${userId}`)
    .setLabel("Encerrar Ticket")
    .setStyle(ButtonStyle.Danger)
    .setEmoji("🔒");

  const btnAddMembro = new ButtonBuilder()
    .setCustomId("add_membro_ticket")
    .setLabel("Adicionar Membro")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji("➕");

  const btnRenomear = new ButtonBuilder()
    .setCustomId("renomear_ticket")
    .setLabel("Renomear Ticket")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji("✏️");

  const btnNotificar = new ButtonBuilder()
    .setCustomId(`notificar_membro:${userId}`)
    .setLabel("Notificar Membro")
    .setStyle(ButtonStyle.Primary)
    .setEmoji("🔔");

  await canal.send({
    content: `<@${userId}>`,
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        btnEncerrar,
        btnAddMembro,
        btnRenomear,
        btnNotificar
      ),
    ],
  });

  await interaction.editReply({
    content: `✅ Seu ticket foi aberto em <#${canal.id}>!`,
  });

  logger.info("Ticket aberto", {
    user: interaction.user.tag,
    tipo: tipoInfo.label,
    canal: canal.name,
    guild: guild.name,
  });
}

// ─── 4a. Botão "Encerrar Ticket" → abre modal para informar motivo ───────────

export async function handleBtnEncerrarTicket(
  interaction: ButtonInteraction,
  openerUserId: string
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`modal_encerrar_ticket:${openerUserId}`)
    .setTitle("Encerrar Ticket");

  const motivoInput = new TextInputBuilder()
    .setCustomId("input_motivo")
    .setLabel("Motivo do encerramento")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Descreva o motivo pelo qual o ticket está sendo encerrado...")
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(motivoInput)
  );

  await interaction.showModal(modal);
}

// ─── 4a-2. Modal de encerramento → deleta canal e notifica via DM ─────────────

export async function handleModalEncerrarTicket(
  interaction: ModalSubmitInteraction,
  openerUserId: string
): Promise<void> {
  const canal = interaction.channel as TextChannel;
  const guild = interaction.guild!;
  const motivo = interaction.fields.getTextInputValue("input_motivo").trim();

  await interaction.reply({ content: "🔒 Encerrando ticket em 5 segundos..." });

  const opener = await guild.members.fetch(openerUserId).catch(() => null);

  await opener
    ?.send(
      `🔒 Seu ticket **${canal.name}** foi encerrado por **${interaction.user.tag}**.\n\n` +
        `📋 **Motivo:** ${motivo}`
    )
    .catch(() => null);

  logger.info("Ticket encerrado", {
    encerradoPor: interaction.user.tag,
    openerUserId,
    motivo,
    canal: canal.name,
    guild: guild.name,
  });

  setTimeout(async () => {
    await canal.delete("Ticket encerrado").catch(() => null);
  }, 5000);
}

// ─── 4b. Botão "Adicionar Membro" → exibe UserSelectMenu efêmero ─────────────

export async function handleBtnAddMembro(
  interaction: ButtonInteraction
): Promise<void> {
  const select = new UserSelectMenuBuilder()
    .setCustomId("select_add_membro_ticket")
    .setPlaceholder("Selecione o membro a adicionar...")
    .setMinValues(1)
    .setMaxValues(1);

  await interaction.reply({
    content: "Selecione o membro que deseja adicionar ao ticket:",
    components: [
      new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(select),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

// ─── 4b-2. UserSelect → adiciona permissão de visualização no canal ──────────

export async function handleSelectAddMembroTicket(
  interaction: UserSelectMenuInteraction
): Promise<void> {
  const canal = interaction.channel as TextChannel;
  const membroId = interaction.values[0];

  await canal.permissionOverwrites.edit(membroId, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
  });

  await interaction.update({
    content: `✅ <@${membroId}> foi adicionado ao ticket.`,
    components: [],
  });

  logger.info("Membro adicionado ao ticket", {
    adicionadoPor: interaction.user.tag,
    membroId,
    canal: canal.name,
  });
}

// ─── 4c. Botão "Renomear Ticket" → abre modal com novo nome ──────────────────

export async function handleBtnRenomearTicket(
  interaction: ButtonInteraction
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId("modal_renomear_ticket")
    .setTitle("Renomear Ticket");

  const nomeInput = new TextInputBuilder()
    .setCustomId("input_novo_nome")
    .setLabel("Novo nome do canal")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Ex: vip-joaosilva")
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(50);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nomeInput)
  );

  await interaction.showModal(modal);
}

// ─── 4c-2. Modal renomear → aplica novo nome no canal ────────────────────────

export async function handleModalRenomearTicket(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const canal = interaction.channel as TextChannel;
  const nomeAnterior = canal.name;

  const novoNome = interaction.fields
    .getTextInputValue("input_novo_nome")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  await canal.setName(novoNome);

  await interaction.reply({
    content: `✅ Canal renomeado de \`${nomeAnterior}\` para \`${novoNome}\`.`,
    flags: MessageFlags.Ephemeral,
  });

  logger.info("Ticket renomeado", {
    renomeadoPor: interaction.user.tag,
    de: nomeAnterior,
    para: novoNome,
  });
}

// ─── 4d. Botão "Notificar Membro" → envia DM para quem abriu o ticket ────────

export async function handleBtnNotificarMembro(
  interaction: ButtonInteraction,
  openerUserId: string
): Promise<void> {
  const guild = interaction.guild!;
  const canal = interaction.channel as TextChannel;
  const opener = await guild.members.fetch(openerUserId).catch(() => null);

  if (!opener) {
    await interaction.reply({
      content: "Usuário não encontrado no servidor.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const enviado = await opener
    .send(
      `🔔 **${interaction.user.tag}** está te chamando no ticket!\n` +
        `📂 Canal: **${canal.name}**\n` +
        `🔗 Acesse: <#${canal.id}>`
    )
    .catch(() => null);

  await interaction.reply({
    content: enviado
      ? `✅ <@${openerUserId}> foi notificado no privado.`
      : `⚠️ Não foi possível enviar DM para <@${openerUserId}> (DMs desativadas).`,
    flags: MessageFlags.Ephemeral,
  });

  logger.info("Membro notificado via DM", {
    notificadoPor: interaction.user.tag,
    openerUserId,
    canal: canal.name,
  });
}
