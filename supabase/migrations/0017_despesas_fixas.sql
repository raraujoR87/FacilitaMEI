-- AgilizeMei — contas fixas (aluguel, internet, telefone)
--
-- É o gasto que o MEI mais esquece de lançar, justamente por ser o mais
-- previsível: ninguém guarda o boleto da internet. O efeito é que
-- "quanto desse dinheiro é seu" fica otimista no fim do mês, que é quando
-- as contas chegam.
--
-- Decisão de projeto: o app NÃO lança sozinho. Dinheiro que o sistema
-- inventa é dinheiro em que o dono não confia — e conta fixa atrasa, muda
-- de valor e é cancelada. O que ele faz é lembrar e deixar o lançamento a
-- um toque, com o valor já preenchido.
create table if not exists public.despesas_fixas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  descricao text not null,
  valor numeric(12,2) not null check (valor > 0),
  -- Opcional: nem toda conta fixa tem dia certo, e obrigar faria chutar.
  dia_vencimento int check (dia_vencimento between 1 and 31),
  categoria_id uuid references public.categorias(id) on delete set null,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_despesas_fixas_user
  on public.despesas_fixas (user_id) where ativa;

alter table public.despesas_fixas enable row level security;

drop policy if exists "dono le suas despesas fixas" on public.despesas_fixas;
create policy "dono le suas despesas fixas" on public.despesas_fixas
  for select using (auth.uid() = user_id);

drop policy if exists "dono cria suas despesas fixas" on public.despesas_fixas;
create policy "dono cria suas despesas fixas" on public.despesas_fixas
  for insert with check (auth.uid() = user_id);

drop policy if exists "dono edita suas despesas fixas" on public.despesas_fixas;
create policy "dono edita suas despesas fixas" on public.despesas_fixas
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "dono apaga suas despesas fixas" on public.despesas_fixas;
create policy "dono apaga suas despesas fixas" on public.despesas_fixas
  for delete using (auth.uid() = user_id);

-- ============================================================
-- O LANÇAMENTO SABE DE QUAL CONTA FIXA VEIO
-- ============================================================
alter table public.lancamentos
  add column if not exists despesa_fixa_id uuid
    references public.despesas_fixas(id) on delete set null;

alter table public.lancamentos drop constraint if exists lancamentos_fixa_so_despesa;
alter table public.lancamentos
  add constraint lancamentos_fixa_so_despesa
  check (despesa_fixa_id is null or tipo = 'despesa');

-- Lançar o aluguel duas vezes no mesmo mês distorce o caixa em silêncio, e
-- é exatamente o erro que um botão de um toque convida a cometer (dois
-- cliques, conexão lenta, voltar na tela). O banco recusa.
create unique index if not exists idx_lancamento_fixa_no_mes
  on public.lancamentos (despesa_fixa_id, (date_trunc('month', data_competencia::timestamp)))
  where despesa_fixa_id is not null;

-- Mesma trava de dono usada no custo por serviço: a FK só valida
-- existência, e a RLS olha o dono da linha inserida, não o da conta fixa
-- apontada.
create or replace function public.fixa_do_mesmo_dono()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.despesa_fixa_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.despesas_fixas f
     where f.id = new.despesa_fixa_id and f.user_id = new.user_id
  ) then
    raise exception 'a conta fixa informada nao pertence a esta conta'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.fixa_do_mesmo_dono() from public, anon, authenticated;

drop trigger if exists lancamentos_fixa_mesmo_dono on public.lancamentos;
create trigger lancamentos_fixa_mesmo_dono
  before insert or update of despesa_fixa_id, user_id on public.lancamentos
  for each row execute function public.fixa_do_mesmo_dono();

-- ============================================================
-- LIMITE DE ESCALA NO GRÁTIS
--
-- Três contas fixas cobrem quem está começando (internet, telefone e mais
-- uma). Quem tem aluguel, contador, sistema e seguro já é um negócio com
-- estrutura — e estrutura justifica pagar.
-- ============================================================
create or replace function public.limitar_fixas_no_free()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quantas int;
begin
  if public.plano_efetivo(new.user_id) = 'pro' then
    return new;
  end if;

  select count(*) into quantas
    from public.despesas_fixas where user_id = new.user_id and ativa;

  if quantas >= 3 then
    raise exception 'o plano gratis guarda ate 3 contas fixas'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.limitar_fixas_no_free() from public, anon, authenticated;

drop trigger if exists despesas_fixas_limite_free on public.despesas_fixas;
create trigger despesas_fixas_limite_free
  before insert on public.despesas_fixas
  for each row execute function public.limitar_fixas_no_free();

-- ============================================================
-- O QUE FALTA LANÇAR NO MÊS
--
-- Uma passada só: a tela precisa da conta fixa, se já foi lançada no mês e
-- por quanto. Sem isto seria uma consulta por conta.
--
-- O recorte é por mês de competência, não "existe algum lançamento": o
-- aluguel de julho não pode fazer o de agosto sumir da lista.
-- ============================================================
create or replace function public.contas_fixas_do_mes(mes date)
returns table (
  id uuid, descricao text, valor numeric, dia_vencimento int,
  categoria_id uuid, categoria text,
  lancamento_id uuid, valor_lancado numeric, lancado_em date
)
language sql stable set search_path = ''
as $$
  select f.id, f.descricao, f.valor, f.dia_vencimento,
         f.categoria_id, c.nome,
         l.id, l.valor, l.data_competencia
    from public.despesas_fixas f
    left join public.categorias c on c.id = f.categoria_id
    left join public.lancamentos l
      on l.despesa_fixa_id = f.id
     and l.data_competencia >= date_trunc('month', mes)::date
     and l.data_competencia < (date_trunc('month', mes) + interval '1 month')::date
   where f.ativa
   order by f.dia_vencimento nulls last, f.descricao;
$$;

grant execute on function public.contas_fixas_do_mes(date) to authenticated;
revoke execute on function public.contas_fixas_do_mes(date) from anon;
