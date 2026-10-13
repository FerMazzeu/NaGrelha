import { useState } from 'react';
import { financeiro } from '../../dados/financeiro';
import { recebiveis, type Lancamento, type Pendencia } from '../../dominio/financeiro';
import { ROTULO_SITUACAO } from '../../dominio/tipos';
import { mensagemDe } from '../../erro';
import { dataCurta, inteiro, real } from '../../formato';
import type { AcoesDoCaixa, DadosDoCaixa } from './Caixa';

/**
 * O que alguém precisa conferir e responder: a lista de dúvidas que a
 * importação deixou ("o que é BASF?", "o Wilson pagou o resto?").
 *
 * Cada ponto traz junto o que é preciso para resolver sem sair dele: o
 * evento com os lançamentos (que abrem para editar), e o botão da ação que
 * aquele ponto pede. Antes a pessoa lia a pergunta, ia procurar o evento em
 * outra aba e voltava para responder.
 *
 * A resposta fica gravada junto com a pergunta. Daqui a seis meses, quando
 * alguém perguntar de onde veio um número, a explicação está aqui.
 */
export default function ParaConferir({
  pendencias,
  dados,
  acoes,
  aoAbrirEvento,
  aoIrParaContas,
  aoMudar,
}: {
  pendencias: Pendencia[];
  dados: DadosDoCaixa;
  acoes: AcoesDoCaixa;
  aoAbrirEvento?: (id: string) => void;
  aoIrParaContas: () => void;
  aoMudar: (p: Pendencia) => void;
}) {
  const abertas = pendencias.filter((p) => p.situacao === 'aberta');
  const resolvidas = pendencias
    .filter((p) => p.situacao === 'resolvida')
    .sort((a, b) => b.resolvidaEm.localeCompare(a.resolvidaEm));

  const item = (p: Pendencia) => (
    <Item key={p.id} p={p} dados={dados} acoes={acoes} aoAbrirEvento={aoAbrirEvento} aoIrParaContas={aoIrParaContas} aoMudar={aoMudar} />
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-fumaca">
        Pontos que a importação não conseguiu resolver sozinha. Cada um traz o evento e os lançamentos ligados a ele:
        confira, corrija pelo botão do próprio ponto, escreva a resposta e marque como resolvido.
      </p>

      <section>
        <h2 className="flex items-baseline gap-2">
          <span className="titulo text-lg text-dourado">Abertas</span>
          <span className="text-sm text-fumaca">{inteiro(abertas.length)}</span>
        </h2>
        {!abertas.length && <p className="mt-2 text-sm text-fumaca">Nada para conferir.</p>}
        <div className="mt-3 grid items-start gap-3 xl:grid-cols-2">{abertas.map(item)}</div>
      </section>

      {resolvidas.length > 0 && (
        <details>
          <summary className="cursor-pointer">
            <span className="titulo text-lg text-creme/70">Resolvidas</span>{' '}
            <span className="text-sm text-fumaca">{inteiro(resolvidas.length)}</span>
          </summary>
          <div className="mt-3 grid items-start gap-3 xl:grid-cols-2">{resolvidas.map(item)}</div>
        </details>
      )}
    </div>
  );
}

