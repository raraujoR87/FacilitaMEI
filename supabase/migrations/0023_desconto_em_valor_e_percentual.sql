-- AgilizeMei — o desconto passa a ser abatido de verdade
--
-- Bug encontrado com dado real: o orçamento #18 tinha valor 5.500 e
-- desconto 560. O desconto era gravado e simplesmente não saía do total.
--
-- A causa: `recalcular_total_documento` fazia `valor = soma dos itens`.
-- Os itens são inseridos DEPOIS do documento, então o gatilho corria em
-- seguida e sobrescrevia o total que a aplicação já tinha descontado. A
-- aplicação calculava certo; o banco desfazia.
--
-- A correção mantém a regra onde ela já morava — no gatilho — em vez de
-- devolvê-la à aplicação. Assim o invariante "valor = subtotal − desconto"
-- vale para qualquer caminho de escrita, hoje e amanhã.

-- ============================================================
-- DESCONTO TAMBÉM EM PERCENTUAL
--
-- Quem negocia fala nas duas moedas: "tiro 10%" e "faço por 500 a menos".
-- Guardar o percentual preserva a intenção — mudando os itens, o desconto
-- acompanha, que é o que a pessoa espera de "10%".
-- ============================================================
alter table public.documentos_venda
  add column if not exists desconto_percentual numeric(5,2)
    check (desconto_percentual is null
           or (desconto_percentual > 0 and desconto_percentual <= 100));

comment on column public.documentos_venda.desconto_percentual is
  'Preenchido quando o desconto foi digitado em %. `desconto` guarda o '
  'valor em reais já calculado; este campo preserva a intenção.';

-- Percentual só existe em orçamento, como o desconto.
alter table public.documentos_venda drop constraint if exists documentos_campos_de_orcamento;
alter table public.documentos_venda
  add constraint documentos_campos_de_orcamento
  check (
    tipo = 'orcamento'
    or (validade_em is null and desconto = 0 and desconto_percentual is null)
  );

-- ============================================================
-- O TOTAL PASSA A DESCONTAR
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
  doc record;
  abatimento numeric(14,2);
begin
  select sum(i.total) into soma
    from public.itens_documento i
   where i.documento_venda_id = documento;

  if soma is null then
    return null;
  end if;

  select desconto, desconto_percentual into doc
    from public.documentos_venda where id = documento;

  -- Percentual manda quando existe: mudando os itens, o desconto
  -- acompanha, que é o que "10%" significa para quem digitou.
  abatimento := case
    when doc.desconto_percentual is not null
      then round(soma * doc.desconto_percentual / 100, 2)
    else coalesce(doc.desconto, 0)
  end;

  -- `greatest` porque desconto maior que o subtotal não pode virar total
  -- negativo: erro de digitação não cobra do cliente ao contrário.
  update public.documentos_venda
     set valor = greatest(soma - abatimento, 0),
         desconto = least(abatimento, soma)
   where id = documento;

  return null;
end;
$$;

-- ============================================================
-- MUDAR O DESCONTO TAMBÉM RECALCULA
--
-- Sem isto, corrigir só o desconto (sem tocar nos itens) não movia o
-- total: o gatilho de itens não dispara, e o valor ficaria do jeito
-- anterior.
-- ============================================================
create or replace function public.aplicar_desconto_no_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  soma numeric(14,2);
  abatimento numeric(14,2);
begin
  if new.desconto is not distinct from old.desconto
     and new.desconto_percentual is not distinct from old.desconto_percentual then
    return new;
  end if;

  select sum(i.total) into soma
    from public.itens_documento i
   where i.documento_venda_id = new.id;

  -- Sem itens detalhados, o subtotal é o total que já estava lá somado ao
  -- desconto anterior — é a única referência que existe.
  if soma is null then
    soma := coalesce(old.valor, 0) + coalesce(old.desconto, 0);
  end if;

  abatimento := case
    when new.desconto_percentual is not null
      then round(soma * new.desconto_percentual / 100, 2)
    else coalesce(new.desconto, 0)
  end;

  new.desconto := least(abatimento, soma);
  new.valor := greatest(soma - abatimento, 0);
  return new;
end;
$$;

revoke execute on function public.aplicar_desconto_no_total() from public, anon, authenticated;

drop trigger if exists documentos_aplica_desconto on public.documentos_venda;
create trigger documentos_aplica_desconto
  before update of desconto, desconto_percentual on public.documentos_venda
  for each row execute function public.aplicar_desconto_no_total();

-- ============================================================
-- CONSERTA O QUE JÁ ESTAVA ERRADO
--
-- Documentos com desconto gravado cujo `valor` nunca foi abatido.
-- ============================================================
with certos as (
  select d.id,
         coalesce(sum(i.total), 0) as soma
    from public.documentos_venda d
    join public.itens_documento i on i.documento_venda_id = d.id
   where d.desconto > 0
   group by d.id
)
update public.documentos_venda d
   set valor = greatest(c.soma - d.desconto, 0)
  from certos c
 where c.id = d.id
   and d.valor <> greatest(c.soma - d.desconto, 0);
