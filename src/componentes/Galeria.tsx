import { useCallback, useEffect, useMemo, useState } from 'react';
import { galeria } from '../conteudo';
import { dimensao, foto, nomesDaGaleria } from '../fotos';
import { AberturaDeSecao, Revelar } from './Base';
import { Fechar, Seta } from './Icones';

/**
 * Distribui as fotos em colunas equilibrando a altura.
 *
 * `columns` do CSS deixava a última coluna terminar muito antes das outras,
 * porque ele não sabe a altura de cada foto antes de montar. Aqui a altura é
 * conhecida (vem do manifesto), então cada foto vai para a coluna mais curta
 * no momento. A conta usa a proporção, não pixels, porque a largura da coluna
 * muda com a tela mas a proporção não.
 */
function distribuir(nomes: string[], quantidade: number) {
  const itens = nomes.map((nome, indice) => {
    const { largura, altura } = dimensao(nome);
    return { nome, indice, proporcao: altura / largura };
  });

  // As mais altas entram primeiro. Distribuir na ordem original deixa as
  // últimas fotos sem espaço para compensar, e uma coluna termina bem antes
  // das outras. Colocando as grandes primeiro, as pequenas acertam o resto.
  const porTamanho = [...itens].sort((a, b) => b.proporcao - a.proporcao);

  const colunas: typeof itens[] = Array.from({ length: quantidade }, () => []);
  const alturas: number[] = new Array(quantidade).fill(0);

  for (const item of porTamanho) {
    const maisCurta = alturas.indexOf(Math.min(...alturas));
    colunas[maisCurta].push(item);
    alturas[maisCurta] += item.proporcao;
  }

  // Dentro da coluna, volta para a ordem original. Sem isso toda coluna fica
  // com as fotos altas em cima e as baixas embaixo, o que vira um degrau.
  return colunas.map((coluna) => coluna.sort((a, b) => a.indice - b.indice));
}

/**
 * Mosaico em colunas, com clique para ampliar.
 *
 * Cada foto aparece na proporção que tem de verdade, sem recorte quadrado:
 * prato alto parece alto, tábua comprida parece comprida, e a grade deixa de
 * ter ritmo de catálogo.
 */
export default function Galeria() {
  const [aberta, setAberta] = useState<number | null>(null);

  // 4 é o padrão também na renderização em Node, onde não existe matchMedia.
  const [quantidadeDeColunas, setQuantidadeDeColunas] = useState(4);

  useEffect(() => {
    const larga = window.matchMedia('(min-width: 1024px)');
    const media = window.matchMedia('(min-width: 768px)');
    const ajustar = () => setQuantidadeDeColunas(larga.matches ? 4 : media.matches ? 3 : 2);

    ajustar();
    larga.addEventListener('change', ajustar);
    media.addEventListener('change', ajustar);
    return () => {
      larga.removeEventListener('change', ajustar);
      media.removeEventListener('change', ajustar);
    };
  }, []);

  const colunas = useMemo(
    () => distribuir(nomesDaGaleria, quantidadeDeColunas),
    [quantidadeDeColunas],
  );

  const fechar = useCallback(() => setAberta(null), []);
  const mover = useCallback((passo: number) => {
    setAberta((atual) => {
      if (atual === null) return atual;
      return (atual + passo + nomesDaGaleria.length) % nomesDaGaleria.length;
    });
  }, []);

  useEffect(() => {
    if (aberta === null) return;

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar();
      if (e.key === 'ArrowRight') mover(1);
      if (e.key === 'ArrowLeft') mover(-1);
    };

    document.addEventListener('keydown', aoTeclar);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = anterior;
    };
  }, [aberta, fechar, mover]);

  return (
    <section id="galeria" className="secao border-t border-borda bg-carvao-2">
      <div className="area">
        <Revelar>
          <AberturaDeSecao selo={galeria.selo} titulo={galeria.titulo} texto={galeria.texto} centrada />
        </Revelar>

        <div className="mt-12 flex items-start gap-3 md:gap-4">
          {colunas.map((coluna, iColuna) => (
            <div key={iColuna} className="flex min-w-0 flex-1 flex-col gap-3 md:gap-4">
              {coluna.map(({ nome, indice }) => {
                const { largura, altura } = dimensao(nome);
                return (
                  <button
                    key={nome}
                    type="button"
                    onClick={() => setAberta(indice)}
                    className="group block w-full overflow-hidden rounded-cartao border border-borda"
                    aria-label={`Ampliar foto ${indice + 1} de ${nomesDaGaleria.length}`}
                  >
                    <img
                      src={foto(nome)}
                      alt={galeria.alternativos[indice] ?? 'Prato servido em um evento do Na Grelha'}
                      width={largura}
                      height={altura}
                      loading="lazy"
                      decoding="async"
                      className="block h-auto w-full transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {aberta !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foto ampliada"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-carvao/95 p-4 backdrop-blur-sm"
          onClick={fechar}
        >
          <img
            src={foto(nomesDaGaleria[aberta])}
            alt={galeria.alternativos[aberta] ?? 'Prato servido em um evento do Na Grelha'}
            width={dimensao(nomesDaGaleria[aberta]).largura}
            height={dimensao(nomesDaGaleria[aberta]).altura}
            className="max-h-[86vh] w-auto max-w-full rounded-cartao object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar"
            className="botao botao-fantasma absolute right-4 top-4 !min-h-11 !w-11 !px-0 bg-carvao/70"
            autoFocus
          >
            <Fechar className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              mover(-1);
            }}
            aria-label="Foto anterior"
            className="botao botao-fantasma absolute left-3 !min-h-12 !w-12 !px-0 bg-carvao/70"
          >
            <Seta className="h-5 w-5 rotate-180" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              mover(1);
            }}
            aria-label="Próxima foto"
            className="botao botao-fantasma absolute right-3 !min-h-12 !w-12 !px-0 bg-carvao/70"
          >
            <Seta className="h-5 w-5" />
          </button>

          <p className="absolute bottom-5 text-sm text-fumaca">
            {aberta + 1} de {nomesDaGaleria.length}
          </p>
        </div>
      )}
    </section>
  );
}
