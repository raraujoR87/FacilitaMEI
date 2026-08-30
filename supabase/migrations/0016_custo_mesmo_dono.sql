-- AgilizeMei — custo só pode apontar para documento da própria conta
--
-- A chave estrangeira só garante que o documento EXISTE, e a RLS de
-- `lancamentos` olha o dono da linha inserida — nenhuma das duas verifica
-- o dono do documento apontado. Sem esta trava, um tenant conseguia
-- pendurar um custo seu no recibo de outro (verificado: o insert passava).
--
-- Não vazava dado (a RLS continua barrando a leitura), mas deixava uma
-- referência cruzada entre contas: com `on delete set null`, o dono do
-- documento mexeria na linha do vizinho ao apagar o próprio recibo, e
-- qualquer consulta futura por documento que esqueça o filtro de usuário
-- viraria vazamento. Trava melhor agora do que depender de lembrar disso.
create or replace function public.custo_do_mesmo_dono()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.custo_de_documento_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.documentos_venda d
     where d.id = new.custo_de_documento_id
       and d.user_id = new.user_id
  ) then
    raise exception 'o documento informado nao pertence a esta conta'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.custo_do_mesmo_dono() from public, anon, authenticated;

drop trigger if exists lancamentos_custo_mesmo_dono on public.lancamentos;
create trigger lancamentos_custo_mesmo_dono
  before insert or update of custo_de_documento_id, user_id on public.lancamentos
  for each row execute function public.custo_do_mesmo_dono();
