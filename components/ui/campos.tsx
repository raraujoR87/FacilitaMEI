import type { ReactNode } from "react";

type CampoProps = {
  nome: string;
  label: string;
  tipo?: string;
  obrigatorio?: boolean;
  valorInicial?: string | null;
  placeholder?: string;
  dica?: string;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email";
};

export function Campo({
  nome,
  label,
  tipo = "text",
  obrigatorio,
  valorInicial,
  placeholder,
  dica,
  inputMode,
}: CampoProps) {
  return (
    <div>
      <label className="rotulo" htmlFor={nome}>
        {label}
        {!obrigatorio && <span className="dica"> (opcional)</span>}
      </label>
      <input
        id={nome}
        name={nome}
        type={tipo}
        required={obrigatorio}
        defaultValue={valorInicial ?? undefined}
        placeholder={placeholder}
        inputMode={inputMode}
        className="campo"
      />
      {dica && <p className="dica">{dica}</p>}
    </div>
  );
}

type OpcaoSelect = { valor: string; rotulo: string };

export function CampoSelect({
  nome,
  label,
  opcoes,
  valorInicial,
  obrigatorio,
  vazio,
}: {
  nome: string;
  label: string;
  opcoes: OpcaoSelect[];
  valorInicial?: string | null;
  obrigatorio?: boolean;
  vazio?: string;
}) {
  return (
    <div>
      <label className="rotulo" htmlFor={nome}>
        {label}
      </label>
      <select
        id={nome}
        name={nome}
        required={obrigatorio}
        defaultValue={valorInicial ?? ""}
        className="campo"
      >
        {vazio && <option value="">{vazio}</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Aviso({ estado }: { estado: { erro?: string; sucesso?: string } }) {
  if (!estado.erro && !estado.sucesso) return null;
  return (
    <p
      className={`aviso ${estado.erro ? "aviso-erro" : "aviso-sucesso"}`}
      role="status"
    >
      {estado.erro ?? estado.sucesso}
    </p>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-sm py-8 text-center"
      style={{ color: "var(--tinta-suave)" }}
    >
      {children}
    </p>
  );
}

export function Recibo({
  titulo,
  children,
  className = "",
}: {
  titulo?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`fita-recibo px-6 py-6 ${className}`}>
      {titulo && (
        <p
          className="text-xs uppercase tracking-widest mb-4"
          style={{ color: "var(--tinta-suave)" }}
        >
          {titulo}
        </p>
      )}
      {children}
    </section>
  );
}

const CORES_STATUS: Record<string, string> = {
  pago: "var(--positivo)",
  pendente: "var(--pendente)",
  vencido: "var(--selo)",
  cancelado: "var(--tinta-suave)",
};

export function Carimbo({ status }: { status: string }) {
  return (
    <span className="carimbo" style={{ color: CORES_STATUS[status] ?? "var(--tinta-suave)" }}>
      {status}
    </span>
  );
}
