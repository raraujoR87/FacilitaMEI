-- AgilizeMei — edição de registros e trilha de auditoria
--
-- Corrigir um erro de digitação era impossível: só criar e excluir. Num
-- recibo, isso obrigava a cancelar e refazer, queimando um número da
-- sequência por causa de uma letra errada.
--
-- Editar registro financeiro sem deixar rastro, porém, é pior que não
-- editar: quando o cliente disser "esse valor não era esse", ninguém tem
-- como saber. Por isso a edição chega junto com o histórico.

-- ============================================================
-- HISTÓRICO DE ALTERAÇÕES
--
-- Escrito por gatilho, não pela aplicação: assim nenhum caminho de código
-- — nem um bug futuro — consegue alterar valor sem deixar registro.
-- ============================================================
create table if not exists public.alteracoes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tabela text not null,
  registro_id uuid not null,
  campo text not null,
  valor_anterior text,
  valor_novo text,
  alterado_em timestamptz not null default now()
);

alter table public.alteracoes enable row level security;

-- Só leitura, e só do próprio histórico. Ninguém edita nem apaga trilha de
-- auditoria pela API — inclusive o dono dos dados.
drop policy if exists "usuario_le_proprio_historico" on public.alteracoes;
create policy "usuario_le_proprio_historico"
  on public.alteracoes for select
  using (user_id = (select auth.uid()));

create index if not exists idx_alteracoes_registro
  on public.alteracoes (registro_id, alterado_em desc);

/**
 * Registra a mudança dos campos que importam para dinheiro e identidade do
 * documento. `security definer` para conseguir escrever mesmo sem policy de
 * insert — a trilha não pode depender da boa vontade de quem altera.
 */
create or replace function public.registrar_alteracao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  campos text[];
  campo text;
  antes text;
  depois text;
begin
  campos := case TG_TABLE_NAME
    when 'documentos_venda' then
      array['valor', 'descricao_servico', 'status', 'natureza', 'data_vencimento', 'nf_numero']
    when 'lancamentos' then
      array['valor', 'descricao', 'tipo', 'data_competencia', 'categoria_id']
    else array[]::text[]
  end;

  foreach campo in array campos loop
    execute format('select ($1).%I::text, ($2).%I::text', campo, campo)
       into antes, depois using old, new;

    if antes is distinct from depois then
      insert into public.alteracoes (user_id, tabela, registro_id, campo, valor_anterior, valor_novo)
      values (new.user_id, TG_TABLE_NAME, new.id, campo, antes, depois);
    end if;
  end loop;

  return null;
end;
$$;

revoke execute on function public.registrar_alteracao() from public, anon, authenticated;

drop trigger if exists documentos_venda_historico on public.documentos_venda;
create trigger documentos_venda_historico
  after update on public.documentos_venda
  for each row execute function public.registrar_alteracao();

drop trigger if exists lancamentos_historico on public.lancamentos;
create trigger lancamentos_historico
  after update on public.lancamentos
  for each row execute function public.registrar_alteracao();

-- ============================================================
-- O QUE PODE SER EDITADO
--
-- Nota fiscal emitida trava o documento: alterar o valor depois criaria
-- divergência com o que o governo já recebeu, e o relatório do contador
-- deixaria de bater. Documento cancelado também não volta atrás.
-- ============================================================
create or replace function public.documento_editavel(documento_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select d.nf_numero is null and d.status <> 'cancelado'
    from public.documentos_venda d
   where d.id = documento_id;
$$;
