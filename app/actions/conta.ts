"use server";

import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { type EstadoForm, lerTexto } from "@/app/actions/tipos";

/**
 * Exclusão da conta pelo próprio titular (LGPD, art. 18, VI).
 *
 * Sem fila e sem pedido por e-mail: o efeito é imediato. A confirmação
 * digitada existe porque não há desfazer — o cascade no banco leva perfil,
 * lançamentos, documentos, itens, clientes e categorias junto.
 */
export async function excluirConta(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  if (lerTexto(formData, "confirmacao").trim().toUpperCase() !== "EXCLUIR") {
    return { erro: 'Digite EXCLUIR para confirmar.' };
  }

  // Comprovantes ficam no Storage, fora do alcance do cascade do banco:
  // precisam ser removidos antes, ou virariam arquivos órfãos com dado
  // financeiro de uma conta que não existe mais.
  const { data: arquivos } = await supabase.storage
    .from("comprovantes")
    .list(user.id, { limit: 1000 });

  if (arquivos && arquivos.length > 0) {
    await supabase.storage
      .from("comprovantes")
      .remove(arquivos.map((a) => `${user.id}/${a.name}`));
  }

  const { error } = await supabase.rpc("excluir_minha_conta");

  if (error) {
    return { erro: `Não foi possível excluir: ${error.message}` };
  }

  await supabase.auth.signOut();
  redirect("/?conta=excluida");
}
