-- AgilizeMei — catálogo de produtos e serviços
--
-- O atrito que aparece todo dia: "Corte masculino — R$ 45" é redigitado a
-- cada atendimento, "Tinta acrílica 18L — R$ 289,90" a cada orçamento. O
-- catálogo guarda o que se vende uma vez e reusa em recibo e proposta.
--
-- Por que catálogo antes de estoque: o catálogo serve os dois públicos — o
-- pintor reusa "diária de mão de obra", a loja reusa "camiseta P". Estoque
-- só serve a quem revende, e traz a obrigação de manter todo número certo
-- para sempre; saldo errado é pior que saldo nenhum, porque a pessoa passa
-- a desconfiar também do caixa. O campo de controle de saldo entra depois,
-- como coluna desta mesma tabela.
create table if not exists public.itens_catalogo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  natureza text not null check (natureza in ('servico', 'produto')),
  preco numeric(12,2) not null check (preco >= 0),
  -- Quanto o item CUSTA ao dono. É o que faz a margem aparecer sem
  -- precisar lançar despesa a cada venda.
  custo numeric(12,2) not null default 0 check (custo >= 0),
  unidade text not null default 'un',
  -- Arquivar em vez de apagar: item que saiu de linha não pode sumir do
  -- histórico dos documentos que já o usaram.
  arquivado_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_catalogo_ativo
  on public.itens_catalogo (user_id) where arquivado_em is null;

-- O mesmo item cadastrado duas vezes divide o histórico e faz a lista
-- crescer com ruído. `lower` porque "Corte" e "corte" são o mesmo serviço.
create unique index if not exists idx_catalogo_nome_unico
  on public.itens_catalogo (user_id, lower(nome))
  where arquivado_em is null;

alter table public.itens_catalogo enable row level security;

drop policy if exists "dono le seu catalogo" on public.itens_catalogo;
create policy "dono le seu catalogo" on public.itens_catalogo
  for select using (auth.uid() = user_id);

drop policy if exists "dono cria no seu catalogo" on public.itens_catalogo;
create policy "dono cria no seu catalogo" on public.itens_catalogo
  for insert with check (auth.uid() = user_id);

drop policy if exists "dono edita seu catalogo" on public.itens_catalogo;
create policy "dono edita seu catalogo" on public.itens_catalogo
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "dono apaga do seu catalogo" on public.itens_catalogo;
create policy "dono apaga do seu catalogo" on public.itens_catalogo
  for delete using (auth.uid() = user_id);

-- ============================================================
-- O ITEM DO DOCUMENTO LEMBRA DE ONDE VEIO
--
-- `custo_unitario` é FOTOGRAFIA, não referência: mudar o preço de custo no
-- catálogo amanhã não pode reescrever a margem de um serviço entregue mês
-- passado. É a mesma razão pela qual o recibo guarda o valor e não aponta
-- para uma tabela de preços.
-- ============================================================
alter table public.itens_documento
  add column if not exists catalogo_item_id uuid
    references public.itens_catalogo(id) on delete set null,
  add column if not exists custo_unitario numeric(12,2) not null default 0
    check (custo_unitario >= 0);

comment on column public.itens_documento.custo_unitario is
  'Custo copiado do catálogo no momento da emissão. Alimenta a margem sem '
  'gerar lançamento: o dinheiro saiu quando a mercadoria foi comprada, não '
  'quando foi vendida.';

-- Mesma trava de dono já usada no custo por serviço e na conta fixa: a FK
-- só valida existência, e a RLS olha o dono da linha inserida — não o do
-- item de catálogo apontado.
create or replace function public.catalogo_do_mesmo_dono()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.catalogo_item_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.itens_catalogo c
     where c.id = new.catalogo_item_id and c.user_id = new.user_id
  ) then
    raise exception 'o item de catalogo informado nao pertence a esta conta'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.catalogo_do_mesmo_dono() from public, anon, authenticated;

drop trigger if exists itens_catalogo_mesmo_dono on public.itens_documento;
create trigger itens_catalogo_mesmo_dono
  before insert or update of catalogo_item_id, user_id on public.itens_documento
  for each row execute function public.catalogo_do_mesmo_dono();

-- ============================================================
-- LIMITE DE ESCALA NO GRÁTIS
--
-- Quinze itens de propósito, e não três como nas contas fixas: o catálogo
-- existe para tirar digitação do dia a dia, e um teto apertado devolveria
-- o atrito justamente a quem ainda não virou cliente. Quem tem trinta
-- itens de linha é um negócio montado — esse justifica pagar.
-- ============================================================
create or replace function public.limitar_catalogo_no_free()
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
    from public.itens_catalogo
   where user_id = new.user_id and arquivado_em is null;

  if quantos >= 15 then
    raise exception 'o plano gratis guarda ate 15 itens no catalogo'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.limitar_catalogo_no_free() from public, anon, authenticated;

drop trigger if exists catalogo_limite_free on public.itens_catalogo;
create trigger catalogo_limite_free
  before insert on public.itens_catalogo
  for each row execute function public.limitar_catalogo_no_free();

-- Reativar um item também ocupa vaga: sem isto, arquivar e reativar em
-- sequência seria um jeito de furar o limite.
drop trigger if exists catalogo_limite_free_update on public.itens_catalogo;
create trigger catalogo_limite_free_update
  before update on public.itens_catalogo
  for each row
  when (old.arquivado_em is not null and new.arquivado_em is null)
  execute function public.limitar_catalogo_no_free();
