"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { type EstadoForm, lerOpcional, lerTexto } from "@/app/actions/tipos";

const TIPOS_CHAVE = ["cpf", "cnpj", "email", "telefone", "aleatoria"];

export async function atualizarPerfil(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const nomeNegocio = lerTexto(formData, "nome_negocio");
  if (!nomeNegocio) return { erro: "O nome do negócio é obrigatório." };

  const tipoChave = lerOpcional(formData, "tipo_chave_pix");
  const chavePix = lerOpcional(formData, "chave_pix");

  if (chavePix && !tipoChave) {
    return { erro: "Escolha o tipo da chave PIX." };
  }
  if (tipoChave && !TIPOS_CHAVE.includes(tipoChave)) {
    return { erro: "Tipo de chave PIX inválido." };
  }
  // Sem titular e cidade o BR Code é recusado pelos aplicativos de banco.
  if (chavePix && !lerTexto(formData, "nome_titular_pix")) {
    return { erro: "Informe o nome do titular da chave PIX." };
  }

  const { error } = await supabase
    .from("perfis")
    .update({
      nome_negocio: nomeNegocio,
      cnpj: lerOpcional(formData, "cnpj"),
      telefone_whatsapp: lerOpcional(formData, "telefone_whatsapp"),
      chave_pix: chavePix,
      tipo_chave_pix: chavePix ? tipoChave : null,
      nome_titular_pix: lerOpcional(formData, "nome_titular_pix"),
      cidade_pix: lerOpcional(formData, "cidade_pix"),
    })
    .eq("id", user.id);

  if (error) {
    // telefone_whatsapp é único: o mesmo número não pode atender duas contas.
    if (error.code === "23505") {
      return { erro: "Esse número de WhatsApp já está vinculado a outra conta." };
    }
    return { erro: "Não foi possível salvar as alterações." };
  }

  revalidatePath("/configuracoes");
  revalidatePath("/cobranca");
  return { sucesso: "Dados salvos." };
}
