-- AgilizeMei — endurecimento das funções do banco
--
-- Apontado pelo linter de segurança do Supabase depois de aplicar a 0002.

-- ============================================================
-- search_path fixo
--
-- Sem `search_path` definido, quem chama a função decide em que schema os
-- nomes não qualificados são resolvidos. Numa função `security definer`
-- isso permite apontar `perfis` para uma tabela forjada e executar código
-- com os privilégios do dono. Todas as referências no corpo já são
-- qualificadas com `public.`, então zerar o caminho é seguro.
-- ============================================================
alter function public.handle_new_user() set search_path = '';
alter function public.tocar_updated_at() set search_path = '';
alter function public.definir_numero_documento() set search_path = '';

-- ============================================================
-- Funções de gatilho fora da API REST
--
-- Estando no schema `public`, elas ficam expostas em /rest/v1/rpc/. O
-- privilégio de execução de uma função de gatilho é verificado na criação
-- do gatilho, não a cada disparo — revogar aqui não afeta o cadastro de
-- usuários, só fecha a porta de chamada direta.
-- ============================================================
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.tocar_updated_at() from public, anon, authenticated;
revoke execute on function public.definir_numero_documento() from public, anon, authenticated;
