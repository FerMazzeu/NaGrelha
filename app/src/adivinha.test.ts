import { describe, expect, it } from 'vitest';
import { adivinhar } from './adivinha';

/*
  Os nomes vêm das planilhas de verdade do Alan, escritos como ele escreve,
  com os erros de digitação dele ("Shouder", "BANDEIJA", "Calabreza"). Um
  palpite que só acerta o nome certo não serve para nada aqui.
*/
describe('palpite de categoria e aproveitamento', () => {
  const casos: [string, string, string, number][] = [
    // nome, preparo, categoria esperada, aproveitamento esperado
    ['Chorizo', 'CHURRASCO', 'carne', 0.72],
    ['Ancho', 'CHURRASCO', 'carne', 0.72],
    ['Shouder', 'CHURRASCO', 'carne', 0.72],
    ['Copalombo', 'CHURRASCO', 'carne', 0.72],
    ['Costela bovina', 'CHURRASCO', 'carne', 0.5],
    ['File de cox e sobrecoxa', 'CHURRASCO', 'carne', 0.62],
    ['Tulipa', 'CHURRASCO', 'carne', 0.62],
    ['linguiça', 'CHURRASCO', 'carne', 0.85],
    ['Panceta', 'CHURRASCO', 'carne', 0.8],

    ['Pão Frances', 'PÃO DE ALHO', 'entrada', 1],
    ['Mussarela', 'PÃO DE ALHO', 'entrada', 1],
    // Batata rústica é entrada no cardápio da casa, e quem diz isso é o preparo.
    ['Batata inglesa grande', 'BATATA RUSTICA', 'entrada', 1],

    ['Arroz branco', 'ARROZ', 'guarnicao', 1],
    ['Farinha de milho', 'FAROFA NA GRELHA.', 'guarnicao', 1],
    ['Maionese', 'MAIONESE', 'guarnicao', 1],

    ['DETERGENTE', 'PRODUTO DE LIMPEZA', 'limpeza', 1],
    ['ALCOOL 80%', 'PRODUTO DE LIMPEZA', 'limpeza', 1],
    ['COPO', 'LOUÇAS', 'estrutura', 1],
    ['BANDEIJA GARÇON', 'LOUÇAS', 'estrutura', 1],
    ['Carvão de 5kg', 'FOGO', 'estrutura', 1],
  ];

  for (const [nome, preparo, categoria, rendimento] of casos) {
    it(`${nome} em ${preparo} é ${categoria}`, () => {
      expect(adivinhar(nome, preparo)).toEqual({ categoria, rendimento });
    });
  }

  it('BACON no arroz carreteiro é tempero, e não churrasco', () => {
    /*
      O caso que quase deu errado. "Bacon" casa com a regra de carne, mas em
      "ARROZ CARRETEIRO" ele é tempero, e aproveitamento de 80% ali faria a
      compra pedir mais bacon do que a receita usa.
    */
    expect(adivinhar('Bacon', 'ARROZ CARRETEIRO')).toEqual({ categoria: 'guarnicao', rendimento: 1 });
    // No churrasco, o mesmo nome é carne e perde na brasa.
    expect(adivinhar('Bacon', 'CHURRASCO')).toEqual({ categoria: 'carne', rendimento: 0.8 });
  });

  it('nome que ninguém conhece cai no seguro, e não numa carne inventada', () => {
    // Aproveitamento 1 erra para menos na compra, que é o erro barato.
    expect(adivinhar('Coisa estranha', 'EXTRA')).toEqual({ categoria: 'extra', rendimento: 1 });
  });

  it('carne sem corte conhecido ainda perde na brasa', () => {
    expect(adivinhar('Peça misteriosa', 'CHURRASCO')).toEqual({ categoria: 'carne', rendimento: 0.75 });
  });
});
