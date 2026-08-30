-- AgilizeMei — identidade no documento e link público
--
-- O plano Pro só tinha um argumento (mais notas lidas por IA), e era o
-- único que o cliente contornava lançando manualmente. Conversão baixa por
-- desenho, não por preço.
--
-- O que muda: o recibo é a única peça do sistema que o cliente DO cliente
-- enxerga. É ali que mora a disposição a pagar — parecer profissional para
-- quem recebe, e receber mais rápido.

-- ============================================================
-- IDENTIDADE VISUAL DO NEGÓCIO
-- ============================================================
alter table public.perfis
  add column if not exists logo_url text,
  add column if not exists cor_marca text
    check (cor_marca is null or cor_marca ~ '^#[0-9A-Fa-f]{6}$');

comment on column public.perfis.cor_marca is
  'Cor de destaque do recibo, em hexadecimal. Validada no banco porque vai direto para o CSS.';

-- Logotipo é público por natureza: aparece no recibo que o cliente abre sem
-- estar logado. Fica em bucket próprio, separado dos comprovantes, que são
-- privados e nunca devem virar públicos por engano.
insert into storage.buckets (id, name, public)
values ('marcas', 'marcas', true)
on conflict (id) do update set public = true;

drop policy if exists "marcas_leitura_publica" on storage.objects;
create policy "marcas_leitura_publica"
  on storage.objects for select
  using (bucket_id = 'marcas');

drop policy if exists "marcas_envia_propria" on storage.objects;
create policy "marcas_envia_propria"
  on storage.objects for insert
  with check (
    bucket_id = 'marcas'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "marcas_atualiza_propria" on storage.objects;
create policy "marcas_atualiza_propria"
  on storage.objects for update
  using (
    bucket_id = 'marcas'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "marcas_apaga_propria" on storage.objects;
create policy "marcas_apaga_propria"
  on storage.objects for delete
  using (
    bucket_id = 'marcas'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ============================================================
-- LINK PÚBLICO DO DOCUMENTO
--
-- Imprimir e mandar PDF é fricção: o MEI atende no balcão e manda tudo por
-- WhatsApp. Um link que abre o recibo no celular do cliente, já com o PIX,
-- encurta o caminho entre entregar o serviço e receber.
--
-- O token é um UUID aleatório: 122 bits, não adivinhável. Só existe depois
-- que a pessoa decide compartilhar — documento não fica exposto por padrão.
-- ============================================================
alter table public.documentos_venda
  add column if not exists token_publico uuid unique,
  add column if not exists aceito_em timestamptz,
  add column if not exists aceito_por text;

-- ============================================================
-- LEITURA ANÔNIMA POR TOKEN
--
-- O visitante não tem sessão, então a RLS o barraria. Esta função é a única
-- porta: devolve um documento só se o token bater, e apenas os campos que
-- precisam aparecer — nada de e-mail, telefone ou CPF do cliente, que não
-- têm por que trafegar para quem abriu o link.
-- ============================================================
create or replace function public.documento_por_token(token uuid)
returns table (
  id uuid,
  numero int,
  tipo text,
  natureza text,
  descricao_servico text,
  valor numeric,
  status text,
  data_emissao date,
  data_vencimento date,
  observacoes text,
  aceito_em timestamptz,
  aceito_por text,
  cliente_nome text,
  negocio_nome text,
  negocio_cnpj text,
  negocio_municipio text,
  negocio_uf text,
  logo_url text,
  cor_marca text,
  chave_pix text,
  tipo_chave_pix text,
  nome_titular_pix text,
  cidade_pix text,
  itens json
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.id, d.numero, d.tipo, d.natureza, d.descricao_servico, d.valor, d.status,
    d.data_emissao, d.data_vencimento, d.observacoes, d.aceito_em, d.aceito_por,
    c.nome,
    p.nome_negocio, p.cnpj, p.municipio, p.uf, p.logo_url, p.cor_marca,
    p.chave_pix, p.tipo_chave_pix, p.nome_titular_pix, p.cidade_pix,
    (select coalesce(json_agg(json_build_object(
       'descricao', i.descricao, 'quantidade', i.quantidade,
       'unidade', i.unidade, 'valor_unitario', i.valor_unitario, 'total', i.total
     ) order by i.ordem), '[]'::json)
       from public.itens_documento i where i.documento_venda_id = d.id)
  from public.documentos_venda d
  join public.perfis p on p.id = d.user_id
  left join public.clientes c on c.id = d.cliente_id
  where d.token_publico = token
    and d.status <> 'cancelado';
$$;

grant execute on function public.documento_por_token(uuid) to anon, authenticated;

-- ============================================================
-- ACEITE DO ORÇAMENTO PELO CLIENTE
--
-- Fecha a venda sem ida e volta: o cliente abre o link, concorda e o MEI
-- vê o aceite registrado. Só orçamento, e só uma vez.
-- ============================================================
create or replace function public.aceitar_orcamento(token uuid, nome text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  afetados int;
begin
  if coalesce(trim(nome), '') = '' then
    raise exception 'informe o nome de quem está aceitando';
  end if;

  update public.documentos_venda
     set aceito_em = now(),
         aceito_por = left(trim(nome), 120)
   where token_publico = token
     and tipo = 'orcamento'
     and status = 'pendente'
     and aceito_em is null;

  get diagnostics afetados = row_count;
  return afetados > 0;
end;
$$;

grant execute on function public.aceitar_orcamento(uuid, text) to anon, authenticated;
