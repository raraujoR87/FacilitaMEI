import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gerarPdfOrcamento } from "@/lib/pdf-orcamento";
import { formatarDocumento } from "@/lib/fiscal";
import { COLUNAS_PLANO, temRecurso } from "@/lib/planos";

/**
 * O orçamento como arquivo para anexar no WhatsApp.
 *
 * Só o dono baixa. O cliente recebe o arquivo pelas mãos dele, ou abre o
 * link público — que já tem aceite. Abrir esta rota para o token público
 * daria um segundo caminho para o mesmo dado sem nada a mais em troca.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autorizado", { status: 401 });

  const [{ data: doc }, { data: perfil }] = await Promise.all([
    supabase
      .from("documentos_venda")
      .select(
        "id, numero, tipo, natureza, descricao_servico, valor, desconto, data_emissao, validade_em, condicoes_pagamento, prazo_execucao, garantia, observacoes, token_publico, clientes(nome, documento, telefone, email), itens_documento(descricao, quantidade, unidade, valor_unitario, total, ordem)"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("perfis")
      .select(
        `nome_negocio, cnpj, endereco, municipio, uf, telefone_whatsapp, email_contato, assinatura_nome, assinatura_titulo, assinatura_caminho, logo_url, cor_marca, ${COLUNAS_PLANO}`
      )
      .eq("id", user.id)
      .single(),
  ]);

  // Documento de outro tenant não volta pela RLS e cai aqui como
  // inexistente: 404 não revela que ele existe.
  if (!doc || doc.tipo !== "orcamento") {
    return new NextResponse("Orçamento não encontrado", { status: 404 });
  }

  const cliente = Array.isArray(doc.clientes) ? doc.clientes[0] : doc.clientes;

  // Marca no documento segue a mesma regra do recibo: é do Pro.
  const comMarca = temRecurso(perfil, "marcaNoRecibo");
  let logo: { bytes: Uint8Array; tipo: "png" | "jpg" } | null = null;

  if (comMarca && perfil?.logo_url) {
    try {
      const resposta = await fetch(perfil.logo_url);
      if (resposta.ok) {
        const tipoConteudo = resposta.headers.get("content-type") ?? "";
        logo = {
          bytes: new Uint8Array(await resposta.arrayBuffer()),
          tipo: tipoConteudo.includes("png") ? "png" : "jpg",
        };
      }
    } catch {
      // Storage fora do ar não pode impedir a proposta de sair.
      logo = null;
    }
  }

  // Assinatura vem de bucket privado, baixada com a sessão do dono — não
  // há URL pública para ela, e é isso que impede alguém de copiá-la para
  // outro documento.
  let assinatura: Uint8Array | null = null;
  if (perfil?.assinatura_caminho) {
    const { data: arquivo } = await supabase.storage
      .from("assinaturas")
      .download(perfil.assinatura_caminho);
    if (arquivo) assinatura = new Uint8Array(await arquivo.arrayBuffer());
  }

  const itens = [...(doc.itens_documento ?? [])].sort(
    (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)
  );

  const origem = new URL(_request.url).origin;

  const bytes = await gerarPdfOrcamento(
    {
      nome: perfil?.nome_negocio ?? "Meu negócio",
      cnpj: perfil?.cnpj ?? null,
      endereco: perfil?.endereco ?? null,
      municipio: perfil?.municipio ?? null,
      uf: perfil?.uf ?? null,
      telefone: perfil?.telefone_whatsapp ?? null,
      email: perfil?.email_contato ?? null,
      assinaturaNome: perfil?.assinatura_nome ?? null,
      assinaturaTitulo: perfil?.assinatura_titulo ?? null,
      logo,
      assinatura,
      corMarca: comMarca ? perfil?.cor_marca ?? null : null,
    },
    {
      nome: cliente?.nome ?? null,
      documento: cliente?.documento ? formatarDocumento(cliente.documento) : null,
      telefone: cliente?.telefone ?? null,
      email: cliente?.email ?? null,
    },
    {
      numero: doc.numero,
      descricao: doc.descricao_servico,
      natureza: doc.natureza as "servico" | "produto",
      dataEmissao: doc.data_emissao,
      validadeEm: doc.validade_em,
      desconto: Number(doc.desconto ?? 0),
      itens,
      condicoesPagamento: doc.condicoes_pagamento,
      prazoExecucao: doc.prazo_execucao,
      garantia: doc.garantia,
      observacoes: doc.observacoes,
      linkAceite: doc.token_publico ? `${origem}/r/${doc.token_publico}` : null,
    }
  );

  const nomeArquivo = `orcamento-${doc.numero}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      // Proposta muda enquanto está aberta; servir versão em cache faria o
      // MEI mandar ao cliente um preço que ele já corrigiu.
      "Cache-Control": "no-store",
    },
  });
}
