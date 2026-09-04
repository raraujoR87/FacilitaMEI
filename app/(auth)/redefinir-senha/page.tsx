"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { senhaAtendeRequisitos } from "@/lib/senha";
import { RequisitosSenha } from "@/components/ui/requisitos-senha";

/**
 * Nova senha, depois do link do e-mail.
 *
 * Quem chega aqui já tem sessão: o link passou por `/auth/confirm`, que
 * trocou o token por sessão. Não é rota protegida no proxy porque a
 * verificação real é o `updateUser` abaixo — sem sessão ele falha, e é
 * isso que decide, não o roteador.
 */
export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const senhaOk = senhaAtendeRequisitos(senha);
  const conferem = senha.length > 0 && senha === confirmacao;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!senhaOk) {
      setErro("A senha ainda não atende aos requisitos abaixo.");
      return;
    }
    if (!conferem) {
      setErro("As duas senhas não são iguais.");
      return;
    }

    setCarregando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: senha });
    setCarregando(false);

    if (error) {
      // O caso comum não é senha ruim, é link velho: o e-mail ficou dias
      // na caixa de entrada e a sessão de recuperação já expirou.
      setErro(
        "Não foi possível salvar. O link pode ter expirado — peça um novo em 'Esqueceu a senha?'."
      );
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="fita-recibo px-8 py-10">
      <h1 className="text-2xl mb-1" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
        Criar nova senha
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--tinta-suave)" }}>
        Escolha uma senha nova para entrar no AgilizeMei.
      </p>

      <form onSubmit={salvar} className="flex flex-col gap-4">
        <div>
          <label className="rotulo" htmlFor="senha">
            Nova senha
          </label>
          <input
            id="senha"
            type="password"
            required
            autoComplete="new-password"
            aria-describedby="requisitos-senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="campo"
            style={{
              borderColor: senha.length > 0 && !senhaOk ? "var(--pendente)" : "var(--borda)",
            }}
          />
          <div id="requisitos-senha">
            <RequisitosSenha senha={senha} />
          </div>
        </div>

        <div>
          <label className="rotulo" htmlFor="confirmacao">
            Repita a nova senha
          </label>
          <input
            id="confirmacao"
            type="password"
            required
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            className="campo"
            style={{
              borderColor:
                confirmacao.length > 0 && !conferem ? "var(--selo)" : "var(--borda)",
            }}
          />
          {confirmacao.length > 0 && !conferem && (
            <p className="dica" style={{ color: "var(--selo)" }}>
              As duas senhas não são iguais.
            </p>
          )}
        </div>

        {erro && <p className="aviso aviso-erro">{erro}</p>}

        <button type="submit" disabled={carregando} className="botao">
          {carregando ? "Salvando..." : "Salvar e entrar"}
        </button>
      </form>

      <p className="text-sm mt-6" style={{ color: "var(--tinta-suave)" }}>
        <Link href="/esqueci-senha" className="underline">
          Pedir outro link
        </Link>
      </p>
    </div>
  );
}
