-- FacilitaMEI — schema inicial
-- Multi-tenant: cada usuário autenticado é o dono direto dos seus registros
-- (1 MEI = 1 conta = 1 tenant). Isolamento garantido via RLS em todas as tabelas.

-- ============================================================
-- PERFIL DO NEGÓCIO (dados do MEI)
-- ============================================================
create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome_negocio text not null,
  cnpj text,
  telefone_whatsapp text unique,
  plano text not null default 'free' check (plano in ('free', 'pro')),
  limite_notas_mes int not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.perfis enable row level security;

create policy "usuario_ve_proprio_perfil"
  on public.perfis for select
  using (auth.uid() = id);

create policy "usuario_atualiza_proprio_perfil"
  on public.perfis for update
  using (auth.uid() = id);

create policy "usuario_cria_proprio_perfil"
  on public.perfis for insert
  with check (auth.uid() = id);

-- ============================================================
-- CATEGORIAS DE DESPESA/RECEITA
-- ============================================================
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('receita', 'despesa')),
  cor text default '#6366f1',
  created_at timestamptz not null default now()
);

alter table public.categorias enable row level security;

create policy "usuario_gerencia_proprias_categorias"
  on public.categorias for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- LANÇAMENTOS FINANCEIROS (núcleo do ERP)
-- ============================================================
create table if not exists public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  categoria_id uuid references public.categorias(id) on delete set null,
  tipo text not null check (tipo in ('receita', 'despesa')),
  descricao text not null,
  valor numeric(12,2) not null check (valor >= 0),
  data_competencia date not null default current_date,
  fornecedor_cliente text,
  origem text not null default 'manual' check (origem in ('manual', 'whatsapp', 'upload', 'ocr')),
  url_comprovante text,
  pago boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.lancamentos enable row level security;

create policy "usuario_gerencia_proprios_lancamentos"
  on public.lancamentos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_lancamentos_user_data
  on public.lancamentos (user_id, data_competencia desc);

-- ============================================================
-- CLIENTES
-- ============================================================
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  observacoes text,
  created_at timestamptz not null default now()
);

alter table public.clientes enable row level security;

create policy "usuario_gerencia_proprios_clientes"
  on public.clientes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- ORÇAMENTOS / RECIBOS (vendas)
-- ============================================================
create table if not exists public.documentos_venda (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  tipo text not null check (tipo in ('orcamento', 'recibo')),
  numero serial,
  descricao_servico text not null,
  valor numeric(12,2) not null check (valor >= 0),
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado')),
  data_emissao date not null default current_date,
  data_vencimento date,
  link_pix text,
  created_at timestamptz not null default now()
);

alter table public.documentos_venda enable row level security;

create policy "usuario_gerencia_proprios_documentos"
  on public.documentos_venda for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- LEMBRETES DE COBRANÇA (fila para o worker de WhatsApp)
-- ============================================================
create table if not exists public.lembretes_cobranca (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  documento_venda_id uuid not null references public.documentos_venda(id) on delete cascade,
  enviar_em timestamptz not null,
  enviado boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.lembretes_cobranca enable row level security;

create policy "usuario_gerencia_proprios_lembretes"
  on public.lembretes_cobranca for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: cria perfil automaticamente ao cadastrar usuário
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.perfis (id, nome_negocio)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome_negocio', 'Meu Negócio'));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
