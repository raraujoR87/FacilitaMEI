import { redirect } from "next/navigation";

/**
 * Financeiro e Vendas viraram uma tela só, /movimento. Manter o redirecionamento
 * evita 404 para quem guardou o link ou decorou o caminho.
 */
export default function VendasPage() {
  redirect("/movimento");
}
