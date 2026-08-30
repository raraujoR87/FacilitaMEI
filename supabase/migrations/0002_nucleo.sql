-- FacilitaMEI — núcleo do produto
-- Complementa 0001_init.sql com: dados de PIX no perfil, numeração de
-- documentos por usuário, vínculo recibo→lançamento, categorias padrão
-- e o bucket de comprovantes privado.

-- ============================================================
-- PERFIL: dados de recebimento (PIX) e controle de atualização
-- ============================================================
alter table public.perfis
  add column if not exists chave_pix text,
  add column if not exists tipo_chave_pix text
    check (tipo_chave_pix in ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  add column if not exists nome_titular_pix text,
  add column if not exists cidade_pix text;

create or replace function public.tocar_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists perfis_updated_at on public.perfis;
create trigger perfis_updated_at
  before update on public.perfis
  for each row execute function public.tocar_updated_at();

-- ============================================================
-- DOCUMENTOS DE VENDA: numeração por usuário
--
-- `numero serial` usava uma sequence global: o segundo MEI a emitir um
-- recibo via #2, revelando o volume da plataforma e quebrando a
-- expectativa de numeração sequencial própria de cada negócio.
-- ============================================================
alter table public.documentos_venda alter column numero drop default;
drop sequence if exists public.documentos_venda_numero_seq;

create or replace function public.definir_numero_documento()
returns trigger as $$
begin
  if new.numero is null then
    select coalesce(max(numero), 0) + 1
      into new.numero
      from public.documentos_venda
     where user_id = new.user_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists documentos_venda_numero on public.documentos_venda;
create trigger documentos_venda_numero
  before insert on public.documentos_venda
  for each row execute function public.definir_numero_documento();

create unique index if not exists idx_documentos_venda_numero_por_usuario
  on public.documentos_venda (user_id, numero);

create index if not exists idx_documentos_venda_status
  on public.documentos_venda (user_id, status, data_vencimento);

-- ============================================================
-- LANÇAMENTOS: vínculo com o recibo que os originou
--
-- Marcar uma venda como paga gera a receita correspondente. O índice
-- único impede que dois cliques no botão lancem a mesma receita duas vezes.
-- ============================================================
alter table public.lancamentos
  add column if not exists documento_venda_id uuid
    references public.documentos_venda(id) on delete set null;

create unique index if not exists idx_lancamentos_documento_venda
  on public.lancamentos (documento_venda_id)
  where documento_venda_id is not null;

-- ============================================================
-- CLIENTES: busca por nome
-- ============================================================
create index if not exists idx_clientes_user_nome
  on public.clientes (user_id, nome);

-- ============================================================
-- CATEGORIAS PADRÃO NA CRIAÇÃO DA CONTA
--
-- Sem isso o usuário chega numa tela de lançamento com o campo de
-- categoria vazio e precisa inventar a taxonomia sozinho.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.perfis (id, nome_negocio)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome_negocio', 'Meu Negócio'));

  insert into public.categorias (user_id, nome, tipo, cor) values
    (new.id, 'Vendas',                 'receita', '#2F6E5B'),
    (new.id, 'Serviços',               'receita', '#2F6E5B'),
    (new.id, 'Fornecedores',           'despesa', '#C23B22'),
    (new.id, 'Material de trabalho',   'despesa', '#C23B22'),
    (new.id, 'Transporte',             'despesa', '#C23B22'),
    (new.id, 'Alimentação',            'despesa', '#C23B22'),
    (new.id, 'Impostos e taxas',       'despesa', '#C23B22'),
    (new.id, 'Outros',                 'despesa', '#59564E');

  return new;
end;
$$ language plpgsql security definer;

-- ============================================================
-- STORAGE: comprovantes são documentos financeiros, não públicos
--
-- O bucket público de 0001 deixava qualquer nota fiscal acessível por
-- URL para quem tivesse o link. Aqui ele vira privado e o acesso passa
-- a depender da pasta do próprio usuário.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', false)
on conflict (id) do update set public = false;

drop policy if exists "comprovantes_le_proprios" on storage.objects;
create policy "comprovantes_le_proprios"
  on storage.objects for select
  using (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "comprovantes_envia_proprios" on storage.objects;
create policy "comprovantes_envia_proprios"
  on storage.objects for insert
  with check (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "comprovantes_apaga_proprios" on storage.objects;
create policy "comprovantes_apaga_proprios"
  on storage.objects for delete
  using (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
