import mongoose, { Schema, Document } from "mongoose";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Guild,
  ModalBuilder,
  ModalSubmitInteraction,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  UserSelectMenuInteraction,
} from "discord.js";
import { logger } from "../logger";

// ─── Modelo MongoDB para avaliações ──────────────────────────────────────────

interface IAvaliacao extends Document {
  avaliadorId: string;
  avaliadorNick: string;
  avaliadoId: string;
  avaliadoNick: string;
  avaliacao: string;
  pontoAtencao: string;
  createdAt: Date;
}

const avaliacaoSchema = new Schema<IAvaliacao>({
  avaliadorId:  { type: String, required: true },
  avaliadorNick:{ type: String, required: true },
  avaliadoId:   { type: String, required: true },
  avaliadoNick: { type: String, required: true },
  avaliacao:    { type: String, required: true },
  pontoAtencao: { type: String, required: true },
  createdAt:    { type: Date,   default: Date.now },
});

const Avaliacao = mongoose.model<IAvaliacao>("Avaliacao", avaliacaoSchema);

// ─── Constantes ───────────────────────────────────────────────────────────────

const CANAL_AVALIACOES  = "📋・avaliação-estágios";
const CANAL_FEITAS      = "✅・avaliação-feitas-estagios";
const ROLE_ESTAGIARIO   = "🎓| ESTAGÍARIO - FORÇA TÁTICA";
const TITULO_LISTA      = "📊 Avaliações de Estágio";

// Armazenamento temporário: userId do avaliador → userId do avaliado
const pendingAvaliacoes = new Map<string, string>();

// ─── 1. Comando /avaliar-estagio (apenas usuário autorizado) ──────────────────
//        Publica o botão permanente no canal

