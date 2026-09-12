import { useEffect, useState, type ReactNode } from 'react';

export function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="rotulo mb-1.5">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-fumaca">{dica}</span>}
    </label>
  );
}

export function CampoTexto({
  valor,
  aoMudar,
  ...resto
}: {
  valor: string;
  aoMudar: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return <input className="campo" value={valor} onChange={(e) => aoMudar(e.target.value)} {...resto} />;
}

/**
 * Campo numérico que dá para editar.
 *
 * O buffer de texto existe porque campo numérico controlado direto pelo número
 * é intragável: apagar tudo vira 0 na hora, "1," some antes de virar "1,5" e o
 * cursor pula. Aqui o texto é livre enquanto se digita e só o valor
 * interpretado sobe; quando o valor muda por fora, o texto é ressincronizado.
 */
export function CampoNumero({
  valor,
  aoMudar,
  sufixo,
  minimo = 0,
  ...resto
}: {
  valor: number;
  aoMudar: (v: number) => void;
  sufixo?: string;
  minimo?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [texto, setTexto] = useState(() => paraTexto(valor));

  useEffect(() => {
    if (interpretar(texto) !== valor) setTexto(paraTexto(valor));
    // só quando o valor externo muda, não a cada tecla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return (
    <div className="relative">
      <input
        className={`campo ${sufixo ? 'pr-12' : ''}`}
        inputMode="decimal"
        value={texto}
        onChange={(e) => {
          const bruto = e.target.value.replace(/[^\d.,]/g, '');
          setTexto(bruto);
          const n = interpretar(bruto);
          if (n !== null) aoMudar(Math.max(minimo, n));
        }}
        onBlur={() => {
          const n = interpretar(texto);
          const final = n === null ? minimo : Math.max(minimo, n);
          aoMudar(final);
          setTexto(paraTexto(final));
        }}
        {...resto}
      />
      {sufixo && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-fumaca">
          {sufixo}
        </span>
      )}
    </div>
  );
}

function interpretar(texto: string): number | null {
  if (texto.trim() === '') return null;
  const n = Number(texto.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function paraTexto(valor: number) {
  if (!Number.isFinite(valor)) return '';
  return String(valor).replace('.', ',');
}

export function Segmentado<T extends string>({
  valor,
  opcoes,
  aoMudar,
}: {
  valor: T;
  opcoes: { valor: T; rotulo: string }[];
  aoMudar: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl border border-borda bg-carvao-3 p-1">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => aoMudar(o.valor)}
          aria-pressed={valor === o.valor}
          className={`flex-1 rounded-lg px-2 py-2.5 text-sm font-semibold transition-colors ${
            valor === o.valor ? 'bg-brasa text-creme' : 'text-fumaca hover:text-creme'
          }`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Botão de copiar que confirma na própria etiqueta. */
export function BotaoCopiar({ texto, rotulo = 'Copiar' }: { texto: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(t);
  }, [copiado]);

  return (
    <button
      type="button"
      className={`botao ${copiado ? 'botao-linha !border-verde !text-verde' : 'botao-linha'}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
        } catch {
          // navegador sem permissão de área de transferência: o texto continua
          // na tela para seleção manual, então não vale quebrar nada aqui
          setCopiado(false);
        }
      }}
    >
      {copiado ? 'Copiado' : rotulo}
    </button>
  );
}
