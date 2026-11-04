import { describe, expect, it } from 'vitest';
import { centavosDoTexto, textoDeDinheiro } from './componentes/Campos';

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

describe('digitando no campo de dinheiro', () => {
  const valor = (digitado: string) => centavosDoTexto(textoDeDinheiro(digitado));

  it('"55" é R$ 55,00, e não R$ 0,55 como na maquininha', () => {
    expect(valor('55')).toBe(5500);
  });

  it('a vírgula separa os centavos, com duas casas no máximo', () => {
    expect(textoDeDinheiro('55,9')).toBe('55,9');
    expect(valor('55,9')).toBe(5590);
    expect(textoDeDinheiro('55,999')).toBe('55,99');
    expect(textoDeDinheiro('5,5,5')).toBe('5,55');
  });

  it('o ponto do teclado numérico vale como vírgula; com três dígitos, é milhar', () => {
    expect(valor('55.5')).toBe(5550);
    expect(valor('1.500')).toBe(150000);
    expect(valor('1.234,56')).toBe(123456);
  });

  it('letra e "R$" somem, e o sinal só fica onde pode ficar negativo', () => {
    expect(textoDeDinheiro('R$ 12a')).toBe('12');
    expect(textoDeDinheiro('-30')).toBe('30');
    expect(textoDeDinheiro('-30', true)).toBe('-30');
  });
});
