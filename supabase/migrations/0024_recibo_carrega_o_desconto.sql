-- AgilizeMei — o desconto acompanha o orçamento até o recibo
--
-- Bug que a conversão expôs: orçamento de R$ 3.000 com 10% de desconto
-- fechava em R$ 2.700, mas o recibo gerado a partir dele saía R$ 3.000.
-- Os itens são copiados para o recibo, o gatilho recalcula pela soma
-- crua, e o recibo não tinha onde guardar o abatimento — o cliente seria
-- cobrado a mais do que aceitou.
--
-- A causa foi uma restrição minha, da 0021, que proibia desconto fora de
-- orçamento. O raciocínio de lá ("mexer no valor do recibo é reescrever o
-- passado") misturava duas coisas: EDITAR o desconto de um recibo antigo
-- é outra história; REGISTRAR o desconto que de fato foi concedido é o
-- documento contando a verdade.
--
-- Validade continua exclusiva de orçamento: recibo não vence.
alter table public.documentos_venda drop constraint if exists documentos_campos_de_orcamento;
alter table public.documentos_venda
  add constraint documentos_campos_de_orcamento
  check (tipo = 'orcamento' or validade_em is null);

comment on column public.documentos_venda.desconto is
  'Abatido do subtotal dos itens. `valor` já guarda o total final. '
  'Acompanha o orçamento quando ele vira recibo, para o cliente pagar o '
  'que aceitou.';

-- ============================================================
-- CONSERTA CONVERSÕES QUE JÁ PERDERAM O DESCONTO
--
-- Recibo gerado de um orçamento com desconto, cujo total ficou igual à
-- soma crua dos itens.
-- ============================================================
update public.documentos_venda r
   set desconto = o.desconto,
       desconto_percentual = o.desconto_percentual,
       valor = greatest(
         (select coalesce(sum(i.total), 0) from public.itens_documento i
           where i.documento_venda_id = r.id) - o.desconto,
         0
       )
  from public.documentos_venda o
 where r.gerado_de_orcamento_id = o.id
   and o.desconto > 0
   and r.desconto = 0;
