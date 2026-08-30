-- AgilizeMei — clientes como ferramenta de decisão
--
-- A lista de clientes era um cadastro. O que o MEI precisa saber é quem
-- paga mais, quem está devendo e quem sumiu — as três perguntas que mudam
-- o que ele faz na semana.

-- Quando a cobrança foi baixada. Sem isso não dá para saber se o cliente
-- paga em dia ou sempre atrasa — e é justamente esse o cliente que o MEI
-- precisa identificar antes de aceitar o próximo serviço a prazo.
alter table public.documentos_venda
  add column if not exists pago_em timestamptz;

-- Baixas antigas: o lançamento de receita marca quando a baixa aconteceu.
update public.documentos_venda d
   set pago_em = l.created_at
  from public.lancamentos l
 where l.documento_venda_id = d.id
   and d.status = 'pago'
   and d.pago_em is null;

-- Sem security definer de propósito: roda como quem chama, e a RLS de
-- `documentos_venda` e `clientes` já limita ao dono. Uma função que
-- ignorasse a RLS aqui seria risco sem ganho.
create or replace function public.metricas_clientes()
returns table (
  cliente_id uuid,
  nome text,
  documento text,
  telefone text,
  documentos bigint,
  total_pago numeric,
  total_aberto numeric,
  total_vencido numeric,
  ticket_medio numeric,
  primeira_compra date,
  ultima_compra date,
  dias_desde_ultima int,
  intervalo_medio_dias int,
  pagou_com_atraso bigint
)
language sql
stable
set search_path = ''
as $$
  select
    c.id,
    c.nome,
    c.documento,
    c.telefone,
    count(d.id) filter (where d.tipo = 'recibo'),
    coalesce(sum(d.valor) filter (where d.status = 'pago'), 0),
    coalesce(sum(d.valor) filter (where d.status = 'pendente' and d.tipo = 'recibo'), 0),
    coalesce(sum(d.valor) filter (
      where d.status = 'pendente' and d.tipo = 'recibo'
        and d.data_vencimento is not null and d.data_vencimento < current_date
    ), 0),
    case
      when count(d.id) filter (where d.status = 'pago') > 0
      then round(
        coalesce(sum(d.valor) filter (where d.status = 'pago'), 0)
        / count(d.id) filter (where d.status = 'pago'), 2)
      else 0
    end,
    min(d.data_emissao) filter (where d.tipo = 'recibo'),
    max(d.data_emissao) filter (where d.tipo = 'recibo'),
    (current_date - max(d.data_emissao) filter (where d.tipo = 'recibo'))::int,
    -- Recorrência: com uma compra só não há intervalo a medir.
    case
      when count(d.id) filter (where d.tipo = 'recibo') > 1
      then (
        (max(d.data_emissao) filter (where d.tipo = 'recibo')
         - min(d.data_emissao) filter (where d.tipo = 'recibo'))
        / (count(d.id) filter (where d.tipo = 'recibo') - 1)
      )::int
      else null
    end,
    count(d.id) filter (
      where d.pago_em is not null
        and d.data_vencimento is not null
        and d.pago_em::date > d.data_vencimento
    )
  from public.clientes c
  left join public.documentos_venda d
    on d.cliente_id = c.id and d.status <> 'cancelado'
  group by c.id, c.nome, c.documento, c.telefone
  order by coalesce(sum(d.valor) filter (where d.status = 'pago'), 0) desc;
$$;

grant execute on function public.metricas_clientes() to authenticated;
revoke execute on function public.metricas_clientes() from anon;
