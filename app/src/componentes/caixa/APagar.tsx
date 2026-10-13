import { aPagar, hojeIso, inicioDoControle, type APagar } from '../../dominio/financeiro';
import { dataCurta, inteiro, real } from '../../formato';
import type { AcoesDoCaixa, DadosDoCaixa } from './Caixa';

/**
 * O que a empresa deve: as saídas previstas e o cachê de quem foi escalado.
 *
 * O cachê aparece sozinho a partir da escala do evento. "Paguei" abre a saída
 * já preenchida com a pessoa e o evento, e é essa ligação que tira o cachê
 * da lista.
 */
export default function APagarTela({ dados, acoes }: { dados: DadosDoCaixa; acoes: AcoesDoCaixa }) {
  const hoje = hojeIso();
  const itens = aPagar(dados.lancamentos, dados.escalas, dados.membros, dados.orcamentos, hoje, inicioDoControle(dados.contas, hoje));
  const vencidos = itens.filter((p) => p.atrasado);
  const aVencer = itens.filter((p) => !p.atrasado);
  const categoriaDeEquipe = dados.categorias.find((c) => c.grupo === 'equipe' && c.tipo === 'saida')?.id ?? null;
  const primeiraConta = dados.contas.find((c) => c.ativo)?.id ?? null;

  const pagar = (p: APagar) => {
    if (p.origem === 'lancamento') {
      acoes.abrir({ ...p.lancamento, pagoEm: hoje, contaId: p.lancamento.contaId ?? primeiraConta });
      return;
    }
    acoes.novo('saida', {
      valor: p.valor,
      eventoId: p.evento.id,
      membroId: p.escala.membroId,
      pessoa: p.membro?.nome.trim() ?? '',
      categoriaId: categoriaDeEquipe,
      descricao: `Cachê ${p.membro?.nome.trim() ?? ''}, ${p.evento.cliente}`,
    });
  };

  const total = (ps: APagar[]) => real(ps.reduce((s, p) => s + p.valor, 0));

  const lista = (ps: APagar[]) => (
    <div className="mt-3 space-y-2">
      {ps.map((p) => {
        const chave = p.origem === 'cache' ? `c-${p.escala.id}` : p.lancamento.id;
        const titulo =
          p.origem === 'cache'
            ? `Cachê ${p.membro?.nome.trim() ?? 'de alguém da equipe'}`
            : p.lancamento.descricao || 'Sem descrição';
        const detalhe =
          p.origem === 'cache'
            ? `${p.escala.funcao || 'equipe'} · evento ${p.evento.cliente || 'sem nome'}`
            : [
                dados.categorias.find((c) => c.id === p.lancamento.categoriaId)?.nome,
                p.lancamento.pessoa,
                dados.orcamentos.find((o) => o.id === p.lancamento.eventoId)?.cliente,
              ]
                .filter(Boolean)
                .join(' · ');
        return (
          <div key={chave} className={`cartao flex items-center gap-3 p-3 ${p.atrasado ? 'border-l-4 border-l-brasa' : ''}`}>
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => (p.origem === 'lancamento' ? acoes.abrir(p.lancamento) : pagar(p))}
            >
              <span className="block truncate font-semibold">{titulo}</span>
              <span className="block truncate text-sm text-fumaca">
                <span className={p.atrasado ? 'text-brasa-clara' : ''}>
                  {p.atrasado ? '⚠ venceu' : 'vence'} {dataCurta(p.vencimento)}
                </span>
                {detalhe && ` · ${detalhe}`}
              </span>
            </button>
            <span className="shrink-0 font-semibold">{real(p.valor)}</span>
            <button type="button" className="botao botao-linha !min-h-9 !px-3 text-sm" onClick={() => pagar(p)}>
              Paguei
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fumaca">
          Conta fixa, fornecedor, imposto: lance como saída sem marcar "já pago". Para repetir todo mês, use "Repetir
          todo mês" no lançamento.
        </p>
        <button type="button" className="botao botao-linha" onClick={() => acoes.novo('saida', { pagoEm: '' })}>
          + Conta a pagar
        </button>
      </div>

      <section>
        <h2 className="flex flex-wrap items-baseline gap-2">
          <span className="titulo text-lg text-brasa-clara">Vencidos</span>
          <span className="text-sm text-fumaca">
            {inteiro(vencidos.length)} · {total(vencidos)}
          </span>
        </h2>
        {vencidos.length ? lista(vencidos) : <p className="mt-2 text-sm text-fumaca">Nada vencido.</p>}
      </section>

      <section>
        <h2 className="flex flex-wrap items-baseline gap-2">
          <span className="titulo text-lg text-dourado">A vencer</span>
          <span className="text-sm text-fumaca">
            {inteiro(aVencer.length)} · {total(aVencer)}
          </span>
        </h2>
        {aVencer.length ? lista(aVencer) : <p className="mt-2 text-sm text-fumaca">Nada a vencer.</p>}
      </section>
    </div>
  );
}
