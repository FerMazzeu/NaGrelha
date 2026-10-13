import { useState } from 'react';
import {
  ROTULO_FORMA,
  repetirMensal,
  type Categoria,
  type Conta,
  type FormaDePagamento,
  type Lancamento,
  type TipoDeLancamento,
} from '../../dominio/financeiro';
import type { Membro, Orcamento } from '../../dominio/tipos';
import { mensagemDe } from '../../erro';
import { dataCurta, normalizar, real } from '../../formato';
import { Campo, CampoNumero, CampoTexto, Segmentado } from '../Campos';

/** Os sócios não estão na equipe, mas recebem pró-labore: entram na lista de nomes. */
const SOCIOS = ['Alan', 'Érica'];

/**
 * Lançar ou editar um lançamento.
 *
 * Abre por cima da tela, e não numa página própria, porque quase sempre se
 * lança no meio de outra coisa: conferindo o a receber, olhando o extrato.
 * Fechar volta exatamente para onde a pessoa estava.
 */
export default function FormularioDeLancamento({
  inicial,
  contas,
  categorias,
  eventos,
  membros,
  aoSalvar,
  aoRemover,
  aoFechar,
}: {
  inicial: Lancamento;
  contas: Conta[];
  categorias: Categoria[];
  eventos: Orcamento[];
  membros: Membro[];
  /** Mais de um quando repete por meses. */
  aoSalvar: (ls: Lancamento[]) => Promise<void>;
  aoRemover?: () => Promise<void>;
  aoFechar: () => void;
}) {
  const [l, setL] = useState<Lancamento>(() => ({
    ...inicial,
    // Lançamento novo já nasce na primeira conta, que é a que mais se usa.
    contaId: inicial.contaId ?? (inicial.pagoEm ? (contas.find((c) => c.ativo)?.id ?? null) : null),
  }));
  const [repetir, setRepetir] = useState(1);
  const [gravando, setGravando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [erro, setErro] = useState('');

  const mudar = (p: Partial<Lancamento>) => setL((atual) => ({ ...atual, ...p }));
  const novo = !inicial.id;
  const transferencia = l.tipo === 'transferencia';
  const pago = !!l.pagoEm;
  const ativas = contas.filter((c) => c.ativo || c.id === l.contaId || c.id === l.contaDestinoId);
  const dasCategorias = categorias.filter((c) => (c.ativo || c.id === l.categoriaId) && c.tipo === l.tipo);

  // Evento fechado primeiro, do mais próximo de hoje; perdido e orçado não
  // recebem dinheiro.
  const eventosParaEscolher = eventos
    .filter((o) => o.situacao === 'confirmado' || o.situacao === 'realizado' || o.id === l.eventoId)
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  const nomes = [...SOCIOS, ...membros.map((m) => m.nome.trim())];

  const problema = (() => {
    if (!(l.valor > 0)) return 'Falta o valor.';
    if (!l.vencimento) return 'Falta a data.';
    if (pago && !l.contaId) return 'Escolha a conta por onde o dinheiro passou.';
    if (transferencia && (!l.contaDestinoId || l.contaDestinoId === l.contaId)) return 'Escolha a conta de destino, diferente da de origem.';
    return '';
  })();

  const salvar = async () => {
    if (problema) {
      setErro(problema);
      return;
    }
    setGravando(true);
    setErro('');
    try {
      // Pessoa com o nome de alguém da equipe fica ligada a ela: é o que tira
      // o cachê dela da lista de a pagar.
      const membro = membros.find((m) => normalizar(m.nome) === normalizar(l.pessoa));
      const final: Lancamento = {
        ...l,
        membroId: membro?.id ?? (l.pessoa ? null : l.membroId),
        // Previsto ainda não passou por conta nenhuma.
        contaId: transferencia || pago ? l.contaId : null,
        descricao: l.descricao.trim() || descricaoPadrao(l, categorias, eventos),
      };
      await aoSalvar(novo && repetir > 1 && !transferencia ? repetirMensal(final, repetir) : [final]);
      aoFechar();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setGravando(false);
    }
  };

  const titulo = novo
    ? { entrada: 'Nova entrada', saida: 'Nova saída', transferencia: 'Transferência entre contas' }[l.tipo]
    : 'Editar lançamento';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={aoFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-borda bg-carvao-2 p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="titulo text-xl">{titulo}</h2>
          <button type="button" className="botao botao-linha !min-h-9 !px-3 text-sm" onClick={aoFechar}>
            Fechar
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {novo && (
            <Segmentado<TipoDeLancamento>
              valor={l.tipo}
              aoMudar={(tipo) =>
                mudar({
                  tipo,
                  categoriaId: null,
                  // Transferência é sempre algo que já aconteceu.
                  pagoEm: tipo === 'transferencia' ? l.pagoEm || l.vencimento : l.pagoEm,
                })
              }
              opcoes={[
                { valor: 'entrada', rotulo: 'Entrada' },
                { valor: 'saida', rotulo: 'Saída' },
                { valor: 'transferencia', rotulo: 'Transferência' },
              ]}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Valor">
              <CampoNumero valor={l.valor} aoMudar={(valor) => mudar({ valor })} sufixo="R$" autoFocus={novo} />
            </Campo>
            {!transferencia && (
              <Campo rotulo="Categoria">
                <select
                  className="campo"
                  value={l.categoriaId ?? ''}
                  onChange={(e) => mudar({ categoriaId: e.target.value || null })}
                >
                  <option value="">Sem categoria</option>
                  {dasCategorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </div>

          <Campo rotulo="Descrição">
            <CampoTexto
              valor={l.descricao}
              aoMudar={(descricao) => mudar({ descricao })}
              placeholder={descricaoPadrao(l, categorias, eventos) || 'O que foi'}
            />
          </Campo>

          {!transferencia && (
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 accent-[#c4261d]"
                checked={pago}
                onChange={(e) =>
                  mudar({
                    pagoEm: e.target.checked ? l.vencimento : '',
                    contaId: e.target.checked ? (l.contaId ?? ativas[0]?.id ?? null) : l.contaId,
                  })
                }
              />
              <span className="text-sm">
                {l.tipo === 'entrada' ? 'Já recebido' : 'Já pago'}
                <span className="block text-xs text-fumaca">
                  Desmarcado fica como {l.tipo === 'entrada' ? 'a receber' : 'a pagar'}, sem mexer no saldo.
                </span>
              </span>
            </label>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo={pago ? (transferencia ? 'Data' : l.tipo === 'entrada' ? 'Recebido em' : 'Pago em') : 'Vence em'}>
              <input
                type="date"
                className="campo"
                value={pago ? l.pagoEm : l.vencimento}
                onChange={(e) =>
                  pago ? mudar({ pagoEm: e.target.value, vencimento: novo ? e.target.value : l.vencimento }) : mudar({ vencimento: e.target.value })
                }
              />
            </Campo>
            {(pago || transferencia) && (
              <Campo rotulo={transferencia ? 'Sai de' : 'Conta'}>
                <select className="campo" value={l.contaId ?? ''} onChange={(e) => mudar({ contaId: e.target.value || null })}>
                  <option value="">Escolha</option>
                  {ativas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
            {transferencia && (
              <Campo rotulo="Entra em">
                <select
                  className="campo"
                  value={l.contaDestinoId ?? ''}
                  onChange={(e) => mudar({ contaDestinoId: e.target.value || null })}
                >
                  <option value="">Escolha</option>
                  {ativas
                    .filter((c) => c.id !== l.contaId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                </select>
              </Campo>
            )}
            {!transferencia && pago && (
              <Campo rotulo="Forma">
                <select
                  className="campo"
                  value={l.forma}
                  onChange={(e) => mudar({ forma: e.target.value as FormaDePagamento })}
                >
                  {(Object.keys(ROTULO_FORMA) as FormaDePagamento[]).map((f) => (
                    <option key={f} value={f}>
                      {ROTULO_FORMA[f]}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </div>

          {!transferencia && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Evento" dica="Ligar ao evento é o que faz o a receber e o resultado da festa baterem.">
                <select className="campo" value={l.eventoId ?? ''} onChange={(e) => mudar({ eventoId: e.target.value || null })}>
                  <option value="">Nenhum</option>
                  {eventosParaEscolher.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.data ? dataCurta(o.data) : 'sem data'} · {o.cliente || 'Sem nome'}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo={l.tipo === 'entrada' ? 'De quem' : 'Para quem'}>
                <CampoTexto
                  valor={l.pessoa}
                  aoMudar={(pessoa) => mudar({ pessoa })}
                  list="pessoas-do-caixa"
                  placeholder="Sócio, equipe, fornecedor"
                />
                <datalist id="pessoas-do-caixa">
                  {nomes.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </Campo>
            </div>
          )}

          <Campo rotulo="Observações">
            <textarea
              className="campo min-h-20 py-3"
              value={l.observacoes}
              onChange={(e) => mudar({ observacoes: e.target.value })}
              placeholder="Nota fiscal, combinado, parcela"
            />
          </Campo>

          {novo && !transferencia && (
            <Campo rotulo="Repetir todo mês" dica="Para aluguel, contador, parcela: cria as próximas como previstas.">
              <CampoNumero valor={repetir} aoMudar={(v) => setRepetir(Math.min(36, Math.max(1, Math.round(v))))} sufixo="vezes" minimo={1} />
            </Campo>
          )}

          {erro && <p className="rounded-xl border border-brasa/50 bg-brasa/10 p-3 text-sm text-brasa-clara">{erro}</p>}

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" className="botao botao-brasa flex-1" disabled={gravando} onClick={() => void salvar()}>
              {gravando ? 'Gravando...' : novo && repetir > 1 ? `Lançar ${repetir} meses · ${real(l.valor * repetir)}` : 'Salvar'}
            </button>
            {aoRemover &&
              (confirmandoExclusao ? (
                <button
                  type="button"
                  className="botao botao-linha !border-brasa !text-brasa-clara"
                  disabled={gravando}
                  onClick={async () => {
                    setGravando(true);
                    try {
                      await aoRemover();
                      aoFechar();
                    } catch (e) {
                      setErro(mensagemDe(e));
                      setGravando(false);
                    }
                  }}
                >
                  Excluir de vez
                </button>
              ) : (
                <button type="button" className="botao botao-linha !text-fumaca" onClick={() => setConfirmandoExclusao(true)}>
                  Excluir
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** "Pró-labore, Fulana" quando ninguém escreveu nada: a lista não fica cheia de linha em branco. */
export function descricaoPadrao(l: Lancamento, categorias: Categoria[], eventos: Orcamento[]) {
  if (l.tipo === 'transferencia') return 'Transferência';
  const categoria = categorias.find((c) => c.id === l.categoriaId)?.nome ?? '';
  const evento = eventos.find((o) => o.id === l.eventoId)?.cliente ?? '';
  return [categoria, l.pessoa, evento].filter(Boolean).join(', ');
}
