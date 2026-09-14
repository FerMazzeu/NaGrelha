import { useState } from 'react';
import { calcular, totalDeConvidados } from '../dominio/calculo';
import { ROTULO_SITUACAO, type Orcamento } from '../dominio/tipos';
import { dataCurta, inteiro, real } from '../formato';

export default function ListaDeOrcamentos({
  orcamentos,
  aoAbrir,
  aoCriar,
  aoDuplicar,
  aoRemover,
}: {
  orcamentos: Orcamento[];
  aoAbrir: (id: string) => void;
  aoCriar: () => void;
  aoDuplicar: (id: string) => void;
  aoRemover: (id: string) => Promise<void>;
}) {
  return (
    <div className="area py-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="titulo text-2xl">Orçamentos</h1>
          <p className="mt-1 text-sm text-fumaca">
            {orcamentos.length === 0
              ? 'Nenhum ainda'
              : `${inteiro(orcamentos.length)} ${orcamentos.length === 1 ? 'orçamento' : 'orçamentos'}`}
          </p>
        </div>
        <button type="button" className="botao botao-brasa" onClick={aoCriar}>
          Novo orçamento
        </button>
      </div>

      {orcamentos.length === 0 ? (
        <div className="cartao mt-6 p-6 text-sm text-fumaca">
          <p className="font-semibold text-creme">Comece por um evento.</p>
          <p className="mt-2">
            Você informa quantos convidados e quais cortes entram. O app calcula quanto comprar de cada coisa, já
            corrigido pelo osso e pela perda na brasa, e fecha o preço.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {orcamentos.map((o) => (
            <Cartao key={o.id} orcamento={o} aoAbrir={aoAbrir} aoDuplicar={aoDuplicar} aoRemover={aoRemover} />
          ))}
        </div>
      )}
    </div>
  );
}

function Cartao({
  orcamento,
  aoAbrir,
  aoDuplicar,
  aoRemover,
}: {
  orcamento: Orcamento;
  aoAbrir: (id: string) => void;
  aoDuplicar: (id: string) => void;
  aoRemover: (id: string) => Promise<void>;
}) {
  // Confirmação no próprio cartão, em dois toques.
  // `window.confirm` some atrás do teclado no celular e trava a página, e
  // excluir orçamento não tem desfazer: leva o evento, os itens e os custos.
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const r = calcular(orcamento);

  if (confirmando) {
    return (
      <div className="cartao border-brasa/50 bg-brasa/8 p-4">
        <p className="text-sm">
          Excluir <strong>{orcamento.cliente || 'este orçamento'}</strong>?
        </p>
        <p className="mt-1 text-xs text-fumaca">Some o evento, os itens e os custos. Não dá para desfazer.</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="botao botao-brasa flex-1"
            disabled={excluindo}
            onClick={async () => {
              setExcluindo(true);
              try {
                await aoRemover(orcamento.id);
              } finally {
                setExcluindo(false);
                setConfirmando(false);
              }
            }}
          >
            {excluindo ? 'Excluindo...' : 'Excluir'}
          </button>
          <button
            type="button"
            className="botao botao-linha flex-1"
            disabled={excluindo}
            onClick={() => setConfirmando(false)}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cartao flex items-center gap-2 p-4">
      <button type="button" onClick={() => aoAbrir(orcamento.id)} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{orcamento.cliente || 'Sem nome'}</p>
          <span className="shrink-0 rounded-full border border-borda px-2 py-0.5 text-[0.65rem] text-fumaca">
            {ROTULO_SITUACAO[orcamento.situacao]}
          </span>
        </div>
        <p className="mt-0.5 truncate text-sm text-fumaca">
          {dataCurta(orcamento.data)} · {inteiro(totalDeConvidados(orcamento))} convidados
          {orcamento.local ? ` · ${orcamento.local}` : ''}
        </p>
        <p className="mt-1.5 font-display text-xl uppercase text-dourado">{real(r.preco)}</p>
      </button>

      <div className="flex shrink-0 flex-col gap-2">
        <button
          type="button"
          onClick={() => aoDuplicar(orcamento.id)}
          className="botao botao-linha !min-h-9 !px-3 text-sm"
          title="Criar um novo a partir deste"
        >
          Duplicar
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="botao botao-linha !min-h-9 !px-3 text-sm !text-fumaca hover:!border-brasa hover:!text-brasa-clara"
          title="Excluir orçamento"
        >
          Excluir
        </button>
      </div>
    </div>
  );
}
