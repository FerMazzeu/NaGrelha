/**
 * Efeito de digitação, igual ao do lid-ia.
 *
 * O servidor manda a resposta em pedaços irregulares: às vezes três palavras
 * de uma vez, às vezes uma frase inteira, às vezes nada por um segundo. Jogar
 * cada pedaço direto na tela dá um texto que aparece aos solavancos.
 *
 * Então a tela não mostra o que chegou, mostra o que já foi "digitado", e
 * corre atrás do que chegou a cada 16 ms. O passo é proporcional ao atraso, um
 * nono do que falta, então ela acelera quando fica para trás e desacelera ao
 * alcançar. Uma velocidade fixa faria o contrário: travaria em resposta longa
 * e ficaria lenta demais em resposta curta.
 *
 * O `Math.max(1, ...)` é o que garante que ela sempre termina: um nono de oito
 * caracteres arredonda para 1, mas um nono de 1 arredondaria para 0 e o último
 * caractere nunca apareceria.
 */
const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

export function digitar(
  mostrar: (texto: string) => void,
  lerAlvo: () => string,
  acabou: () => boolean,
  passo = 16,
) {
  return (async () => {
    let mostrado = 0;
    while (true) {
      const texto = lerAlvo();
      if (mostrado < texto.length) {
        mostrado = Math.min(texto.length, mostrado + Math.max(1, Math.ceil((texto.length - mostrado) / 9)));
        mostrar(texto.slice(0, mostrado));
        await espera(passo);
      } else if (acabou()) {
        return;
      } else {
        // Nada novo ainda, e o fluxo não acabou. Espera um pouco mais que o
        // passo normal, para não girar à toa enquanto o modelo pensa.
        await espera(passo * 1.5);
      }
    }
  })();
}
