import { describe, expect, it } from 'vitest';
import { arredondarCompra } from './calculo';
import { barrisDeChopp, custoDe, descreverBarris, ehChopp } from './unidade';
import { quantidade } from '../formato';

describe('litro e chopp', () => {
  it('70 L de chopp são um barril de 50 e um de 30, e não dois de 50', () => {
    expect(barrisDeChopp(70)).toEqual([50, 30]);
    expect(arredondarCompra(70, 'l', 'CHOPP')).toBe(80);
  });

  it('a sobra é a menor possível', () => {
    expect(barrisDeChopp(25)).toEqual([30]);
    expect(barrisDeChopp(45)).toEqual([50]);
    expect(barrisDeChopp(90)).toEqual([30, 30, 30]);
    expect(barrisDeChopp(100)).toEqual([50, 50]);
  });

  it('o resto em litro arredonda para o litro cheio', () => {
    expect(arredondarCompra(12.3, 'l', 'Suco')).toBe(13);
  });

  it('preço por litro multiplica direto', () => {
    expect(custoDe('l', 80, 14)).toBe(1120);
    expect(custoDe('kg', 1500, 40)).toBe(60);
  });

  it('a lista diz em que barris vem', () => {
    expect(descreverBarris([50, 30])).toBe('1 barril de 50 L + 1 de 30 L');
    expect(quantidade(80, 'l', 'Chopp')).toBe('80 L (1 barril de 50 L + 1 de 30 L)');
    expect(quantidade(13, 'l', 'Suco')).toBe('13 L');
  });

  it('chopp e chope, mas não "chopper"', () => {
    expect(ehChopp('CHOPP')).toBe(true);
    expect(ehChopp('Chope artesanal')).toBe(true);
    expect(ehChopp('Chopper')).toBe(false);
  });
});
