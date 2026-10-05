import { useState } from 'react';
import { calcular, totalDeConvidados } from '../dominio/calculo';
import { separarPorSituacao } from '../dominio/situacao';
import { COR_SITUACAO, ROTULO_SITUACAO, type Orcamento, type Situacao } from '../dominio/tipos';
import { dataCurta, inteiro, real } from '../formato';
import { BotaoCopiar } from './Campos';

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
  const [mostrarLink, setMostrarLink] = useState(false);

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
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="botao botao-linha"
            aria-expanded={mostrarLink}
            onClick={() => setMostrarLink((v) => !v)}
          >
            Link para o cliente
          </button>
          <button type="button" className="botao botao-brasa" onClick={aoCriar}>
            Novo orçamento
          </button>
        </div>
      </div>

      {mostrarLink && <LinkDoCardapio />}

      {orcamentos.length === 0 ? (
        <div className="cartao mt-6 p-6 text-sm text-fumaca">
          <p className="font-semibold text-creme">Comece por um evento.</p>
          <p className="mt-2">
            Você informa quantos convidados e quais cortes entram. O app calcula quanto comprar de cada coisa, já
            corrigido pelo osso e pela perda na brasa, e fecha o preço.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {separarPorSituacao(orcamentos).map((bloco) => {
            /*
              Duas colunas no notebook, uma no celular.

              `xl` e não `lg`: em 1024 o cartão partido ao meio já corta o nome
              do cliente, que é justamente o que se procura na lista.
            */
            const cartoes = (
              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                {bloco.orcamentos.map((o) => (
                  <Cartao key={o.id} orcamento={o} aoAbrir={aoAbrir} aoDuplicar={aoDuplicar} aoRemover={aoRemover} />
                ))}
              </div>
            );

            const cabecalho = (
              <>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${PONTO[bloco.situacao]}`} />
                <span className={`titulo text-lg ${TITULO[bloco.situacao]}`}>{bloco.titulo}</span>
                <span className="text-sm text-fumaca">{inteiro(bloco.orcamentos.length)}</span>
                {bloco.dica && <span className="hidden text-sm text-fumaca sm:inline">· {bloco.dica}</span>}
              </>
            );

            // Realizado e perdido são consulta: ficam fechados, para não
            // empurrar os eventos da semana para fora da tela.
            return bloco.historico ? (
              <details key={bloco.situacao} className="group">
                <summary className="flex cursor-pointer items-center gap-2">
                  {cabecalho}
                  <span className="text-fumaca transition-transform group-open:rotate-90">›</span>
                </summary>
                {cartoes}
              </details>
            ) : (
              <section key={bloco.situacao}>
                <h2 className="flex items-center gap-2">{cabecalho}</h2>
                {cartoes}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * O link que a equipe manda para o cliente montar o próprio pedido.
 *
 * O mesmo link serve para todo mundo: quem abre diz quem é no formulário. Um
 * link por cliente exigiria cadastrar o cliente antes de mandar, que é
 * justamente a digitação que isto existe para evitar.
 */
function LinkDoCardapio() {
  const endereco = `${window.location.origin}/?pedido`;
  const recado = `Oi! Para montar o orçamento do seu churrasco, é só abrir este link, contar sobre a festa e marcar o que você quer: ${endereco}`;

  return (
    <div className="cartao mt-4 p-4">
      <p className="text-sm text-fumaca">
        O cliente abre, preenche os dados da festa e marca o cardápio. O pedido aparece aqui em{' '}
        <strong className="text-dourado">Para validar</strong>, já montado, e você confere o preço antes de mandar.
      </p>
      <p className="campo mt-3 flex items-center select-all truncate text-sm">{endereco}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <BotaoCopiar texto={endereco} rotulo="Copiar link" />
        <a
          className="botao botao-linha"
          href={`https://wa.me/?text=${encodeURIComponent(recado)}`}
          target="_blank"
          rel="noreferrer"
        >
          Mandar no WhatsApp
        </a>
      </div>
    </div>
  );
}

const PONTO: Record<Situacao, string> = {
  rascunho: 'bg-dourado',
  orcado: 'bg-fumaca/60',
  confirmado: 'bg-verde',
  realizado: 'bg-creme/40',
  perdido: 'bg-brasa',
};

const TITULO: Record<Situacao, string> = {
  rascunho: 'text-dourado',
  orcado: 'text-creme',
  confirmado: 'text-verde',
  realizado: 'text-creme/70',
  perdido: 'text-creme/70',
};

/** Faixa na borda esquerda do cartão: dá para ver a situação sem ler. */
const FAIXA: Record<Situacao, string> = {
  rascunho: 'border-l-4 border-l-dourado',
  orcado: '',
  confirmado: 'border-l-4 border-l-verde',
  realizado: '',
  perdido: 'opacity-70',
};

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
  const hoje = new Date().toISOString().slice(0, 10);
  const jaPassou =
    !!orcamento.data &&
    orcamento.data < hoje &&
    ['rascunho', 'orcado', 'confirmado'].includes(orcamento.situacao);

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
    /*
      Destaque ao passar o mouse, porque o cartão inteiro abre a edição e
      nada na tela dizia isso.

      O destaque acende só sobre a área que abre (`has-[.abrir:hover]`), e
      não sobre o cartão todo: com o cartão inteiro aceso, passar o mouse em
      "Excluir" também diria "clique para editar".

      Anel em vez de borda: a borda esquerda já carrega a cor da situação, e
      trocar a cor dela no hover apagaria o verde do confirmado.
    */
    <div
      className={`cartao flex items-center gap-2 p-4 transition duration-150 has-[.abrir:hover]:shadow-lg has-[.abrir:hover]:shadow-black/40 has-[.abrir:hover]:ring-1 has-[.abrir:hover]:ring-dourado/60 has-[.abrir:focus-visible]:ring-1 has-[.abrir:focus-visible]:ring-dourado/60 motion-safe:has-[.abrir:hover]:-translate-y-0.5 ${FAIXA[orcamento.situacao]}`}
    >
      <button
        type="button"
        onClick={() => aoAbrir(orcamento.id)}
        className="abrir group/abrir min-w-0 flex-1 cursor-pointer text-left focus-visible:outline-none"
      >
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{orcamento.cliente || 'Sem nome'}</p>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold ${COR_SITUACAO[orcamento.situacao]}`}
          >
            {ROTULO_SITUACAO[orcamento.situacao]}
          </span>
        </div>
        <p className="mt-0.5 truncate text-sm text-fumaca">
          {dataCurta(orcamento.data)}
          {/* Orçado com data no passado é erro de digitação ou evento que
              aconteceu e ninguém marcou. Os dois pedem um toque, e a ordem
              por data joga ele para o topo do bloco, então ele precisa dizer
              por quê. */}
          {jaPassou && <span className="font-semibold text-brasa-clara"> · data já passou</span>}
          {' · '}
          {inteiro(totalDeConvidados(orcamento))} convidados
          {orcamento.local ? ` · ${orcamento.local}` : ''}
        </p>
        <p className="mt-1.5 flex items-baseline gap-3">
          <span className="font-display text-xl uppercase text-dourado">{real(r.preco)}</span>
          {/* Aparece junto com o destaque e diz em palavras o que o clique faz.
              No celular não tem mouse em cima: lá o toque já é a pergunta. */}
          <span className="text-xs font-semibold text-dourado opacity-0 transition-opacity duration-150 group-hover/abrir:opacity-100 group-focus-visible/abrir:opacity-100">
            Abrir para editar ›
          </span>
        </p>
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
