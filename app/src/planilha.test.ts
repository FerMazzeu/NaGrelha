import { describe, expect, it } from 'vitest';
import { lerLinhas } from './planilha';
import { compararComCatalogo, porPessoaDe } from './importacao';
import type { Item } from './dominio/tipos';

/**
 * Um pedaço da planilha de 80 pessoas do Alan, célula por célula.
 *
 * Os NÚMEROS aqui são inventados, e os nomes de pessoa também. O que precisa
 * ser fiel é o formato — onde fica a unidade, o que vem depois das
 * observações — e não quanto custa o quilo nem quanto cada um recebe. Este
 * repositório é público e o histórico do git não esquece.
 *
 * A coluna A é vazia, o nome está na B, a quantidade na D, a unidade na E e o
 * preço na F. Copiado do arquivo real, e não inventado: o valor deste teste é
 * ser o formato dele, com os defeitos dele.
 */
const OITENTA: unknown[][] = [
  [],
  [null, null, 'MODELO 80 PESSOAS', 'MODELO 80 PESSOAS', 'MODELO 80 PESSOAS'],
  [null, null, 'ADULTOS', 70, 131.08, 9175.97],
  [null, null, 'CRIANÇAS', 15, 65.54, 983.13],
  [null, null, 'Valor total', null, 10159.1],
  [null, 'Descrição', null, 'Quantidade.', 'Quantidade.'],
  [null, 'PÃO DE ALHO', 'PÃO DE ALHO', 'PÃO DE ALHO', 'PÃO DE ALHO', 'VALOR COTAÇÃO', 'VALOR REAL'],
  [null, 'Pão Frances', null, 26, 'und.', 1, null, 26],
  [null, 'Mussarela', null, 26, 'und.', 1.2, null, 31.2],
  [null, 'CHURRASCO', 'CHURRASCO', 'CHURRASCO', 'CHURRASCO'],
  [null, 'Shouder', null, 7, 'kg', 40, null, 280],
  [null, 'Chorizo', null, 8, 'kg', 50, null, 400],
  [null, 'LOUÇAS', 'LOUÇAS', 'LOUÇAS', 'LOUÇAS'],
  [null, 'COPO', null, 8, 'DZ', 10, 80, 80],
  [null, null, null, null, null, null, null, 3745.97],
  [null, 'OBSERVAÇÕES IMPORTANTES:', 'OBSERVAÇÕES IMPORTANTES:'],
  [null, 'O EVENTO TEM DURAÇÃO DE 5 HORAS.'],
  // Equipe com nome e valor, que e o que vem depois das observacoes na
  // planilha real. Aqui os dois sao inventados de proposito: este repo e
  // publico, e quanto cada pessoa recebe nao e assunto dele. O teste so
  // precisa que a linha exista e tenha a forma certa.
  [null, 'FRETE', 'FULANO', 2, 'und', 111, null, 222],
  [null, 'Churrasqueiro', 'BELTRANO', 1, 'und', 999, null, 999],
];

/**
 * A planilha de 30 pessoas, que tem o total numa coluna diferente.
 *
 * É por isso que o leitor não fixa coluna: a âncora é a unidade, com a
 * quantidade à esquerda e o preço à direita.
 */
const TRINTA: unknown[][] = [
  [null, null, 'Na grelha 30', 'Na grelha 30'],
  [null, 'MAIONESE', 'MAIONESE', 'MAIONESE', 'MAIONESE'],
  [null, 'Batata inglesa', null, 3, 'kg', 8, 24],
  [null, 'Alho', null, 1, 'Und.', 2.34, 2.34],
];

