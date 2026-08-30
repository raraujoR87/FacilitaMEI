-- AgilizeMei — a natureza da saída vira coluna, não nome de categoria
--
-- Defeito que isto corrige: todo o cálculo de "quanto desse dinheiro é seu"
-- decidia o que era retirada e o que era imposto COMPARANDO O NOME DA
-- CATEGORIA como texto ('Retirada do dono', 'DAS (imposto do MEI)').
-- Categoria é rótulo do usuário — ele pode renomear "Retirada do dono"
-- para "Pró-labore" na primeira semana. A conta do caixa quebraria em
-- silêncio, sem erro em lugar nenhum, e o número errado é o principal da
-- tela inicial.
--
-- Regra de ouro: o que o sistema calcula não pode depender de texto que o
-- usuário edita. Categoria continua sendo rótulo livre; a natureza é dado.
alter table public.lancamentos
  add column if not exists natureza_saida text
    check (natureza_saida in ('custo', 'retirada', 'imposto'));

comment on column public.lancamentos.natureza_saida is
  'custo = gasto do negócio; retirada = dinheiro do dono; imposto = DAS. '
  'Decide o cálculo do caixa. Categoria é só rótulo e pode ser renomeada.';

-- Backfill pelo nome de categoria, que é a única informação que existe hoje.
update public.lancamentos l
   set natureza_saida = case
         when c.nome = 'Retirada do dono'      then 'retirada'
         when c.nome = 'DAS (imposto do MEI)'  then 'imposto'
         else 'custo'
       end
  from public.categorias c
 where c.id = l.categoria_id
   and l.tipo = 'despesa'
   and l.natureza_saida is null;

-- Despesa sem categoria é custo do negócio.
update public.lancamentos
   set natureza_saida = 'custo'
 where tipo = 'despesa' and natureza_saida is null;

-- ============================================================
-- NORMALIZAÇÃO NA ENTRADA
--
-- Um gatilho em vez de default: receita não tem natureza de saída, e
-- default de coluna não sabe olhar o `tipo`. Assim toda rota de escrita
-- (formulário, conta fixa, documento de venda) cai na regra sem precisar
-- lembrar dela.
-- ============================================================
create or replace function public.normalizar_natureza_saida()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tipo = 'receita' then
    new.natureza_saida := null;
  elsif new.natureza_saida is null then
    new.natureza_saida := 'custo';
  end if;
  return new;
end;
$$;

revoke execute on function public.normalizar_natureza_saida() from public, anon, authenticated;

drop trigger if exists lancamentos_natureza_saida on public.lancamentos;
create trigger lancamentos_natureza_saida
  before insert or update on public.lancamentos
  for each row execute function public.normalizar_natureza_saida();

alter table public.lancamentos drop constraint if exists lancamentos_natureza_coerente;
alter table public.lancamentos
  add constraint lancamentos_natureza_coerente
  check ((tipo = 'despesa') = (natureza_saida is not null));

-- Retirada e imposto não são custo de trabalho nenhum: o dinheiro que o
-- dono tira não entra na margem do serviço, e deixar entrar faria um
-- trabalho lucrativo parecer prejuízo.
alter table public.lancamentos drop constraint if exists lancamentos_custo_so_de_custo;
alter table public.lancamentos
  add constraint lancamentos_custo_so_de_custo
  check (custo_de_documento_id is null or natureza_saida = 'custo');

-- Conta fixa é sempre custo do negócio.
alter table public.lancamentos drop constraint if exists lancamentos_fixa_so_custo;
alter table public.lancamentos
  add constraint lancamentos_fixa_so_custo
  check (despesa_fixa_id is null or natureza_saida = 'custo');

-- ============================================================
-- UM DAS POR COMPETÊNCIA
--
-- Dois cliques no botão "já paguei" dobrariam o imposto do mês em
-- silêncio. A chave é a COMPETÊNCIA, não o dia do pagamento: quem paga um
-- DAS atrasado registra na competência a que ele se refere, que é como o
-- contador espera ver — e por isso a trava não atrapalha quem está
-- regularizando meses anteriores.
-- ============================================================
create unique index if not exists idx_das_por_competencia
  on public.lancamentos (user_id, (date_trunc('month', data_competencia::timestamp)))
  where natureza_saida = 'imposto';
