import { describe, expect, it } from 'vitest';
import { nomeDeArquivo, nomeDoPdf } from './pdf-da-proposta';

describe('nome do arquivo do PDF', () => {
  it('sem acento, para o WhatsApp não mostrar "OrÃ§amento"', () => {
    expect(nomeDoPdf('FULANA', '2027-01-16')).toBe('Orcamento Na Grelha - FULANA - 16-01.pdf');
  });

  it('o nome do cliente também perde o acento, e só ele', () => {
    expect(nomeDoPdf('João Conceição', '2026-12-12')).toBe('Orcamento Na Grelha - Joao Conceicao - 12-12.pdf');
  });

  it('caractere que o Windows não aceita em nome de arquivo sai', () => {
    expect(nomeDeArquivo('Festa 15/12: "Ana"?')).toBe('Festa 1512 Ana');
  });

  it('sem cliente e sem data não quebra', () => {
    expect(nomeDoPdf('  ', '')).toBe('Orcamento Na Grelha - cliente.pdf');
  });
});
