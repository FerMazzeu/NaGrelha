import { describe, expect, it } from 'vitest';
import { casaBusca, normalizar, peso, real } from './formato';

describe('normalizar para busca', () => {
  it('tira acento', () => {
    expect(normalizar('Salpicão')).toBe('salpicao');
    expect(normalizar('Pão de alho')).toBe('pao de alho');
    expect(normalizar('Linguiça')).toBe('linguica');
  });

  it('tira caixa e espaço nas pontas', () => {
    expect(normalizar('  PICANHA  ')).toBe('picanha');
  });
});

describe('casaBusca', () => {
  it('acha sem o acento que o nome tem', () => {
    expect(casaBusca('salpicao', 'Salpicão')).toBe(true);
    expect(casaBusca('PAO', 'Pão de alho')).toBe(true);
  });

  it('acha com o acento também', () => {
    expect(casaBusca('Salpicão', 'Salpicão')).toBe(true);
  });

  it('acha no meio da palavra', () => {
    expect(casaBusca('toscana', 'Linguiça toscana')).toBe(true);
  });

  it('procura em qualquer um dos campos', () => {
    expect(casaBusca('churrasqueiro', 'André', 'Churrasqueiro')).toBe(true);
    expect(casaBusca('andre', 'André', 'Churrasqueiro')).toBe(true);
  });

  it('busca vazia deixa tudo passar', () => {
    expect(casaBusca('', 'qualquer coisa')).toBe(true);
    expect(casaBusca('   ', 'qualquer coisa')).toBe(true);
  });

  it('nao casa o que nao existe', () => {
    expect(casaBusca('costela', 'Picanha', 'Carne')).toBe(false);
  });
});

describe('formatação', () => {
  it('grama vira quilo acima de mil', () => {
    expect(peso(850)).toBe('850 g');
    expect(peso(12500)).toBe('12,5 kg');
  });

  it('peso invalido nao vira NaN na tela', () => {
    expect(peso(Number.NaN)).toBe('0 g');
    expect(real(Number.NaN)).toContain('0,00');
  });
});