describe('leitura da planilha do Alan', () => {
  const lido = lerLinhas(OITENTA);

  it('acha quantas pessoas o modelo atende', () => {
    expect(lido.pessoas).toBe(80);
  });

  it('separa preparo de item', () => {
    expect(lido.itens.map((i) => i.nome)).toEqual(['Pão Frances', 'Mussarela', 'Shouder', 'Chorizo', 'COPO']);
    expect(lido.itens.find((i) => i.nome === 'Chorizo')?.grupo).toBe('CHURRASCO');
    expect(lido.itens.find((i) => i.nome === 'Pão Frances')?.grupo).toBe('PÃO DE ALHO');
  });

  it('lê quantidade, unidade e preço da linha', () => {
    const chorizo = lido.itens.find((i) => i.nome === 'Chorizo')!;
    expect(chorizo).toMatchObject({ quantidade: 8, unidade: 'kg', preco: 50 });
  });

  it('dúzia e pacote viram unidade, porque é assim que se compra', () => {
    expect(lido.itens.find((i) => i.nome === 'COPO')?.unidade).toBe('un');
  });

  it('PARA nas observações, e não engole a equipe como se fosse compra', () => {
    // Frete e Churrasqueiro vêm depois das observações. Se entrassem, o
    // catálogo de comida ganharia o cachê do Alan como se fosse ingrediente.
    expect(lido.itens.map((i) => i.nome)).not.toContain('FRETE');
    expect(lido.itens.map((i) => i.nome)).not.toContain('Churrasqueiro');
  });

  it('ignora cabeçalho, total e linha solta de soma', () => {
    expect(lido.itens.map((i) => i.nome)).not.toContain('Descrição');
    expect(lido.itens.map((i) => i.nome)).not.toContain('Valor total');
    expect(lido.itens.map((i) => i.nome)).not.toContain('ADULTOS');
  });

  /*
    Achado rodando contra o arquivo de verdade, nao contra este teste.

    Na planilha de 30 pessoas a unidade do pao frances esta escrita "und," com
    virgula, e nao "und." com ponto. O leitor so tirava o ponto, entao a linha
    inteira era descartada em silencio: um item de compra sumia da importacao e
    ninguem ficava sabendo.
  */
  it('aceita unidade com virgula no lugar do ponto', () => {
    const comVirgula = lerLinhas([
      [null, 'CHORIPAN', 'CHORIPAN', 'CHORIPAN', 'CHORIPAN'],
      [null, 'Pão frances', null, 10, 'und,', 1, 10],
      [null, 'Queijo', null, 2, 'Und.', 5, 10],
      [null, 'Carne', null, 3, 'KG', 40, 120],
    ]);
    expect(comVirgula.itens.map((i) => i.nome)).toEqual(['Pão frances', 'Queijo', 'Carne']);
    expect(comVirgula.itens[2].unidade).toBe('kg');
  });

  it('acha as pessoas pelas linhas de adultos e crianças quando falta o título', () => {
    // A planilha de 30 se chama "Na grelha 30", e nao "MODELO 30 PESSOAS".
    const semTitulo = lerLinhas([
      [null, null, 'Na grelha 30', 'Na grelha 30'],
      [null, null, 'ADULTOS ', 30, 169.76],
      [null, null, 'CRIANÇAS', 0, 84.88],
    ]);
    expect(semTitulo.pessoas).toBe(30);
  });

  it('o título ganha da soma quando os dois existem e discordam', () => {
    // No arquivo de 80 o titulo diz 80 e as linhas somam 85.
    expect(lerLinhas(OITENTA).pessoas).toBe(80);
  });

  it('funciona na planilha de 30, que tem o total noutra coluna', () => {
    const outra = lerLinhas(TRINTA);
    expect(outra.itens).toHaveLength(2);
    expect(outra.itens[0]).toMatchObject({ nome: 'Batata inglesa', quantidade: 3, unidade: 'kg', preco: 8 });
    expect(outra.itens[1]).toMatchObject({ nome: 'Alho', quantidade: 1, unidade: 'un', preco: 2.34 });
  });
});

