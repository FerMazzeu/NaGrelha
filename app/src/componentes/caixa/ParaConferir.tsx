import { useState } from 'react';
import { financeiro } from '../../dados/financeiro';
import type { Pendencia } from '../../dominio/financeiro';
import type { Orcamento } from '../../dominio/tipos';
import { mensagemDe } from '../../erro';
import { dataCurta, inteiro, real } from '../../formato';

/**
 * O que alguém precisa conferir e responder: a lista de dúvidas que a
 * importação deixou ("o que é BASF?", "o Wilson pagou o resto?").
 *
 * A resposta fica gravada junto com a pergunta. Daqui a seis meses, quando
 * alguém perguntar de onde veio um número, a explicação está aqui, e não
 * perdida numa conversa de WhatsApp.
 */
export default function ParaConferir({
  pendencias,
  eventos,
  aoMudar,
}: {
  pendencias: Pendencia[];
  eventos: Orcamento[];
  aoMudar: (p: Pendencia) => void;
}) {
  const abertas = pendencias.filter((p) => p.situacao === 'aberta');
  const resolvidas = pendencias
    .filter((p) => p.situacao === 'resolvida')
    .sort((a, b) => b.resolvidaEm.localeCompare(a.resolvidaEm));

  return (
    <div className="space-y-6">
      <p className="text-sm text-fumaca">
        Pontos que a importação não conseguiu resolver sozinha. Escreva o que for preciso na resposta e marque como
        resolvido; a resposta fica guardada.
      </p>

      <section>
        <h2 className="flex items-baseline gap-2">
          <span className="titulo text-lg text-dourado">Abertas</span>
          <span className="text-sm text-fumaca">{inteiro(abertas.length)}</span>
        </h2>
        {!abertas.length && <p className="mt-2 text-sm text-fumaca">Nada para conferir.</p>}
        <div className="mt-3 space-y-3">
          {abertas.map((p) => (
            <Item key={p.id} p={p} eventos={eventos} aoMudar={aoMudar} />
          ))}
        </div>
      </section>

      {resolvidas.length > 0 && (
        <details>
          <summary className="cursor-pointer">
            <span className="titulo text-lg text-creme/70">Resolvidas</span>{' '}
            <span className="text-sm text-fumaca">{inteiro(resolvidas.length)}</span>
          </summary>
          <div className="mt-3 space-y-3">
            {resolvidas.map((p) => (
              <Item key={p.id} p={p} eventos={eventos} aoMudar={aoMudar} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function Item({ p, eventos, aoMudar }: { p: Pendencia; eventos: Orcamento[]; aoMudar: (p: Pendencia) => void }) {
  const [resposta, setResposta] = useState(p.resposta);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState('');
  const evento = eventos.find((o) => o.id === p.eventoId);
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

  return (
    <div className={`cartao p-4 ${resolvida ? 'opacity-70' : 'border-l-4 border-l-dourado'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">{p.titulo}</p>
        {p.valor !== null && <p className="font-display text-lg uppercase text-dourado">{real(p.valor)}</p>}
      </div>
      <p className="mt-1 text-sm text-fumaca">{p.detalhe}</p>
      {evento && (
        <p className="mt-1 text-xs text-fumaca">
          Evento: {evento.cliente} · {evento.data ? dataCurta(evento.data) : 'sem data'}
        </p>
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
