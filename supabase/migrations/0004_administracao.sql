-- FacilitaMEI — back-office de operação
--
-- Duas regras guiaram o desenho:
--
-- 1. Nenhuma chave de service role no app. Um segredo que ignora RLS dentro
--    do Next é ponto único de falha; aqui a fronteira fica no banco.
-- 2. O operador enxerga a saúde da conta, não a vida financeira do cliente.
--    Nenhuma função abaixo devolve descrição, valor ou fornecedor de
--    lançamento — apenas contagens, datas e estado de cadastro.

-- ============================================================
-- QUEM É ADMINISTRADOR
--
-- Sem policy de insert/update/delete: ninguém vira administrador pela API,
-- só por SQL no painel do Supabase. A policy de select permite que a pessoa
-- veja o próprio registro, que é o que a checagem precisa.
-- ============================================================
create table if not exists public.administradores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  observacao text,
  criado_em timestamptz not null default now()
);

alter table public.administradores enable row level security;

drop policy if exists "administrador_ve_a_si" on public.administradores;
create policy "administrador_ve_a_si"
  on public.administradores for select
  using (user_id = (select auth.uid()));

-- Propositalmente SEM security definer: roda como quem chama, então a RLS
-- acima já garante que só um administrador de verdade recebe `true`.
create or replace function public.eh_administrador()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.administradores where user_id = (select auth.uid())
  );
$$;

