import { exigirUsuario } from "@/lib/auth";
import { FormularioPerfil, type Perfil } from "./formulario";
import { SeusDados } from "./seus-dados";
import { MarcaDoNegocio } from "./marca";
import { DadosDaEmpresa, type DadosEmpresa } from "./empresa";
import { Assinatura } from "./assinatura";
import { COLUNAS_PLANO, temRecurso } from "@/lib/planos";

export default async function ConfiguracoesPage() {
  const { supabase, user } = await exigirUsuario();

  const { data: perfil } = await supabase
    .from("perfis")
    .select(
      `nome_negocio, cnpj, data_abertura_mei, valor_das, municipio, uf, telefone_whatsapp, chave_pix, tipo_chave_pix, nome_titular_pix, cidade_pix, logo_url, cor_marca, endereco, email_contato, assinatura_nome, assinatura_titulo, assinatura_caminho, ${COLUNAS_PLANO}`
    )
    .eq("id", user.id)
    .single();

  // Bucket privado: a URL é assinada na hora e expira. Guardar a URL no
  // perfil deixaria um link morto assim que o prazo passasse.
  let assinaturaUrl: string | null = null;
  if (perfil?.assinatura_caminho) {
    const { data: assinada } = await supabase.storage
      .from("assinaturas")
      .createSignedUrl(perfil.assinatura_caminho, 60 * 10);
    assinaturaUrl = assinada?.signedUrl ?? null;
  }

  return (
    <div>
      <h1 className="text-2xl mb-6" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
        Configurações
      </h1>

      <FormularioPerfil
        perfil={
          (perfil as Perfil) ?? {
            nome_negocio: "",
            cnpj: null,
            data_abertura_mei: null,
            valor_das: null,
            municipio: null,
            uf: null,
            telefone_whatsapp: null,
            chave_pix: null,
            tipo_chave_pix: null,
            nome_titular_pix: null,
            cidade_pix: null,
          }
        }
      />

      <div className="mt-8">
        <DadosDaEmpresa
          dados={
            {
              endereco: perfil?.endereco ?? null,
              email_contato: perfil?.email_contato ?? null,
              assinatura_nome: perfil?.assinatura_nome ?? null,
              assinatura_titulo: perfil?.assinatura_titulo ?? null,
            } satisfies DadosEmpresa
          }
          nomeNegocio={perfil?.nome_negocio ?? "Meu negócio"}
        />
      </div>

      <div className="mt-8">
        <Assinatura atual={assinaturaUrl} />
      </div>

      <div className="mt-8">
        <MarcaDoNegocio
          logoUrl={perfil?.logo_url ?? null}
          corMarca={perfil?.cor_marca ?? null}
          liberado={temRecurso(perfil, "marcaNoRecibo")}
        />
      </div>

      <div className="mt-8">
        <SeusDados />
      </div>
    </div>
  );
}
