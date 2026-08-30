"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

    setCarregando(false);
    if (error) {
      setErro("E-mail ou senha incorretos.");
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
        Entrar
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--tinta-suave)" }}>
        Acesse seu FacilitaMEI
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium block mb-1" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
            style={{ borderColor: "var(--borda)" }}
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1" htmlFor="senha">
            Senha
          </label>
          <input
            id="senha"
            type="password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
            style={{ borderColor: "var(--borda)" }}
          />
        </div>

        {erro && (
          <p className="text-sm" style={{ color: "var(--selo)" }}>
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={carregando}
          className="mt-2 rounded-md py-2.5 font-medium text-white disabled:opacity-60"
          style={{ background: "var(--tinta)" }}
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p className="text-sm mt-6 text-center" style={{ color: "var(--tinta-suave)" }}>
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium underline">
          Criar conta grátis
        </Link>
      </p>
    </div>
  );
}