-- ============================================================
-- VISÃO GERAL DOS TENANTS
--
-- `security definer` para alcançar auth.users e as tabelas de todos os
-- clientes; a primeira linha do corpo é a checagem de administrador, então
-- a exposição não depende de quem tem permissão de executar.
-- ============================================================
create or replace function public.admin_lista_tenants()
returns table (
  user_id uuid,
  email text,
  nome_negocio text,
  plano text,
  limite_notas_mes int,
  criado_em timestamptz,
  ultimo_acesso timestamptz,
  email_confirmado boolean,
  bloqueado boolean,
  tem_pix boolean,
  tem_whatsapp boolean,
  total_lancamentos bigint,
  total_documentos bigint,
  total_clientes bigint,
  total_comprovantes bigint,
  bytes_comprovantes bigint,
  ultimo_lancamento date,
  notas_ia_no_mes bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_administrador() then
    raise exception 'acesso restrito a administradores' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    u.email::text,
    p.nome_negocio,
    p.plano,
    p.limite_notas_mes,
    p.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at is not null,
    coalesce(u.banned_until > now(), false),
    p.chave_pix is not null,
    p.telefone_whatsapp is not null,
    (select count(*) from public.lancamentos l where l.user_id = p.id),
    (select count(*) from public.documentos_venda d where d.user_id = p.id),
    (select count(*) from public.clientes c where c.user_id = p.id),
    (select count(*) from storage.objects o
      where o.bucket_id = 'comprovantes'
        and (storage.foldername(o.name))[1] = p.id::text),
    -- sum() sobre bigint devolve numeric; o cast alinha com a coluna declarada.
    (select coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint from storage.objects o
      where o.bucket_id = 'comprovantes'
        and (storage.foldername(o.name))[1] = p.id::text),
    (select max(l.data_competencia) from public.lancamentos l where l.user_id = p.id),
    (select count(*) from public.lancamentos l
      where l.user_id = p.id
        and l.origem in ('ocr', 'upload', 'whatsapp')
        and l.created_at >= date_trunc('month', now()))
  from public.perfis p
  join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

-- ============================================================
-- LINHA DO TEMPO DE ACESSO
--
-- A auditoria do GoTrue (`auth.audit_log_entries`) existe, mas no Supabase
-- hospedado pode nunca ser preenchida — foi o que aconteceu aqui. Em vez de
-- entregar uma tela permanentemente vazia, os marcos de conta são derivados
-- de `auth.users`, e a auditoria entra junto quando houver.
--
-- Cobre acesso às contas. Não registra o que cada cliente faz dentro do
-- próprio financeiro, que segue invisível para a operação.
-- ============================================================
create or replace function public.admin_eventos(limite int default 200)
returns table (
  ocorrido_em timestamptz,
  acao text,
  ator_email text,
  ator_id uuid,
  ip text,
  origem text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_administrador() then
    raise exception 'acesso restrito a administradores' using errcode = '42501';
  end if;

  return query
  select * from (
    select
      a.created_at,
      (a.payload::jsonb)->>'action',
      (a.payload::jsonb)->>'actor_username',
      nullif((a.payload::jsonb)->>'actor_id', '')::uuid,
      a.ip_address::text,
      'auditoria'::text
    from auth.audit_log_entries a

    union all

    select u.created_at, 'conta_criada'::text, u.email::text, u.id, null::text, 'derivado'::text
      from auth.users u where u.deleted_at is null

    union all

    select u.email_confirmed_at, 'email_confirmado'::text, u.email::text, u.id, null::text, 'derivado'::text
      from auth.users u
     where u.email_confirmed_at is not null and u.deleted_at is null

    union all

    select u.last_sign_in_at, 'ultimo_acesso'::text, u.email::text, u.id, null::text, 'derivado'::text
      from auth.users u
     where u.last_sign_in_at is not null and u.deleted_at is null
  ) eventos(ocorrido_em, acao, ator_email, ator_id, ip, origem)
  order by eventos.ocorrido_em desc
  limit least(greatest(limite, 1), 1000);
end;
$$;

-- ============================================================
-- PROBLEMAS DE CADASTRO
--
-- Cada linha é uma conta que precisa de atenção humana, com o motivo.
-- ============================================================
create or replace function public.admin_contas_com_problema()
returns table (
  user_id uuid,
  email text,
  criado_em timestamptz,
  problema text,
  detalhe text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_administrador() then
    raise exception 'acesso restrito a administradores' using errcode = '42501';
  end if;

  return query
  -- Cadastro travado antes de confirmar o e-mail: não consegue entrar.
  select u.id, u.email::text, u.created_at,
         'email_nao_confirmado'::text,
         'Cadastrou-se e nunca confirmou o e-mail.'::text
    from auth.users u
   where u.email_confirmed_at is null
     and u.deleted_at is null

  union all

  -- O gatilho de criação de perfil falhou: a conta existe sem negócio.
  select u.id, u.email::text, u.created_at,
         'sem_perfil'::text,
         'Usuário autenticável sem registro em perfis.'::text
    from auth.users u
    left join public.perfis p on p.id = u.id
   where p.id is null
     and u.deleted_at is null

  union all

  -- Confirmou o e-mail mas nunca voltou: sinal de abandono na largada.
  select u.id, u.email::text, u.created_at,
         'nunca_acessou'::text,
         'Confirmou o e-mail mas nunca fez login.'::text
    from auth.users u
   where u.last_sign_in_at is null
     and u.email_confirmed_at is not null
     and u.deleted_at is null

  union all

  select u.id, u.email::text, u.created_at,
         'bloqueado'::text,
         ('Conta suspensa até ' || to_char(u.banned_until, 'DD/MM/YYYY HH24:MI'))::text
    from auth.users u
   where u.banned_until > now()
     and u.deleted_at is null

  order by 3 desc;
end;
$$;

-- ============================================================
-- AÇÃO: mudar plano
--
-- Função dedicada em vez de uma policy ampla de update em `perfis`: o
-- operador altera plano e limite, e nada mais — a chave PIX e o telefone
-- do cliente seguem fora do alcance.
-- ============================================================
create or replace function public.admin_definir_plano(
  alvo uuid,
  novo_plano text,
  novo_limite int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_administrador() then
    raise exception 'acesso restrito a administradores' using errcode = '42501';
  end if;

  if novo_plano not in ('free', 'pro') then
    raise exception 'plano invalido: %', novo_plano;
  end if;

  update public.perfis
     set plano = novo_plano,
         limite_notas_mes = greatest(novo_limite, 0)
   where id = alvo;
end;
$$;

-- ============================================================
-- PERMISSÕES
--
-- Nenhuma dessas funções faz sentido para visitante anônimo.
--
-- NÃO revogue o EXECUTE de `authenticated`: o operador é um usuário
-- autenticado como qualquer outro, e sem esse grant o painel para de
-- funcionar. O linter de segurança do Supabase marca essas quatro funções
-- com "Signed-In Users Can Execute SECURITY DEFINER Function" — aqui é
-- falso positivo conhecido, porque a autorização não depende do grant: a
-- primeira linha de cada corpo chama `eh_administrador()` e aborta com
-- "acesso restrito a administradores". Um cliente comum chamando
-- /rest/v1/rpc/admin_lista_tenants recebe erro, não dados.
-- ============================================================
revoke execute on function public.admin_lista_tenants() from public, anon;
revoke execute on function public.admin_eventos(int) from public, anon;
revoke execute on function public.admin_contas_com_problema() from public, anon;
revoke execute on function public.admin_definir_plano(uuid, text, int) from public, anon;
revoke execute on function public.eh_administrador() from anon;

grant execute on function public.admin_lista_tenants() to authenticated;
grant execute on function public.admin_eventos(int) to authenticated;
grant execute on function public.admin_contas_com_problema() to authenticated;
grant execute on function public.admin_definir_plano(uuid, text, int) to authenticated;

-- Para promover a primeira pessoa (o e-mail precisa já ter conta):
--   insert into public.administradores (user_id, observacao)
--   select id, 'fundador' from auth.users where email = 'voce@exemplo.com';
