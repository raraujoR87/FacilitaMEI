"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { type EstadoForm, lerTexto } from "@/app/actions/tipos";
import { planoEfetivo } from "@/lib/planos";

const TIPOS_ACEITOS = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const TAMANHO_MAXIMO = 2 * 1024 * 1024;

/**
 * Logotipo e cor do negócio no recibo.
 *
 * O recibo é a única peça do sistema que o cliente do MEI vê. Levar a marca
 * dele para lá é o que transforma "um papelzinho" em documento de empresa —
 * e é por isso que este é recurso do Pro.
 */
export async function atualizarMarca(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const { data: perfil } = await supabase
    .from("perfis")
    .select("plano, plano_expira_em, logo_url")
    .eq("id", user.id)
    .single();

  // A checagem é aqui, no servidor: esconder o formulário na tela não
  // impede ninguém de chamar a ação direto.
  if (planoEfetivo(perfil) !== "pro") {
    return { erro: "Personalizar o recibo é um recurso do plano Pro." };
  }

  const cor = lerTexto(formData, "cor_marca").trim();
  if (cor && !/^#[0-9A-Fa-f]{6}$/.test(cor)) {
    return { erro: "Cor inválida. Use o seletor." };
  }

  let logoUrl = perfil?.logo_url ?? null;

  if (lerTexto(formData, "remover_logo") === "sim") {
    logoUrl = null;
  }

  const arquivo = formData.get("logo");
  if (arquivo instanceof File && arquivo.size > 0) {
    if (!TIPOS_ACEITOS.includes(arquivo.type)) {
      return { erro: "Envie o logo em PNG, JPG, WEBP ou SVG." };
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      return { erro: "O logo precisa ter até 2 MB." };
    }

    // Nome fixo por usuário: trocar o logo sobrescreve em vez de acumular
    // arquivos órfãos a cada troca.
    const extensao = arquivo.type === "image/svg+xml" ? "svg" : arquivo.type.split("/")[1];
    const caminho = `${user.id}/logo.${extensao}`;

    const { error: erroUpload } = await supabase.storage
      .from("marcas")
      .upload(caminho, Buffer.from(await arquivo.arrayBuffer()), {
        contentType: arquivo.type,
        upsert: true,
      });

    if (erroUpload) return { erro: "Não foi possível enviar o logo." };

    // A versão entra na URL para o navegador não servir o logo antigo do
    // cache depois da troca.
    const publica = supabase.storage.from("marcas").getPublicUrl(caminho).data.publicUrl;
    logoUrl = `${publica}?v=${Date.now()}`;
  }

  const { error } = await supabase
    .from("perfis")
    .update({ logo_url: logoUrl, cor_marca: cor || null })
    .eq("id", user.id);

  if (error) return { erro: "Não foi possível salvar." };

  revalidatePath("/configuracoes");
  revalidatePath("/movimento");
  return { sucesso: "Marca atualizada. Ela já aparece nos próximos recibos." };
}

/** Gera (ou reaproveita) o link público de um documento. */
export async function compartilharDocumento(
  _anterior: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  const { supabase, user } = await exigirUsuario();

  const id = lerTexto(formData, "id");
  if (!id) return { erro: "Documento não identificado." };

  const { data: perfil } = await supabase
    .from("perfis")
    .select("plano, plano_expira_em")
    .eq("id", user.id)
    .single();

  if (planoEfetivo(perfil) !== "pro") {
    return { erro: "O link para o cliente é um recurso do plano Pro." };
  }

  const { data: documento } = await supabase
    .from("documentos_venda")
    .select("token_publico")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!documento) return { erro: "Documento não encontrado." };

  // Reaproveita o token existente: gerar outro invalidaria o link que o
  // cliente já recebeu.
  if (documento.token_publico) {
    return { sucesso: documento.token_publico };
  }

  const token = crypto.randomUUID();
  const { error } = await supabase
    .from("documentos_venda")
    .update({ token_publico: token })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { erro: "Não foi possível gerar o link." };

  revalidatePath(`/recibo/${id}`);
  return { sucesso: token };
}

export async function removerLinkPublico(formData: FormData): Promise<void> {
  const { supabase, user } = await exigirUsuario();
  const id = lerTexto(formData, "id");
  if (!id) return;

  await supabase
    .from("documentos_venda")
    .update({ token_publico: null })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath(`/recibo/${id}`);
}
