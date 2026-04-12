import mongoose, { Schema, Document } from "mongoose";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Guild,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
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

// ─── Modelo MongoDB ───────────────────────────────────────────────────────────

interface IApreensoes {
  armasFogo: number;
  armaBranca: number;
  municoes: number;
  itensPoliciaisRoubados: number;
  entorpecentes: number;
  bombas: number;
  dinheiroIlicitos: number;
}

interface IRSO extends Document {
  userId: string;
  userNick: string;
  viatura: string;
  motoristaIds: string[];
  comandanteIds: string[];
  auxiliar1Ids: string[];
  auxiliar2Ids: string[];
  auxiliar3Ids: string[];
  observacoes: string;
  inicio: Date;
  fim?: Date;
  status: "aberto" | "fechado";
  messageId?: string;
  apreensoes: IApreensoes;
  contado: boolean;
  createdAt: Date;
}

const rsoSchema = new Schema<IRSO>({
  userId:        { type: String,   required: true },
  userNick:      { type: String,   required: true },
  viatura:       { type: String,   required: true },
  motoristaIds:  { type: [String], required: true },
  comandanteIds: { type: [String], required: true },
  auxiliar1Ids:  { type: [String], default: [] },
  auxiliar2Ids:  { type: [String], default: [] },
  auxiliar3Ids:  { type: [String], default: [] },
  observacoes:  { type: String, default: "" },
  inicio:       { type: Date, required: true },
  fim:          { type: Date },
  status:       { type: String, enum: ["aberto", "fechado"], default: "aberto" },
  messageId:    { type: String },
  apreensoes: {
    armasFogo:              { type: Number, default: 0 },
    armaBranca:             { type: Number, default: 0 },
    municoes:               { type: Number, default: 0 },
    itensPoliciaisRoubados: { type: Number, default: 0 },
    entorpecentes:          { type: Number, default: 0 },
    bombas:                 { type: Number, default: 0 },
    dinheiroIlicitos:       { type: Number, default: 0 },
  },
  contado:   { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const RSO = mongoose.model<IRSO>("RSO", rsoSchema);

// ─── Constantes ───────────────────────────────────────────────────────────────

const CANAL_RSO                  = "📋・rso";
const CANAL_SOLICITAR_CONTAGEM   = "📠・solicitar-contagem-rso";
const CANAL_RELATORIO            = "📚・relatorio-semanal";
const TITULO_PAINEL_CONTAGEM     = "📊 Solicitar Contagem de RSO's";
const CANAL_REGISTRO_ATIVIDADE   = "🏛️・registro-de-atividade-rso";
const ROLE_POLICIAL              = "👮🏻‍♀️| Policial Militar";
const ROLE_AUSENCIA              = "Ausencia";
const TITULO_REGISTRO_ATIVIDADE  = "📊 Registro de Atividade RSO";

const APREENSOES_INFO: Record<string, { label: string; emoji: string }> = {
  armasFogo:              { label: "Armas de fogo",            emoji: "🔫" },
  armaBranca:             { label: "Arma branca",              emoji: "🔪" },
  municoes:               { label: "Munições",                 emoji: "🧨" },
  itensPoliciaisRoubados: { label: "Itens policiais/Roubados", emoji: "🚔" },
  entorpecentes:          { label: "Intorpecentes",            emoji: "💊" },
  bombas:                 { label: "Bombas",                   emoji: "💣" },
  dinheiroIlicitos:       { label: "Dinheiro Ilícitos",        emoji: "💰" },
};

// Armazenamento temporário para o fluxo de abertura
interface PendingRsoAbrir {
  viatura: string;
  motoristaId: string;
  comandanteId: string;
  auxiliar1Id: string;
  auxiliar2Id: string;
  auxiliar3Id: string;
}

const pendingRsoAbrir = new Map<string, PendingRsoAbrir>();

interface PendingRsoEditar {
  motoristaId: string;
  comandanteId: string;
  auxiliarIds: string[];
}

const pendingRsoEditar = new Map<string, PendingRsoEditar>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHora(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function memArr(ids: string[]): string {
  const filtered = ids.filter(Boolean);
  return filtered.length ? filtered.map((id) => `<@${id}>`).join(" | ") : "—";
}

function formatarCorpoRso(rso: IRSO): string {
  const ap = rso.apreensoes;
  return [
    `Viatura: ${rso.viatura}`,
    "",
    `Motorista: ${memArr(rso.motoristaIds)}`,
    `Comandante de equipe: ${memArr(rso.comandanteIds)}`,
    `1° Auxiliar: ${memArr(rso.auxiliar1Ids)}`,
    `2° Auxiliar: ${memArr(rso.auxiliar2Ids)}`,
    `3° Auxiliar: ${memArr(rso.auxiliar3Ids)}`,
    "",
    `Início: ${formatHora(rso.inicio)}`,
    `Fim: ${rso.fim ? formatHora(rso.fim) : "—"}`,
    "",
    "Apreensões: \n",
    `Armas de fogo: ${ap.armasFogo}`,
    `Arma branca: ${ap.armaBranca}`,
    `Munições: ${ap.municoes}`,
    `Itens policiais/Roubados: ${ap.itensPoliciaisRoubados}`,
    `Intorpecentes: ${ap.entorpecentes}`,
    `Bombas: ${ap.bombas}`,
    `Dinheiro Ilícitos: ${ap.dinheiroIlicitos}`,
    "",
    `Obs: ${rso.observacoes || "—"}`,
  ].join("\n");
}

function buildRsoEmbed(rso: IRSO): EmbedBuilder {
  const aberto = rso.status === "aberto";
  return new EmbedBuilder()
    .setTitle(`🚔 RSO — ${aberto ? "🟢 Aberto" : "🔴 Encerrado"}`)
    .setDescription(formatarCorpoRso(rso))
    .setColor(aberto ? 0x2ecc71 : 0xe74c3c)
    .setFooter({ text: rso.userNick })
    .setTimestamp(rso.inicio);
}

async function atualizarMensagemRso(guild: Guild, rso: IRSO): Promise<void> {
  if (!rso.messageId) return;
  const canal = guild.channels.cache.find(
    (c) => c.name === CANAL_RSO
  ) as TextChannel | undefined;
  if (!canal) return;
  const msg = await canal.messages.fetch(rso.messageId).catch(() => null);
  await msg?.edit({ embeds: [buildRsoEmbed(rso)] }).catch(() => null);
}

// ─── 1. Comando /rso ──────────────────────────────────────────────────────────

export async function handleRso(
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
    .setTitle("🚔 Sistema de RSO")
    .setDescription("Utilize os botões abaixo para gerenciar o Relatório de Serviço Operacional.")
    .setColor(0x3498db);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("btn_abrir_rso")
      .setLabel("Abrir RSO")
      .setStyle(ButtonStyle.Success)
      .setEmoji("🟢"),
    new ButtonBuilder()
      .setCustomId("btn_fechar_rso")
      .setLabel("Fechar RSO")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔴"),
    new ButtonBuilder()
      .setCustomId("btn_adicionar_apreensoes")
      .setLabel("Adicionar Apreensões")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📦"),
    new ButtonBuilder()
      .setCustomId("btn_editar_rso")
      .setLabel("Editar RSO")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("✏️"),
  );

  await interaction.reply({ embeds: [embed], components: [row] });
  await publicarPainelContagem(interaction);

  logger.info("Painel de RSO publicado", {
    canal: interaction.channelId,
    guild: interaction.guild?.name,
  });
}

// ─── 2a. Botão "Abrir RSO" → verifica RSO existente e abre modal de viatura ──

export async function handleBtnAbrirRso(
  interaction: ButtonInteraction
): Promise<void> {
  const existente = await RSO.findOne({ userId: interaction.user.id, status: "aberto" });
  if (existente) {
    await interaction.reply({
      content:
        "⚠️ Você já possui um RSO aberto. Encerre o RSO atual antes de abrir um novo.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId("modal_rso_viatura")
    .setTitle("Abrir RSO — Viatura");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("input_viatura")
        .setLabel("Viatura")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: M-18020 TrailBlazer 22")
        .setRequired(true)
        .setMaxLength(60)
    )
  );

  await interaction.showModal(modal);
}

// ─── 2b. Modal de viatura → exibe selects de equipe ──────────────────────────

export async function handleModalRsoViatura(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const viatura = interaction.fields.getTextInputValue("input_viatura").trim();

  pendingRsoAbrir.set(interaction.user.id, {
    viatura,
    motoristaId: "",
    comandanteId: "",
    auxiliar1Id: "",
    auxiliar2Id: "",
    auxiliar3Id: "",
  });

  const rowMotorista = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId("select_rso_motorista")
      .setPlaceholder("Selecione o Motorista...")
      .setMinValues(1)
      .setMaxValues(1)
  );

  const rowComandante = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId("select_rso_comandante")
      .setPlaceholder("Selecione o Comandante de equipe...")
      .setMinValues(1)
      .setMaxValues(1)
  );

  const rowAuxiliares = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId("select_rso_auxiliares")
      .setPlaceholder("Selecione os Auxiliares (até 3, opcional)...")
      .setMinValues(0)
      .setMaxValues(3)
  );

  const rowConfirmar = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("btn_rso_confirmar_equipe")
      .setLabel("Confirmar equipe e adicionar obs.")
      .setStyle(ButtonStyle.Success)
      .setEmoji("✅")
  );

  await interaction.reply({
    content: `**Viatura:** ${viatura}\n\nSelecione a equipe abaixo e clique em confirmar:`,
    components: [rowMotorista, rowComandante, rowAuxiliares, rowConfirmar],
    flags: MessageFlags.Ephemeral,
  });
}

