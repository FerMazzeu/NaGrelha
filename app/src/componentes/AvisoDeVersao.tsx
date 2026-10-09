import { useState } from 'react';

/**
 * "Nova versão disponível · Atualizar", no alto da tela.
 *
 * Pequeno de propósito: não tapa o trabalho e não exige nada na hora. Mas
 * fica até a pessoa atualizar, porque a versão velha é a que lia o cardápio
 * pela metade, e esquecer dela é o problema que isto resolve.
 *
 * Antes de recarregar, espera a fila de gravação esvaziar: a última edição
 * ainda pode estar a caminho do banco, e recarregar no meio dela a perderia.
 */
export default function AvisoDeVersao({ antesDeAtualizar }: { antesDeAtualizar: () => Promise<void> }) {
  const [atualizando, setAtualizando] = useState(false);

  const atualizar = async () => {
    setAtualizando(true);
    try {
      await antesDeAtualizar();
    } finally {
      window.location.reload();
    }
  };

  return (
    /*
      No celular fica embaixo, logo acima das abas: no alto ele cobria o nome
      do app e o e-mail. No computador fica no alto da área de conteúdo, onde
      embaixo está a barra do preço do orçamento.
    */
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--altura-nav)+env(safe-area-inset-bottom,0px)+0.75rem)] z-50 flex justify-center px-4 lg:bottom-auto lg:top-3"
      style={{ paddingLeft: 'var(--largura-menu)' }}
      role="status"
    >
      <div className="aviso-de-versao pointer-events-auto flex items-center gap-3 rounded-full border border-dourado/40 bg-carvao-2/95 py-1.5 pl-4 pr-1.5 text-sm shadow-lg shadow-black/40 backdrop-blur">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-dourado" aria-hidden />
        <span className="text-creme/90">Nova versão disponível</span>
        <button
          type="button"
          onClick={atualizar}
          disabled={atualizando}
          className="rounded-full bg-dourado/15 px-3 py-1 font-semibold text-dourado transition-colors hover:bg-dourado/25 disabled:opacity-60"
        >
          {atualizando ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>
    </div>
  );
}
