-- AgilizeMei — 14 dias de Pro no cadastro e limites de escala no grátis
--
-- O Pro competia com uma alternativa gratuita: lançar na mão. Recurso
-- interno nunca converte, porque sempre há um jeito manual de contornar.
--
-- Duas mudanças de estratégia:
--
-- 1. Todo mundo começa no Pro por 14 dias. Perder o que já se teve converte
--    muito mais do que nunca ter tido — e nesses 14 dias a pessoa forma o
--    hábito com o produto inteiro.
--
-- 2. O grátis passa a ter limites de ESCALA, não de função. Quem cresceu
--    esbarra; quem está começando não sente. O concorrente aqui é o caderno
--    e o WhatsApp: grátis capado demais faz voltar para o papel, e aí não
--    há o que converter.
--
-- Editar registro segue livre de propósito. Erro de digitação que não dá
-- para corrigir gera raiva, e atinge justamente o iniciante que ainda não
-- foi convertido.

-- ============================================================
-- PERÍODO DE TESTE
-- ============================================================
alter table public.perfis
  add column if not exists trial_expira_em timestamptz;

comment on column public.perfis.trial_expira_em is
  'Fim dos 14 dias de Pro dados no cadastro. Passado, a conta cai para o grátis.';

-- Contas que já existiam ganham o teste a partir de agora, para ninguém ser
-- rebaixado sem nunca ter experimentado.
update public.perfis
   set trial_expira_em = now() + interval '14 days'
 where trial_expira_em is null;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.perfis (id, nome_negocio, trial_expira_em)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome_negocio', 'Meu Negócio'),
    now() + interval '14 days'
  );

  insert into public.categorias (user_id, nome, tipo, cor) values
    (new.id, 'Vendas',               'receita', '#2F6E5B'),
    (new.id, 'Serviços',             'receita', '#2F6E5B'),
    (new.id, 'Fornecedores',         'despesa', '#C23B22'),
    (new.id, 'Material de trabalho', 'despesa', '#C23B22'),
    (new.id, 'Transporte',           'despesa', '#C23B22'),
    (new.id, 'Alimentação',          'despesa', '#C23B22'),
    (new.id, 'Impostos e taxas',     'despesa', '#C23B22'),
    (new.id, 'Outros',               'despesa', '#59564E');

  return new;
end;
$$ language plpgsql security definer set search_path = '';

-- ============================================================
-- PLANO EFETIVO PASSA A CONSIDERAR O TESTE
-- ============================================================
create or replace function public.plano_efetivo(perfil_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p.trial_expira_em is not null and p.trial_expira_em > now() then 'pro'
    when p.plano = 'pro'
     and (p.plano_expira_em is null or p.plano_expira_em > now()) then 'pro'
    else 'free'
  end
  from public.perfis p
  where p.id = perfil_id;
$$;

-- ============================================================
-- LIMITES DE ESCALA NO GRÁTIS
--
-- Cadastro de cliente é conveniência: dá para emitir recibo sem cliente
-- cadastrado. Quem tem mais de cinco clientes fixos já é um negócio que
-- justifica pagar.
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

  select count(*) into quantos from public.clientes where user_id = new.user_id;

  if quantos >= 5 then
    raise exception 'o plano gratis guarda ate 5 clientes'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.limitar_clientes_no_free() from public, anon, authenticated;

drop trigger if exists clientes_limite_free on public.clientes;
create trigger clientes_limite_free
  before insert on public.clientes
  for each row execute function public.limitar_clientes_no_free();

-- ============================================================
-- Orçamento detalhado é ferramenta de quem vende serviço maior — e quem
-- vende serviço maior é quem paga. Três linhas cobrem o caso simples.
-- ============================================================
create or replace function public.limitar_itens_no_free()
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
    from public.itens_documento
   where documento_venda_id = new.documento_venda_id;

  if quantos >= 3 then
    raise exception 'o plano gratis detalha ate 3 itens por documento'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.limitar_itens_no_free() from public, anon, authenticated;

drop trigger if exists itens_limite_free on public.itens_documento;
create trigger itens_limite_free
  before insert on public.itens_documento
  for each row execute function public.limitar_itens_no_free();