/*
  A planilha de receita.

  O Alan manda o tutu de feijao com os ingredientes e mais nada: a gramatura
  ele preenche na hora. A primeira leitura exigia quantidade E preco, entao
  recusava a receita inteira e a tela so dizia "105 linhas nao foram lidas",
  sem motivo nenhum.
*/
describe('receita sem gramatura e sem preço', () => {
  const RECEITA: unknown[][] = [
    [null, 'Cardápio de inverno'],
    [null, 'Convidados', 100],
    [null, 'TUTU DE FEIJÃO', 'TUTU DE FEIJÃO', 'TUTU DE FEIJÃO', 'TUTU DE FEIJÃO'],
    [null, 'Feijão'],
    [null, 'Bacon'],
    [null, 'Alho'],
    [null, 'CALDO VERDE', 'CALDO VERDE', 'CALDO VERDE', 'CALDO VERDE'],
    [null, 'Batata'],
    [null, 'Couve'],
  ];

  const lido = lerLinhas(RECEITA);

  it('aceita o ingrediente mesmo sem número nenhum', () => {
    expect(lido.itens.map((i) => i.nome)).toEqual(['Feijão', 'Bacon', 'Alho', 'Batata', 'Couve']);
  });

  it('põe cada um no preparo certo', () => {
    expect(lido.itens.find((i) => i.nome === 'Couve')?.grupo).toBe('CALDO VERDE');
    expect(lido.itens.find((i) => i.nome === 'Feijão')?.grupo).toBe('TUTU DE FEIJÃO');
  });

  it('marca o que falta, em vez de jogar a linha fora', () => {
    expect(lido.itens.every((i) => i.falta === 'sem-nada')).toBe(true);
    expect(lido.itens.every((i) => i.quantidade === 0 && i.preco === 0)).toBe(true);
  });

  it('NÃO transforma título e convidados em ingrediente', () => {
    const nomes = lido.itens.map((i) => i.nome);
    expect(nomes).not.toContain('Cardápio de inverno');
    expect(nomes).not.toContain('Convidados');
  });

  it('diz o motivo do que ficou de fora', () => {
    // O título está antes de qualquer preparo, então não há onde encaixar.
    expect(lido.ignoradas.find((i) => i.texto === 'Cardápio de inverno')?.motivo).toBe('fora-de-preparo');
  });
});

describe('linha com número faltando', () => {
  it('sem preço entra zerado e marcado', () => {
    const lido = lerLinhas([
      [null, 'CHURRASCO', 'CHURRASCO', 'CHURRASCO', 'CHURRASCO'],
      [null, 'Picanha', null, 12, 'kg'],
    ]);
    expect(lido.itens[0]).toMatchObject({ nome: 'Picanha', quantidade: 12, preco: 0, falta: 'sem-preco' });
  });

  it('sem quantidade entra zerado e marcado', () => {
    const lido = lerLinhas([
      [null, 'CHURRASCO', 'CHURRASCO', 'CHURRASCO', 'CHURRASCO'],
      [null, 'Picanha', null, null, 'kg', 79.9],
    ]);
    expect(lido.itens[0]).toMatchObject({ nome: 'Picanha', quantidade: 0, preco: 79.9, falta: 'sem-quantidade' });
  });

  it('linha de subtotal solta não vira item chamado de número', () => {
    // Apareceu quando a leitura passou a aceitar linha sem unidade: a linha de
    // soma da planilha dele virava um item com nome "3745.97".
    const lido = lerLinhas([
      [null, 'CHURRASCO', 'CHURRASCO', 'CHURRASCO', 'CHURRASCO'],
      [null, 'Picanha', null, 12, 'kg', 79.9],
      [null, null, null, null, null, null, null, 3745.97],
    ]);
    expect(lido.itens.map((i) => i.nome)).toEqual(['Picanha']);
  });
});

