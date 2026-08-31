-- AgilizeMei — fechar o CRUD de clientes
--
-- Faltava editar: um erro de digitação no nome ia para todo recibo emitido,
-- e não havia como acrescentar o CPF/CNPJ depois. Esse campo decide se a
-- venda exige nota fiscal — cadastrar sem ele deixava o aviso fiscal errado
-- para sempre.
--
-- E havia um beco sem saída: o grátis conta 5 clientes, mas só dava para
-- excluir quem nunca comprou. Quem chegasse a 5 clientes com histórico não
-- podia excluir nem cadastrar mais ninguém. Arquivar resolve sem apagar
-- nada.

-- ============================================================
-- ARQUIVAR EM VEZ DE APAGAR
-- ============================================================
alter table public.clientes
  add column if not exists arquivado_em timestamptz;

comment on column public.clientes.arquivado_em is
  'Cliente que não atende mais. Sai da lista e da contagem do plano, mas o '
  'histórico de recibos continua intacto.';

create index if not exists idx_clientes_ativos
  on public.clientes (user_id) where arquivado_em is null;

-- ============================================================
-- O HISTÓRICO NÃO PODE FICAR ÓRFÃO
--
-- A FK é `on delete set null`: apagar um cliente com recibos emitidos
-- deixaria os documentos sem nome, silenciosamente. A tela já escondia o
-- botão, mas esconder botão não é controle — a mesma sessão consegue
-- chamar a API REST direto.
-- ============================================================
create or replace function public.proteger_cliente_com_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.documentos_venda d where d.cliente_id = old.id) then
    raise exception 'cliente com recibo emitido nao pode ser excluido, apenas arquivado'
      using errcode = '42501';
  end if;
  return old;
end;
$$;

revoke execute on function public.proteger_cliente_com_historico() from public, anon, authenticated;

drop trigger if exists clientes_protege_historico on public.clientes;
create trigger clientes_protege_historico
  before delete on public.clientes
  for each row execute function public.proteger_cliente_com_historico();

-- ============================================================
-- MESMO CPF/CNPJ É O MESMO CLIENTE
--
-- Cadastro duplicado quebra tudo que depende da carteira: o cliente
-- aparece duas vezes no ranking, a recorrência não é detectada e a dívida
-- fica dividida em dois nomes. Arquivado não bloqueia — se voltar a
-- atender, dá para reativar ou cadastrar de novo.
-- ============================================================
create unique index if not exists idx_cliente_documento_unico
  on public.clientes (user_id, documento)
  where documento is not null and arquivado_em is null;

-- ============================================================
-- ARQUIVADO NÃO OCUPA VAGA NO PLANO GRÁTIS
-- ============================================================
create or replace function public.limitar_clientes_no_free()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quantos int;
begin
  if public.plano_efetivo(new.user_id) = 'pro' then
    return new;
  end if;

  select count(*) into quantos
    from public.clientes
   where user_id = new.user_id and arquivado_em is null;

  if quantos >= 5 then
    raise exception 'o plano gratis guarda ate 5 clientes'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.limitar_clientes_no_free() from public, anon, authenticated;

-- Reativar um cliente também ocupa vaga: sem isto, arquivar e reativar em
-- sequência seria um jeito de furar o limite.
drop trigger if exists clientes_limite_free_update on public.clientes;
create trigger clientes_limite_free_update
  before update on public.clientes
  for each row
  when (old.arquivado_em is not null and new.arquivado_em is null)
  execute function public.limitar_clientes_no_free();

-- ============================================================
-- MÉTRICAS SABEM QUEM ESTÁ ARQUIVADO
--
-- A função devolve todos e a tela separa: arquivado sai do ranking, dos
-- alertas e dos totais, mas continua acessível para reativar. Ver 0015
-- para a origem do cálculo de lucro.
-- ============================================================
drop function if exists public.metricas_clientes();

create or replace function public.metricas_clientes()
returns table (
  cliente_id uuid, nome text, documento text, telefone text,
  email text, observacoes text, arquivado_em timestamptz,
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
    c.email, c.observacoes, c.arquivado_em,
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
  group by c.id, c.nome, c.documento, c.telefone, c.email, c.observacoes, c.arquivado_em
  order by coalesce(sum(d.valor) filter (where d.status = 'pago'), 0) desc;
$$;

grant execute on function public.metricas_clientes() to authenticated;
revoke execute on function public.metricas_clientes() from anon;
