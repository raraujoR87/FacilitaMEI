import { exigirUsuario } from "@/lib/auth";
import { formatarMoeda } from "@/lib/formato";
import { combina } from "@/lib/busca";
import {
  LIMITE_CATALOGO_FREE,
  ordenarCatalogo,
  type ItemCatalogo,
} from "@/lib/catalogo";
import { COLUNAS_PLANO, planoEfetivo } from "@/lib/planos";
import { Recibo, Vazio } from "@/components/ui/campos";
import { CampoBusca } from "@/components/ui/campo-busca";
import { LinhaItem, NovoItem, ReativarItem } from "./formulario";

/**
 * O que você vende, cadastrado uma vez.
 *
 * Existe para tirar digitação do dia: "Corte masculino — R$ 45" era
 * redigitado a cada atendimento, e "Tinta acrílica 18L" a cada orçamento.
 * O custo cadastrado aqui é o que faz a margem aparecer em toda venda sem
 * lançar despesa uma por uma.
 */
export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const termo = (await searchParams).q ?? "";
  const { supabase, user } = await exigirUsuario();

  const [{ data }, { data: perfil }] = await Promise.all([
    supabase
      .from("itens_catalogo")
      .select("id, nome, natureza, preco, custo, unidade, arquivado_em")
      .eq("user_id", user.id),
    supabase.from("perfis").select(COLUNAS_PLANO).eq("id", user.id).single(),
  ]);

  const todos = (data ?? []) as ItemCatalogo[];
  const ativos = ordenarCatalogo(todos.filter((i) => i.arquivado_em === null));
  const arquivados = todos.filter((i) => i.arquivado_em !== null);

  const listados = ativos.filter((i) => combina(termo, i.nome, i.unidade));
  const servicos = ativos.filter((i) => i.natureza === "servico").length;
  const produtos = ativos.length - servicos;

  const noGratis = planoEfetivo(perfil) === "free";
  const restam = LIMITE_CATALOGO_FREE - ativos.length;

  return (
    <div>
      <h1 className="text-2xl mb-1" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
        Catálogo
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--tinta-suave)" }}>
        {ativos.length === 0
          ? "O que você vende, cadastrado uma vez e reusado em recibos e orçamentos."
          : `${servicos} serviço(s) · ${produtos} produto(s)`}
      </p>

      {/* O aviso aparece perto do fim, não desde o começo: limite anunciado
          cedo demais é barreira antes de a pessoa ver o valor. */}
      {noGratis && restam <= 3 && (
        <p className="aviso mb-6" style={{ borderColor: "var(--pendente)" }}>
          {restam > 0
            ? `Restam ${restam} item(ns) no plano grátis. No Pro o catálogo não tem limite.`
            : "Você chegou aos 15 itens do plano grátis. Arquive o que não vende mais, ou passe para o Pro."}
        </p>
      )}

      <NovoItem />

      {ativos.length > 0 && (
        <div className="mb-3">
          <CampoBusca placeholder="Buscar item pelo nome" rotulo="Buscar no catálogo" />
        </div>
      )}

      <Recibo
        titulo={
          termo
            ? `${listados.length} de ${ativos.length} item(ns)`
            : `${ativos.length} item(ns)`
        }
      >
        {listados.length === 0 ? (
          <Vazio>
            {termo
              ? `Nenhum item encontrado para "${termo}".`
              : "Nada cadastrado ainda. Cadastre o que você mais vende — na próxima venda é só escolher da lista em vez de digitar."}
          </Vazio>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--borda)" }}>
            {listados.map((item) => (
              <LinhaItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </Recibo>

      {arquivados.length > 0 && (
        <details className="mt-6">
          <summary className="text-sm cursor-pointer" style={{ color: "var(--tinta-suave)" }}>
            {arquivados.length} item(ns) arquivado(s)
          </summary>
          <div
            className="mt-2 rounded-lg border divide-y"
            style={{ borderColor: "var(--borda)", background: "#fff" }}
          >
            {arquivados.map((item) => (
              <div
                key={item.id}
                className="px-5 py-3 flex flex-wrap justify-between items-center gap-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate">{item.nome}</p>
                  <p className="text-xs" style={{ color: "var(--tinta-suave)" }}>
                    {formatarMoeda(Number(item.preco))} · por {item.unidade}
                  </p>
                </div>
                <ReativarItem id={item.id} />
              </div>
            ))}
          </div>
          <p className="dica">
            Arquivado não conta no limite e some da lista, mas os documentos
            que já usaram o item continuam intactos.
          </p>
        </details>
      )}
    </div>
  );
}
