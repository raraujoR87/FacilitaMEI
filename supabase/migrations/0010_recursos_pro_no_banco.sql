-- AgilizeMei — a trava de plano desce para o banco
--
-- A checagem de plano vivia só na Server Action. Como a RLS permite ao dono
-- atualizar o próprio documento e o próprio perfil, bastava chamar a API
-- REST do Supabase com a própria sessão para ligar recurso pago sem pagar.
-- Esconder o botão na tela nunca foi controle de acesso.

create or replace function public.exigir_pro_para_recursos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_TABLE_NAME = 'documentos_venda' then
    -- Só CRIAR o link é pago; remover continua livre, para ninguém ficar
    -- preso a um link que quer derrubar depois de cair para o grátis.
    if new.token_publico is not null
       and new.token_publico is distinct from old.token_publico
       and public.plano_efetivo(new.user_id) <> 'pro' then
      raise exception 'link publico do documento e um recurso do plano Pro'
        using errcode = '42501';
    end if;
  end if;

  if TG_TABLE_NAME = 'perfis' then
    if ((new.logo_url is not null and new.logo_url is distinct from old.logo_url)
        or (new.cor_marca is not null and new.cor_marca is distinct from old.cor_marca))
       and public.plano_efetivo(new.id) <> 'pro' then
      raise exception 'personalizar a marca e um recurso do plano Pro'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.exigir_pro_para_recursos() from public, anon, authenticated;

drop trigger if exists documentos_venda_exige_pro on public.documentos_venda;
create trigger documentos_venda_exige_pro
  before update on public.documentos_venda
  for each row execute function public.exigir_pro_para_recursos();

drop trigger if exists perfis_exige_pro on public.perfis;
create trigger perfis_exige_pro
  before update on public.perfis
  for each row execute function public.exigir_pro_para_recursos();
