import { createClient } from '@supabase/supabase-js';

/**
 * Configuração pública do Supabase, escrita no código de propósito.
 *
 * A URL e a chave publicável **não são segredo**: elas vão para o navegador de
 * qualquer forma, e quem protege o dado é a RLS, não o sigilo da chave.
 * Deixar as duas aqui significa que o host não precisa de nenhuma variável de
 * ambiente configurada, e que clonar o repositório e rodar já funciona.
 *
 * Segredo de verdade (OPENROUTER_API_KEY) mora **só** como secret de edge
 * function no Supabase. Nunca aqui, nunca no front, nunca no host.
 */
export const SUPABASE_URL = 'https://idwmchjvcmzdxljkaqdq.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_M5mg_qY25R-1Ew4q95-Mdg_7_itagWw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});

/** Endereço de uma edge function, montado a partir da mesma constante. */
export const funcao = (nome: string) => `${SUPABASE_URL}/functions/v1/${nome}`;
