import { useMemo, useState } from 'react';
import { extrato, hojeIso, ROTULO_FORMA, type Lancamento } from '../../dominio/financeiro';
import { mensagemDe } from '../../erro';
import { exportarLivroCaixa } from '../../excel-caixa';
import { casaBusca, dataCurta, real } from '../../formato';
import type { AcoesDoCaixa, DadosDoCaixa } from './Caixa';

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

type Periodo = { tipo: 'mes'; mes: string } | { tipo: 'ano'; ano: string } | { tipo: 'tudo' };

function limites(p: Periodo): [string, string, string] {
  if (p.tipo === 'mes') {
    const [a, m] = p.mes.split('-').map(Number);
    const fim = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
    const nome = MESES[m - 1];
    return [`${p.mes}-01`, fim, `${nome[0].toUpperCase()}${nome.slice(1)} de ${a}`];
  }
  if (p.tipo === 'ano') return [`${p.ano}-01-01`, `${p.ano}-12-31`, p.ano];
  return ['0000-01-01', '9999-12-31', 'todo o período'];
}

function andarMes(mes: string, n: number) {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7);
}

/**
 * O livro caixa: o que passou pelas contas, dia a dia, com o saldo andando.
 *
 * Mostra só o que foi pago. O previsto mora em "a receber" e "a pagar": se
 * entrasse aqui, o saldo da linha deixaria de bater com o extrato do banco,
 * que é contra o que esta tela é conferida.
 */
