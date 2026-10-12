-- Gravar o orçamento inteiro numa transação só.
--
-- Antes o app gravava em ~15 chamadas separadas: o evento, depois "apaga os
-- itens / insere os itens", "apaga os serviços / insere os serviços", e assim
-- por diante. Entre o apagar e o inserir, quem lesse o orçamento via ele oco.
-- Em 12/10/2026 foi isso: um F5 caiu 0,1 s depois de apagar os serviços e
-- 0,1 s antes de regravá-los, e a tela mostrou o orçamento sem mão de obra,
-- pela metade do preço. Se alguém editasse dali, o vazio ficava gravado.
--
-- Aqui tudo acontece dentro de uma função, que o Postgres roda numa transação:
-- quem lê vê o orçamento de antes ou o de depois, nunca o do meio. E se
-- qualquer linha for recusada, nada muda.
--
-- `p_versao` é o `atualizado_em` que o app tinha quando abriu o orçamento. Se
-- no banco estiver outro, alguém gravou por cima nesse meio-tempo (outro
-- aparelho, outra aba), e esta gravação é recusada em vez de apagar o trabalho
-- da outra pessoa. Nulo pula a conferência: é o orçamento que acabou de nascer.
--
-- SECURITY INVOKER: roda com as permissões de quem chamou, então a RLS de
-- sempre (e_membro) continua valendo em cada tabela.

create or replace function public.salvar_orcamento(p jsonb, p_versao timestamptz default null)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid := (p->'evento'->>'id')::uuid;
  v_atual timestamptz;
  v_nova timestamptz;
begin
  if v_id is null then
    raise exception 'orçamento sem id';
  end if;

  -- Trava a linha: duas gravações do mesmo orçamento esperam uma pela outra.
  select atualizado_em into v_atual from eventos where id = v_id for update;

  -- Tinha versão e a linha sumiu: foi excluído. Gravar agora o recriaria.
  if p_versao is not null and v_atual is null then
    raise exception 'ORCAMENTO_EXCLUIDO'
      using hint = 'Este orçamento foi excluído.';
  end if;

  if p_versao is not null and v_atual <> p_versao then
    raise exception 'ORCAMENTO_ALTERADO'
      using hint = 'Este orçamento foi alterado em outro aparelho.';
  end if;

  insert into eventos (
    id, cliente, contato, data, hora, local, observacoes, situacao, tipo_evento,
    adultos, criancas, apetite, duracao_horas, margem, fator_carvao, preco_carvao
  )
  select
    id, cliente, contato, data, hora, local, observacoes, situacao, tipo_evento,
    adultos, criancas, apetite, duracao_horas, margem, fator_carvao, preco_carvao
  from jsonb_populate_record(null::eventos, p->'evento')
  on conflict (id) do update set
    cliente = excluded.cliente,
    contato = excluded.contato,
    data = excluded.data,
    hora = excluded.hora,
    local = excluded.local,
    observacoes = excluded.observacoes,
    situacao = excluded.situacao,
    tipo_evento = excluded.tipo_evento,
    adultos = excluded.adultos,
    criancas = excluded.criancas,
    apetite = excluded.apetite,
    duracao_horas = excluded.duracao_horas,
    margem = excluded.margem,
    fator_carvao = excluded.fator_carvao,
    preco_carvao = excluded.preco_carvao,
    atualizado_em = now()
  returning atualizado_em into v_nova;

  delete from evento_itens where evento_id = v_id;
  insert into evento_itens (
    evento_id, item_id, nome, grupo, categoria, unidade, por_pessoa,
    rendimento, preco, embalagens, selecionado, ordem
  )
  select
    v_id, item_id, nome, grupo, categoria, unidade, por_pessoa,
    rendimento, preco, coalesce(embalagens, '{}'), selecionado, ordem
  from jsonb_populate_recordset(null::evento_itens, coalesce(p->'itens', '[]'));

  delete from evento_custos where evento_id = v_id;
  insert into evento_custos (evento_id, descricao, valor)
  select v_id, descricao, valor
  from jsonb_populate_recordset(null::evento_custos, coalesce(p->'custos', '[]'));

  delete from evento_servicos where evento_id = v_id;
  insert into evento_servicos (
    evento_id, servico_id, nome, papel, pessoa, quantidade, valor,
    percentual, valor_manual, ordem
  )
  select
    v_id, servico_id, nome, papel, pessoa, quantidade, valor,
    percentual, valor_manual, ordem
  from jsonb_populate_recordset(null::evento_servicos, coalesce(p->'servicos', '[]'));

  delete from evento_faixas where evento_id = v_id;
  insert into evento_faixas (evento_id, faixa_id, nome, percentual, quantidade, ordem)
  select v_id, faixa_id, nome, percentual, quantidade, ordem
  from jsonb_populate_recordset(null::evento_faixas, coalesce(p->'faixas', '[]'));

  return v_nova;
end;
$$;

revoke all on function public.salvar_orcamento(jsonb, timestamptz) from public, anon;
grant execute on function public.salvar_orcamento(jsonb, timestamptz) to authenticated;
