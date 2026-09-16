import { useEffect, useMemo } from 'react';

/**
 * Fila de gravação: uma por vez, e só a última versão vale.
 *
 * O editor chama `salvar` a cada tecla digitada, e gravar um orçamento é apagar
 * as linhas de item no banco e reescrever todas. Sem fila, duas gravações se
 * atropelam assim:
 *
 *     A apaga   (0 linhas)
 *     B apaga   (0 linhas)
 *     A escreve (84 linhas)
 *     B escreve (84 linhas)   ->  168 linhas, cardápio em dobro
 *
 * Foi exatamente isso que aconteceu com o evento da ANA em produção, e o
 * cliente viu cada item duas vezes na lista de compras.
 *
 * A fila resolve as duas pontas: espera `atraso` antes de gravar, para uma
 * palavra digitada não virar dez gravações, e nunca deixa duas rodarem juntas.
 * Se chegou mudança enquanto uma estava no ar, a próxima roda em seguida com o
 * valor mais novo, e os intermediários são descartados: eles já estão contidos
 * no último.
 *
 * Fica fora do React de propósito, para poder ser testado com relógio falso.
 */
export function criarFila<T extends { id: string }>(
  gravar: (valor: T) => Promise<void>,
  aoFalhar: (mensagem: string) => void,
  atraso = 600,
) {
  /** Um pendente por id: dois orçamentos abertos não disputam a mesma vaga. */
  const pendentes = new Map<string, T>();
  let emCurso = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function descarregar(): Promise<void> {
    if (emCurso) return;
    emCurso = true;
    try {
      while (pendentes.size) {
        const [id, valor] = pendentes.entries().next().value as [string, T];
        pendentes.delete(id);
        try {
          await gravar(valor);
        } catch (e) {
          aoFalhar(e instanceof Error ? e.message : String(e));
        }
      }
    } finally {
      emCurso = false;
    }
  }

  return {
    /** Marca para gravar daqui a pouco. Substitui o pendente do mesmo id. */
    agendar(valor: T) {
      pendentes.set(valor.id, valor);
      if (timer) clearTimeout(timer);
      timer = setTimeout(descarregar, atraso);
    },

    /** Grava agora o que estiver esperando. Para sair da tela sem perder nada. */
    agora() {
      if (timer) clearTimeout(timer);
      return descarregar();
    },

    /** Só para teste e para o aviso de fechar a aba. */
    temPendente() {
      return pendentes.size > 0 || emCurso;
    },
  };
}

export function useGravacaoEnfileirada<T extends { id: string }>(
  gravar: (valor: T) => Promise<void>,
  aoFalhar: (mensagem: string) => void,
  atraso = 600,
) {
  // A fila guarda estado entre renderizações, então é criada uma vez só. As
  // funções recebidas são lidas na hora de gravar, e não fixadas aqui, senão
  // um `setErro` antigo sobreviveria à troca de tela.
  const ref = useMemo(
    () => ({ gravar, aoFalhar }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  ref.gravar = gravar;
  ref.aoFalhar = aoFalhar;

  const fila = useMemo(
    () => criarFila<T>((v) => ref.gravar(v), (m) => ref.aoFalhar(m), atraso),
    [ref, atraso],
  );

  // Fechar a aba com gravação pendente perderia a última edição. Este é o
  // único gancho que o navegador dá, e ele só funciona para trabalho que já
  // está a caminho, por isso a fila dispara junto.
  useEffect(() => {
    const aoSair = (e: BeforeUnloadEvent) => {
      if (!fila.temPendente()) return;
      fila.agora();
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', aoSair);
    return () => window.removeEventListener('beforeunload', aoSair);
  }, [fila]);

  return { agendar: fila.agendar, agora: fila.agora };
}
