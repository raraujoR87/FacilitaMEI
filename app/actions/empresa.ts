"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { type EstadoForm, lerOpcional, lerTexto } from "@/app/actions/tipos";

/** Uma assinatura desenhada não passa disso; acima é imagem colada. */
const TAMANHO_MAXIMO_ASSINATURA = 400 * 1024;

/**
 * Dados da empresa que aparecem nos documentos.
 *
 * Endereço e e-mail não são burocracia de cadastro: sem eles a proposta
 * sai sem como o cliente responder ou conferir com quem está falando, e
 * proposta sem remetente completo parece rascunho.
 */
export async function atualizarDadosDaEmpresa(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const email = lerTexto(formData, "email_contato");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { erro: "E-mail inválido. Confira o endereço." };
  }

  const { error } = await supabase
    .from("perfis")
    .update({
      endereco: lerOpcional(formData, "endereco"),
      email_contato: email || null,
      assinatura_nome: lerOpcional(formData, "assinatura_nome"),
      assinatura_titulo: lerOpcional(formData, "assinatura_titulo"),
    })
    .eq("id", user.id);

  if (error) return { erro: "Não foi possível salvar." };

  revalidatePath("/configuracoes");
  revalidatePath("/orcamentos");
  return { sucesso: "Dados da empresa atualizados." };
}

/**
 * Guarda a assinatura desenhada na tela.
 *
 * Chega como data URL porque o desenho nasce num `canvas`, não num
 * arquivo escolhido pelo usuário. O PNG de uma assinatura tem poucos KB,
 * então cabe no corpo da ação sem upload em duas etapas.
 *
 * Vai para bucket privado: logo é material de divulgação, assinatura não.
 * Uma assinatura à mão alcançável por URL pública é coisa que se copia e
 * cola em outro documento.
 */
export async function salvarAssinatura(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  if (lerTexto(formData, "remover") === "sim") {
    const { data: perfil } = await supabase
      .from("perfis")
      .select("assinatura_caminho")
      .eq("id", user.id)
      .single();

    if (perfil?.assinatura_caminho) {
      await supabase.storage.from("assinaturas").remove([perfil.assinatura_caminho]);
    }

    await supabase.from("perfis").update({ assinatura_caminho: null }).eq("id", user.id);

    revalidatePath("/configuracoes");
    return { sucesso: "Assinatura removida." };
  }

  const dataUrl = lerTexto(formData, "assinatura");
  if (!dataUrl) return { erro: "Desenhe a assinatura antes de salvar." };

  const prefixo = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefixo)) {
    return { erro: "Formato de assinatura inesperado. Desenhe de novo." };
  }

  const bytes = Buffer.from(dataUrl.slice(prefixo.length), "base64");
  if (bytes.length === 0) return { erro: "Desenhe a assinatura antes de salvar." };
  if (bytes.length > TAMANHO_MAXIMO_ASSINATURA) {
    return { erro: "A assinatura ficou grande demais. Desenhe de novo, mais simples." };
  }

  // Caminho fixo por usuário: assinar de novo sobrescreve, em vez de
  // acumular arquivos órfãos a cada tentativa.
  const caminho = `${user.id}/assinatura.png`;

  const { error: erroUpload } = await supabase.storage
    .from("assinaturas")
    .upload(caminho, bytes, { contentType: "image/png", upsert: true });

  if (erroUpload) return { erro: "Não foi possível salvar a assinatura." };

  const { error } = await supabase
    .from("perfis")
    .update({ assinatura_caminho: caminho })
    .eq("id", user.id);

  if (error) return { erro: "Não foi possível salvar." };

  revalidatePath("/configuracoes");
  revalidatePath("/orcamentos");
  return { sucesso: "Assinatura salva. Ela entra nos próximos documentos." };
}
