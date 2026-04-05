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
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { RANKS } from "../config/ranks";
import { logger } from "../logger";

interface PendingRequest {
  nome: string;
  rg: string;
}

// Armazenamento temporário: userId -> { nome, rg }
const pendingRequests = new Map<string, PendingRequest>();

// ─── 1. Comando /solicitar-funcional (apenas usuário autorizado) ──────────────
//        Envia a mensagem pública com o botão de solicitação

export async function handleSolicitarFuncional(
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
    .setTitle("📋 Solicitação Funcional")
    .setDescription(
      "Clique no botão abaixo para solicitar sua graduação.\n\n" +
      "Você precisará informar seu **nome completo** e **RG**.\n" +
      "Após o envio, alguém do RH irá analisar sua solicitação."
    )
    .setColor(0x3498db);

  const btnSolicitar = new ButtonBuilder()
    .setCustomId("btn_abrir_funcional")
    .setLabel("Solicitar Funcional")
    .setStyle(ButtonStyle.Primary)
    .setEmoji("📋");

  await interaction.reply({
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(btnSolicitar),
    ],
  });

  logger.info("Mensagem de solicitação funcional publicada", {
    canal: interaction.channelId,
    guild: interaction.guild?.name,
  });
}

// ─── 2. Botão público "Solicitar Funcional" → abre o modal ───────────────────

export async function handleBtnAbrirFuncional(
  interaction: ButtonInteraction
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId("modal_solicitar_funcional")
    .setTitle("Solicitação Funcional");

  const nomeInput = new TextInputBuilder()
    .setCustomId("input_nome")
    .setLabel("Nome completo")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Ex: Hugo Smith")
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(40);

  const rgInput = new TextInputBuilder()
    .setCustomId("input_rg")
    .setLabel("RG")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Ex: 25002")
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(20);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nomeInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(rgInput)
  );

  await interaction.showModal(modal);
}

// ─── 2. Recebe o modal e exibe o select de graduação ─────────────────────────

