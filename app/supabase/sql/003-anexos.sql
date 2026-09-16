-- ============================================================================
-- Na Grelha — anexos nas mensagens do assistente
--
-- JA APLICADO no projeto NaGrelha (idwmchjvcmzdxljkaqdq) pela migration
-- `anexos_nas_mensagens`. Fica aqui porque o banco tem que ser reconstruivel a
-- partir do repositorio, e nao so a partir do painel.
-- ============================================================================

-- Anexos de uma mensagem: foto de referencia, audio, arquivo de texto.
--
-- Vai como jsonb, e nao como coluna nova para cada tipo, porque uma mensagem
-- pode levar varios arquivos de tipos diferentes de uma vez. Cada item guarda
-- o caminho no bucket privado `midias`, nunca uma URL: link assinado expira e
-- guardar link expirado no banco e guardar lixo.
--
-- Formato: [{"caminho": "uid/anexos/123.jpg", "mime": "image/jpeg", "nome": "logo.jpg"}]
alter table public.mensagens add column if not exists anexos jsonb not null default '[]'::jsonb;

comment on column public.mensagens.anexos is
  'Arquivos enviados junto da mensagem. Caminhos no bucket midias, nunca URLs assinadas.';


-- ----------------------------------------------------------------------------
-- CONFERENCIA
-- ----------------------------------------------------------------------------

-- a coluna existe e ja tem o padrao certo?
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'mensagens' and column_name = 'anexos';

-- quais mensagens vieram com arquivo?
select id, papel, left(conteudo, 60) as conteudo, jsonb_array_length(anexos) as arquivos, criado_em
from public.mensagens
where jsonb_array_length(anexos) > 0
order by criado_em desc
limit 20;
