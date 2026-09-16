import { useState } from 'react';
import type { Conversa } from '../dominio/tipos';
import { Fechar, Recomecar } from './Icones';

/**
 * Histórico de conversas.
 *
 * Coluna fixa à esquerda no desktop, gaveta no celular. É a mesma lista nos
 * dois, e não dois componentes: duas cópias da lista divergem no primeiro
 * ajuste que alguém faz correndo.
 */
export default function HistoricoDeConversas({
  conversas,
  abertaId,
  aoAbrir,
  aoNova,
  aoRenomear,
  aoRemover,
  aoFechar,
}: {
  conversas: Conversa[];
  abertaId: string | null;
  aoAbrir: (id: string) => void;
  aoNova: () => void;
  aoRenomear: (id: string, titulo: string) => Promise<void>;
  aoRemover: (id: string) => Promise<void>;
  /** Só existe na gaveta do celular. */
  aoFechar?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-borda p-3">
        <button type="button" className="botao botao-brasa !min-h-10 flex-1 text-sm" onClick={aoNova}>
          <Recomecar className="h-4 w-4" />
          Nova conversa
        </button>
        {aoFechar && (
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar histórico"
            className="botao botao-linha !min-h-10 !w-10 shrink-0 !px-0 lg:hidden"
          >
            <Fechar className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!conversas.length && (
          <p className="p-3 text-sm text-fumaca">
            Nenhuma conversa ainda. A primeira mensagem cria uma.
          </p>
        )}

        {conversas.map((c) => (
          <Linha
            key={c.id}
            conversa={c}
            ativa={c.id === abertaId}
            aoAbrir={aoAbrir}
            aoRenomear={aoRenomear}
            aoRemover={aoRemover}
          />
        ))}
      </div>
    </div>
  );
}

function Linha({
  conversa,
  ativa,
  aoAbrir,
  aoRenomear,
  aoRemover,
}: {
  conversa: Conversa;
  ativa: boolean;
  aoAbrir: (id: string) => void;
  aoRenomear: (id: string, titulo: string) => Promise<void>;
  aoRemover: (id: string) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(conversa.titulo);
  const [confirmando, setConfirmando] = useState(false);

  if (editando) {
    return (
      <div className="rounded-xl bg-carvao-3 p-2">
        <input
          className="campo !min-h-9 text-sm"
          value={rascunho}
          autoFocus
          onChange={(e) => setRascunho(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter') {
              await aoRenomear(conversa.id, rascunho.trim() || conversa.titulo);
              setEditando(false);
            }
            if (e.key === 'Escape') {
              setRascunho(conversa.titulo);
              setEditando(false);
            }
          }}
          onBlur={() => setEditando(false)}
          aria-label="Nome da conversa"
        />
        <p className="mt-1 px-1 text-[0.65rem] text-fumaca">Enter salva, Esc cancela</p>
      </div>
    );
  }

  if (confirmando) {
    return (
      <div className="rounded-xl border border-brasa/40 bg-brasa/8 p-3">
        <p className="text-sm">Apagar esta conversa?</p>
        <p className="mt-1 text-xs text-fumaca">As mensagens vão junto.</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="botao botao-brasa !min-h-9 flex-1 text-sm"
            onClick={() => aoRemover(conversa.id)}
          >
            Apagar
          </button>
          <button
            type="button"
            className="botao botao-linha !min-h-9 flex-1 text-sm"
            onClick={() => setConfirmando(false)}
          >
            Não
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center gap-1 rounded-xl transition-colors ${
        ativa ? 'bg-carvao-3' : 'hover:bg-carvao-3/60'
      }`}
    >
      <button
        type="button"
        onClick={() => aoAbrir(conversa.id)}
        className="min-w-0 flex-1 px-3 py-2.5 text-left"
      >
        <p className={`truncate text-sm ${ativa ? 'font-semibold text-dourado' : 'text-creme'}`}>
          {conversa.titulo}
        </p>
        <p className="truncate text-[0.65rem] text-fumaca">{quando(conversa.atualizadoEm)}</p>
      </button>

      <div className="flex shrink-0 pr-1">
        <button
          type="button"
          aria-label="Renomear"
          title="Renomear"
          className="rounded-lg px-2 py-1 text-xs text-fumaca hover:text-creme"
          onClick={() => {
            setRascunho(conversa.titulo);
            setEditando(true);
          }}
        >
          ✎
        </button>
        <button
          type="button"
          aria-label="Apagar conversa"
          title="Apagar"
          className="rounded-lg px-2 py-1 text-xs text-fumaca hover:text-brasa-clara"
          onClick={() => setConfirmando(true)}
        >
          ×
        </button>
      </div>
    </div>
  );
}

/** "agora", "14:30", "ontem", ou a data. O suficiente para reconhecer. */
function quando(iso: string) {
  if (!iso) return '';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';

  const agora = new Date();
  const minutos = (agora.getTime() - data.getTime()) / 60000;
  if (minutos < 2) return 'agora';
  if (minutos < 60) return `há ${Math.round(minutos)} min`;

  const hoje = agora.toDateString() === data.toDateString();
  if (hoje) return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  if (ontem.toDateString() === data.toDateString()) return 'ontem';

  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