export async function handleModalSolicitarFuncional(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const nome = interaction.fields.getTextInputValue("input_nome").trim();
  const rg = interaction.fields.getTextInputValue("input_rg").trim();

  pendingRequests.set(interaction.user.id, { nome, rg });

  const select = new StringSelectMenuBuilder()
    .setCustomId("select_graduacao")
    .setPlaceholder("Selecione sua graduação...")
    .addOptions(
      RANKS.map((rank) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(rank.label)
          .setValue(rank.value)
          .setEmoji(rank.emoji)
      )
    );

  await interaction.reply({
    content: `**${nome}**, selecione sua graduação abaixo:`,
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

// ─── 3. Recebe o select e envia para #aprovar-funcional ──────────────────────

export async function handleSelectGraduacao(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const userId = interaction.user.id;
  const pending = pendingRequests.get(userId);

  if (!pending) {
    await interaction.update({
      content: "Sessão expirada. Use `/solicitar-funcional` novamente.",
      components: [],
    });
    return;
  }

  pendingRequests.delete(userId);

  const rank = RANKS.find((r) => r.value === interaction.values[0]);
  if (!rank) {
    await interaction.update({ content: "Graduação inválida.", components: [] });
    return;
  }

  const guild = interaction.guild!;

  const canal = guild.channels.cache.find(
    (c) => c.name === "✅・aprovar-funcional"
  ) as TextChannel | undefined;

  if (!canal) {
    await interaction.update({
      content:
        "Canal `✅・aprovar-funcional` não encontrado. Contate um administrador.",
      components: [],
    });
    return;
  }

  const nickFormatado = `${rank.nickPrefix} | ${pending.nome} - ${pending.rg}`;

  const embed = new EmbedBuilder()
    .setTitle("📋 Nova Solicitação Funcional")
    .setColor(0x3498db)
    .setThumbnail(interaction.user.displayAvatarURL())
    .addFields(
      { name: "👤 Usuário Discord", value: `<@${userId}>`, inline: true },
      { name: "📝 Nome completo",   value: pending.nome,   inline: true },
      { name: "🪪 RG",              value: pending.rg,     inline: true },
      {
        name: "🎖️ Graduação solicitada",
        value: `${rank.emoji} **${rank.label}**`,
        inline: true,
      },
      {
        name: "🏷️ Novo apelido",
        value: `\`${nickFormatado}\``,
        inline: false,
      }
    )
    .setTimestamp()
    .setFooter({ text: `ID: ${userId}` });

  const btnAprovar = new ButtonBuilder()
    .setCustomId(`aprovar:${userId}:${rank.value}`)
    .setLabel("Aprovar")
    .setStyle(ButtonStyle.Success)
    .setEmoji("✅");

  const btnRecusar = new ButtonBuilder()
    .setCustomId(`recusar:${userId}`)
    .setLabel("Recusar")
    .setStyle(ButtonStyle.Danger)
    .setEmoji("❌");

  await canal.send({
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        btnAprovar,
        btnRecusar
      ),
    ],
  });

  await interaction.update({
    content:
      "✅ Solicitação enviada com sucesso! Aguarde a aprovação de um administrador.",
    components: [],
  });

  logger.info("Solicitação funcional enviada", {
    user: interaction.user.tag,
    nome: pending.nome,
    rg: pending.rg,
    graduacao: rank.label,
    guild: guild.name,
  });
}

// ─── 4a. Staff aprova: seta cargo, muda apelido e notifica ──────────────────

export async function handleBtnAprovar(
  interaction: ButtonInteraction,
  userId: string,
  rankValue: string
): Promise<void> {
  const rank = RANKS.find((r) => r.value === rankValue);
  if (!rank) {
    await interaction.reply({ content: "Graduação inválida.", flags: MessageFlags.Ephemeral });
    return;
  }

  const guild = interaction.guild!;
  const member = await guild.members.fetch(userId).catch(() => null);

  if (!member) {
    await interaction.reply({
      content: "Usuário não encontrado no servidor.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Lê nome e RG do embed para montar o apelido
  const embedFields = interaction.message.embeds[0]?.fields ?? [];
  const nomeField = embedFields.find((f) => f.name === "📝 Nome completo");
  const rgField   = embedFields.find((f) => f.name === "🪪 RG");
  const nome = nomeField?.value ?? member.user.username;
  const rg   = rgField?.value   ?? "";

  const novoApelido = `${rank.nickPrefix} | ${nome} - ${rg}`;

  // Coleta todos os nomes de cargos gerenciados (principal + extras de todas as graduações)
  const allManagedRoleNames = new Set<string>(
    RANKS.flatMap((r) => [r.roleName, ...r.additionalRoles])
  );

  // Remove todos os cargos gerenciados que o membro já possui
  const rolesToRemove = member.roles.cache.filter((r) =>
    allManagedRoleNames.has(r.name)
  );
  await member.roles.remove(rolesToRemove).catch(() => null);

  // Resolve o cargo principal
  const role = guild.roles.cache.find((r) => r.name === rank.roleName);
  if (!role) {
    await interaction.reply({
      content: `Cargo \`${rank.roleName}\` não existe no servidor. Crie o cargo e tente novamente.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Resolve os cargos extras desta graduação
  const extraRoles = rank.additionalRoles
    .map((name) => guild.roles.cache.find((r) => r.name === name))
    .filter((r): r is NonNullable<typeof r> => r !== undefined);

  await member.roles.add([role, ...extraRoles]);
  await member.setNickname(novoApelido).catch(() => null); // ignora se for dono do servidor

  // Edita o embed indicando aprovação
  const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(0x2ecc71)
    .setTitle("✅ Solicitação Funcional — Aprovada")
    .setFooter({ text: `Aprovado por ${interaction.user.tag}` });

  await interaction.update({ embeds: [updatedEmbed], components: [] });

  // DM para o usuário
  await member
    .send(
      `✅ Sua solicitação funcional foi **aprovada**!\n🎖️ Graduação: **${rank.emoji} ${rank.label}**\n🏷️ Apelido: \`${novoApelido}\``
    )
    .catch(() => null);

  logger.info("Solicitação funcional aprovada", {
    aprovadoPor: interaction.user.tag,
    usuario: member.user.tag,
    graduacao: rank.label,
    apelido: novoApelido,
  });
}

// ─── 4b. Staff recusa: notifica o usuário ────────────────────────────────────

export async function handleBtnRecusar(
  interaction: ButtonInteraction,
  userId: string
): Promise<void> {
  const guild = interaction.guild!;
  const member = await guild.members.fetch(userId).catch(() => null);

  const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(0xe74c3c)
    .setTitle("❌ Solicitação Funcional — Recusada")
    .setFooter({ text: `Recusado por ${interaction.user.tag}` });

  await interaction.update({ embeds: [updatedEmbed], components: [] });

  await member
    ?.send(
      "❌ Sua solicitação funcional foi **recusada**. Entre em contato com um administrador para mais informações."
    )
    .catch(() => null);

  logger.info("Solicitação funcional recusada", {
    recusadoPor: interaction.user.tag,
    usuarioId: userId,
  });
}