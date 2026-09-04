import { Suspense } from "react";
import { FormularioEsqueciSenha } from "./formulario";

/**
 * `useSearchParams` obriga a fronteira de Suspense: sem ela o Next recusa
 * pré-renderizar a página, porque o parâmetro só existe no navegador.
 */
export default function EsqueciSenhaPage() {
  return (
    <Suspense
      fallback={
        <div className="fita-recibo px-8 py-10">
          <p className="text-sm" style={{ color: "var(--tinta-suave)" }}>
            Carregando...
          </p>
        </div>
      }
    >
      <FormularioEsqueciSenha />
    </Suspense>
  );
}
