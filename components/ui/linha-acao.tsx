"use client";

import { createContext, useContext, useOptimistic } from "react";
import { BotaoSubmit } from "@/components/ui/botao-submit";

/**
 * Linha que reage antes do servidor responder.
 *
 * Sem isto, clicar em "Recebi" ou "Excluir" mudava só o texto de um botão
 * pequeno e a lista continuava idêntica até a resposta chegar. No celular,
 * com conexão ruim, a tela parecia travada — e quando a resposta chegava,
 * tudo re-renderizava de uma vez, o que dá a sensação de a página inteira
 * ter recarregado.
 *
 * `useOptimistic` é o certo aqui em vez de `useState`: se a ação falhar, o
 * estado volta sozinho quando a transição termina. Esconder a linha com
 * estado local seria mentir — a linha sumiria mesmo se o servidor tivesse
 * recusado.
 */
const ContextoSaindo = createContext<((acao: void) => void) | null>(null);

export function LinhaAcao({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [saindo, marcarSaindo] = useOptimistic<boolean, void>(false, () => true);

  return (
    <ContextoSaindo.Provider value={marcarSaindo}>
      <div className={className} style={style} data-saindo={saindo || undefined}>
        {children}
      </div>
    </ContextoSaindo.Provider>
  );
}

/**
 * Botão cuja ação faz a linha sair da lista.
 *
 * Serve tanto para remover de vez (excluir) quanto para tirar dali (dar
 * baixa numa cobrança, arquivar um cliente): dos dois jeitos a linha some
 * da tela, e o feedback tem que ser o mesmo.
 */
/**
 * Para ações que precisam mostrar erro e por isso não cabem no
 * `BotaoQueRemove` — arquivar cliente, por exemplo, recusa quem tem
 * cobrança em aberto.
 */
export function useMarcarSaindo() {
  return useContext(ContextoSaindo);
}

export function BotaoQueRemove({
  acao,
  id,
  children,
  carregando = "...",
  variante,
  campos,
}: {
  acao: (formData: FormData) => Promise<void>;
  id: string;
  children: React.ReactNode;
  carregando?: string;
  variante?: "secundario" | "discreto";
  /** Campos extras que a ação precisa além do id. */
  campos?: Record<string, string>;
}) {
  const marcarSaindo = useContext(ContextoSaindo);

  return (
    <form
      action={async (formData: FormData) => {
        // Dentro da ação, que já roda em transição — é o que `useOptimistic`
        // exige para saber quando reverter.
        marcarSaindo?.(undefined);
        await acao(formData);
      }}
    >
      <input type="hidden" name="id" value={id} />
      {campos &&
        Object.entries(campos).map(([nome, valor]) => (
          <input key={nome} type="hidden" name={nome} value={valor} />
        ))}
      <BotaoSubmit variante={variante} carregando={carregando}>
        {children}
      </BotaoSubmit>
    </form>
  );
}
