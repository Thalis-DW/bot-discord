export interface Rank {
  label: string;            // nome exibido no select
  value: string;            // identificador único (sem espaços/acentos)
  roleName: string;         // cargo principal (nome EXATO no Discord)
  additionalRoles: string[]; // cargos extras concedidos junto com o principal
  nickPrefix: string;       // prefixo usado no apelido: "{nickPrefix} | Nome - RG"
  emoji: string;            // emoji de exibição nos embeds e select menus
}

// Edite esta lista conforme os cargos existentes no seu servidor.
// Na aprovação, o bot remove todos os cargos de qualquer graduação e
// adiciona o cargo principal + todos os additionalRoles da graduação escolhida.
export const RANKS: Rank[] = [
  {
    label: "Soldado",
    value: "soldado",
    roleName: "[❯] SOLDADO 1ª CLASSE PM",
    additionalRoles: [
      "18° BPM/M - COMPANHIA DE FORÇA TÁTICA",
      "👮🏻‍♀️| Policial Militar",
      "PRAÇAS",
      "🎓| ESTAGÍARIO - FORÇA TÁTICA",
    ],
    nickPrefix: "❯",
    emoji: "🪖",
  },
  {
    label: "Cabo",
    value: "cabo",
    roleName: "[❯❯] CABO PM",
    additionalRoles: [
      "18° BPM/M - COMPANHIA DE FORÇA TÁTICA",
      "👮🏻‍♀️| Policial Militar",
      "PRAÇAS",
      "🎓| ESTAGÍARIO - FORÇA TÁTICA",
    ],
    nickPrefix: "❯❯",
    emoji: "🪖",
  },
  {
    label: "3º Sargento",
    value: "3sargento",
    roleName: "[❯❯❯] 3º SARGENTO PM",
    additionalRoles: [
      "18° BPM/M - COMPANHIA DE FORÇA TÁTICA",
      "👮🏻‍♀️| Policial Militar",
      "PRAÇAS GRADUADOS",
      "🎓| ESTAGÍARIO - FORÇA TÁTICA",
    ],
    nickPrefix: "❯❯❯",
    emoji: "🎖️",
  },
  {
    label: "2º Sargento",
    value: "2sargento",
    roleName: "[❯ ❯❯❯] 2º SARGENTO PM",
    additionalRoles: [
      "18° BPM/M - COMPANHIA DE FORÇA TÁTICA",
      "👮🏻‍♀️| Policial Militar",
      "PRAÇAS GRADUADOS",
      "🎓| ESTAGÍARIO - FORÇA TÁTICA",
    ],
    nickPrefix: "❯ ❯❯❯",
    emoji: "🎖️",
  },
  {
    label: "1º Sargento",
    value: "1sargento",
    roleName: "[❯❯ ❯❯❯] 1º SARGENTO PM",
    additionalRoles: [
      "18° BPM/M - COMPANHIA DE FORÇA TÁTICA",
      "👮🏻‍♀️| Policial Militar",
      "PRAÇAS GRADUADOS",
      "🎓| ESTAGÍARIO - FORÇA TÁTICA",
    ],
    nickPrefix: "❯❯ ❯❯❯",
    emoji: "🎖️",
  },
  {
    label: "Subtenente",
    value: "subtenente",
    roleName: "[△] SUBTENENTE PM",
    additionalRoles: [
      "18° BPM/M - COMPANHIA DE FORÇA TÁTICA",
      "👮🏻‍♀️| Policial Militar",
      "PRAÇAS GRADUADOS",
      "🎓| ESTAGÍARIO - FORÇA TÁTICA",
    ],
    nickPrefix: "△",
    emoji: "⭐",
  },
  {
    label: "Aspirante a Oficial",
    value: "aspirante",
    roleName: "[✯] ASPIRANTE A OFICIAL PM",
    additionalRoles: [
      "18° BPM/M - COMPANHIA DE FORÇA TÁTICA",
      "PRAÇAS ESPECIAIS",
      "👮🏻‍♀️| Policial Militar",
      "🎓| ESTAGÍARIO - FORÇA TÁTICA",
    ],
    nickPrefix: "✯",
    emoji: "🌟",
  },
  {
    label: "2º Tenente",
    value: "2tenente",
    roleName: "[✧] 2° TENENTE PM",
    additionalRoles: [
      "👮🏻‍♀️| Policial Militar",
      "18° BPM/M - COMPANHIA DE FORÇA TÁTICA",
      "EM/PM",
      "OFICIAIS SUBALTERNOS",
      "🎓| ESTAGÍARIO - FORÇA TÁTICA",
    ],
    nickPrefix: "✧",
    emoji: "💫",
  },
  {
    label: "1º Tenente",
    value: "1tenente",
    roleName: "[✧✧] 1º TENENTE PM",
    additionalRoles: [
      "👮🏻‍♀️| Policial Militar",
      "18° BPM/M - COMPANHIA DE FORÇA TÁTICA",
      "EM/PM",
      "OFICIAIS SUBALTERNOS",
      "🎓| ESTAGÍARIO - FORÇA TÁTICA",
    ],
    nickPrefix: "✧✧",
    emoji: "💫",
  },
  {
    label: "Capitão",
    value: "capitao",
    roleName: "[✧✧✧] CAPITÃO PM",
    additionalRoles: [],
    nickPrefix: "✧✧✧",
    emoji: "👑",
  },
];