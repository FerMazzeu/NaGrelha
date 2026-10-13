import { describe, expect, it } from 'vitest';
import { centavosDoTexto } from './componentes/Campos';

describe('valor colado no campo de dinheiro', () => {
  it('entende o jeito brasileiro, o americano e o número cru', () => {
    expect(centavosDoTexto('R$ 2.500,00')).toBe(250000);
    expect(centavosDoTexto('1.234,5')).toBe(123450);
    expect(centavosDoTexto('2500.5')).toBe(250050);
    expect(centavosDoTexto('1.234')).toBe(123400);
    expect(centavosDoTexto('80')).toBe(8000);
    expect(centavosDoTexto('-150,25')).toBe(-15025);
  });

  it('texto sem número não vira zero escondido', () => {
    expect(centavosDoTexto('abc')).toBeNull();
    expect(centavosDoTexto('')).toBeNull();
  });
});
