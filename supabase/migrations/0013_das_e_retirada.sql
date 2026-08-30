-- AgilizeMei — "quanto desse dinheiro é meu?"
--
-- A pergunta que o MEI faz todo mês e nenhuma ferramenta da faixa dele
-- responde. Ele mistura a conta pessoal com a do negócio porque não tem
-- como saber quanto pode tirar sem comprometer o imposto e as contas.

-- Valor do DAS informado pelo próprio MEI: muda todo ano com o salário
-- mínimo e varia conforme a atividade (comércio, serviço ou os dois).
-- Fixar um número no código seria errar todo mês de janeiro.
alter table public.perfis
  add column if not exists valor_das numeric(10,2)
    check (valor_das is null or valor_das >= 0);

comment on column public.perfis.valor_das is
  'Valor mensal do DAS informado pelo usuário. Nulo enquanto ele não informar.';

-- Duas categorias que precisam existir para as contas fecharem: sem elas,
-- o imposto e a retirada do dono virariam "Outros" e o relatório do
-- contador ficaria ilegível.
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
    (new.id, 'DAS (imposto do MEI)', 'despesa', '#D9A441'),
    (new.id, 'Retirada do dono',     'despesa', '#59564E'),
    (new.id, 'Outros',               'despesa', '#59564E');

  return new;
end;
$$ language plpgsql security definer set search_path = '';

insert into public.categorias (user_id, nome, tipo, cor)
select p.id, novas.nome, 'despesa', novas.cor
  from public.perfis p
 cross join (values
   ('DAS (imposto do MEI)', '#D9A441'),
   ('Retirada do dono', '#59564E')
 ) as novas(nome, cor)
 where not exists (
   select 1 from public.categorias c
    where c.user_id = p.id and c.nome = novas.nome
 );
