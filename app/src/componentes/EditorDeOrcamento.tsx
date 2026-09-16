import { useEffect, useMemo, useState } from 'react';
import { repositorio } from '../dados/supabase';
import { agruparPorPreparo, EXTRAS_SUGERIDOS } from '../dominio/catalogo';
import { calcular, redistribuirCarnes, totalDeConvidados, valorSugerido } from '../dominio/calculo';
import {
  ROTULO_PAPEL,
  ROTULO_SITUACAO,
  type Apetite,
  type Escala,
  type FaixaEtaria,
  type Membro,
  type Orcamento,
  type Servico,
  type Situacao,
} from '../dominio/tipos';
import { decimal, inteiro, novoId, quantidade, real } from '../formato';
import { exportarOrcamento } from '../excel';
import { textoDaEscala, textoDaListaDeCompras, textoDaProposta } from '../texto';
import { BotaoCopiar, Campo, CampoNumero, CampoTexto, Segmentado } from './Campos';

const METAS_DE_CARNE = [300, 350, 400, 450, 500];

export default function EditorDeOrcamento({
  orcamento,
  membros,
  servicosDisponiveis,
  faixasDisponiveis,
  aoMudar,
  aoVoltar,
  aoRemover,
}: {
  orcamento: Orcamento;
  membros: Membro[];
  servicosDisponiveis: Servico[];
  faixasDisponiveis: FaixaEtaria[];
  aoMudar: (o: Orcamento) => void;
  aoVoltar: () => void;
  aoRemover: () => void;
}) {
  const [aba, setAba] = useState<
    'evento' | 'cardapio' | 'servicos' | 'equipe' | 'custos' | 'resultado'
  >('evento');
  const resultado = useMemo(() => calcular(orcamento), [orcamento]);

  const mudar = (parcial: Partial<Orcamento>) =>
    aoMudar({ ...orcamento, ...parcial, atualizadoEm: new Date().toISOString() });

  const alternarItem = (id: string) =>
    mudar({
      selecionados: orcamento.selecionados.includes(id)
        ? orcamento.selecionados.filter((s) => s !== id)
        : [...orcamento.selecionados, id],
    });

  return (
    <div className="pb-32">
      <div className="sticky top-0 z-20 border-b border-borda bg-carvao/95 backdrop-blur">
        <div className="area flex items-center gap-3 py-3">
          <button type="button" onClick={aoVoltar} className="botao botao-linha !min-h-10 !px-3">
            Voltar
          </button>
          <p className="min-w-0 flex-1 truncate font-semibold">{orcamento.cliente || 'Orçamento sem nome'}</p>
          <button
            type="button"
            onClick={aoRemover}
            className="botao botao-linha !min-h-10 !px-3 text-sm !text-fumaca hover:!border-brasa hover:!text-brasa-clara"
          >
            Excluir
          </button>
        </div>

        <div className="area flex gap-1 overflow-x-auto pb-2">
          {(
            [
              ['evento', 'Evento'],
              ['cardapio', 'Cardápio'],
              ['servicos', 'Serviços'],
              ['equipe', 'Equipe'],
              ['custos', 'Custos'],
              ['resultado', 'Resultado'],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAba(id)}
              aria-pressed={aba === id}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                aba === id ? 'bg-carvao-3 text-dourado' : 'text-fumaca hover:text-creme'
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="area py-6">
        {aba === 'evento' && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Cliente">
                <CampoTexto valor={orcamento.cliente} aoMudar={(v) => mudar({ cliente: v })} placeholder="Nome de quem contrata" />
              </Campo>
              <Campo rotulo="Contato">
                <CampoTexto valor={orcamento.contato} aoMudar={(v) => mudar({ contato: v })} placeholder="WhatsApp" inputMode="tel" />
              </Campo>
              <Campo rotulo="Data do evento">
                <input type="date" className="campo" value={orcamento.data} onChange={(e) => mudar({ data: e.target.value })} />
              </Campo>
              <Campo rotulo="Hora de servir">
                <input type="time" className="campo" value={orcamento.hora} onChange={(e) => mudar({ hora: e.target.value })} />
              </Campo>
              <Campo rotulo="Local">
                <CampoTexto valor={orcamento.local} aoMudar={(v) => mudar({ local: v })} placeholder="Cidade, chácara, salão" />
              </Campo>
            </div>

            <Campo rotulo="Situação" dica="É o que separa a agenda entre proposta e contrato fechado.">
              <Segmentado<Situacao>
                valor={orcamento.situacao}
                aoMudar={(v) => mudar({ situacao: v })}
                opcoes={(['orcado', 'confirmado', 'realizado', 'perdido'] as const).map((v) => ({
                  valor: v,
                  rotulo: ROTULO_SITUACAO[v],
                }))}
              />
            </Campo>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Adultos">
                <CampoNumero valor={orcamento.adultos} aoMudar={(v) => mudar({ adultos: v })} sufixo="pes." />
              </Campo>
              <Campo rotulo="Duração do evento">
                <CampoNumero
                  valor={orcamento.duracaoHoras}
                  aoMudar={(v) => mudar({ duracaoHoras: v })}
                  sufixo="h"
                />
              </Campo>
            </div>

            {/*
              Crianças por faixa de idade, no lugar da regra fixa de metade.
              O percentual vale para as duas pontas: quanto a criança come e
              quanto ela paga. É o que faz a soma da cobrança fechar com o custo.
            */}
            <div>
              <p className="rotulo mb-2">Crianças por faixa de idade</p>
              <div className="space-y-2">
                {faixasDisponiveis.map((f) => {
                  const noEvento = orcamento.faixas.find((x) => x.faixaId === f.id);
                  const quantidade = noEvento?.quantidade ?? 0;
                  return (
                    <div key={f.id} className="cartao flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{f.nome}</p>
                        <p className="text-sm text-fumaca">
                          {f.percentual === 0
                            ? 'não paga'
                            : f.percentual === 100
                              ? 'paga como adulto'
                              : `paga ${inteiro(f.percentual)}% do adulto`}
                        </p>
                      </div>
                      <div className="w-24 shrink-0">
                        <CampoNumero
                          valor={quantidade}
                          aoMudar={(v) => {
                            const outras = orcamento.faixas.filter((x) => x.faixaId !== f.id);
                            mudar({
                              faixas:
                                v > 0
                                  ? [
                                      ...outras,
                                      {
                                        id: noEvento?.id ?? `nova-${f.id}`,
                                        faixaId: f.id,
                                        nome: f.nome,
                                        percentual: f.percentual,
                                        quantidade: v,
                                      },
                                    ]
                                  : outras,
                            });
                          }}
                          sufixo="pes."
                          aria-label={`Crianças de ${f.nome}`}
                        />
                      </div>
                    </div>
                  );
                })}
                {!faixasDisponiveis.length && (
                  <p className="text-sm text-fumaca">Nenhuma faixa cadastrada ainda.</p>
                )}
              </div>
            </div>

            <Campo rotulo="Apetite" dica="Ajusta tudo de uma vez, sem mexer item por item.">
              <Segmentado<Apetite>
                valor={orcamento.apetite}
                aoMudar={(v) => mudar({ apetite: v })}
                opcoes={[
                  { valor: 'leve', rotulo: 'Leve' },
                  { valor: 'normal', rotulo: 'Normal' },
                  { valor: 'forte', rotulo: 'Forte' },
                ]}
              />
            </Campo>

            <Campo rotulo="Observações" dica="Entra no fim da proposta enviada ao cliente.">
              <textarea
                className="campo min-h-24 py-3"
                value={orcamento.observacoes}
                onChange={(e) => mudar({ observacoes: e.target.value })}
                placeholder="Combinações, restrições, horário de servir"
              />
            </Campo>

            <p className="cartao p-4 text-sm text-fumaca">
              São <strong className="text-creme">{inteiro(totalDeConvidados(orcamento))} convidados</strong>, que pesam{' '}
              <strong className="text-creme">{decimal(resultado.pessoasEquivalentes)} pessoas</strong> na compra.
              A diferença é a fração de cada faixa de idade, mais o apetite.
            </p>
          </div>
        )}

        {aba === 'cardapio' && (
          <div className="space-y-6">
            <div className="cartao p-4">
              <p className="rotulo">Carne por pessoa, no prato</p>
              <p className="metrica mt-1">{inteiro(resultado.carnePorPessoa)} g</p>
              <p className="mt-2 text-sm text-fumaca">
                São {decimal(resultado.carneCrua)} kg de carne crua para comprar. A diferença é osso, gordura e perda
                na brasa.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {METAS_DE_CARNE.map((meta) => (
                  <button
                    key={meta}
                    type="button"
                    className="botao botao-linha !min-h-9 !px-3 text-sm"
                    onClick={() =>
                      mudar({ itens: redistribuirCarnes(orcamento.itens, orcamento.selecionados, meta) })
                    }
                  >
                    {meta} g
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-fumaca">
                Redistribui entre os cortes marcados, mantendo a proporção entre eles.
              </p>
            </div>

            {/*
              Por preparo, que foi o pedido do Alan: "separar as materias primas
              por prato". Cada bloco mostra quantos itens dele estao marcados,
              porque meio preparo marcado quase sempre e esquecimento.
            */}
            {agruparPorPreparo(orcamento.itens).map(([preparo, doPreparo]) => {
              const marcados = doPreparo.filter((i) => orcamento.selecionados.includes(i.id)).length;
              return (
              <section key={preparo}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="titulo text-lg text-dourado">{preparo}</h2>
                  <button
                    type="button"
                    className="shrink-0 text-xs text-fumaca underline-offset-4 hover:text-creme hover:underline"
                    onClick={() => {
                      const ids = doPreparo.map((i) => i.id);
                      const todos = marcados === doPreparo.length;
                      mudar({
                        selecionados: todos
                          ? orcamento.selecionados.filter((s) => !ids.includes(s))
                          : [...new Set([...orcamento.selecionados, ...ids])],
                      });
                    }}
                  >
                    {marcados}/{doPreparo.length} · {marcados === doPreparo.length ? 'tirar tudo' : 'marcar tudo'}
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {doPreparo
                    .map((item) => {
                      const marcado = orcamento.selecionados.includes(item.id);
                      const linha = resultado.linhas.find((l) => l.item.id === item.id);
                      return (
                        <div
                          key={item.id}
                          className={`cartao p-3 transition-colors ${marcado ? '' : 'opacity-55'}`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => alternarItem(item.id)}
                              className="h-6 w-6 shrink-0 accent-[#c4261d]"
                              aria-label={`Incluir ${item.nome}`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold">{item.nome}</p>
                              {linha && (
                                <p className="text-sm text-fumaca">
                                  comprar {quantidade(linha.comprar, item.unidade)} · {real(linha.custo)}
                                </p>
                              )}
                            </div>
                            <div className="w-24 shrink-0">
                              <CampoNumero
                                valor={item.porPessoa}
                                aoMudar={(v) =>
                                  mudar({
                                    itens: orcamento.itens.map((i) =>
                                      i.id === item.id ? { ...i, porPessoa: v } : i,
                                    ),
                                  })
                                }
                                sufixo={item.unidade === 'kg' ? 'g' : 'un'}
                                aria-label={`${item.nome}, por pessoa`}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </section>
              );
            })}
          </div>
        )}

        {aba === 'custos' && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Carvão por kg de carne" dica="Quilos de carvão para cada quilo de carne crua.">
                <CampoNumero valor={orcamento.fatorCarvao} aoMudar={(v) => mudar({ fatorCarvao: v })} sufixo="kg" />
              </Campo>
              <Campo rotulo="Preço do carvão">
                <CampoNumero valor={orcamento.precoCarvao} aoMudar={(v) => mudar({ precoCarvao: v })} sufixo="R$/kg" />
              </Campo>
            </div>

            <p className="cartao p-4 text-sm text-fumaca">
              {inteiro(resultado.carvaoKg)} kg de carvão, {real(resultado.custoCarvao)}. Sai do peso de carne crua, e
              não do número de convidados, porque quem gasta brasa é quilo de carne na grelha.
            </p>

            <section>
              <div className="flex items-center justify-between">
                <h2 className="titulo text-lg text-dourado">Outros custos</h2>
                <button
                  type="button"
                  className="botao botao-linha !min-h-9 !px-3 text-sm"
                  onClick={() =>
                    mudar({
                      custosExtras: [...orcamento.custosExtras, { id: novoId(), descricao: '', valor: 0 }],
                    })
                  }
                >
                  Adicionar
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {orcamento.custosExtras.map((custo) => (
                  <div key={custo.id} className="cartao flex items-center gap-2 p-3">
                    <CampoTexto
                      valor={custo.descricao}
                      aoMudar={(v) =>
                        mudar({
                          custosExtras: orcamento.custosExtras.map((c) =>
                            c.id === custo.id ? { ...c, descricao: v } : c,
                          ),
                        })
                      }
                      placeholder="Descrição"
                      aria-label="Descrição do custo"
                    />
                    <div className="w-28 shrink-0">
                      <CampoNumero
                        valor={custo.valor}
                        aoMudar={(v) =>
                          mudar({
                            custosExtras: orcamento.custosExtras.map((c) =>
                              c.id === custo.id ? { ...c, valor: v } : c,
                            ),
                          })
                        }
                        sufixo="R$"
                        aria-label="Valor do custo"
                      />
                    </div>
                    <button
                      type="button"
                      aria-label={`Remover ${custo.descricao || 'custo'}`}
                      onClick={() =>
                        mudar({ custosExtras: orcamento.custosExtras.filter((c) => c.id !== custo.id) })
                      }
                      className="botao botao-linha !min-h-10 !w-10 shrink-0 !px-0 !text-fumaca"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {!orcamento.custosExtras.length && (
                  <p className="text-sm text-fumaca">Nada além das compras e do carvão.</p>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {EXTRAS_SUGERIDOS.filter(
                  (s) => !orcamento.custosExtras.some((c) => c.descricao === s),
                ).map((sugestao) => (
                  <button
                    key={sugestao}
                    type="button"
                    className="botao botao-linha !min-h-9 !px-3 text-sm"
                    onClick={() =>
                      mudar({
                        custosExtras: [...orcamento.custosExtras, { id: novoId(), descricao: sugestao, valor: 0 }],
                      })
                    }
                  >
                    + {sugestao}
                  </button>
                ))}
              </div>
            </section>

            <Campo
              rotulo="Margem sobre o custo"
              dica={`Custo mais ${inteiro(orcamento.margem)}%. Na venda isso vira ${decimal(
                resultado.margemSobrePreco,
              )}% de margem sobre o preço.`}
            >
              <CampoNumero valor={orcamento.margem} aoMudar={(v) => mudar({ margem: v })} sufixo="%" />
            </Campo>
          </div>
        )}

        {aba === 'servicos' && (
          <ServicosDoEvento
            orcamento={orcamento}
            disponiveis={servicosDisponiveis}
            convidados={totalDeConvidados(orcamento)}
            resultado={resultado}
            mudar={mudar}
          />
        )}

        {aba === 'equipe' && <EscalaDoEvento eventoId={orcamento.id} membros={membros} />}

        {aba === 'resultado' && <Resultado orcamento={orcamento} resultado={resultado} />}
      </div>

      {/* Barra fixa: o preço é o número que se olha o tempo todo, em qualquer aba. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-carvao/95 backdrop-blur">
        <div className="area flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="rotulo whitespace-nowrap">Preço fechado</p>
            <p className="metrica">{real(resultado.preco)}</p>
          </div>
          <div className="text-right text-sm text-fumaca">
            <p>{real(resultado.precoPorPessoa)} por pessoa</p>
            <p>
              custo {real(resultado.custoTotal)} · lucro{' '}
              <strong className={resultado.lucro >= 0 ? 'text-verde' : 'text-brasa-clara'}>
                {real(resultado.lucro)}
              </strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Resultado({
  orcamento,
  resultado,
}: {
  orcamento: Orcamento;
  resultado: ReturnType<typeof calcular>;
}) {
  const proposta = textoDaProposta(orcamento, resultado);
  const compras = textoDaListaDeCompras(orcamento, resultado);
  const escala = textoDaEscala(orcamento, resultado);
  const zap = orcamento.contato.replace(/\D/g, '');
  const [exportando, setExportando] = useState(false);
  const [erroExport, setErroExport] = useState('');

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="cartao p-4">
          <p className="rotulo">Preço fechado</p>
          <p className="metrica mt-1">{real(resultado.preco)}</p>
          <p className="mt-1 text-sm text-fumaca">{real(resultado.precoPorPessoa)} por pessoa</p>
        </div>
        <div className="cartao p-4">
          <p className="rotulo">Custo total</p>
          <p className="metrica mt-1 !text-creme">{real(resultado.custoTotal)}</p>
          <p className="mt-1 text-sm text-fumaca">{real(resultado.custoPorPessoa)} por pessoa</p>
        </div>
      </div>

      <div className="cartao divide-y divide-borda">
        {[
          ['Compras', real(resultado.custoItens)],
          ['Carvão', `${inteiro(resultado.carvaoKg)} kg · ${real(resultado.custoCarvao)}`],
          ['Outros custos', real(resultado.custosExtras)],
          ['Lucro', real(resultado.lucro)],
          ['Margem sobre o preço', `${decimal(resultado.margemSobrePreco)}%`],
          ['Carne crua', `${decimal(resultado.carneCrua)} kg`],
          ['Carne por pessoa, no prato', `${inteiro(resultado.carnePorPessoa)} g`],
        ].map(([rotulo, valor]) => (
          <div key={rotulo} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-fumaca">{rotulo}</span>
            <span className="font-semibold">{valor}</span>
          </div>
        ))}
      </div>

      {/* Exportar fecha o ciclo: o orcamento sai no formato de planilha que
          eles ja usam, com insumos por preparo, servico e total por convidado. */}
      <div className="cartao p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="rotulo">Planilha</p>
            <p className="mt-1 text-sm text-fumaca">
              Baixa o orçamento em Excel, com insumos, serviço e lista de compras.
            </p>
          </div>
          <button
            type="button"
            className="botao botao-brasa"
            disabled={exportando}
            onClick={async () => {
              setErroExport('');
              setExportando(true);
              try {
                await exportarOrcamento(orcamento, resultado);
              } catch (e) {
                setErroExport(e instanceof Error ? e.message : String(e));
              } finally {
                setExportando(false);
              }
            }}
          >
            {exportando ? 'Gerando...' : 'Exportar em Excel'}
          </button>
        </div>
        {erroExport && <p className="mt-3 text-sm text-brasa-clara">{erroExport}</p>}
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="titulo text-lg text-dourado">Proposta para o cliente</h2>
          <div className="flex gap-2">
            <BotaoCopiar texto={proposta} />
            {zap.length >= 10 && (
              <a
                className="botao botao-brasa"
                href={`https://wa.me/${zap.length <= 11 ? `55${zap}` : zap}?text=${encodeURIComponent(proposta)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Enviar no WhatsApp
              </a>
            )}
          </div>
        </div>
        <pre className="cartao mt-3 overflow-x-auto p-4 text-sm whitespace-pre-wrap font-sans text-creme">
          {proposta}
        </pre>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="titulo text-lg text-dourado">Lista de compras</h2>
          <BotaoCopiar texto={compras} />
        </div>
        <pre className="cartao mt-3 overflow-x-auto p-4 text-sm whitespace-pre-wrap font-sans text-creme">
          {compras}
        </pre>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="titulo text-lg text-dourado">Escala da equipe</h2>
          <BotaoCopiar texto={escala} />
        </div>
        <pre className="cartao mt-3 overflow-x-auto p-4 text-sm whitespace-pre-wrap font-sans text-creme">
          {escala}
        </pre>
      </section>
    </div>
  );
}

/**
 * Quem trabalha neste evento.
 *
 * O cachê entra aqui e não nos custos extras de propósito: é a escala que
 * decide quanto de mão de obra o evento tem, e digitar o mesmo número em dois
 * lugares é como planilha começa a mentir. O total aparece com um atalho para
 * jogar de uma vez nos custos.
 */
function EscalaDoEvento({ eventoId, membros }: { eventoId: string; membros: Membro[] }) {
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    repositorio
      .listarEscalas(eventoId)
      .then((e) => vivo && setEscalas(e))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [eventoId]);

  const recarregar = async () => setEscalas(await repositorio.listarEscalas(eventoId));

  const escalados = new Set(escalas.map((e) => e.membroId));
  const disponiveis = membros.filter((m) => !escalados.has(m.id));
  const totalCache = escalas.reduce((s, e) => s + e.cache, 0);

  if (carregando) return <p className="text-sm text-fumaca">Carregando escala...</p>;

  return (
    <div className="space-y-5">
      {!membros.length && (
        <p className="cartao p-4 text-sm text-fumaca">
          Nenhum membro cadastrado ainda. Cadastre a equipe na aba Equipe da tela inicial.
        </p>
      )}

      {escalas.length > 0 && (
        <div className="cartao p-4">
          <p className="rotulo">Mão de obra deste evento</p>
          <p className="metrica mt-1">{real(totalCache)}</p>
          <p className="mt-2 text-sm text-fumaca">
            {inteiro(escalas.length)} {escalas.length === 1 ? 'pessoa escalada' : 'pessoas escaladas'}. Lance este
            valor em Custos para ele entrar no preço.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {escalas.map((e) => {
          const membro = membros.find((m) => m.id === e.membroId);
          return (
            <div key={e.id} className="cartao flex items-center gap-3 p-3">
              <button
                type="button"
                onClick={async () => {
                  await repositorio.atualizarEscala({ ...e, confirmado: !e.confirmado });
                  await recarregar();
                }}
                aria-pressed={e.confirmado}
                className={`h-6 w-6 shrink-0 rounded-md border-2 ${
                  e.confirmado ? 'border-verde bg-verde/25 text-verde' : 'border-borda'
                }`}
                title={e.confirmado ? 'Confirmado' : 'Ainda não confirmou'}
              >
                {e.confirmado ? '✓' : ''}
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{membro?.nome ?? 'Membro removido'}</p>
                <p className="truncate text-sm text-fumaca">{e.funcao || membro?.funcao || 'sem função'}</p>
              </div>

              <div className="w-24 shrink-0">
                <CampoNumero
                  valor={e.cache}
                  aoMudar={async (v) => {
                    setEscalas((atuais) => atuais.map((x) => (x.id === e.id ? { ...x, cache: v } : x)));
                    await repositorio.atualizarEscala({ ...e, cache: v });
                  }}
                  sufixo="R$"
                  aria-label={`Cachê de ${membro?.nome ?? 'membro'}`}
                />
              </div>

              <button
                type="button"
                aria-label="Tirar da escala"
                className="botao botao-linha !min-h-10 !w-10 shrink-0 !px-0 !text-fumaca"
                onClick={async () => {
                  await repositorio.desescalar(e.id);
                  await recarregar();
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {disponiveis.length > 0 && (
        <div>
          <p className="rotulo mb-2">Escalar</p>
          <div className="flex flex-wrap gap-2">
            {disponiveis.map((m) => (
              <button
                key={m.id}
                type="button"
                className="botao botao-linha !min-h-9 !px-3 text-sm"
                onClick={async () => {
                  await repositorio.escalar(eventoId, m.id, m.funcao, m.cachePadrao);
                  await recarregar();
                }}
              >
                + {m.nome}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Serviços do evento.
 *
 * É a metade do orçamento que faltava: equipe, frete, imposto e caixa. Na
 * planilha do cliente essa seção sozinha custa mais que os insumos, então
 * esquecer uma linha aqui é o erro mais caro que o app pode deixar acontecer.
 */
function ServicosDoEvento({
  orcamento,
  disponiveis,
  convidados,
  resultado,
  mudar,
}: {
  orcamento: Orcamento;
  disponiveis: Servico[];
  convidados: number;
  resultado: ReturnType<typeof calcular>;
  mudar: (parcial: Partial<Orcamento>) => void;
}) {
  const usados = new Set(orcamento.servicos.map((s) => s.servicoId));
  const aAdicionar = disponiveis.filter((s) => !usados.has(s.id));

  const atualizar = (id: string, parcial: Partial<(typeof orcamento.servicos)[number]>) =>
    mudar({ servicos: orcamento.servicos.map((s) => (s.id === id ? { ...s, ...parcial } : s)) });

  return (
    <div className="space-y-5">
      <div className="cartao p-4">
        <p className="rotulo">Total de serviço</p>
        <p className="metrica mt-1">{real(resultado.custoServicos)}</p>
        <p className="mt-2 text-sm text-fumaca">
          Equipe, frete, imposto e taxas. Entra no preço junto com as compras.
        </p>
        {orcamento.servicos.some((s) => s.percentual > 0) && (
          <p className="mt-2 text-xs text-fumaca">
            O imposto é calculado sobre o total cobrado, e não sobre o custo. Por isso ele sobe um
            pouco quando você acrescenta qualquer outra coisa ao orçamento.
          </p>
        )}
      </div>

      <div className="space-y-2">
        {orcamento.servicos.map((s) => (
          <div key={s.id} className="cartao p-3">
            <div className="flex items-center gap-2">
              <span className="shrink-0 rounded-full border border-borda px-2 py-0.5 text-[0.65rem] text-fumaca">
                {ROTULO_PAPEL[s.papel]}
              </span>
              <p className="min-w-0 flex-1 truncate font-semibold">{s.nome}</p>
              <button
                type="button"
                aria-label={`Tirar ${s.nome}`}
                className="botao botao-linha !min-h-9 !w-9 shrink-0 !px-0 !text-fumaca"
                onClick={() => mudar({ servicos: orcamento.servicos.filter((x) => x.id !== s.id) })}
              >
                ×
              </button>
            </div>

            {/*
              Serviço percentual não tem quantidade nem valor: ele é uma fração
              do total. Mostrar os três campos juntos convidaria a preencher o
              valor à mão e achar que aquilo manda em alguma coisa.
            */}
            {s.percentual > 0 ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Campo rotulo="Quem">
                  <CampoTexto
                    valor={s.pessoa}
                    aoMudar={(v) => atualizar(s.id, { pessoa: v })}
                    placeholder="Nome"
                    aria-label={`Quem faz ${s.nome}`}
                  />
                </Campo>
                <Campo rotulo="Percentual">
                  <CampoNumero
                    valor={s.percentual}
                    aoMudar={(v) => atualizar(s.id, { percentual: v })}
                    sufixo="%"
                    aria-label={`Percentual de ${s.nome}`}
                  />
                </Campo>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Campo rotulo="Quem">
                  <CampoTexto
                    valor={s.pessoa}
                    aoMudar={(v) => atualizar(s.id, { pessoa: v })}
                    placeholder="Nome"
                    aria-label={`Quem faz ${s.nome}`}
                  />
                </Campo>
                <Campo rotulo={s.papel === 'frete' ? 'Km' : 'Qtd'}>
                  <CampoNumero
                    valor={s.quantidade}
                    aoMudar={(v) => atualizar(s.id, { quantidade: v })}
                    aria-label={`Quantidade de ${s.nome}`}
                  />
                </Campo>
                <Campo rotulo="Valor">
                  <CampoNumero
                    valor={s.valor}
                    aoMudar={(v) => atualizar(s.id, { valor: v })}
                    sufixo="R$"
                    aria-label={`Valor de ${s.nome}`}
                  />
                </Campo>
              </div>
            )}

            <p className="mt-2 text-right text-sm text-fumaca">
              {s.percentual > 0 ? (
                <>
                  {decimal(s.percentual)}% do total ={' '}
                  <strong className="text-creme">
                    {real(resultado.servicos.find((x) => x.servico.id === s.id)?.total ?? 0)}
                  </strong>
                </>
              ) : (
                <>
                  {inteiro(s.quantidade)} x {real(s.valor)} ={' '}
                  <strong className="text-creme">{real(s.quantidade * s.valor)}</strong>
                </>
              )}
            </p>
          </div>
        ))}

        {!orcamento.servicos.length && (
          <p className="cartao p-4 text-sm text-fumaca">
            Nenhum serviço ainda. Sem isso o preço sai só com o custo das compras, bem abaixo do real.
          </p>
        )}
      </div>

      {aAdicionar.length > 0 && (
        <div>
          <p className="rotulo mb-2">Adicionar serviço</p>
          <div className="flex flex-wrap gap-2">
            {aAdicionar.map((s) => (
              <button
                key={s.id}
                type="button"
                className="botao botao-linha !min-h-9 !px-3 text-sm"
                onClick={() =>
                  mudar({
                    servicos: [
                      ...orcamento.servicos,
                      {
                        id: `novo-${s.id}-${Date.now()}`,
                        servicoId: s.id,
                        nome: s.nome,
                        papel: s.papel,
                        pessoa: '',
                        quantidade: 1,
                        // O cachê do Alan e da Érica muda com o tamanho do
                        // evento. O valor já vem da faixa certa.
                        valor: valorSugerido(s, convidados),
                        // Imposto vem como percentual do catálogo; o resto vem zero.
                        percentual: s.percentual,
                      },
                    ],
                  })
                }
              >
                + {s.nome}
                {s.usaFaixa && <span className="ml-1 text-dourado">{real(valorSugerido(s, convidados))}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
