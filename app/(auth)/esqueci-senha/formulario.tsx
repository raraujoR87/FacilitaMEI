"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function FormularioEsqueciSenha() {
  const parametros = useSearchParams();
  const expirado = parametros.get("expirado") === "1";

  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    // Construído aqui, e não no corpo do componente: durante o prerender
    // não há navegador nem variáveis públicas garantidas.
    const supabase = createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/redefinir-senha`,
    });

    setCarregando(false);
    if (error) {
      setErro("Não foi possível enviar agora. Tente de novo em alguns minutos.");
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="fita-recibo px-8 py-10">
        <h1 className="text-2xl mb-1" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
          Confira seu e-mail
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--tinta-suave)" }}>
          Se existe uma conta com <strong>{email}</strong>, o link para criar
          uma senha nova chegou aí. Ele vale por pouco tempo — se demorar,
          peça outro.
        </p>
        <Link href="/login" className="botao botao-secundario">
          Voltar para entrar
        </Link>
      </div>
    );
  }

  return (
    <div className="fita-recibo px-8 py-10">
      <h1 className="text-2xl mb-1" style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
        Esqueceu a senha?
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--tinta-suave)" }}>
        Informe seu e-mail e enviamos um link para você criar uma nova.
      </p>

      {expirado && (
        <p className="aviso aviso-erro mb-4">
          Aquele link expirou ou já tinha sido usado. Peça um novo abaixo.
        </p>
      )}

      <form onSubmit={enviar} className="flex flex-col gap-4">
        <div>
          <label className="rotulo" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="campo"
          />
        </div>

        {erro && <p className="aviso aviso-erro">{erro}</p>}

        <button type="submit" disabled={carregando} className="botao">
          {carregando ? "Enviando..." : "Enviar link"}
        </button>
      </form>

      <p className="text-sm mt-6" style={{ color: "var(--tinta-suave)" }}>
        Lembrou?{" "}
        <Link href="/login" className="underline font-medium">
          Entrar
        </Link>
      </p>
    </div>
  );
}
