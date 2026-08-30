/**
 * Link wa.me: abre o WhatsApp do celular com a mensagem já escrita.
 *
 * Não depende da API oficial da Meta — funciona hoje, com o WhatsApp que o
 * MEI já usa. A API oficial entra depois, para o envio automático.
 */
export function linkWhatsApp(telefone: string | null, mensagem: string): string | null {
  if (!telefone) return null;

  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 10) return null;

  const comDdi = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${comDdi}?text=${encodeURIComponent(mensagem)}`;
}
