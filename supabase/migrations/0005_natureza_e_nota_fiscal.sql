-- AgilizeMei — natureza da entrada e rastreio de nota fiscal
--
-- Dois problemas de modelagem que este arquivo resolve:
--
-- 1. Havia dois caminhos para registrar o mesmo dinheiro: lançamento de
--    receita no financeiro, ou recibo em vendas. O usuário tinha que
--    escolher, e escolhendo errado ficava sem recibo. Agora toda entrada
--    nasce de um documento de venda, e o lançamento é consequência.
--
-- 2. Quem é MEI presta serviço E vende produto — naturezas com regras
--    fiscais diferentes. Serviço gera NFS-e (municipal/nacional), produto
--    gera NF-e (estadual). Sem essa distinção no dado, o app não consegue
--    dizer qual nota a pessoa precisa emitir.

-- ============================================================
-- NATUREZA DA ENTRADA
-- ============================================================
alter table public.documentos_venda
  add column if not exists natureza text not null default 'servico'
    check (natureza in ('servico', 'produto'));

comment on column public.documentos_venda.natureza is
  'servico gera NFS-e; produto gera NF-e. Regras fiscais distintas.';

-- ============================================================
-- RASTREIO DA NOTA FISCAL
--
-- O AgilizeMei não emite a nota: a emissão é feita no Emissor Nacional
-- (serviço) ou na SEFAZ estadual (produto). O que guardamos é o registro
-- de que foi emitida, para o relatório do contador bater com o que o
-- governo recebeu.
-- ============================================================
alter table public.documentos_venda
  add column if not exists nf_numero text,
  add column if not exists nf_emitida_em timestamptz,
  add column if not exists nf_link text;

create index if not exists idx_documentos_venda_sem_nf
  on public.documentos_venda (user_id, data_emissao desc)
  where nf_numero is null;

-- ============================================================
-- DOCUMENTO DO CLIENTE
--
-- É o dado que decide a obrigatoriedade: venda para CNPJ exige nota,
-- venda para pessoa física não. Sem ele, o app não tem como avisar.
-- ============================================================
alter table public.clientes
  add column if not exists documento text;

comment on column public.clientes.documento is
  'CPF ou CNPJ, apenas dígitos. 11 = pessoa física, 14 = pessoa jurídica.';

-- ============================================================
-- ENDEREÇO DO NEGÓCIO
--
-- A NFS-e exige o município do prestador. Já temos cidade_pix, mas ela
-- serve ao BR Code (máximo 15 caracteres, sem acento) e não presta para
-- uso fiscal.
-- ============================================================
alter table public.perfis
  add column if not exists municipio text,
  add column if not exists uf text check (uf is null or length(uf) = 2);
