import type { ReactNode } from 'react';

/**
 * Renderizador de markdown mínimo.
 *
 * Cobre o que o modelo realmente usa numa resposta de chat: título, lista,
 * negrito, itálico, código e tabela simples. Não é um parser completo, e não
 * precisa ser: trazer uma biblioteca de markdown para isto custaria mais
 * bundle do que o app inteiro tem hoje.
 *
 * O texto nunca vira HTML: cada pedaço vira elemento React, então não existe
 * caminho de injeção pelo que o modelo escreve.
 */
export function Texto({ markdown }: { markdown: string }) {
  const blocos: ReactNode[] = [];
  const linhas = markdown.split('\n');
  let i = 0;
  let chave = 0;

  while (i < linhas.length) {
    const linha = linhas[i];

    // bloco de código
    if (linha.trimStart().startsWith('```')) {
      const corpo: string[] = [];
      i++;
      while (i < linhas.length && !linhas[i].trimStart().startsWith('```')) {
        corpo.push(linhas[i]);
        i++;
      }
      i++;
      blocos.push(
        <pre key={chave++} className="overflow-x-auto rounded-xl bg-carvao-3 p-3 text-sm">
          <code>{corpo.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // título
    const titulo = /^(#{1,4})\s+(.*)$/.exec(linha);
    if (titulo) {
      const nivel = titulo[1].length;
      blocos.push(
        <p
          key={chave++}
          className={`titulo mt-3 text-dourado ${nivel <= 2 ? 'text-lg' : 'text-base'}`}
        >
          {embutido(titulo[2])}
        </p>,
      );
      i++;
      continue;
    }

    // tabela: linha com | seguida de linha de tracos
    if (linha.includes('|') && /^\s*\|?[\s:-]*\|[\s:|-]*$/.test(linhas[i + 1] ?? '')) {
      const cabecalho = celulas(linha);
      i += 2;
      const corpo: string[][] = [];
      while (i < linhas.length && linhas[i].includes('|')) {
        corpo.push(celulas(linhas[i]));
        i++;
      }
      blocos.push(
        <div key={chave++} className="overflow-x-auto">
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr>
                {cabecalho.map((c, n) => (
                  <th key={n} className="border-b border-borda py-1.5 pr-3 text-left text-fumaca">
                    {embutido(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corpo.map((linhaDaTabela, n) => (
                <tr key={n}>
                  {linhaDaTabela.map((c, m) => (
                    <td key={m} className="border-b border-borda/40 py-1.5 pr-3">
                      {embutido(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // lista
    if (/^\s*([-*+]|\d+\.)\s+/.test(linha)) {
      const itens: string[] = [];
      const numerada = /^\s*\d+\./.test(linha);
      while (i < linhas.length && /^\s*([-*+]|\d+\.)\s+/.test(linhas[i])) {
        itens.push(linhas[i].replace(/^\s*([-*+]|\d+\.)\s+/, ''));
        i++;
      }
      const Lista = numerada ? 'ol' : 'ul';
      blocos.push(
        <Lista
          key={chave++}
          className={`mt-2 space-y-1 pl-5 ${numerada ? 'list-decimal' : 'list-disc'} marker:text-fumaca`}
        >
          {itens.map((t, n) => (
            <li key={n}>{embutido(t)}</li>
          ))}
        </Lista>,
      );
      continue;
    }

    if (!linha.trim()) {
      i++;
      continue;
    }

    // parágrafo: junta linhas seguidas
    const paragrafo: string[] = [];
    while (
      i < linhas.length &&
      linhas[i].trim() &&
      !/^\s*([-*+]|\d+\.)\s+/.test(linhas[i]) &&
      !/^#{1,4}\s/.test(linhas[i]) &&
      !linhas[i].trimStart().startsWith('```')
    ) {
      paragrafo.push(linhas[i]);
      i++;
    }
    blocos.push(
      <p key={chave++} className="mt-2 leading-relaxed first:mt-0">
        {embutido(paragrafo.join(' '))}
      </p>,
    );
  }

  return <div className="text-[0.95rem]">{blocos}</div>;
}

const celulas = (linha: string) =>
  linha
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim());

/** Negrito, itálico e código dentro de uma linha. */
function embutido(texto: string): ReactNode[] {
  const partes: ReactNode[] = [];
  const padrao = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g;
  let ultimo = 0;
  let chave = 0;
  let achado: RegExpExecArray | null;

  while ((achado = padrao.exec(texto)) !== null) {
    if (achado.index > ultimo) partes.push(texto.slice(ultimo, achado.index));
    const bruto = achado[0];

    if (bruto.startsWith('**') || bruto.startsWith('__')) {
      partes.push(
        <strong key={chave++} className="font-semibold text-creme">
          {bruto.slice(2, -2)}
        </strong>,
      );
    } else if (bruto.startsWith('`')) {
      partes.push(
        <code key={chave++} className="rounded bg-carvao-3 px-1 py-0.5 text-[0.85em]">
          {bruto.slice(1, -1)}
        </code>,
      );
    } else {
      partes.push(<em key={chave++}>{bruto.slice(1, -1)}</em>);
    }

    ultimo = achado.index + bruto.length;
  }

  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}
