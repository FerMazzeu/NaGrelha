import { useState } from 'react';
import { diasAntes, hojeIso, inicioDoControle as inicioDe, recebiveis, type Lancamento, type Recebivel } from '../../dominio/financeiro';
import { mensagemDe } from '../../erro';
import { dataCurta, inteiro, real } from '../../formato';
import type { AcoesDoCaixa, DadosDoCaixa } from './Caixa';

/**
 * O que os clientes devem.
 *
 * Cada evento fechado é uma linha: valor, quanto entrou, quanto falta, e o
 * vencimento do restante, quatro dias antes da festa. Não há conta a receber
 * para digitar: registrar o pagamento é lançar a entrada ligada ao evento.
 */
export default function AReceber({ dados, acoes }: { dados: DadosDoCaixa; acoes: AcoesDoCaixa }) {
  const hoje = hojeIso();
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [quitando, setQuitando] = useState<false | 'confirmar' | 'gravando'>(false);

  const todos = recebiveis(dados.orcamentos, dados.lancamentos, hoje);
  const ordem = (a: Recebivel, b: Recebivel) => (a.vencimento || '9999').localeCompare(b.vencimento || '9999');
  const atrasados = todos.filter((r) => r.atrasado).sort(ordem);
  const emDia = todos.filter((r) => r.restante > 0.009 && !r.atrasado).sort(ordem);
  const quitados = todos.filter((r) => r.situacao === 'quitado').sort((a, b) => b.evento.data.localeCompare(a.evento.data));

  // Entrada prevista sem evento: um reembolso, uma venda avulsa.
  const avulsas = dados.lancamentos
    .filter((l) => l.tipo === 'entrada' && !l.pagoEm && !l.eventoId)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  const categoriaDeEvento = dados.categorias.find((c) => c.grupo === 'receita' && c.tipo === 'entrada')?.id ?? null;
  const primeiraConta = dados.contas.find((c) => c.ativo) ?? dados.contas[0];
  const inicioDoControle = inicioDe(dados.contas, hoje);

  /*
    Evento que aconteceu antes de o caixa existir e foi pago, só que ninguém
    lançou. Sem isto, todo evento antigo do app apareceria como atrasado.

    O pagamento entra datado na véspera do saldo inicial: fica registrado no
    evento, mas não soma no saldo, que já tem esse dinheiro dentro.
  */
  const antigos = atrasados.filter((r) => r.evento.data && r.evento.data < inicioDoControle);
  const pagoAntes = (r: Recebivel): Lancamento => {
    const vespera = diasAntes(inicioDoControle, 1);
    const dia = r.evento.data && r.evento.data < vespera ? r.evento.data : vespera;
    return {
      id: '',
      tipo: 'entrada',
      descricao: `Pagamento ${r.evento.cliente} (antes do controle)`,
      valor: r.restante,
      vencimento: dia,
      pagoEm: dia,
      contaId: primeiraConta?.id ?? null,
      contaDestinoId: null,
      categoriaId: categoriaDeEvento,
      eventoId: r.evento.id,
      membroId: null,
      pessoa: '',
      forma: '',
      observacoes: 'Marcado como recebido antes do início do controle de caixa.',
    };
  };

  const quitarAntigos = async () => {
    setQuitando('gravando');
    setErro('');
    try {
      await acoes.gravar(antigos.map(pagoAntes));
      setQuitando(false);
    } catch (e) {
      setErro(mensagemDe(e));
      setQuitando(false);
    }
  };

  const receber = (r: Recebivel) =>
    acoes.novo('entrada', {
      valor: r.restante,
      eventoId: r.evento.id,
      categoriaId: categoriaDeEvento,
      descricao: `${r.recebido > 0 ? 'Restante' : 'Entrada'} ${r.evento.cliente}`,
    });

  const total = (rs: Recebivel[]) => real(rs.reduce((s, r) => s + r.restante, 0));

  const lista = (rs: Recebivel[]) => (
    <div className="mt-3 space-y-2">
      {rs.map((r) => (
        <Cartao
          key={r.evento.id}
          r={r}
          dados={dados}
          acoes={acoes}
          aberto={aberto === r.evento.id}
          aoAlternar={() => setAberto(aberto === r.evento.id ? null : r.evento.id)}
          aoReceber={() => receber(r)}
          aoMarcarAntigo={r.evento.data && r.evento.data < inicioDoControle && r.restante > 0 ? () => void acoes.gravar([pagoAntes(r)]).catch((e) => setErro(mensagemDe(e))) : undefined}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {erro && <p className="rounded-xl border border-brasa/50 bg-brasa/10 p-3 text-sm text-brasa-clara">{erro}</p>}

      {antigos.length > 0 && (
        <div className="cartao border-dourado/50 p-4 text-sm">
          <p className="font-semibold text-dourado">
            {inteiro(antigos.length)} {antigos.length === 1 ? 'evento antigo aparece' : 'eventos antigos aparecem'} como
            atrasado ({total(antigos)})
          </p>
          <p className="mt-1 text-fumaca">
            São de antes de {dataCurta(inicioDoControle)}, quando o controle começou. Se já foram pagos, marque como
            recebidos antes do controle: o pagamento fica registrado no evento, sem mexer no saldo das contas.
          </p>
          {quitando === 'confirmar' ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="botao botao-brasa" onClick={() => void quitarAntigos()}>
                Sim, todos foram pagos
              </button>
              <button type="button" className="botao botao-linha" onClick={() => setQuitando(false)}>
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="botao botao-linha mt-3"
              disabled={quitando === 'gravando'}
              onClick={() => setQuitando('confirmar')}
            >
              {quitando === 'gravando' ? 'Gravando...' : 'Marcar todos como recebidos antes do controle'}
            </button>
          )}
        </div>
      )}

      <section>
        <h2 className="flex flex-wrap items-baseline gap-2">
          <span className="titulo text-lg text-brasa-clara">Atrasados</span>
          <span className="text-sm text-fumaca">
            {inteiro(atrasados.length)} · {total(atrasados)}
          </span>
        </h2>
        {atrasados.length ? lista(atrasados) : <p className="mt-2 text-sm text-fumaca">Ninguém atrasado.</p>}
      </section>

      <section>
        <h2 className="flex flex-wrap items-baseline gap-2">
          <span className="titulo text-lg text-dourado">A vencer</span>
          <span className="text-sm text-fumaca">
            {inteiro(emDia.length)} · {total(emDia)}
          </span>
        </h2>
        {emDia.length ? lista(emDia) : <p className="mt-2 text-sm text-fumaca">Nada a vencer.</p>}
      </section>

      {avulsas.length > 0 && (
        <section>
          <h2 className="titulo text-lg text-dourado">Outras entradas previstas</h2>
          <div className="mt-3 space-y-2">
            {avulsas.map((l) => (
              <div key={l.id} className="cartao flex items-center gap-3 p-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => acoes.abrir(l)}>
                  <span className="block truncate font-semibold">{l.descricao || 'Sem descrição'}</span>
                  <span className={`text-sm ${l.vencimento < hoje ? 'text-brasa-clara' : 'text-fumaca'}`}>
                    vence {dataCurta(l.vencimento)}
                  </span>
                </button>
                <span className="shrink-0 font-semibold">{real(l.valor)}</span>
                <button
                  type="button"
                  className="botao botao-linha !min-h-9 !px-3 text-sm"
                  onClick={() => acoes.abrir({ ...l, pagoEm: hoje, contaId: l.contaId ?? primeiraConta?.id ?? null })}
                >
                  Recebi
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {quitados.length > 0 && (
        <details>
          <summary className="cursor-pointer">
            <span className="titulo text-lg text-creme/70">Quitados</span>{' '}
            <span className="text-sm text-fumaca">{inteiro(quitados.length)}</span>
          </summary>
          {lista(quitados)}
        </details>
      )}
    </div>
  );
}

function Cartao({
  r,
  dados,
  acoes,
  aberto,
  aoAlternar,
  aoReceber,
  aoMarcarAntigo,
}: {
  r: Recebivel;
  dados: DadosDoCaixa;
  acoes: AcoesDoCaixa;
  aberto: boolean;
  aoAlternar: () => void;
  aoReceber: () => void;
  aoMarcarAntigo?: () => void;
}) {
  const pago = r.total > 0 ? Math.min(100, (r.recebido / r.total) * 100) : 0;
  const movimentos = dados.lancamentos
    .filter((l) => l.eventoId === r.evento.id && l.tipo === 'entrada')
    .sort((a, b) => (a.pagoEm || a.vencimento).localeCompare(b.pagoEm || b.vencimento));

  return (
    <div className={`cartao p-4 ${r.atrasado ? 'border-l-4 border-l-brasa' : ''}`}>
      <div className="flex items-start gap-3">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={aoAlternar} aria-expanded={aberto}>
          <span className="block truncate font-semibold">{r.evento.cliente || 'Sem nome'}</span>
          <span className="block text-sm text-fumaca">
            evento {r.evento.data ? dataCurta(r.evento.data) : 'sem data'}
            {r.restante > 0.009 && r.vencimento && (
              <span className={r.atrasado ? 'text-brasa-clara' : ''}>
                {' '}
                · {r.atrasado ? '⚠ restante venceu' : 'restante vence'} {dataCurta(r.vencimento)}
              </span>
            )}
          </span>
        </button>
        <div className="shrink-0 text-right">
          <p className="font-display text-lg uppercase text-dourado">{real(r.restante)}</p>
          <p className="text-xs text-fumaca">de {real(r.total)}</p>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-carvao-3" aria-hidden="true">
        <div className="h-full rounded-full bg-verde" style={{ width: `${pago}%` }} />
      </div>
      <p className="mt-1 text-xs text-fumaca">
        {real(r.recebido)} recebido{r.previsto > 0 ? ` · ${real(r.previsto)} combinado para depois` : ''}
      </p>

      {r.restante > 0.009 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="botao botao-brasa !min-h-9 !px-3 text-sm" onClick={aoReceber}>
            Registrar recebimento
          </button>
          {aoMarcarAntigo && (
            <button type="button" className="botao botao-linha !min-h-9 !px-3 text-sm" onClick={aoMarcarAntigo}>
              Já estava pago
            </button>
          )}
        </div>
      )}

      {aberto && (
        <ul className="mt-3 divide-y divide-borda border-t border-borda text-sm">
          {!movimentos.length && <li className="py-2 text-fumaca">Nenhum recebimento lançado.</li>}
          {movimentos.map((l) => (
            <li key={l.id}>
              <button type="button" className="flex w-full justify-between gap-3 py-2 text-left hover:text-dourado" onClick={() => acoes.abrir(l)}>
                <span className="truncate">
                  {l.pagoEm ? dataCurta(l.pagoEm) : `previsto ${dataCurta(l.vencimento)}`} · {l.descricao}
                </span>
                <span className="shrink-0">{real(l.valor)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
