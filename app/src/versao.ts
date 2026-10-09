import { useEffect, useState } from 'react';

/** Posta pelo build (ver vite.config.ts). */
declare const __VERSAO__: string;

export const VERSAO_ATUAL = __VERSAO__;

/** De quanto em quanto tempo o app aberto pergunta ao servidor. */
const INTERVALO_MS = 5 * 60 * 1000;

/**
 * A versão publicada no servidor, ou nulo se não deu para saber.
 *
 * Sem cache de propósito: o navegador guardaria o arquivo velho e o aviso
 * nunca apareceria. Erro de rede não é versão nova, então vira nulo.
 */
export async function versaoNoServidor(): Promise<string | null> {
  try {
    const resposta = await fetch(`/versao.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!resposta.ok) return null;
    const corpo = (await resposta.json()) as { versao?: unknown };
    return typeof corpo.versao === 'string' ? corpo.versao : null;
  } catch {
    return null;
  }
}

/**
 * Diz se saiu versão nova desde que esta aba abriu.
 *
 * Pergunta a cada poucos minutos e toda vez que a aba volta a ficar visível,
 * que é quando alguém retoma o app depois de horas parado. No `npm run dev`
 * não pergunta: lá o código já se atualiza sozinho.
 */
export function useVersaoNova() {
  const [nova, setNova] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    let ativo = true;

    const conferir = async () => {
      if (document.visibilityState !== 'visible') return;
      const servidor = await versaoNoServidor();
      if (ativo && servidor && servidor !== VERSAO_ATUAL) setNova(true);
    };

    const intervalo = setInterval(conferir, INTERVALO_MS);
    document.addEventListener('visibilitychange', conferir);
    window.addEventListener('focus', conferir);
    void conferir();

    return () => {
      ativo = false;
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', conferir);
      window.removeEventListener('focus', conferir);
    };
  }, []);

  return nova;
}
