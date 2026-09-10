-- AgilizeMei — orçamento vira proposta comercial, não lançamento
--
-- Orçamento não é dinheiro: é oferta. Morava dentro do formulário de
-- Movimento por um atalho de implementação (mesma tabela do recibo), e
-- isso confundia duas coisas de naturezas opostas — uma registra o que já
-- aconteceu, a outra propõe o que pode acontecer.
--
-- O que faltava para ser uma proposta de verdade: validade, condições de
-- pagamento, prazo, garantia e desconto. Sem validade, principalmente: o
-- cliente volta dois meses depois cobrando um preço que o material já não
-- tem.
alter table public.documentos_venda
  add column if not exists validade_em date,
  add column if not exists condicoes_pagamento text,
  add column if not exists prazo_execucao text,
  add column if not exists garantia text,
  add column if not exists desconto numeric(12,2) not null default 0
    check (desconto >= 0);

comment on column public.documentos_venda.validade_em is
  'Até quando o preço vale. Só orçamento usa; recibo usa data_vencimento.';
comment on column public.documentos_venda.desconto is
  'Abatido do subtotal dos itens. `valor` já guarda o total final.';

-- Validade só faz sentido em orçamento, e desconto também: num recibo o
-- valor já saiu do bolso do cliente e mexer nele seria reescrever o
-- passado.
alter table public.documentos_venda drop constraint if exists documentos_campos_de_orcamento;
alter table public.documentos_venda
  add constraint documentos_campos_de_orcamento
  check (
    tipo = 'orcamento'
    or (validade_em is null and desconto = 0)
  );

-- ============================================================
-- IDENTIDADE DO PROFISSIONAL NA PROPOSTA
--
-- Uma proposta sem endereço, contato e assinatura parece rascunho — e
-- rascunho não fecha negócio. É o mesmo motivo do logo no recibo: o que o
-- cliente do MEI enxerga é o que decide.
-- ============================================================
alter table public.perfis
  add column if not exists endereco text,
  add column if not exists email_contato text,
  add column if not exists assinatura_nome text,
  add column if not exists assinatura_titulo text;

comment on column public.perfis.assinatura_nome is
  'Quem assina a proposta. Vazio usa o nome do negócio.';
comment on column public.perfis.assinatura_titulo is
  'Linha sob a assinatura: profissão, registro de conselho, cargo.';

-- ============================================================
-- ORÇAMENTO NÃO ENTRA NO CAIXA
--
-- Já era verdade nas telas, mas por convenção espalhada em cada consulta.
-- Aqui vira garantia: proposta nunca gera lançamento, nem por engano de
-- uma rota futura.
-- ============================================================
create or replace function public.orcamento_nao_vira_dinheiro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.documento_venda_id is not null and exists (
    select 1 from public.documentos_venda d
     where d.id = new.documento_venda_id and d.tipo = 'orcamento'
  ) then
    raise exception 'orcamento e proposta e nao gera lancamento'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.orcamento_nao_vira_dinheiro() from public, anon, authenticated;

drop trigger if exists lancamentos_sem_orcamento on public.lancamentos;
create trigger lancamentos_sem_orcamento
  before insert or update of documento_venda_id on public.lancamentos
  for each row execute function public.orcamento_nao_vira_dinheiro();