function Item({
  p,
  dados,
  acoes,
  aoAbrirEvento,
  aoIrParaContas,
  aoMudar,
}: {
  p: Pendencia;
  dados: DadosDoCaixa;
  acoes: AcoesDoCaixa;
  aoAbrirEvento?: (id: string) => void;
  aoIrParaContas: () => void;
  aoMudar: (p: Pendencia) => void;
}) {
  const [resposta, setResposta] = useState(p.resposta);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState('');
  const evento = dados.orcamentos.find((o) => o.id === p.eventoId);
  const resolvida = p.situacao === 'resolvida';

  const gravar = async (situacao: Pendencia['situacao']) => {
    setGravando(true);
    setErro('');
    const nova = { ...p, resposta, situacao, resolvidaEm: situacao === 'resolvida' ? new Date().toISOString() : '' };
    try {
      await financeiro.salvarPendencia(nova);
      aoMudar(nova);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setGravando(false);
    }
  };

  const categoria = (grupo: string, tipo: 'entrada' | 'saida') =>
    dados.categorias.find((c) => c.ativo && c.grupo === grupo && c.tipo === tipo)?.id ?? null;

  /*
    A ação que cada tipo de ponto pede. O tipo sai do próprio ponto (tem
    evento, tem valor solto, é o dos saldos), e não de uma coluna a mais: é
    o mesmo texto que a importação escreveu.
  */
  const ehSaldos = /^conferir os saldos/i.test(p.titulo);
  const ehForaDaImportacao = /^ficou de fora/i.test(p.titulo);
  const valorSolto = !evento && p.valor !== null && !ehSaldos;

  return (
    <div className={`cartao p-4 ${resolvida ? 'opacity-70' : 'border-l-4 border-l-dourado'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">{p.titulo}</p>
        {p.valor !== null && <p className="font-display text-lg uppercase text-dourado">{real(p.valor)}</p>}
      </div>
      <p className="mt-1 text-sm text-fumaca">{p.detalhe}</p>

      {evento && <PainelDoEvento eventoId={evento.id} dados={dados} acoes={acoes} aoAbrirEvento={aoAbrirEvento} />}

      {!resolvida && (
        <div className="mt-3 flex flex-wrap gap-2">
          {evento && (
            <button
              type="button"
              className="botao botao-linha !min-h-9 !px-3 text-sm"
              onClick={() =>
                acoes.novo('entrada', {
                  eventoId: evento.id,
                  valor: recebiveis([evento], dados.lancamentos)[0]?.restante ?? 0,
                  categoriaId: categoria('receita', 'entrada'),
                  descricao: `Restante ${evento.cliente}`,
                })
              }
            >
              Registrar recebimento
            </button>
          )}
          {valorSolto && (
            <button
              type="button"
              className="botao botao-linha !min-h-9 !px-3 text-sm"
              onClick={() =>
                acoes.novo('saida', {
                  valor: p.valor ?? 0,
                  pagoEm: '',
                  descricao: /"(.+)"/.exec(p.titulo)?.[1] ?? p.titulo,
                  observacoes: 'Lançado a partir de um ponto para conferir.',
                })
              }
            >
              Lançar como conta a pagar
            </button>
          )}
          {ehSaldos && (
            <button type="button" className="botao botao-linha !min-h-9 !px-3 text-sm" onClick={aoIrParaContas}>
              Ir para as contas e conferir com o extrato
            </button>
          )}
          {ehForaDaImportacao && (
            <button
              type="button"
              className="botao botao-linha !min-h-9 !px-3 text-sm"
              onClick={() => acoes.novo('entrada', { categoriaId: categoria('receita', 'entrada'), observacoes: p.detalhe })}
            >
              Lançar uma entrada
            </button>
          )}
        </div>
      )}

      <textarea
        className="campo mt-3 min-h-16 py-2 text-sm"
        value={resposta}
        onChange={(e) => setResposta(e.target.value)}
        placeholder="Resposta: o que é, o que foi feito"
        aria-label={`Resposta para: ${p.titulo}`}
      />
      {erro && <p className="mt-2 text-sm text-brasa-clara">{erro}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {resolvida ? (
          <>
            <span className="text-xs text-fumaca">Resolvida em {dataCurta(p.resolvidaEm.slice(0, 10))}</span>
            {resposta !== p.resposta && (
              <button type="button" className="botao botao-linha !min-h-9 !px-3 text-sm" disabled={gravando} onClick={() => void gravar('resolvida')}>
                Salvar resposta
              </button>
            )}
            <button type="button" className="text-sm text-fumaca hover:text-creme" disabled={gravando} onClick={() => void gravar('aberta')}>
              Reabrir
            </button>
          </>
        ) : (
          <>
            <button type="button" className="botao botao-brasa !min-h-9 !px-3 text-sm" disabled={gravando} onClick={() => void gravar('resolvida')}>
              {gravando ? 'Gravando...' : 'Resolvido'}
            </button>
            {resposta !== p.resposta && (
              <button type="button" className="botao botao-linha !min-h-9 !px-3 text-sm" disabled={gravando} onClick={() => void gravar('aberta')}>
                Salvar sem fechar
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * O evento do ponto, do jeito que se confere: quanto vale, quanto entrou,
 * quanto falta, e cada lançamento ligado a ele, que abre para editar.
 */
function PainelDoEvento({
  eventoId,
  dados,
  acoes,
  aoAbrirEvento,
}: {
  eventoId: string;
  dados: DadosDoCaixa;
  acoes: AcoesDoCaixa;
  aoAbrirEvento?: (id: string) => void;
}) {
  const evento = dados.orcamentos.find((o) => o.id === eventoId)!;
  const r = recebiveis([evento], dados.lancamentos)[0];
  const movimentos = dados.lancamentos
    .filter((l) => l.eventoId === eventoId)
    .sort((a, b) => (a.pagoEm || a.vencimento).localeCompare(b.pagoEm || b.vencimento));
  const nomeDaCategoria = (l: Lancamento) => dados.categorias.find((c) => c.id === l.categoriaId)?.nome ?? '';

  return (
    <div className="mt-3 rounded-xl border border-borda bg-carvao-3/50 p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p>
          <span className="font-semibold">{evento.cliente || 'Sem nome'}</span>
          <span className="text-fumaca">
            {' '}
            · {evento.data ? dataCurta(evento.data) : 'sem data'} · {ROTULO_SITUACAO[evento.situacao]}
          </span>
        </p>
        {aoAbrirEvento && (
          <button type="button" className="text-xs font-semibold text-dourado underline-offset-4 hover:underline" onClick={() => aoAbrirEvento(evento.id)}>
            Abrir o evento ›
          </button>
        )}
      </div>

      {r && (
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <Numero rotulo="Valor" valor={r.total} />
          <Numero rotulo="Recebido" valor={r.recebido} />
          <Numero rotulo="Falta" valor={r.restante} destaque={r.restante > 0.009} />
        </div>
      )}

      <p className="rotulo mt-3">Lançamentos do evento</p>
      {!movimentos.length && <p className="mt-1 text-fumaca">Nenhum lançamento ligado a este evento.</p>}
      <ul className="mt-1 divide-y divide-borda">
        {movimentos.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              onClick={() => acoes.abrir(l)}
              className="flex w-full items-center justify-between gap-3 py-1.5 text-left hover:text-dourado"
              title="Abrir para conferir ou corrigir"
            >
              <span className="min-w-0">
                <span className="block truncate">{l.descricao || nomeDaCategoria(l) || 'Sem descrição'}</span>
                <span className="block text-xs text-fumaca">
                  {l.pagoEm ? `pago ${dataCurta(l.pagoEm)}` : `previsto ${dataCurta(l.vencimento)}`}
                  {l.pessoa ? ` · ${l.pessoa}` : ''}
                </span>
              </span>
              <span className={`shrink-0 font-semibold ${l.tipo === 'saida' ? 'text-brasa-clara' : ''}`}>
                {l.tipo === 'saida' ? '− ' : '+ '}
                {real(l.valor)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Numero({ rotulo, valor, destaque = false }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className="rounded-lg bg-carvao-2 p-2">
      <p className="text-[0.65rem] uppercase tracking-wide text-fumaca">{rotulo}</p>
      <p className={`font-semibold ${destaque ? 'text-dourado' : ''}`}>{real(valor)}</p>
    </div>
  );
}
