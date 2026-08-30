import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <span
          className="text-lg tracking-tight"
          style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
        >
          Facilita<span style={{ color: "var(--positivo)" }}>MEI</span>
        </span>
        <Link
          href="/login"
          className="text-sm font-medium px-4 py-2 rounded-md border"
          style={{ borderColor: "var(--borda)" }}
        >
          Entrar
        </Link>
      </header>

      <section className="flex-1 max-w-5xl mx-auto w-full px-6 py-16 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span
            className="carimbo mb-6"
            style={{ color: "var(--positivo)" }}
          >
            Feito pra quem trabalha sozinho
          </span>
          <h1
            className="mt-6 text-4xl md:text-5xl leading-tight"
            style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
          >
            Manda a nota pelo WhatsApp.
            <br />A gente organiza o resto.
          </h1>
          <p className="mt-5 text-lg" style={{ color: "var(--tinta-suave)" }}>
            Financeiro, vendas e cobrança num só lugar — sem planilha, sem
            curso, sem complicação. Você tira a foto, o FacilitaMEI categoriza
            e monta o relatório pro seu contador.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              href="/cadastro"
              className="px-5 py-3 rounded-md font-medium text-white"
              style={{ background: "var(--tinta)" }}
            >
              Começar grátis
            </Link>
            <span className="self-center text-sm" style={{ color: "var(--tinta-suave)" }}>
              10 notas/mês sem custo
            </span>
          </div>
        </div>

        {/* Assinatura visual: fita de recibo com o resumo do mês */}
        <div className="fita-recibo mx-auto w-full max-w-sm px-6 py-8 rotate-1">
          <p
            className="text-xs uppercase tracking-widest text-center"
            style={{ color: "var(--tinta-suave)" }}
          >
            Resumo de Agosto
          </p>
          <div className="my-4 border-t border-dashed" style={{ borderColor: "var(--borda)" }} />
          {[
            { label: "Venda — Corte de cabelo", valor: "R$ 45,00", tipo: "receita" },
            { label: "Fornecedor — Produtos", valor: "R$ 120,00", tipo: "despesa" },
            { label: "Venda — Manicure", valor: "R$ 35,00", tipo: "receita" },
          ].map((item) => (
            <div key={item.label} className="flex justify-between py-1.5 text-sm">
              <span>{item.label}</span>
              <span
                style={{
                  fontFamily: "var(--font-mono-valor)",
                  color: item.tipo === "receita" ? "var(--positivo)" : "var(--selo)",
                }}
              >
                {item.tipo === "receita" ? "+" : "-"}
                {item.valor}
              </span>
            </div>
          ))}
          <div className="my-4 border-t border-dashed" style={{ borderColor: "var(--borda)" }} />
          <div className="flex justify-between font-semibold">
            <span>Saldo</span>
            <span style={{ fontFamily: "var(--font-mono-valor)" }}>R$ -40,00</span>
          </div>
          <div className="mt-6 text-center">
            <span className="carimbo" style={{ color: "var(--pendente)" }}>
              pendente de revisão
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
