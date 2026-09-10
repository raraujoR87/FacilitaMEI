"use client";

import { useActionState, useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";
import { salvarAssinatura } from "@/app/actions/empresa";
import { ESTADO_INICIAL } from "@/app/actions/tipos";
import { Aviso } from "@/components/ui/campos";
import { BotaoSubmit } from "@/components/ui/botao-submit";

/** Área de desenho em pontos CSS. Proporção de assinatura, não de quadro. */
const LARGURA = 520;
const ALTURA = 180;
/** Desenha em 2x e reduz na hora de exportar: fica nítido no PDF impresso. */
const ESCALA = 2;

type Ponto = { x: number; y: number };

/**
 * Assinatura desenhada com o dedo ou o mouse.
 *
 * O MEI não tem assinatura digitalizada guardada em lugar nenhum — pedir
 * "envie um arquivo PNG da sua assinatura" é um pedido que ele não sabe
 * atender. Desenhar na tela é o caminho que ele completa, e no celular
 * sai melhor que no computador porque o dedo já é a caneta.
 *
 * `pointer` em vez de mouse e touch separados: o mesmo código atende
 * dedo, caneta e mouse, e não há o atraso de clique dos eventos de toque.
 */
export function Assinatura({ atual }: { atual: string | null }) {
  const [estado, acao] = useActionState(salvarAssinatura, ESTADO_INICIAL);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const ultimo = useRef<Ponto | null>(null);
  const [temTraco, setTemTraco] = useState(false);
  const [dataUrl, setDataUrl] = useState("");
  const [refazendo, setRefazendo] = useState(atual === null);

  function contexto(): CanvasRenderingContext2D | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.4 * ESCALA;
    ctx.strokeStyle = "#1a1a1a";
    return ctx;
  }

  function pontoDoEvento(e: React.PointerEvent<HTMLCanvasElement>): Ponto {
    const canvas = canvasRef.current!;
    const area = canvas.getBoundingClientRect();
    // O canvas é exibido menor que sua resolução interna; sem converter
    // pela razão, o traço sai deslocado do dedo.
    return {
      x: ((e.clientX - area.left) / area.width) * canvas.width,
      y: ((e.clientY - area.top) / area.height) * canvas.height,
    };
  }

  function comecar(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    desenhando.current = true;
    ultimo.current = pontoDoEvento(e);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    e.preventDefault();
    const ctx = contexto();
    const atualPonto = pontoDoEvento(e);
    if (!ctx || !ultimo.current) return;

    ctx.beginPath();
    ctx.moveTo(ultimo.current.x, ultimo.current.y);
    ctx.lineTo(atualPonto.x, atualPonto.y);
    ctx.stroke();

    ultimo.current = atualPonto;
    if (!temTraco) setTemTraco(true);
  }

  function terminar() {
    if (!desenhando.current) return;
    desenhando.current = false;
    ultimo.current = null;
    exportar();
  }

  /**
   * Recorta a sobra transparente antes de exportar.
   *
   * Sem o recorte, a assinatura vai para o PDF cercada de vazio e aparece
   * minúscula no meio de um retângulo grande — parece defeito.
   */
  function exportar() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Canal alfa: qualquer pixel pintado conta.
        if (data[(y * width + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < 0) {
      setDataUrl("");
      setTemTraco(false);
      return;
    }

    const folga = 8 * ESCALA;
    const recorteX = Math.max(0, minX - folga);
    const recorteY = Math.max(0, minY - folga);
    const recorteL = Math.min(width, maxX + folga) - recorteX;
    const recorteA = Math.min(height, maxY + folga) - recorteY;

    const saida = document.createElement("canvas");
    saida.width = recorteL;
    saida.height = recorteA;
    saida
      .getContext("2d")!
      .drawImage(canvas, recorteX, recorteY, recorteL, recorteA, 0, 0, recorteL, recorteA);

    setDataUrl(saida.toDataURL("image/png"));
  }

  function limpar() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTemTraco(false);
    setDataUrl("");
  }

  return (
    <section>
      <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
        <PenLine size={15} aria-hidden />
        Sua assinatura
      </h2>

      <div
        className="rounded-lg border px-5 py-4"
        style={{ borderColor: "var(--borda)", background: "#fff" }}
      >
        {atual && !refazendo ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm" style={{ color: "var(--tinta-suave)" }}>
              Assinatura salva. Ela entra no rodapé dos orçamentos e recibos.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={atual}
              alt="Sua assinatura"
              className="border rounded-md bg-white"
              style={{ borderColor: "var(--borda)", maxWidth: 260, padding: 8 }}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRefazendo(true)}
                className="botao botao-secundario"
              >
                Assinar de novo
              </button>
              <form action={acao}>
                <input type="hidden" name="remover" value="sim" />
                <BotaoSubmit variante="discreto" carregando="...">
                  Remover assinatura
                </BotaoSubmit>
              </form>
            </div>
            <Aviso estado={estado} />
          </div>
        ) : (
          <form action={acao} className="flex flex-col gap-3">
            <p className="text-sm" style={{ color: "var(--tinta-suave)" }}>
              Assine no quadro abaixo com o dedo (no celular) ou com o mouse.
              Sai melhor no celular.
            </p>

            <div
              className="rounded-md border overflow-hidden"
              style={{ borderColor: temTraco ? "var(--tinta)" : "var(--borda)" }}
            >
              <canvas
                ref={canvasRef}
                width={LARGURA * ESCALA}
                height={ALTURA * ESCALA}
                onPointerDown={comecar}
                onPointerMove={mover}
                onPointerUp={terminar}
                onPointerLeave={terminar}
                onPointerCancel={terminar}
                aria-label="Quadro para desenhar sua assinatura"
                className="block w-full"
                style={{
                  // `touch-action: none` impede a página de rolar enquanto
                  // o dedo desenha — sem isso, no celular, a tela desliza
                  // e o traço sai picotado.
                  touchAction: "none",
                  aspectRatio: `${LARGURA} / ${ALTURA}`,
                  background:
                    "linear-gradient(to bottom, transparent calc(100% - 34px), var(--borda) calc(100% - 34px), var(--borda) calc(100% - 33px), transparent calc(100% - 33px))",
                  cursor: "crosshair",
                }}
              />
            </div>

            <input type="hidden" name="assinatura" value={dataUrl} />

            <div className="flex flex-wrap items-center gap-2">
              <BotaoSubmit carregando="Salvando...">Salvar assinatura</BotaoSubmit>
              <button type="button" onClick={limpar} className="botao botao-secundario">
                <Eraser size={15} aria-hidden />
                Limpar
              </button>
              {atual && (
                <button
                  type="button"
                  onClick={() => setRefazendo(false)}
                  className="botao botao-discreto"
                >
                  Cancelar
                </button>
              )}
            </div>

            <Aviso estado={estado} />
          </form>
        )}
      </div>
    </section>
  );
}
