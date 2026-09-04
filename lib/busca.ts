/**
 * Comparação de texto para a busca das listas.
 *
 * Fica em `lib/` para ser testável direto pelo runner do Node — é lógica
 * de negócio disfarçada de utilitário: se ela errar, a pessoa conclui que
 * o cliente não está cadastrado e cadastra de novo.
 */

/**
 * Tira acento e caixa.
 *
 * Sem isso, procurar "jose" não acha "José" — e é assim que o nome está
 * cadastrado. Quem digita no celular raramente põe acento.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    // Faixa dos sinais diacríticos combinantes, que o NFD separa da letra.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Se algum dos campos contém o termo.
 *
 * Termo vazio combina com tudo: sem busca, a lista inteira aparece.
 */
export function combina(
  termo: string,
  ...campos: (string | null | undefined)[]
): boolean {
  const alvo = normalizar(termo);
  if (!alvo) return true;
  return campos.some((campo) => campo && normalizar(campo).includes(alvo));
}

/**
 * Só os dígitos, para buscar CPF/CNPJ e telefone.
 *
 * O cadastro guarda "11222333000181" e a tela mostra
 * "11.222.333/0001-81". Sem normalizar os dois lados, procurar pelo que
 * está na tela não acharia nada.
 */
export function apenasNumeros(texto: string): string {
  return texto.replace(/\D/g, "");
}

/** Combina em texto ou em documento/telefone digitado com pontuação. */
export function combinaCadastro(
  termo: string,
  nome: string,
  documento: string | null,
  telefone: string | null
): boolean {
  if (combina(termo, nome)) return true;

  const digitos = apenasNumeros(termo);
  if (!digitos) return false;

  return [documento, telefone].some(
    (campo) => campo && apenasNumeros(campo).includes(digitos)
  );
}