export default function LivroCaixa({ dados, acoes }: { dados: DadosDoCaixa; acoes: AcoesDoCaixa }) {
  const [periodo, setPeriodo] = useState<Periodo>({ tipo: 'mes', mes: hojeIso().slice(0, 7) });
  const [contaId, setContaId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<'todos' | Lancamento['tipo']>('todos');
  const [categoriaId, setCategoriaId] = useState('');
  const [busca, setBusca] = useState('');
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState('');

  const [de, ate, rotulo] = limites(periodo);
  const nomeDaConta = (id: string | null) => dados.contas.find((c) => c.id === id)?.nome ?? '';
  const nomeDaCategoria = (id: string | null) => dados.categorias.find((c) => c.id === id)?.nome ?? '';
  const nomeDoEvento = (id: string | null) => dados.orcamentos.find((o) => o.id === id)?.cliente ?? '';

  const { saldoAnterior, linhas, saldoFinal } = useMemo(
    () => extrato(dados.contas, dados.lancamentos, contaId, de, ate),
    [dados.contas, dados.lancamentos, contaId, de, ate],
  );

  // Filtro de tipo, categoria e busca só esconde linha: o saldo continua o
  // do extrato inteiro, senão ele mentiria.
  const filtrando = tipo !== 'todos' || !!categoriaId || !!busca.trim();
  const visiveis = linhas.filter(
    ({ lancamento: l }) =>
      (tipo === 'todos' || l.tipo === tipo) &&
      (!categoriaId || l.categoriaId === categoriaId) &&
      casaBusca(busca, l.descricao, l.pessoa, l.observacoes, nomeDaCategoria(l.categoriaId), nomeDoEvento(l.eventoId)),
  );
  const entradas = visiveis.filter((x) => x.lancamento.tipo === 'entrada').reduce((s, x) => s + x.lancamento.valor, 0);
  const saidas = visiveis.filter((x) => x.lancamento.tipo === 'saida').reduce((s, x) => s + x.lancamento.valor, 0);

  const exportar = async () => {
    setExportando(true);
    setErro('');
    try {
      await exportarLivroCaixa({
        titulo: `Livro caixa - ${contaId ? nomeDaConta(contaId) : 'todas as contas'} - ${rotulo}`,
        saldoAnterior,
        saldoFinal,
        linhas: visiveis.map(({ lancamento: l, efeito, saldo }) => ({
          data: l.pagoEm,
          descricao: l.descricao,
          categoria: nomeDaCategoria(l.categoriaId),
          conta:
            l.tipo === 'transferencia' ? `${nomeDaConta(l.contaId)} → ${nomeDaConta(l.contaDestinoId)}` : nomeDaConta(l.contaId),
          evento: nomeDoEvento(l.eventoId),
          pessoa: l.pessoa,
          forma: l.forma ? ROTULO_FORMA[l.forma] : '',
          valor: efeito,
          saldo,
        })),
        mostrarSaldo: !filtrando,
      });
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setExportando(false);
    }
  };

  const anos = [...new Set([hojeIso().slice(0, 4), ...dados.lancamentos.filter((l) => l.pagoEm).map((l) => l.pagoEm.slice(0, 4))])].sort().reverse();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {periodo.tipo === 'mes' && (
          <div className="flex items-center gap-1">
            <button type="button" className="botao botao-linha !min-h-9 !px-3" aria-label="Mês anterior" onClick={() => setPeriodo({ tipo: 'mes', mes: andarMes(periodo.mes, -1) })}>
              ‹
            </button>
            <span className="min-w-36 text-center font-semibold">{rotulo}</span>
            <button type="button" className="botao botao-linha !min-h-9 !px-3" aria-label="Próximo mês" onClick={() => setPeriodo({ tipo: 'mes', mes: andarMes(periodo.mes, 1) })}>
              ›
            </button>
          </div>
        )}
        <select
          className="campo !w-auto"
          value={periodo.tipo === 'mes' ? 'mes' : periodo.tipo === 'ano' ? periodo.ano : 'tudo'}
          onChange={(e) => {
            const v = e.target.value;
            setPeriodo(v === 'mes' ? { tipo: 'mes', mes: hojeIso().slice(0, 7) } : v === 'tudo' ? { tipo: 'tudo' } : { tipo: 'ano', ano: v });
          }}
          aria-label="Período"
        >
          <option value="mes">Por mês</option>
          {anos.map((a) => (
            <option key={a} value={a}>
              Ano de {a}
            </option>
          ))}
          <option value="tudo">Tudo</option>
        </select>
        <select className="campo !w-auto" value={contaId ?? ''} onChange={(e) => setContaId(e.target.value || null)} aria-label="Conta">
          <option value="">Todas as contas</option>
          {dados.contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <select className="campo !w-auto" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} aria-label="Tipo">
          <option value="todos">Entradas e saídas</option>
          <option value="entrada">Só entradas</option>
          <option value="saida">Só saídas</option>
          <option value="transferencia">Transferências</option>
        </select>
        <select className="campo !w-auto" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {dados.categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <input className="campo !w-auto min-w-0 flex-1" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" />
        <button type="button" className="botao botao-linha" disabled={exportando || !visiveis.length} onClick={() => void exportar()}>
          {exportando ? 'Gerando...' : 'Excel'}
        </button>
      </div>

      {erro && <p className="rounded-xl border border-brasa/50 bg-brasa/10 p-3 text-sm text-brasa-clara">{erro}</p>}

      <div className="grid gap-3 sm:grid-cols-4">
        <Numero rotulo="Saldo anterior" valor={saldoAnterior} />
        <Numero rotulo="Entradas" valor={entradas} />
        <Numero rotulo="Saídas" valor={-saidas} />
        <Numero rotulo="Saldo no fim" valor={saldoFinal} />
      </div>
      {filtrando && (
        <p className="text-xs text-fumaca">
          Com filtro, a coluna de saldo continua sendo a do extrato inteiro da conta, para bater com o banco.
        </p>
      )}

      {!visiveis.length ? (
        <p className="cartao p-6 text-sm text-fumaca">Nenhum lançamento pago em {rotulo}.</p>
      ) : (
        <div className="cartao divide-y divide-borda">
          {visiveis.map(({ lancamento: l, efeito, saldo }) => {
            const evento = nomeDoEvento(l.eventoId);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => acoes.abrir(l)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-carvao-3/60"
              >
                <span className="w-12 shrink-0 text-xs text-fumaca">{dataCurta(l.pagoEm).slice(0, 5)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{l.descricao || 'Sem descrição'}</span>
                  <span className="block truncate text-xs text-fumaca">
                    {[
                      l.tipo === 'transferencia'
                        ? `${nomeDaConta(l.contaId)} → ${nomeDaConta(l.contaDestinoId)}`
                        : nomeDaCategoria(l.categoriaId),
                      evento && `evento ${evento}`,
                      l.pessoa,
                      !contaId && l.tipo !== 'transferencia' && nomeDaConta(l.contaId),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span
                    className={`block text-sm font-semibold ${
                      l.tipo === 'entrada' ? 'text-creme' : l.tipo === 'saida' ? 'text-brasa-clara' : 'text-fumaca'
                    }`}
                  >
                    {l.tipo === 'transferencia' && !contaId ? '⇄ ' : efeito >= 0 ? '+ ' : '− '}
                    {real(l.tipo === 'transferencia' && !contaId ? l.valor : Math.abs(efeito))}
                  </span>
                  <span className="block text-xs text-fumaca">{real(saldo)}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="cartao p-3">
      <p className="rotulo">{rotulo}</p>
      <p className={`mt-1 font-display text-xl uppercase ${valor < 0 ? 'text-brasa-clara' : 'text-creme'}`}>{real(valor)}</p>
    </div>
  );
}
