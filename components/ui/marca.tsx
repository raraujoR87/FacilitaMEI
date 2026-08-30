/**
 * Assinatura da marca. Centraliza o nome para que um próximo rebranding
 * seja uma edição só — o anterior custou 16 arquivos.
 */
export const NOME_MARCA = "AgilizeMei";
export const DOMINIO = "agilizemei.com.br";

export function Marca({
  tamanho = "normal",
}: {
  tamanho?: "normal" | "pequeno" | "grande";
}) {
  const classe =
    tamanho === "grande" ? "text-2xl" : tamanho === "pequeno" ? "text-base" : "text-lg";

  return (
    <span
      className={`${classe} tracking-tight`}
      style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
    >
      Agilize<span style={{ color: "var(--positivo)" }}>Mei</span>
    </span>
  );
}
