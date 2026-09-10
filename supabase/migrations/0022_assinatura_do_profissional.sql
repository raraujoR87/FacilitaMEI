-- AgilizeMei — assinatura desenhada, para os documentos
--
-- Bucket PRIVADO, e não o `marcas` que já existe: logo é material de
-- divulgação, assinatura não. O `marcas` tem leitura pública, e uma
-- assinatura à mão alcançável por URL é coisa que se copia e cola em
-- outro documento. Aqui só o dono lê, e o PDF é montado no servidor, que
-- já tem a sessão dele.
insert into storage.buckets (id, name, public)
values ('assinaturas', 'assinaturas', false)
on conflict (id) do nothing;

drop policy if exists "assinaturas_envia_propria" on storage.objects;
create policy "assinaturas_envia_propria" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'assinaturas'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "assinaturas_le_propria" on storage.objects;
create policy "assinaturas_le_propria" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assinaturas'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "assinaturas_atualiza_propria" on storage.objects;
create policy "assinaturas_atualiza_propria" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'assinaturas'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "assinaturas_apaga_propria" on storage.objects;
create policy "assinaturas_apaga_propria" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'assinaturas'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Guarda o CAMINHO, não a URL: em bucket privado a URL é assinada e
-- expira, então gravá-la deixaria um link morto no perfil.
alter table public.perfis
  add column if not exists assinatura_caminho text;

comment on column public.perfis.assinatura_caminho is
  'Caminho no bucket privado `assinaturas`. A URL é assinada na hora de usar.';
