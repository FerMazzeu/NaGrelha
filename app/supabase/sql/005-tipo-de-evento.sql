-- ============================================================================
-- Na Grelha — tipo de evento e as tabelas de cache do Alan
--
-- JA APLICADO no projeto NaGrelha (idwmchjvcmzdxljkaqdq), pelas migrations
-- `tipo_de_evento_e_tabela_de_cache` e `tabela_de_cache_completa`. Fica aqui
-- porque o banco tem que ser reconstruivel a partir do repositorio.
--
-- Ate 17/09/2026 existia UMA tabela de cache, com quatro faixas, terminando em
-- "81 acima". O Alan mandou duas tabelas de nove faixas cada, porque casamento
-- e festa de 15 anos pagam mais que aniversario e corporativo para o mesmo
-- numero de convidados.
-- ============================================================================

alter table public.eventos
  add column if not exists tipo_evento text not null default 'aniversario'
  check (tipo_evento in ('aniversario', 'casamento'));

comment on column public.eventos.tipo_evento is
  'Manda no cache da equipe. Casamento e 15 anos pagam mais que aniversario.';

-- `null` quer dizer "vale para qualquer tipo", que e como as faixas antigas
-- funcionavam. Quem tem tabela por tipo ganha da geral no calculo.
alter table public.servico_faixas
  add column if not exists tipo_evento text
  check (tipo_evento is null or tipo_evento in ('aniversario', 'casamento'));

-- O valor digitado a mao nao pode ser sobrescrito quando o numero de
-- convidados muda: seria apagar um desconto que a Erica deu de proposito.
alter table public.evento_servicos
  add column if not exists valor_manual boolean not null default false;

comment on column public.evento_servicos.valor_manual is
  'Alguem digitou o valor. A tabela de faixa para de mandar nesta linha.';


-- ----------------------------------------------------------------------------
-- AS TABELAS DO ALAN
--
-- Valem para Churrasqueiro (Alan) e Organizacao/metre (Erica), que na planilha
-- aparecem como a linha unica "ALAN E ERICA".
--
-- A primeira carga destes numeros saiu de uma foto borrada e errou dois
-- valores do aniversario (150-199 e 200-249), alem de nao ter as duas ultimas
-- faixas do casamento, que estavam cortadas. Os valores abaixo sao os da
-- planilha legivel. E o motivo de existir a tela Catalogo > Tabelas de cache:
-- preco muda, e mudar preco nao pode depender de quem escreve codigo.
--
-- Escrito como upsert para poder rodar de novo sem duplicar faixa.
-- ----------------------------------------------------------------------------

with alvo as (
  select id from public.servicos_catalogo
  where nome in ('Churrasqueiro', 'Organização (metrê)')
),
correto (tipo, min_c, max_c, valor) as (
  values
    -- Aniversario e corporativo
    ('aniversario',   1,   30,  500),
    ('aniversario',  31,   60,  600),
    ('aniversario',  61,   80,  800),
    ('aniversario',  81,   99, 1000),
    ('aniversario', 100,  120, 1200),
    ('aniversario', 121,  149, 1400),
    ('aniversario', 150,  199, 1600),
    ('aniversario', 200,  249, 1800),
    ('aniversario', 250,  300, 2000),
    -- Casamento e festa de 15 anos
    ('casamento',     1,   30,  800),
    ('casamento',    31,   60, 1000),
    ('casamento',    61,   80, 1200),
    ('casamento',    81,   99, 1400),
    ('casamento',   100,  120, 1600),
    ('casamento',   121,  149, 1800),
    ('casamento',   150,  199, 2000),
    ('casamento',   200,  249, 2500),
    ('casamento',   250,  300, 3000)
),
atualizadas as (
  update public.servico_faixas f
  set valor = c.valor, max_convidados = c.max_c
  from correto c, alvo a
  where f.servico_id = a.id and f.tipo_evento = c.tipo and f.min_convidados = c.min_c
  returning 1
)
insert into public.servico_faixas (servico_id, min_convidados, max_convidados, valor, tipo_evento)
select a.id, c.min_c, c.max_c, c.valor, c.tipo
from alvo a cross join correto c
where not exists (
  select 1 from public.servico_faixas f
  where f.servico_id = a.id and f.tipo_evento = c.tipo and f.min_convidados = c.min_c
);

-- As faixas antigas, sem tipo, sairiam na frente em qualquer consulta que nao
-- olhasse o tipo. Como agora existe tabela por tipo para estes dois servicos,
-- elas viraram ruido.
delete from public.servico_faixas f
where f.tipo_evento is null
  and f.servico_id in (
    select id from public.servicos_catalogo where nome in ('Churrasqueiro', 'Organização (metrê)')
  );


-- ----------------------------------------------------------------------------
-- CONFERENCIA
-- ----------------------------------------------------------------------------

-- as quatro tabelas batem com a planilha? (nove faixas cada, 1 a 300)
select s.nome, f.tipo_evento as tipo, count(*) as faixas,
       string_agg(f.min_convidados || '-' || f.max_convidados || ': ' || f.valor::int, ' | '
                  order by f.min_convidados) as tabela
from public.servicos_catalogo s
join public.servico_faixas f on f.servico_id = s.id
where f.tipo_evento is not null
group by s.nome, f.tipo_evento
order by s.nome, f.tipo_evento;

-- algum buraco entre faixas do mesmo servico e tipo?
select s.nome, f.tipo_evento, f.max_convidados as termina, p.min_convidados as proxima_comeca
from public.servico_faixas f
join public.servicos_catalogo s on s.id = f.servico_id
join lateral (
  select min(x.min_convidados) as min_convidados
  from public.servico_faixas x
  where x.servico_id = f.servico_id
    and x.tipo_evento is not distinct from f.tipo_evento
    and x.min_convidados > f.min_convidados
) p on true
where f.max_convidados is not null and p.min_convidados > f.max_convidados + 1;
