-- AgilizeMei — detalhamento por item
--
-- Até aqui um recibo era uma frase e um valor. Isso não descreve "3 cortes
-- a R$ 45", nem um orçamento com peça e mão de obra separadas, e não atende
-- a NF-e de produto, que exige quantidade e valor unitário por item.
--
-- O detalhamento é opcional: quem quer registrar rápido continua com uma
-- linha só. Quem precisa detalhar, detalha.

create table if not exists public.itens_documento (
  id uuid primary key default gen_random_uuid(),
  -- user_id repetido do documento pai: deixa a policy direta e o filtro
  -- barato, no mesmo padrão das outras tabelas do schema.
  user_id uuid not null references auth.users(id) on delete cascade,
  documento_venda_id uuid not null
    references public.documentos_venda(id) on delete cascade,
  descricao text not null,
  quantidade numeric(12,3) not null default 1 check (quantidade > 0),
  unidade text not null default 'un',
  valor_unitario numeric(12,2) not null check (valor_unitario >= 0),
  -- Calculado pelo banco: cliente e servidor nunca divergem no arredondamento.
  total numeric(14,2) generated always as (round(quantidade * valor_unitario, 2)) stored,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.itens_documento enable row level security;

drop policy if exists "usuario_gerencia_proprios_itens" on public.itens_documento;
create policy "usuario_gerencia_proprios_itens"
  on public.itens_documento for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create index if not exists idx_itens_documento_pai
  on public.itens_documento (documento_venda_id, ordem);

-- ============================================================
-- O TOTAL DO DOCUMENTO SEGUE OS ITENS
--
-- `documentos_venda.valor` continua sendo a fonte para lançamento, PIX e
-- relatório. Quando há itens, ele passa a ser a soma deles — do contrário
-- existiriam dois totais divergentes e o PIX poderia cobrar valor errado.
-- Sem itens, o valor digitado permanece intocado.
-- ============================================================
create or replace function public.recalcular_total_documento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  documento uuid := coalesce(new.documento_venda_id, old.documento_venda_id);
  soma numeric(14,2);
begin
  select sum(i.total) into soma
    from public.itens_documento i
   where i.documento_venda_id = documento;

  -- Apagar o último item não zera a cobrança: volta ao valor digitado,
  -- que é o comportamento menos surpreendente.
  if soma is not null then
    update public.documentos_venda
       set valor = soma
     where id = documento;
  end if;

  return null;
end;
$$;

drop trigger if exists itens_documento_recalcula on public.itens_documento;
create trigger itens_documento_recalcula
  after insert or update or delete on public.itens_documento
  for each row execute function public.recalcular_total_documento();

-- Função de gatilho não precisa ser chamável pela API REST.
revoke execute on function public.recalcular_total_documento() from public, anon, authenticated;

-- ============================================================
-- OBSERVAÇÕES DO DOCUMENTO
--
-- Prazo de garantia, condição de pagamento, o que não está incluso — o
-- texto que evita discussão depois, sobretudo em orçamento.
-- ============================================================
alter table public.documentos_venda
  add column if not exists observacoes text;
