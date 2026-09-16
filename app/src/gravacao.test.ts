import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarFila } from './gravacao';

type Doc = { id: string; texto: string };

/**
 * Um "banco" que reproduz o jeito como o orçamento é gravado: apaga as linhas
 * do documento e escreve as novas. É esse apaga-e-reescreve que duplicava o
 * cardápio quando duas gravações corriam juntas.
 *
 * O `await` entre apagar e escrever é o buraco por onde a outra gravação
 * entrava. Ele fica aqui de propósito: sem ele o teste não prova nada.
 */
function bancoFalso() {
  const linhas: string[] = [];
  const espera = () => new Promise((ok) => setTimeout(ok, 10));

  return {
    linhas,
    async gravar(doc: Doc) {
      // apaga
      for (let i = linhas.length - 1; i >= 0; i--) {
        if (linhas[i].startsWith(`${doc.id}:`)) linhas.splice(i, 1);
      }
      await espera();
      // reescreve
      linhas.push(`${doc.id}:${doc.texto}`);
    },
  };
}

describe('fila de gravação', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('digitar dez letras grava uma vez só, com a última versão', async () => {
    const gravar = vi.fn(async () => {});
    const fila = criarFila<Doc>(gravar, () => {}, 600);

    for (const letra of 'churrasco') fila.agendar({ id: 'a', texto: letra });

    expect(gravar).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);

    expect(gravar).toHaveBeenCalledTimes(1);
    expect(gravar).toHaveBeenCalledWith({ id: 'a', texto: 'o' });
  });

  /*
    Prova que o banco falso reproduz o bug de verdade.

    Sem isto, o teste seguinte poderia estar passando por acaso, com um banco
    falso incapaz de duplicar seja como for. Aqui as duas gravacoes vao soltas,
    sem fila, e o resultado e a linha em dobro que o cliente viu.
  */
  it('sem fila, duas gravacoes ao mesmo tempo duplicam mesmo', async () => {
    const banco = bancoFalso();

    const juntas = Promise.all([
      banco.gravar({ id: 'ana', texto: 'primeira' }),
      banco.gravar({ id: 'ana', texto: 'segunda' }),
    ]);
    await vi.advanceTimersByTimeAsync(50);
    await juntas;

    expect(banco.linhas).toHaveLength(2);
  });

  it('NÃO duplica quando uma gravação chega no meio da outra', async () => {
    const banco = bancoFalso();
    const fila = criarFila<Doc>(banco.gravar, () => {}, 0);

    fila.agendar({ id: 'ana', texto: 'primeira' });
    await vi.advanceTimersByTimeAsync(0); // a gravação começou e está no `await`
    fila.agendar({ id: 'ana', texto: 'segunda' });
    await vi.advanceTimersByTimeAsync(50);

    // Sem a fila, as duas apagariam antes de qualquer uma escrever, e sobrariam
    // duas linhas. É exatamente o cardápio em dobro que o cliente viu.
    expect(banco.linhas).toEqual(['ana:segunda']);
  });

  it('dois orçamentos abertos não engolem um ao outro', async () => {
    const banco = bancoFalso();
    const fila = criarFila<Doc>(banco.gravar, () => {}, 0);

    fila.agendar({ id: 'ana', texto: 'churrasco' });
    fila.agendar({ id: 'erica', texto: 'aniversário' });
    await vi.advanceTimersByTimeAsync(100);

    expect(banco.linhas.sort()).toEqual(['ana:churrasco', 'erica:aniversário']);
  });

  it('falha de uma gravação não trava a fila', async () => {
    const erros: string[] = [];
    let chamadas = 0;
    const gravar = vi.fn(async () => {
      chamadas++;
      if (chamadas === 1) throw new Error('sem internet');
    });
    const fila = criarFila<Doc>(gravar, (m) => erros.push(m), 0);

    fila.agendar({ id: 'a', texto: 'um' });
    await vi.advanceTimersByTimeAsync(10);
    fila.agendar({ id: 'b', texto: 'dois' });
    await vi.advanceTimersByTimeAsync(10);

    expect(erros).toEqual(['sem internet']);
    expect(gravar).toHaveBeenCalledTimes(2);
  });

  it('sair da tela grava na hora, sem esperar o relógio', async () => {
    const gravar = vi.fn(async () => {});
    const fila = criarFila<Doc>(gravar, () => {}, 60000);

    fila.agendar({ id: 'a', texto: 'quase perdido' });
    await fila.agora();

    expect(gravar).toHaveBeenCalledWith({ id: 'a', texto: 'quase perdido' });
  });

  it('sabe quando ainda tem coisa esperando', async () => {
    const fila = criarFila<Doc>(async () => {}, () => {}, 600);
    expect(fila.temPendente()).toBe(false);

    fila.agendar({ id: 'a', texto: 'x' });
    expect(fila.temPendente()).toBe(true);

    await vi.advanceTimersByTimeAsync(600);
    expect(fila.temPendente()).toBe(false);
  });
});