// ─── 2c. Selects de equipe → atualiza pending ────────────────────────────────

export async function handleSelectRsoMotorista(
  interaction: UserSelectMenuInteraction
): Promise<void> {
  const pending = pendingRsoAbrir.get(interaction.user.id);
  if (pending) pending.motoristaId = interaction.values[0];
  await interaction.deferUpdate();
}

export async function handleSelectRsoComandante(
  interaction: UserSelectMenuInteraction
): Promise<void> {
  const pending = pendingRsoAbrir.get(interaction.user.id);
  if (pending) pending.comandanteId = interaction.values[0];
  await interaction.deferUpdate();
}

export async function handleSelectRsoAuxiliares(
  interaction: UserSelectMenuInteraction
): Promise<void> {
  const pending = pendingRsoAbrir.get(interaction.user.id);
  if (pending) {
    const [a1 = "", a2 = "", a3 = ""] = interaction.values;
    pending.auxiliar1Id = a1;
    pending.auxiliar2Id = a2;
    pending.auxiliar3Id = a3;
  }
  await interaction.deferUpdate();
}

// ─── 2d. Botão confirmar equipe → valida e abre modal de observações ──────────

export async function handleBtnRsoConfirmarEquipe(
  interaction: ButtonInteraction
): Promise<void> {
  const pending = pendingRsoAbrir.get(interaction.user.id);

  if (!pending) {
    await interaction.reply({
      content: "Sessão expirada. Clique em **Abrir RSO** novamente.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!pending.motoristaId || !pending.comandanteId) {
    await interaction.reply({
      content: "⚠️ Selecione o **Motorista** e o **Comandante de equipe** antes de confirmar.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId("modal_rso_obs")
    .setTitle("Observações do RSO");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("input_obs")
        .setLabel("Observações")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(500)
    )
  );

  await interaction.showModal(modal);
}

// ─── 2e. Modal de obs → cria RSO e envia no canal ────────────────────────────

export async function handleModalRsoObs(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const pending = pendingRsoAbrir.get(interaction.user.id);
  if (!pending) {
    await interaction.reply({
      content: "Sessão expirada. Clique em **Abrir RSO** novamente.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  pendingRsoAbrir.delete(interaction.user.id);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild   = interaction.guild!;
  const member  = await guild.members.fetch(interaction.user.id).catch(() => null);
  const obs     = interaction.fields.getTextInputValue("input_obs").trim();

  const rsoDoc = await RSO.create({
    userId:        interaction.user.id,
    userNick:      member?.nickname ?? interaction.user.username,
    viatura:       pending.viatura,
    motoristaIds:  [pending.motoristaId],
    comandanteIds: [pending.comandanteId],
    auxiliar1Ids:  pending.auxiliar1Id ? [pending.auxiliar1Id] : [],
    auxiliar2Ids:  pending.auxiliar2Id ? [pending.auxiliar2Id] : [],
    auxiliar3Ids:  pending.auxiliar3Id ? [pending.auxiliar3Id] : [],
    observacoes:   obs,
    inicio:       new Date(),
    apreensoes: {
      armasFogo: 0, armaBranca: 0, municoes: 0,
      itensPoliciaisRoubados: 0, entorpecentes: 0, bombas: 0, dinheiroIlicitos: 0,
    },
  });

  const canalRso = guild.channels.cache.find(
    (c) => c.name === CANAL_RSO
  ) as TextChannel | undefined;

  if (!canalRso) {
    await interaction.editReply({ content: `Canal \`${CANAL_RSO}\` não encontrado.` });
    await rsoDoc.deleteOne();
    return;
  }

  const msg = await canalRso.send({ embeds: [buildRsoEmbed(rsoDoc)] });
  rsoDoc.messageId = msg.id;
  await rsoDoc.save();

  await interaction.editReply({
    content: `✅ RSO aberto com sucesso! Acompanhe em <#${canalRso.id}>.`,
  });

  logger.info("RSO aberto", { user: rsoDoc.userNick, viatura: rsoDoc.viatura, guild: guild.name });
}

// ─── 3. Botão "Fechar RSO" ────────────────────────────────────────────────────

export async function handleBtnFecharRso(
  interaction: ButtonInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const rso = await RSO.findOne({ userId: interaction.user.id, status: "aberto" });
  if (!rso) {
    await interaction.editReply({ content: "⚠️ Você não possui nenhum RSO aberto." });
    return;
  }

  rso.status = "fechado";
  rso.fim    = new Date();
  await rso.save();

  await atualizarMensagemRso(interaction.guild!, rso);
  await atualizarRegistroAtividade(interaction.guild!);
  await interaction.editReply({ content: "✅ RSO encerrado com sucesso!" });

  logger.info("RSO encerrado", { user: interaction.user.tag, viatura: rso.viatura });
}

// ─── 4. Botão "Adicionar Apreensões" → select de tipo ────────────────────────

export async function handleBtnAdicionarApreensoes(
  interaction: ButtonInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const rso = await RSO.findOne({ userId: interaction.user.id, status: "aberto" });
  if (!rso) {
    await interaction.editReply({ content: "⚠️ Você não possui nenhum RSO aberto." });
    return;
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId("select_tipo_apreensao")
    .setPlaceholder("Selecione o tipo de apreensão...")
    .addOptions(
      Object.entries(APREENSOES_INFO).map(([value, { label, emoji }]) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(label)
          .setValue(value)
          .setEmoji(emoji)
      )
    );

  await interaction.editReply({
    content: "Selecione o tipo de apreensão:",
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
  });
}

// ─── 4b. Select de tipo → modal para informar quantidade ─────────────────────

export async function handleSelectTipoApreensao(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const tipo = interaction.values[0];
  const info = APREENSOES_INFO[tipo];
  if (!info) {
    await interaction.reply({ content: "Tipo inválido.", flags: MessageFlags.Ephemeral });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`modal_valor_apreensao:${tipo}`)
    .setTitle(`Adicionar — ${info.label}`);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("input_valor")
        .setLabel(`Quantidade de ${info.label}`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: 3")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(6)
    )
  );

  await interaction.showModal(modal);
}

// ─── 4c. Modal de valor → incrementa apreensão no RSO ────────────────────────

export async function handleModalValorApreensao(
  interaction: ModalSubmitInteraction,
  tipo: string
): Promise<void> {
  const info = APREENSOES_INFO[tipo];
  if (!info) {
    await interaction.reply({ content: "Tipo inválido.", flags: MessageFlags.Ephemeral });
    return;
  }

  const valorStr = interaction.fields.getTextInputValue("input_valor").trim();
  const valor    = parseInt(valorStr, 10);

  if (isNaN(valor) || valor < 0) {
    await interaction.reply({
      content: "⚠️ Digite apenas números inteiros positivos.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const rso = await RSO.findOne({ userId: interaction.user.id, status: "aberto" });
  if (!rso) {
    await interaction.editReply({ content: "⚠️ Nenhum RSO aberto encontrado." });
    return;
  }

  (rso.apreensoes as unknown as Record<string, number>)[tipo] += valor;
  rso.markModified("apreensoes");
  await rso.save();

  await atualizarMensagemRso(interaction.guild!, rso);
  await interaction.editReply({
    content: `✅ **${info.label}**: +${valor} adicionado(s) ao RSO.`,
  });

  logger.info("Apreensão adicionada", { tipo: info.label, valor, user: interaction.user.tag });
}

// ─── 5. Botão "Editar RSO" → exibe seletores de substituição de equipe ────────

export async function handleBtnEditarRso(
  interaction: ButtonInteraction
): Promise<void> {
  const rso = await RSO.findOne({ userId: interaction.user.id, status: "aberto" });
  if (!rso) {
    await interaction.reply({
      content: "⚠️ Você não possui nenhum RSO aberto.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  pendingRsoEditar.set(interaction.user.id, {
    motoristaId:  "",
    comandanteId: "",
    auxiliarIds:  [],
  });

  const rowMotorista = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId("select_rso_editar_motorista")
      .setPlaceholder("Substituir Motorista (opcional)...")
      .setMinValues(0)
      .setMaxValues(1)
  );

  const rowComandante = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId("select_rso_editar_comandante")
      .setPlaceholder("Substituir Comandante de equipe (opcional)...")
      .setMinValues(0)
      .setMaxValues(1)
  );

  const rowAuxiliares = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId("select_rso_editar_auxiliares")
      .setPlaceholder("Adicionar substituto(s) de auxiliar (1°→2°→3°, opcional)...")
      .setMinValues(0)
      .setMaxValues(3)
  );

  const rowBotoes = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("btn_rso_editar_confirmar")
      .setLabel("Confirmar substituição")
      .setStyle(ButtonStyle.Success)
      .setEmoji("✅"),
    new ButtonBuilder()
      .setCustomId("btn_rso_editar_obs")
      .setLabel("Editar observações")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("✏️"),
  );

  await interaction.reply({
    content:
      "Selecione quem substitui cada posição (deixe em branco o que não mudar) e clique em **Confirmar substituição**.\n" +
      "Para editar só as observações, clique em **Editar observações**.",
    components: [rowMotorista, rowComandante, rowAuxiliares, rowBotoes],
    flags: MessageFlags.Ephemeral,
  });
}

// ─── 5b. Selects de substituição de equipe ────────────────────────────────────

export async function handleSelectRsoEditarMotorista(
  interaction: UserSelectMenuInteraction
): Promise<void> {
  const pending = pendingRsoEditar.get(interaction.user.id);
  if (pending) pending.motoristaId = interaction.values[0] ?? "";
  await interaction.deferUpdate();
}

export async function handleSelectRsoEditarComandante(
  interaction: UserSelectMenuInteraction
): Promise<void> {
  const pending = pendingRsoEditar.get(interaction.user.id);
  if (pending) pending.comandanteId = interaction.values[0] ?? "";
  await interaction.deferUpdate();
}

export async function handleSelectRsoEditarAuxiliares(
  interaction: UserSelectMenuInteraction
): Promise<void> {
  const pending = pendingRsoEditar.get(interaction.user.id);
  if (pending) pending.auxiliarIds = interaction.values;
  await interaction.deferUpdate();
}

// ─── 5c. Confirmar substituição de equipe ────────────────────────────────────

export async function handleBtnRsoEditarConfirmar(
  interaction: ButtonInteraction
): Promise<void> {
  const pending = pendingRsoEditar.get(interaction.user.id);

  if (!pending) {
    await interaction.reply({
      content: "Sessão expirada. Clique em **Editar RSO** novamente.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!pending.motoristaId && !pending.comandanteId && pending.auxiliarIds.length === 0) {
    await interaction.reply({
      content: "⚠️ Nenhuma substituição selecionada.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  pendingRsoEditar.delete(interaction.user.id);
  await interaction.deferUpdate();

  const rso = await RSO.findOne({ userId: interaction.user.id, status: "aberto" });
  if (!rso) {
    await interaction.followUp({ content: "⚠️ Nenhum RSO aberto encontrado.", flags: MessageFlags.Ephemeral });
    return;
  }

  if (pending.motoristaId && !rso.motoristaIds.includes(pending.motoristaId)) {
    rso.motoristaIds.push(pending.motoristaId);
    rso.markModified("motoristaIds");
  }

  if (pending.comandanteId && !rso.comandanteIds.includes(pending.comandanteId)) {
    rso.comandanteIds.push(pending.comandanteId);
    rso.markModified("comandanteIds");
  }

  // Distribui substitutos de auxiliar nos slots 1→2→3 na ordem selecionada
  const auxSlots: { field: "auxiliar1Ids" | "auxiliar2Ids" | "auxiliar3Ids"; ids: string[] }[] = [
    { field: "auxiliar1Ids", ids: rso.auxiliar1Ids },
    { field: "auxiliar2Ids", ids: rso.auxiliar2Ids },
    { field: "auxiliar3Ids", ids: rso.auxiliar3Ids },
  ];

  const jaPresentes = new Set([...rso.auxiliar1Ids, ...rso.auxiliar2Ids, ...rso.auxiliar3Ids]);

  let slotIdx = 0;
  for (const auxId of pending.auxiliarIds) {
    if (jaPresentes.has(auxId)) continue;
    while (slotIdx < 3) {
      auxSlots[slotIdx].ids.push(auxId);
      rso.markModified(auxSlots[slotIdx].field);
      slotIdx++;
      break;
    }
  }

  await rso.save();
  await atualizarMensagemRso(interaction.guild!, rso);
  await atualizarRegistroAtividade(interaction.guild!);

  await interaction.editReply({ content: "✅ Equipe atualizada com sucesso!", components: [] });

  logger.info("Equipe do RSO atualizada", { user: interaction.user.tag });
}

// ─── 5d. Botão "Editar observações" → abre modal com obs atual ───────────────

export async function handleBtnRsoEditarObs(
  interaction: ButtonInteraction
): Promise<void> {
  const rso = await RSO.findOne({ userId: interaction.user.id, status: "aberto" });
  if (!rso) {
    await interaction.reply({
      content: "⚠️ Você não possui nenhum RSO aberto.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId("modal_editar_rso")
    .setTitle("Editar RSO — Observações");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("input_obs_editar")
        .setLabel("Observações")
        .setStyle(TextInputStyle.Paragraph)
        .setValue(rso.observacoes)
        .setRequired(false)
        .setMaxLength(500)
    )
  );

  await interaction.showModal(modal);
}

// ─── 5e. Modal editar obs → atualiza observações e mensagem ──────────────────

export async function handleModalEditarRso(
  interaction: ModalSubmitInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const novaObs = interaction.fields.getTextInputValue("input_obs_editar").trim();
  const rso     = await RSO.findOne({ userId: interaction.user.id, status: "aberto" });

  if (!rso) {
    await interaction.editReply({ content: "⚠️ Nenhum RSO aberto encontrado." });
    return;
  }

  rso.observacoes = novaObs;
  await rso.save();

  await atualizarMensagemRso(interaction.guild!, rso);
  await interaction.editReply({ content: "✅ Observações do RSO atualizadas!" });

  logger.info("Observações do RSO editadas", { user: interaction.user.tag });
}

// ─── 6. Botão "Contar RSO's" → soma apreensões e envia relatório ──────────────

export async function handleBtnContarRsos(
  interaction: ButtonInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const rsos = await RSO.find({ status: "fechado", contado: false });

  if (rsos.length === 0) {
    await interaction.editReply({ content: "Não há RSOs encerrados a contabilizar." });
    return;
  }

  const totais = {
    armasFogo: 0, armaBranca: 0, municoes: 0,
    itensPoliciaisRoubados: 0, entorpecentes: 0, bombas: 0, dinheiroIlicitos: 0,
  };

  for (const rso of rsos) {
    totais.armasFogo              += rso.apreensoes.armasFogo;
    totais.armaBranca             += rso.apreensoes.armaBranca;
    totais.municoes               += rso.apreensoes.municoes;
    totais.itensPoliciaisRoubados += rso.apreensoes.itensPoliciaisRoubados;
    totais.entorpecentes          += rso.apreensoes.entorpecentes;
    totais.bombas                 += rso.apreensoes.bombas;
    totais.dinheiroIlicitos       += rso.apreensoes.dinheiroIlicitos;
  }

  const guild          = interaction.guild!;
  const canalRelatorio = guild.channels.cache.find(
    (c) => c.name === CANAL_RELATORIO
  ) as TextChannel | undefined;

  if (!canalRelatorio) {
    await interaction.editReply({
      content: `⚠️ Canal \`${CANAL_RELATORIO}\` não encontrado. Nenhum RSO foi contabilizado.`,
    });
    return;
  }

  const descRelatorio = [
    `Armas de fogo: ${totais.armasFogo}`,
    `Arma branca: ${totais.armaBranca}`,
    `Munições: ${totais.municoes}`,
    `Itens policiais/Roubados: ${totais.itensPoliciaisRoubados}`,
    `Intorpecentes: ${totais.entorpecentes}`,
    `Bombas: ${totais.bombas}`,
    `Dinheiro Ilícitos: ${totais.dinheiroIlicitos}`,
  ].join("\n");

  const embedRelatorio = new EmbedBuilder()
    .setTitle("📊 Relatório Semanal de Apreensões")
    .setDescription(descRelatorio)
    .setColor(0x3498db)
    .addFields({ name: "📋 RSOs contabilizados", value: `${rsos.length}`, inline: true })
    .setTimestamp()
    .setFooter({ text: `Gerado por ${interaction.user.tag}` });

  const msgEnviada = await canalRelatorio.send({ embeds: [embedRelatorio] }).catch(() => null);

  if (!msgEnviada) {
    await interaction.editReply({
      content: `⚠️ Falha ao enviar o relatório em <#${canalRelatorio.id}>. Nenhum RSO foi contabilizado.`,
    });
    return;
  }

  await RSO.updateMany({ status: "fechado", contado: false }, { contado: true });

  await interaction.editReply({
    content: `✅ ${rsos.length} RSO(s) contabilizados. Relatório enviado em <#${canalRelatorio.id}>.`,
  });

  logger.info("RSOs contados", { count: rsos.length, contadoPor: interaction.user.tag });
}

// ─── 7. Comando /reset-rso-contado ───────────────────────────────────────────

export async function handleResetRsoContado(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (interaction.user.id !== process.env.AUTHORIZED_USER_ID) {
    await interaction.reply({
      content: "Você não tem permissão para usar este comando.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await RSO.updateMany({ contado: true }, { $set: { contado: false } });

  await interaction.editReply({
    content: `✅ ${result.modifiedCount} RSO(s) tiveram \`contado\` resetado para \`false\`.`,
  });

  logger.info("RSOs resetados (contado=false)", {
    count: result.modifiedCount,
    por: interaction.user.tag,
  });
}

// ─── 8. Comando /registro-atividade-rso ──────────────────────────────────────

export async function handleRegistroAtividadeRso(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (interaction.user.id !== process.env.AUTHORIZED_USER_ID) {
    await interaction.reply({
      content: "Você não tem permissão para usar este comando.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await atualizarRegistroAtividade(interaction.guild!);
  await interaction.editReply({ content: "✅ Painel de registro de atividade publicado!" });

  logger.info("Painel de registro de atividade RSO publicado", {
    canal: interaction.channelId,
    guild: interaction.guild?.name,
  });
}

// ─── Atualiza (ou cria) a mensagem fixa de registro de atividade ──────────────

async function atualizarRegistroAtividade(guild: Guild): Promise<void> {
  const canal = guild.channels.cache.find(
    (c) => c.name === CANAL_REGISTRO_ATIVIDADE
  ) as TextChannel | undefined;
  if (!canal) return;

  // Intervalo do mês vigente (UTC)
  const agora     = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const fimMes    = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);

  const rsos = await RSO.find({
    inicio: { $gte: inicioMes, $lt: fimMes },
  }).catch(() => [] as IRSO[]);

  // Monta mapa userId → Set de dias-do-mês patrulhados
  const diasPorUsuario = new Map<string, Set<number>>();

  for (const rso of rsos) {
    const dia = rso.inicio.getDate();
    const participantes = [
      ...rso.motoristaIds,
      ...rso.comandanteIds,
      ...rso.auxiliar1Ids,
      ...rso.auxiliar2Ids,
      ...rso.auxiliar3Ids,
    ].filter(Boolean);

    for (const id of participantes) {
      if (!diasPorUsuario.has(id)) diasPorUsuario.set(id, new Set());
      diasPorUsuario.get(id)!.add(dia);
    }
  }

  // Filtra membros com cargo policial e sem ausência
  await guild.members.fetch().catch(() => null);
  const policiais = guild.members.cache.filter(
    (m) =>
      m.roles.cache.some((r) => r.name === ROLE_POLICIAL) &&
      !m.roles.cache.some((r) => r.name === ROLE_AUSENCIA)
  );

  const mesNome  = agora.toLocaleString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });
  const anoAtual = agora.getFullYear();

  let descricao: string;

  if (policiais.size === 0) {
    descricao = "Nenhum policial ativo encontrado.";
  } else {
    const linhas = [...policiais.values()]
      .map((m) => {
        const dias = diasPorUsuario.get(m.id)?.size ?? 0;
        const nick = m.nickname ?? m.user.username;
        return { nick, dias };
      })
      .sort((a, b) => b.dias - a.dias || a.nick.localeCompare(b.nick))
      .map(({ nick, dias }) => {
        const label = dias === 1 ? "dia" : "dias";
        return `👮 **${nick}** — ${dias} ${label}`;
      });

    descricao =
      `Dias patrulhados no mês de **${mesNome}/${anoAtual}**:\n\n` +
      linhas.join("\n");
  }

  const embed = new EmbedBuilder()
    .setTitle(TITULO_REGISTRO_ATIVIDADE)
    .setDescription(descricao)
    .setColor(0x3498db)
    .setTimestamp()
    .setFooter({ text: "Atualizado automaticamente ao encerrar RSO" });

  const msgs       = await canal.messages.fetch({ limit: 50 }).catch(() => null);
  const existente  = msgs?.find(
    (m) =>
      m.author.id === canal.client.user!.id &&
      m.embeds[0]?.title === TITULO_REGISTRO_ATIVIDADE
  );

  const payload = { embeds: [embed] };
  if (existente) {
    await existente.edit(payload).catch(() => null);
  } else {
    await canal.send(payload).catch(() => null);
  }
}

// ─── Publica/atualiza o painel de contagem em solicitar-contagem-rso ──────────

async function publicarPainelContagem(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const guild = interaction.guild!;
  const canal = guild.channels.cache.find(
    (c) => c.name === CANAL_SOLICITAR_CONTAGEM
  ) as TextChannel | undefined;

  if (!canal) return;

  const canalRelatorioId = guild.channels.cache.find(
    (c) => c.name === CANAL_RELATORIO
  )?.id;

  const embed = new EmbedBuilder()
    .setTitle(TITULO_PAINEL_CONTAGEM)
    .setDescription(
      "Clique no botão abaixo para contabilizar todos os RSOs **encerrados e não contados** " +
        `e enviar o relatório em ${canalRelatorioId ? `<#${canalRelatorioId}>` : `\`${CANAL_RELATORIO}\``}.`
    )
    .setColor(0x3498db);

  const btn = new ButtonBuilder()
    .setCustomId("btn_contar_rsos")
    .setLabel("Contar RSO's")
    .setStyle(ButtonStyle.Primary)
    .setEmoji("📊");

  const payload = {
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(btn)],
  };

  const msgs      = await canal.messages.fetch({ limit: 50 }).catch(() => null);
  const existente = msgs?.find(
    (m) =>
      m.author.id === interaction.client.user!.id &&
      m.embeds[0]?.title === TITULO_PAINEL_CONTAGEM
  );

  if (existente) {
    await existente.edit(payload).catch(() => null);
  } else {
    await canal.send(payload).catch(() => null);
  }
}
