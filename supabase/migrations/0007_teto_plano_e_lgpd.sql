-- AgilizeMei — teto do MEI, validade do plano e direito ao esquecimento

-- ============================================================
-- DATA DE ABERTURA DO CNPJ
--
-- No ano de abertura o teto do MEI é proporcional aos meses de atividade.
-- Sem esta data, mostraríamos o teto cheio para quem abriu em outubro e o
-- alerta chegaria tarde demais.
-- ============================================================
alter table public.perfis
  add column if not exists data_abertura_mei date;

-- ============================================================
-- VALIDADE DO PLANO
--
-- `plano` sozinho é uma coluna solta: quem assinava, usava e cancelava
-- continuava Pro para sempre, porque com link de pagamento estático não
-- chega evento de cancelamento. A data de validade fecha esse vazamento —
-- vencida, a conta volta a se comportar como grátis.
-- ============================================================
alter table public.perfis
  add column if not exists plano_expira_em timestamptz;

comment on column public.perfis.plano_expira_em is
  'Nulo no plano grátis. No Pro, data até quando o plano vale; vencida, a conta é tratada como grátis.';

-- ============================================================
-- ACEITE DOS TERMOS
-- ============================================================
alter table public.perfis
  add column if not exists aceitou_termos_em timestamptz;

-- ============================================================
-- COLUNA MORTA
--
-- O BR Code do PIX é gerado sob demanda a partir da chave do perfil, então
-- guardar o link no documento nunca teve uso — e um link salvo ficaria
-- desatualizado se a chave mudasse.
-- ============================================================
alter table public.documentos_venda drop column if exists link_pix;

-- ============================================================
-- DIREITO À EXCLUSÃO (LGPD, art. 18)
--
-- A pessoa apaga a própria conta sem depender de nós. `security definer`
-- porque só o dono do banco alcança auth.users, mas o alvo é fixo em
-- auth.uid(): a função não consegue apagar a conta de outra pessoa nem
-- recebendo parâmetro, porque não recebe parâmetro nenhum.
--
-- O cascade em auth.users leva perfil, lançamentos, documentos, itens,
-- clientes e categorias junto. Comprovantes no Storage ficam para a
-- aplicação apagar antes de chamar isto.
-- ============================================================
create or replace function public.excluir_minha_conta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
begin
  if eu is null then
    raise exception 'sem sessão' using errcode = '42501';
  end if;

  delete from auth.users where id = eu;
end;
$$;

revoke execute on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;

-- ============================================================
-- PLANO EFETIVO
--
-- Uma função só, para que app e banco nunca discordem sobre quem está no
-- Pro. Vencido conta como grátis.
-- ============================================================
create or replace function public.plano_efetivo(perfil_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p.plano = 'pro'
     and (p.plano_expira_em is null or p.plano_expira_em > now())
    then 'pro'
    else 'free'
  end
  from public.perfis p
  where p.id = perfil_id;
$$;

-- ============================================================
-- ADMIN: definir plano passa a aceitar validade
-- ============================================================
create or replace function public.admin_definir_plano(
  alvo uuid,
  novo_plano text,
  novo_limite int,
  expira_em timestamptz default null
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
         limite_notas_mes = greatest(novo_limite, 0),
         -- Voltar para grátis limpa a validade: deixar data de um plano que
         -- não existe mais só confunde quem for ler depois.
         plano_expira_em = case when novo_plano = 'pro' then expira_em else null end
   where id = alvo;
end;
$$;

revoke execute on function public.admin_definir_plano(uuid, text, int, timestamptz) from public, anon;
grant execute on function public.admin_definir_plano(uuid, text, int, timestamptz) to authenticated;

-- A assinatura antiga sai de circulação para não haver duas versões ativas.
drop function if exists public.admin_definir_plano(uuid, text, int);
