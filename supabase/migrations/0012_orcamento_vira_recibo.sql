-- AgilizeMei — do orçamento aceito ao recibo
--
-- O orçamento não vira recibo por mudança de tipo: ele é história, e a
-- numeração dele já foi entregue ao cliente. Nasce um documento novo, com
-- número próprio, apontando para a origem — que é como funciona no mundo
-- real (orçamento nº 5 aprovado, recibo nº 6 emitido).

alter table public.documentos_venda
  add column if not exists gerado_de_orcamento_id uuid
    references public.documentos_venda(id) on delete set null;

-- Um orçamento só gera um recibo: evita clique duplo virar cobrança dobrada.
create unique index if not exists idx_documento_gerado_de_orcamento
  on public.documentos_venda (gerado_de_orcamento_id)
  where gerado_de_orcamento_id is not null;

comment on column public.documentos_venda.gerado_de_orcamento_id is
  'Recibo emitido a partir de um orçamento aceito. Único por orçamento.';

-- Orçamento que virou recibo não está "pago" — ele cumpriu o papel e saiu
-- de cena. Usar 'pago' faria qualquer relatório por status contar proposta
-- como dinheiro recebido, e a trilha de auditoria registraria uma mudança
-- que não aconteceu.
alter table public.documentos_venda drop constraint if exists documentos_venda_status_check;

alter table public.documentos_venda
  add constraint documentos_venda_status_check
  check (status in ('pendente', 'pago', 'cancelado', 'convertido'));

comment on column public.documentos_venda.status is
  'pendente, pago (recibo recebido), cancelado, convertido (orçamento que virou recibo).';
