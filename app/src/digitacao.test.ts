import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { digitar } from './digitacao';

describe('efeito de digitação', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('revela o texto aos poucos, e não de uma vez', async () => {
    let alvo = 'O churrasco sai no ponto do primeiro ao ultimo convidado.';
    const quadros: string[] = [];

    const fim = digitar(
      (t) => quadros.push(t),
      () => alvo,
      () => true,
    );
    await vi.advanceTimersByTimeAsync(2000);
    await fim;

    expect(quadros.length).toBeGreaterThan(5);
    expect(quadros[0].length).toBeLessThan(alvo.length);
    expect(quadros.at(-1)).toBe(alvo);

    // Cada quadro mostra mais que o anterior, e nunca volta atrás.
    for (let i = 1; i < quadros.length; i++) {
      expect(quadros[i].length).toBeGreaterThan(quadros[i - 1].length);
      expect(quadros[i].startsWith(quadros[i - 1])).toBe(true);
    }

    alvo = '';
  });

  it('alcança o texto inteiro, incluindo o último caractere', async () => {
    // Um nono de 1 arredondaria para 0, e o fim nunca apareceria. É o motivo
    // do passo mínimo de um caractere.
    const alvo = 'ok';
    let visto = '';

    const fim = digitar(
      (t) => (visto = t),
      () => alvo,
      () => true,
    );
    await vi.advanceTimersByTimeAsync(1000);
    await fim;

    expect(visto).toBe('ok');
  });

  it('continua enquanto o texto cresce, e para quando o fluxo acaba', async () => {
    let alvo = 'Vou ';
    let acabou = false;
    let visto = '';

    const fim = digitar(
      (t) => (visto = t),
      () => alvo,
      () => acabou,
    );

    await vi.advanceTimersByTimeAsync(200);
    expect(visto).toBe('Vou ');

    // Chega mais texto do servidor.
    alvo = 'Vou calcular a picanha para 80 pessoas.';
    await vi.advanceTimersByTimeAsync(600);
    expect(visto).toBe(alvo);

    acabou = true;
    await vi.advanceTimersByTimeAsync(100);
    await fim;
  });

  it('não gira à toa enquanto o modelo pensa', async () => {
    let acabou = false;
    let chamadas = 0;

    const fim = digitar(
      () => {},
      () => {
        chamadas++;
        return '';
      },
      () => acabou,
    );

    await vi.advanceTimersByTimeAsync(1000);
    // Com passo de 16 ms e espera de 24 ms sem texto, mil milissegundos dão
    // algumas dezenas de voltas, e não milhares.
    expect(chamadas).toBeLessThan(80);

    acabou = true;
    await vi.advanceTimersByTimeAsync(50);
    await fim;
  });

  it('resposta longa não demora proporcionalmente mais', async () => {
    const longo = 'a'.repeat(900);
    let quadros = 0;

    const fim = digitar(
      () => quadros++,
      () => longo,
      () => true,
    );
    await vi.advanceTimersByTimeAsync(10000);
    await fim;

    /*
      O que importa é o tempo até a resposta estar toda na tela.

      Um caractere por quadro faria 900 quadros, quase 15 segundos de espera
      olhando o texto rastejar. Como o passo é um nono do que falta, dá 44
      quadros, perto de sete décimos de segundo. É essa a diferença entre o
      efeito parecer fluido e parecer travado.
    */
    expect(quadros).toBeLessThan(80);
    expect(quadros * 16).toBeLessThan(1500);
  });
});
