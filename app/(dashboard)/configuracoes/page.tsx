import { exigirUsuario } from "@/lib/auth";
import { FormularioPerfil, type Perfil } from "./formulario";

export default async function ConfiguracoesPage() {
  const { supabase, user } = await exigirUsuario();

  const { data: perfil } = await supabase
    .from("perfis")
    .select(
      "nome_negocio, cnpj, telefone_whatsapp, chave_pix, tipo_chave_pix, nome_titular_pix, cidade_pix"
    )
    .eq("id", user.id)
    .single();

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
            telefone_whatsapp: null,
            chave_pix: null,
            tipo_chave_pix: null,
            nome_titular_pix: null,
            cidade_pix: null,
          }
        }
      />
    </div>
  );
}
