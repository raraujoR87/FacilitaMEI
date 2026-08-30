-- AgilizeMei — "esse trabalho deu lucro?"
--
-- Faturamento alto com margem baixa é a armadilha clássica do MEI: ele
-- comemora o cliente grande sem perceber que o material consumiu quase tudo.
-- Sem ligar a despesa ao serviço, o app só sabe dizer quanto entrou.
--
-- Coluna separada de `documento_venda_id` de propósito: aquela guarda a
-- RECEITA gerada pelo documento e tem índice único (um documento, um
-- lançamento de receita). Custo é o contrário — um serviço pode consumir
-- várias despesas.
alter table public.lancamentos
  add column if not exists custo_de_documento_id uuid
    references public.documentos_venda(id) on delete set null;

-- Receita não é custo de nada: sem esta trava, um lançamento de entrada
-- poderia ser marcado como custo e a margem sairia invertida.
alter table public.lancamentos drop constraint if exists lancamentos_custo_so_despesa;
alter table public.lancamentos
  add constraint lancamentos_custo_so_despesa
  check (custo_de_documento_id is null or tipo = 'despesa');

create index if not exists idx_lancamentos_custo_documento
  on public.lancamentos (custo_de_documento_id)
  where custo_de_documento_id is not null;

comment on column public.lancamentos.custo_de_documento_id is
  'Despesa atribuída a um serviço/venda, para calcular margem. Vários custos por documento.';

-- ============================================================
-- MÉTRICAS DE CLIENTE COM LUCRO
--
-- Faturamento e lucro respondem perguntas diferentes, e no fim do mês é o
-- segundo que paga as contas. Substitui a versão de 0014.
--
-- Só custo de trabalho PAGO entra: `total_pago` também só conta pago, e
-- misturar as bases faria o lucro cair antes de a receita subir.
-- ============================================================
drop function if exists public.metricas_clientes();

create or replace function public.metricas_clientes()
returns table (
  cliente_id uuid, nome text, documento text, telefone text,
  documentos bigint, total_pago numeric, total_aberto numeric,
  total_vencido numeric, ticket_medio numeric,
  primeira_compra date, ultima_compra date,
  dias_desde_ultima int, intervalo_medio_dias int, pagou_com_atraso bigint,
  custo_atribuido numeric, lucro numeric
)
language sql stable set search_path = ''
as $$
  with custos as (
    select d.cliente_id, coalesce(sum(l.valor), 0) as total
      from public.lancamentos l
      join public.documentos_venda d on d.id = l.custo_de_documento_id
     where d.status = 'pago'
     group by d.cliente_id
  )
  select
    c.id, c.nome, c.documento, c.telefone,
    count(d.id) filter (where d.tipo = 'recibo'),
    coalesce(sum(d.valor) filter (where d.status = 'pago'), 0),
    coalesce(sum(d.valor) filter (where d.status = 'pendente' and d.tipo = 'recibo'), 0),
    coalesce(sum(d.valor) filter (
      where d.status = 'pendente' and d.tipo = 'recibo'
        and d.data_vencimento is not null and d.data_vencimento < current_date
    ), 0),
    case
      when count(d.id) filter (where d.status = 'pago') > 0
      then round(coalesce(sum(d.valor) filter (where d.status = 'pago'), 0)
                 / count(d.id) filter (where d.status = 'pago'), 2)
      else 0
    end,
    min(d.data_emissao) filter (where d.tipo = 'recibo'),
    max(d.data_emissao) filter (where d.tipo = 'recibo'),
    (current_date - max(d.data_emissao) filter (where d.tipo = 'recibo'))::int,
    case
      when count(d.id) filter (where d.tipo = 'recibo') > 1
      then ((max(d.data_emissao) filter (where d.tipo = 'recibo')
             - min(d.data_emissao) filter (where d.tipo = 'recibo'))
            / (count(d.id) filter (where d.tipo = 'recibo') - 1))::int
      else null
    end,
    count(d.id) filter (
      where d.pago_em is not null and d.data_vencimento is not null
        and d.pago_em::date > d.data_vencimento
    ),
    coalesce(max(cu.total), 0),
    coalesce(sum(d.valor) filter (where d.status = 'pago'), 0) - coalesce(max(cu.total), 0)
  from public.clientes c
  left join public.documentos_venda d
    on d.cliente_id = c.id and d.status <> 'cancelado'
  left join custos cu on cu.cliente_id = c.id
  group by c.id, c.nome, c.documento, c.telefone
  order by coalesce(sum(d.valor) filter (where d.status = 'pago'), 0) desc;
$$;

grant execute on function public.metricas_clientes() to authenticated;
revoke execute on function public.metricas_clientes() from anon;
