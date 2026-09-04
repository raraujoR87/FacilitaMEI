-- AgilizeMei — acesso somente-leitura para o contador
--
-- O contador é o canal de distribuição natural do MEI: um atende dezenas.
-- Hoje o MEI baixa a planilha e manda por WhatsApp todo mês — o contador
-- recebe arquivo desencontrado e cobra pelo retrabalho.
--
-- O que o portal entrega é o recorte da DASN-SIMEI: receita bruta do ano
-- separada em comércio/indústria (produto) e serviços, que é exatamente a
-- divisão que a declaração pede. O app já sabe disso pela `natureza` do
-- documento, então não há trabalho fiscal novo — só apresentar o que já
-- existe no formato que o contador precisa.
--
-- Escopo deliberado: SOMENTE LEITURA e só do que é fiscal. O contador não
-- vê retirada do dono nem margem por trabalho — não é assunto dele, e
-- quanto menos o link expõe, menos custa se vazar.
create table if not exists public.acessos_contador (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 32 bytes aleatórios em hexadecimal: o link é a única credencial, e
  -- adivinhar não pode ser possível.
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  nome_contador text,
  criado_em timestamptz not null default now(),
  -- Acesso sem prazo vira porta esquecida aberta: o MEI troca de contador
  -- e o antigo continua enxergando. Renovar é um clique.
  expira_em timestamptz not null default (now() + interval '90 days'),
  revogado_em timestamptz,
  ultimo_acesso_em timestamptz,
  acessos int not null default 0
);

create index if not exists idx_acessos_contador_user
  on public.acessos_contador (user_id);

alter table public.acessos_contador enable row level security;

drop policy if exists "dono le seus acessos" on public.acessos_contador;
create policy "dono le seus acessos" on public.acessos_contador
  for select using (auth.uid() = user_id);

drop policy if exists "dono cria seus acessos" on public.acessos_contador;
create policy "dono cria seus acessos" on public.acessos_contador
  for insert with check (auth.uid() = user_id);

drop policy if exists "dono edita seus acessos" on public.acessos_contador;
create policy "dono edita seus acessos" on public.acessos_contador
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "dono apaga seus acessos" on public.acessos_contador;
create policy "dono apaga seus acessos" on public.acessos_contador
  for delete using (auth.uid() = user_id);

-- ============================================================
-- UM LINK ATIVO POR CONTA
--
-- Vários links vivos multiplicam a superfície e ninguém lembra de revogar
-- os antigos. Gerar de novo substitui o anterior.
-- ============================================================
create unique index if not exists idx_um_acesso_ativo
  on public.acessos_contador (user_id)
  where revogado_em is null;

-- ============================================================
-- OS DADOS DO ANO, PELO TOKEN
--
-- `security definer` porque quem chama é visitante anônimo: o token é a
-- credencial. Mesmo padrão de `documento_por_token()`, do recibo público.
-- ============================================================
create or replace function public.dados_para_contador(p_token text, p_ano int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  acesso record;
  dono uuid;
  resultado jsonb;
begin
  select * into acesso
    from public.acessos_contador
   where token = p_token
     and revogado_em is null
     and expira_em > now();

  -- Token errado, revogado e expirado devolvem a MESMA coisa: distinguir
  -- diria a quem tenta adivinhar que o token existe.
  if acesso is null then
    return null;
  end if;

  dono := acesso.user_id;

  update public.acessos_contador
     set ultimo_acesso_em = now(), acessos = acessos + 1
   where id = acesso.id;

  select jsonb_build_object(
    'negocio', (
      select jsonb_build_object(
        'nome', p.nome_negocio,
        'cnpj', p.cnpj,
        'municipio', p.municipio,
        'uf', p.uf,
        'data_abertura', p.data_abertura_mei
      ) from public.perfis p where p.id = dono
    ),
    'ano', p_ano,
    'expira_em', acesso.expira_em,
    -- Receita bruta separada como a DASN-SIMEI pede.
    'receita', (
      select jsonb_build_object(
        'total', coalesce(sum(d.valor), 0),
        'comercio_industria', coalesce(sum(d.valor) filter (where d.natureza = 'produto'), 0),
        'servicos', coalesce(sum(d.valor) filter (where d.natureza = 'servico'), 0)
      )
      from public.documentos_venda d
      where d.user_id = dono
        and d.tipo = 'recibo'
        and d.status = 'pago'
        and extract(year from d.data_emissao) = p_ano
    ),
    'por_mes', (
      select coalesce(jsonb_agg(m order by m->>'mes'), '[]'::jsonb) from (
        select jsonb_build_object(
          'mes', to_char(date_trunc('month', d.data_emissao), 'YYYY-MM'),
          'comercio_industria', coalesce(sum(d.valor) filter (where d.natureza = 'produto'), 0),
          'servicos', coalesce(sum(d.valor) filter (where d.natureza = 'servico'), 0),
          'total', coalesce(sum(d.valor), 0)
        ) as m
        from public.documentos_venda d
        where d.user_id = dono
          and d.tipo = 'recibo'
          and d.status = 'pago'
          and extract(year from d.data_emissao) = p_ano
        group by date_trunc('month', d.data_emissao)
      ) sub
    ),
    -- Custos do negócio por categoria. Retirada do dono fica de fora: não
    -- é despesa da empresa e não é assunto do contador aqui.
    'despesas', (
      select coalesce(jsonb_agg(x order by x->>'categoria'), '[]'::jsonb) from (
        select jsonb_build_object(
          'categoria', coalesce(c.nome, 'Sem categoria'),
          'total', sum(l.valor)
        ) as x
        from public.lancamentos l
        left join public.categorias c on c.id = l.categoria_id
        where l.user_id = dono
          and l.tipo = 'despesa'
          and l.natureza_saida in ('custo', 'imposto')
          and extract(year from l.data_competencia) = p_ano
        group by coalesce(c.nome, 'Sem categoria')
      ) sub
    ),
    'documentos', (
      select coalesce(jsonb_agg(x order by x->>'data'), '[]'::jsonb) from (
        select jsonb_build_object(
          'data', d.data_emissao,
          'numero', d.numero,
          'natureza', d.natureza,
          'descricao', d.descricao_servico,
          'valor', d.valor,
          'cliente', cl.nome,
          'documento_cliente', cl.documento,
          'nf_numero', d.nf_numero
        ) as x
        from public.documentos_venda d
        left join public.clientes cl on cl.id = d.cliente_id
        where d.user_id = dono
          and d.tipo = 'recibo'
          and d.status = 'pago'
          and extract(year from d.data_emissao) = p_ano
      ) sub
    )
  ) into resultado;

  return resultado;
end;
$$;

grant execute on function public.dados_para_contador(text, int) to anon, authenticated;