describe('quantidade do evento vira quantidade por pessoa', () => {
  it('quilo vira gramas por pessoa', () => {
    // 8 kg de chorizo para 80 pessoas são 100 g por pessoa.
    const linha = { nome: 'Chorizo', grupo: 'CHURRASCO', unidade: 'kg' as const, quantidade: 8, preco: 50, linha: 1 };
    expect(porPessoaDe(linha, 80)).toBe(100);
  });

  it('unidade aceita fração, porque meio pão por pessoa existe', () => {
    const linha = { nome: 'Pão', grupo: 'X', unidade: 'un' as const, quantidade: 26, preco: 1, linha: 1 };
    expect(porPessoaDe(linha, 80)).toBe(0.325);
  });

  it('zero pessoa não explode a conta', () => {
    const linha = { nome: 'Pão', grupo: 'X', unidade: 'un' as const, quantidade: 26, preco: 1, linha: 1 };
    expect(porPessoaDe(linha, 0)).toBe(0);
  });
});

describe('planilha incompleta não estraga o catálogo', () => {
  const catalogo: Item[] = [
    {
      id: 'chorizo',
      nome: 'Chorizo',
      grupo: 'CHURRASCO',
      categoria: 'carne',
      unidade: 'kg',
      porPessoa: 72,
      rendimento: 0.72,
      preco: 50,
    },
  ];

  it('NÃO zera o preço de quem já existe quando a planilha vem sem preço', () => {
    /*
      O jeito mais fácil de destruir o catálogo do cliente: subir um cardápio
      de receita, que não tem preço, e o app entender zero como preço novo.
    */
    const lido = lerLinhas([
      [null, 'CHURRASCO', 'CHURRASCO', 'CHURRASCO', 'CHURRASCO'],
      [null, 'Chorizo'],
    ]);
    const c = compararComCatalogo(lido.itens, catalogo, {
      pessoas: 80,
      atualizarPrecos: true,
      atualizarQuantidades: true,
      criarNovos: true,
    });
    expect(c.precos).toEqual([]);
    expect(c.quantidades).toEqual([]);
  });
});

describe('o que a planilha muda no catálogo', () => {
  const catalogo: Item[] = [
    {
      id: 'chorizo',
      nome: 'Chorizo',
      grupo: 'CHURRASCO',
      categoria: 'carne',
      unidade: 'kg',
      porPessoa: 100,
      rendimento: 0.72,
      preco: 55,
    },
    {
      id: 'pao',
      nome: 'PÃO FRANCES',
      grupo: 'pão de alho',
      categoria: 'entrada',
      unidade: 'un',
      porPessoa: 0.325,
      rendimento: 1,
      preco: 1,
    },
  ];

  const opcoes = { pessoas: 80, atualizarPrecos: true, atualizarQuantidades: true, criarNovos: true };
  const comparacao = compararComCatalogo(lerLinhas(OITENTA).itens, catalogo, opcoes);

  it('acha o item mesmo com acento e caixa diferentes', () => {
    // "Pão Frances" na planilha, "PÃO FRANCES" no catálogo. Se não casasse,
    // cada importação criaria um item repetido.
    expect(comparacao.novos.map((n) => n.nome)).not.toContain('Pão Frances');
    expect(comparacao.iguais).toBe(1);
  });

  it('mostra o preço que mudou, de quanto para quanto', () => {
    expect(comparacao.precos).toHaveLength(1);
    expect(comparacao.precos[0]).toMatchObject({ de: 55, para: 50 });
    expect(comparacao.precos[0].item.nome).toBe('Chorizo');
  });

  it('lista o que não existe no catálogo como item novo', () => {
    expect(comparacao.novos.map((n) => n.nome).sort()).toEqual(['COPO', 'Mussarela', 'Shouder']);
  });

  it('respeita quem não quer mexer em preço', () => {
    const so = compararComCatalogo(lerLinhas(OITENTA).itens, catalogo, {
      ...opcoes,
      atualizarPrecos: false,
      criarNovos: false,
    });
    expect(so.precos).toHaveLength(0);
    expect(so.novos).toHaveLength(0);
  });

  it('não cria o mesmo item duas vezes', () => {
    const repetida = [...lerLinhas(OITENTA).itens, ...lerLinhas(OITENTA).itens];
    const c = compararComCatalogo(repetida, catalogo, opcoes);
    expect(c.novos).toHaveLength(3);
  });
});
