"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { senhaAtendeRequisitos } from "@/lib/senha";
import { RequisitosSenha } from "@/components/ui/requisitos-senha";

export default function CadastroPage() {
  const router = useRouter();
  const [nomeNegocio, setNomeNegocio] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const senhaOk = senhaAtendeRequisitos(senha);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Barra aqui para a pessoa não descobrir o problema depois de uma
    // ida ao servidor. O Supabase valida de novo do lado dele.
    if (!senhaOk) {
      setErro("A senha ainda não atende aos requisitos abaixo.");
      return;
    }

    setErro(null);
    setCarregando(true);

    // Construído aqui, e não no corpo do componente: durante o
    // prerender não há navegador nem variáveis públicas garantidas.
    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome_negocio: nomeNegocio } },
    });

    setCarregando(false);
    if (error) {
      setErro(traduzirErro(error.message));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="fita-recibo px-8 py-10">
      <h1
        className="text-2xl mb-1"
        style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
      >
        Criar conta
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--tinta-suave)" }}>
        Comece grátis, sem cartão de crédito
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div>
          <label className="rotulo" htmlFor="nome">
            Nome do negócio
          </label>
          <input
            id="nome"
            required
            autoComplete="organization"
            placeholder="Ex: Salão da Rita"
            value={nomeNegocio}
            onChange={(e) => setNomeNegocio(e.target.value)}
            className="campo"
          />
        </div>

        <div>
          <label className="rotulo" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="campo"
          />
        </div>

        <div>
          <label className="rotulo" htmlFor="senha">
            Senha
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
            style={
              senha.length > 0 && !senhaOk
                ? { borderColor: "var(--pendente)" }
                : undefined
            }
          />
          <div id="requisitos-senha">
            <RequisitosSenha senha={senha} />
          </div>
        </div>

        {erro && (
          <p className="aviso aviso-erro" role="alert">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={carregando || !senhaOk}
          className="botao mt-2"
        >
          {carregando ? "Criando..." : "Criar conta grátis"}
        </button>
      </form>

      <p className="text-sm mt-6 text-center" style={{ color: "var(--tinta-suave)" }}>
        Já tem conta?{" "}
        <Link href="/login" className="font-medium underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}

/** O Supabase responde em inglês; aqui vira português de gente. */
function traduzirErro(mensagem: string): string {
  const m = mensagem.toLowerCase();

  if (m.includes("already registered") || m.includes("already been registered")) {
    return "Já existe uma conta com esse e-mail. Tente entrar.";
  }
  if (m.includes("invalid") && m.includes("email")) {
    return "Esse e-mail não parece válido. Confira o endereço.";
  }
  if (m.includes("password")) {
    return "A senha não foi aceita. Confira os requisitos abaixo.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  }
  return mensagem;
}
