import { describe, expect, it } from 'vitest';
import { mensagemDe } from './erro';

describe('mensagemDe', () => {
  it('lê o erro do Supabase, que no navegador é objeto comum', () => {
    // Era isto que virava "[object Object]" na tela.
    expect(mensagemDe({ code: '23514', message: 'muitos pedidos seguidos', details: null, hint: null })).toBe(
      'muitos pedidos seguidos',
    );
  });

  it('continua lendo Error de verdade', () => {
    expect(mensagemDe(new Error('caiu'))).toBe('caiu');
  });

  it('texto solto passa como está', () => {
    expect(mensagemDe('sem rede')).toBe('sem rede');
  });

  it('objeto sem message não vira [object Object]', () => {
    expect(mensagemDe({ status: 500 })).toBe('{"status":500}');
  });
});
