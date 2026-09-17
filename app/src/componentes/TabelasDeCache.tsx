import { useState } from 'react';
import { ROTULO_TIPO_EVENTO, type FaixaDeCache, type Servico, type TipoDeEvento } from '../dominio/tipos';
import { inteiro, real } from '../formato';
import { Campo, CampoNumero } from './Campos';
import { Fechar } from './Icones';

const TIPOS: TipoDeEvento[] = ['aniversario', 'casamento'];

/**
 * As tabelas de cachê do Alan e da Érica.
 *
 * Existe porque o preço deles muda, e mudou: a tabela nasceu com quatro faixas
 * indo até "81 acima" e virou nove faixas indo até 300 convidados, separadas
 * por tipo de evento. Sem esta tela, cada reajuste é um pedido para quem
 * escreveu o código, e o orçamento fica dias com o número velho.
 *
 * A ordem das faixas não é escolhida aqui: elas são reordenadas por `min` na
 * gravação, porque o cálculo pega a primeira que cobre o número de convidados
 * e uma tabela fora de ordem daria o valor errado sem reclamar.
 */
export default function TabelasDeCache({
  servicos,
  aoSalvar,
}: {
  servicos: Servico[];
  aoSalvar: (servico: Servico) => Promise<void>;
}) {
  const comTabela = servicos.filter((s) => s.usaFaixa);

  if (!comTabela.length) {
    return (
      <p className="cartao p-4 text-sm text-fumaca">
        Nenhum serviço cobra por faixa de convidados.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-fumaca">
        O cachê muda com o tamanho e com o tipo do evento. Quem escolhe o tipo é o orçamento, e o
        valor entra sozinho, a menos que alguém digite por cima.
      </p>
      {comTabela.map((s) => (
        <Tabela key={s.id} servico={s} aoSalvar={aoSalvar} />
      ))}
    </div>
  );
}

function Tabela({ servico, aoSalvar }: { servico: Servico; aoSalvar: (s: Servico) => Promise<void> }) {
  const [tipo, setTipo] = useState<TipoDeEvento>('aniversario');
  const [salvando, setSalvando] = useState(false);

  // Uma faixa sem tipo vale para os dois, então aparece nas duas abas.
  const daAba = servico.faixas
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.tipo === tipo || f.tipo === null)
    .sort((a, b) => a.f.min - b.f.min);

  const gravar = async (faixas: FaixaDeCache[]) => {
    setSalvando(true);
    try {
      await aoSalvar({ ...servico, faixas: [...faixas].sort((a, b) => a.min - b.min) });
    } finally {
      setSalvando(false);
    }
  };

  const mudarFaixa = (indice: number, parcial: Partial<FaixaDeCache>) =>
    gravar(servico.faixas.map((f, i) => (i === indice ? { ...f, ...parcial } : f)));

  const remover = (indice: number) => gravar(servico.faixas.filter((_, i) => i !== indice));

  const acrescentar = () => {
    // Começa onde a última terminou: é quase sempre o que se quer, e evita
    // buraco entre faixas, que faria o cachê cair no valor padrão.
    const ultima = daAba.at(-1)?.f;
    const min = ultima?.max ? ultima.max + 1 : (ultima?.min ?? 0) + 1;
    return gravar([...servico.faixas, { min, max: min + 29, valor: ultima?.valor ?? servico.valorPadrao, tipo }]);
  };

  const buracos = acharBuracos(daAba.map(({ f }) => f));

  return (
    <div className="cartao p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{servico.nome}</p>
          <p className="text-xs text-fumaca">Fora de qualquer faixa, cobra {real(servico.valorPadrao)}</p>
        </div>
        <div className="flex gap-1 rounded-full border border-borda p-1">
          {TIPOS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tipo === t}
              onClick={() => setTipo(t)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                tipo === t ? 'bg-dourado text-carvao' : 'text-fumaca hover:text-creme'
              }`}
            >
              {ROTULO_TIPO_EVENTO[t]}
            </button>
          ))}
        </div>
      </div>

      {buracos.length > 0 && (
        <p className="mt-3 rounded-xl border border-brasa/50 bg-brasa/10 p-3 text-sm text-brasa-clara">
          Falta faixa para {buracos.join(', ')} convidados. Nesse intervalo o orçamento usa{' '}
          {real(servico.valorPadrao)}, que não é o da tabela.
        </p>
      )}

      <div className="mt-3 space-y-2">
        {daAba.map(({ f, i }) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1.2fr_auto] items-end gap-2">
            <Campo rotulo="De">
              <CampoNumero
                valor={f.min}
                aoMudar={(v) => mudarFaixa(i, { min: v })}
                sufixo="pes."
                aria-label={`Início da faixa de ${servico.nome}`}
              />
            </Campo>
            <Campo rotulo="Até">
              <CampoNumero
                valor={f.max ?? 0}
                aoMudar={(v) => mudarFaixa(i, { max: v > 0 ? v : null })}
                sufixo="pes."
                aria-label={`Fim da faixa de ${servico.nome}`}
              />
            </Campo>
            <Campo rotulo="Cachê">
              <CampoNumero
                valor={f.valor}
                aoMudar={(v) => mudarFaixa(i, { valor: v })}
                sufixo="R$"
                aria-label={`Cachê da faixa de ${servico.nome}`}
              />
            </Campo>
            <button
              type="button"
              onClick={() => remover(i)}
              aria-label={`Tirar a faixa de ${inteiro(f.min)} convidados`}
              className="botao botao-linha !min-h-11 !w-11 shrink-0 !px-0 !text-fumaca"
            >
              <Fechar className="h-4 w-4" />
            </button>
          </div>
        ))}

        {!daAba.length && (
          <p className="text-sm text-fumaca">
            Sem tabela para {ROTULO_TIPO_EVENTO[tipo].toLowerCase()}. Todo evento desse tipo vai
            cobrar {real(servico.valorPadrao)}.
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button type="button" className="botao botao-linha !min-h-10 text-sm" onClick={acrescentar}>
          Nova faixa
        </button>
        <span className="text-xs text-fumaca">{salvando ? 'salvando...' : 'salva sozinho'}</span>
      </div>
    </div>
  );
}

/**
 * Intervalos de convidados que nenhuma faixa cobre.
 *
 * Buraco de tabela não dá erro: o cálculo simplesmente cai no valor padrão, e
 * o orçamento sai com um cachê que ninguém combinou. Mostrar aqui é o que
 * transforma isso num problema visível.
 */
function acharBuracos(faixas: FaixaDeCache[]) {
  const ordenadas = [...faixas].sort((a, b) => a.min - b.min);
  const buracos: string[] = [];

  for (let i = 0; i < ordenadas.length - 1; i++) {
    const fim = ordenadas[i].max;
    if (fim === null) break; // faixa sem teto engole o resto
    const proximo = ordenadas[i + 1].min;
    if (proximo > fim + 1) buracos.push(fim + 1 === proximo - 1 ? `${fim + 1}` : `${fim + 1} a ${proximo - 1}`);
  }

  const ultima = ordenadas.at(-1);
  if (ultima && ultima.max !== null) buracos.push(`acima de ${ultima.max}`);

  return buracos;
}
