-- AgilizeMei — registrar o aceite dos termos no cadastro
--
-- A coluna `aceitou_termos_em` existe desde a 0007 e nunca era preenchida:
-- ninguém aceitava nada, porque a tela de cadastro não pedia. Sem o
-- registro não há como demonstrar consentimento depois — e é exatamente
-- isso que a LGPD cobra de quem trata dado pessoal.
--
-- O aceite chega pelos metadados do `signUp`, não por um `update` em
-- seguida: com confirmação de e-mail ligada o cadastro não devolve sessão,
-- então o cliente não teria permissão para gravar na própria linha. Aqui o
-- gatilho grava junto com a criação do perfil, numa transação só.
--
-- Mantém as dez categorias da 0013; muda apenas o carimbo do aceite.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.perfis (id, nome_negocio, trial_expira_em, aceitou_termos_em)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome_negocio', 'Meu Negócio'),
    now() + interval '14 days',
    -- Só marca quando o cadastro de fato declarou o aceite. Gravar `now()`
    -- incondicionalmente transformaria o campo num carimbo automático, que
    -- não prova consentimento nenhum.
    case
      when new.raw_user_meta_data->>'aceitou_termos' = 'sim' then now()
      else null
    end
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