export async function handleAvaliarEstagio(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (interaction.user.id !== process.env.AUTHORIZED_USER_ID) {
    await interaction.reply({
      content: "Você não tem permissão para usar este comando.",
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("📋 Avaliação de Estágio")
    .setDescription(
      "Clique no botão abaixo para registrar a avaliação de um estagiário.\n\n" +
        "Você irá selecionar o estagiário e preencher a **avaliação** e o **ponto de atenção**."
    )
    .setColor(0x2ecc71)
    .setFooter({ text: "Sistema de Avaliações de Estágio" });

  const btn = new ButtonBuilder()
    .setCustomId("btn_avaliar_estagio")
    .setLabel("Avaliar Estágio")
    .setStyle(ButtonStyle.Primary)
    .setEmoji("📋");

  await interaction.reply({
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(btn),
    ],
  });

  logger.info("Painel de avaliação de estágio publicado", {
    canal: interaction.channelId,
    guild: interaction.guild?.name,
  });
}

// ─── 2. Botão "Avaliar Estágio" → exibe UserSelectMenu efêmero ───────────────

export async function handleBtnAvaliarEstagio(
  interaction: ButtonInteraction
): Promise<void> {
  const select = new UserSelectMenuBuilder()
    .setCustomId("select_avaliar_usuario")
    .setPlaceholder("Selecione o estagiário a ser avaliado...");

  await interaction.reply({
    content: "Selecione o estagiário que deseja avaliar:",
    components: [
      new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(select),
    ],
    ephemeral: true,
  });
}

// ─── 3. UserSelect → guarda alvo na memória e abre modal ─────────────────────

export async function handleSelectAvaliarUsuario(
  interaction: UserSelectMenuInteraction
): Promise<void> {
  pendingAvaliacoes.set(interaction.user.id, interaction.values[0]);

  const modal = new ModalBuilder()
    .setCustomId("modal_avaliar_estagio")
    .setTitle("Avaliação de Estágio");

  const avaliacaoInput = new TextInputBuilder()
    .setCustomId("input_avaliacao")
    .setLabel("Avaliação")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Descreva sua avaliação sobre o desempenho do estagiário...")
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(1000);

  const pontoAtencaoInput = new TextInputBuilder()
    .setCustomId("input_ponto_atencao")
    .setLabel("Ponto de Atenção")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Indique os pontos que o estagiário deve melhorar...")
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(avaliacaoInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(pontoAtencaoInput)
  );

  await interaction.showModal(modal);
}

// ─── 4. Modal → salva avaliação, envia no canal e atualiza lista ──────────────

export async function handleModalAvaliarEstagio(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const avaliadoId = pendingAvaliacoes.get(interaction.user.id);

  if (!avaliadoId) {
    await interaction.reply({
      content: "Sessão expirada. Clique no botão novamente.",
      ephemeral: true,
    });
    return;
  }

  pendingAvaliacoes.delete(interaction.user.id);

  await interaction.deferReply({ ephemeral: true });

  const guild     = interaction.guild!;
  const avaliacao = interaction.fields.getTextInputValue("input_avaliacao").trim();
  const pontoAtencao = interaction.fields.getTextInputValue("input_ponto_atencao").trim();

  const avaliador = await guild.members.fetch(interaction.user.id).catch(() => null);
  const avaliado  = await guild.members.fetch(avaliadoId).catch(() => null);

  if (!avaliado) {
    await interaction.editReply({ content: "Usuário avaliado não encontrado no servidor." });
    return;
  }

  const avaliadorNick = avaliador?.nickname ?? interaction.user.username;
  const avaliadoNick  = avaliado.nickname  ?? avaliado.user.username;

  // Persiste no MongoDB
  await Avaliacao.create({
    avaliadorId:   interaction.user.id,
    avaliadorNick,
    avaliadoId,
    avaliadoNick,
    avaliacao,
    pontoAtencao,
  }).catch((err) =>
    logger.warn("Falha ao salvar avaliação no MongoDB", { error: String(err) })
  );

  // Envia embed no canal de avaliações
  const canalAvaliacoes = guild.channels.cache.find(
    (c) => c.name === CANAL_AVALIACOES
  ) as TextChannel | undefined;

  if (canalAvaliacoes) {
    const embedAvaliacao = new EmbedBuilder()
      .setTitle("📋 Nova Avaliação de Estágio")
      .setColor(0x2ecc71)
      .addFields(
        { name: "🔍 Avaliado",          value: avaliadoNick,  inline: true },
        { name: "👤 Avaliador",          value: avaliadorNick, inline: true },
        { name: "📝 Avaliação",          value: avaliacao,     inline: false },
        { name: "⚠️ Ponto de Atenção", value: pontoAtencao,  inline: false }
      )
      .setTimestamp()
      .setFooter({ text: `ID do avaliado: ${avaliadoId}` });

    await canalAvaliacoes.send({ embeds: [embedAvaliacao] }).catch(() => null);
  }

  // Atualiza mensagem fixa com a lista de estagiários e contagens
  await atualizarListaFeitas(interaction, guild);

  await interaction.editReply({ content: "✅ Avaliação registrada com sucesso!" });

  logger.info("Avaliação de estágio registrada", {
    avaliador:   avaliadorNick,
    avaliado:    avaliadoNick,
    guild:       guild.name,
  });
}

// ─── Atualiza (ou cria) a mensagem fixa com a lista de estagiários ────────────

async function atualizarListaFeitas(
  interaction: ModalSubmitInteraction,
  guild: Guild
): Promise<void> {
  const canalFeitas = guild.channels.cache.find(
    (c) => c.name === CANAL_FEITAS
  ) as TextChannel | undefined;

  if (!canalFeitas) return;

  // Busca todos os membros e filtra pelos que têm a tag de estagiário
  await guild.members.fetch().catch(() => null);
  const estagiarios = guild.members.cache.filter((m) =>
    m.roles.cache.some((r) => r.name === ROLE_ESTAGIARIO)
  );

  if (estagiarios.size === 0) return;

  // Monta linhas com contagem de avaliações por estagiário
  const linhas: string[] = [];

  for (const [, membro] of estagiarios) {
    const count = await Avaliacao.countDocuments({ avaliadoId: membro.id }).catch(() => 0);
    const nick  = membro.nickname ?? membro.user.username;
    const label = count === 1 ? "avaliação" : "avaliações";
    linhas.push(`🎓 **${nick}** — ${count} ${label}`);
  }

  const embedLista = new EmbedBuilder()
    .setTitle(TITULO_LISTA)
    .setDescription(
      `Estagiários com a tag **${ROLE_ESTAGIARIO}** e total de avaliações:\n\n` +
        linhas.join("\n")
    )
    .setColor(0x3498db)
    .setTimestamp()
    .setFooter({ text: "Atualizado automaticamente a cada nova avaliação" });

  // Edita mensagem existente do bot ou cria uma nova
  const msgs = await canalFeitas.messages.fetch({ limit: 50 }).catch(() => null);
  const msgExistente = msgs?.find(
    (m) =>
      m.author.id === interaction.client.user!.id &&
      m.embeds[0]?.title === TITULO_LISTA
  );

  if (msgExistente) {
    await msgExistente.edit({ embeds: [embedLista] }).catch(() => null);
  } else {
    await canalFeitas.send({ embeds: [embedLista] }).catch(() => null);
  }
}
