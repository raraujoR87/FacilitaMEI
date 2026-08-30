/**
 * Regras de senha exibidas no cadastro.
 *
 * Precisam espelhar o que está configurado em Authentication → Providers →
 * Email no Supabase. Se você afrouxar ou apertar lá, ajuste aqui: mostrar
 * uma exigência que o servidor não aplica (ou omitir uma que ele aplica) é
 * pior do que não mostrar nada, porque o usuário perde a confiança no aviso.
 */

/** Conjunto exato de símbolos aceitos pelo Supabase. */
const SIMBOLOS = "!@#$%^&*()_+-=[]{};'\:\"|<>?,./`~";

export const TAMANHO_MINIMO = 8;

export type RegraSenha = {
  id: string;
  rotulo: string;
  atende: (senha: string) => boolean;
};

export const REGRAS_SENHA: RegraSenha[] = [
  {
    id: "tamanho",
    rotulo: `Pelo menos ${TAMANHO_MINIMO} caracteres`,
    atende: (s) => s.length >= TAMANHO_MINIMO,
  },
  {
    id: "minuscula",
    rotulo: "Uma letra minúscula",
    atende: (s) => /[a-z]/.test(s),
  },
  {
    id: "maiuscula",
    rotulo: "Uma letra maiúscula",
    atende: (s) => /[A-Z]/.test(s),
  },
  { id: "numero", rotulo: "Um número", atende: (s) => /[0-9]/.test(s) },
  {
    id: "simbolo",
    rotulo: "Um símbolo, como ! @ # $",
    // Comparação por conjunto em vez de regex: evita escapar 15 caracteres
    // especiais e deixa a lista idêntica à da documentação.
    atende: (s) => [...s].some((c) => SIMBOLOS.includes(c)),
  },
];

export function avaliarSenha(senha: string) {
  return REGRAS_SENHA.map((regra) => ({
    id: regra.id,
    rotulo: regra.rotulo,
    ok: regra.atende(senha),
  }));
}

export function senhaAtendeRequisitos(senha: string): boolean {
  return REGRAS_SENHA.every((regra) => regra.atende(senha));
}
