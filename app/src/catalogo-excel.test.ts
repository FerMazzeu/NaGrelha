import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { Item } from './dominio/tipos';
import { montarCatalogo } from './excel';
import { compararComCatalogo } from './importacao';
import { lerLinhas } from './planilha';

const CATALOGO: Item[] = [
  {
    id: 'picanha',
    nome: 'Picanha',
    grupo: 'Churrasco',
    categoria: 'carne',
    unidade: 'kg',
    porPessoa: 150,
    rendimento: 0.72,
    preco: 79.9,
  },
  {
    id: 'pao',
    nome: 'Pão de alho',
    grupo: 'Pão de alho',
    categoria: 'entrada',
    unidade: 'un',
    porPessoa: 1.5,
    rendimento: 1,
    preco: 3.5,
  },
  {
    id: 'farofa',
    nome: 'Farinha de milho',
    grupo: 'Farofa na grelha',
    categoria: 'guarnicao',
    unidade: 'kg',
    porPessoa: 35,
    rendimento: 1,
    preco: 4.49,
  },
];

/** Abre os bytes gerados e devolve as linhas como o leitor as vê. */
async function relerComoPlanilha(bytes: ArrayBuffer) {
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(bytes);
  const aba = livro.worksheets[0];

  const linhas: unknown[][] = [];
  aba.eachRow({ includeEmpty: true }, (linha, n) => {
    const valores: unknown[] = [];
    linha.eachCell({ includeEmpty: true }, (c, col) => {
      valores[col - 1] = c.value;
    });
    linhas[n - 1] = valores;
  });

  return lerLinhas(linhas);
}

/*
  O ciclo fechado.

  De nada adianta exportar bonito se o arquivo não voltar. Este teste gera a
  planilha, abre de novo pelo mesmo leitor que lê os arquivos do Alan, e exige
  que o catálogo volte igual ao que saiu. É o que garante que mudar o formato
  da exportação não quebre a importação em silêncio.
*/
describe('baixar e subir de volta', () => {
  it('o arquivo gerado é lido pelo mesmo leitor', async () => {
    const lida = await relerComoPlanilha(await montarCatalogo(CATALOGO, 80));

    expect(lida.pessoas).toBe(80);
    // Ordenado em português: `sort()` cru põe "Pão" depois de "Picanha",
    // porque compara código de caractere e o "ã" vem lá no fim da tabela.
    expect(lida.itens.map((i) => i.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'))).toEqual([
      'Farinha de milho',
      'Pão de alho',
      'Picanha',
    ]);
  });

  it('o preparo sobrevive à ida e à volta', async () => {
    const lida = await relerComoPlanilha(await montarCatalogo(CATALOGO, 80));
    const picanha = lida.itens.find((i) => i.nome === 'Picanha')!;
    expect(picanha.grupo).toBe('CHURRASCO');
    expect(picanha.unidade).toBe('kg');
  });

  it('a planilha traz o que se COMPRA, e não o que vai no prato', async () => {
    const lida = await relerComoPlanilha(await montarCatalogo(CATALOGO, 80));

    /*
      Esta é a conta que estava errada e ia mandar faltar carne na festa.

      A picanha tem 150 g por pessoa NO PRATO e aproveita 72%: o resto vira
      gordura aparada e perda na brasa. Para 80 pessoas são 12 kg de prato, mas
      16,7 kg de compra. Escrever 12 na planilha do mercado faria chegar 8,6 kg
      ao prato, e faltar carne para um quarto dos convidados.
    */
    expect(lida.itens.find((i) => i.nome === 'Picanha')?.quantidade).toBe(16.7);

    // Pão aproveita tudo, então compra e prato coincidem: 1,5 x 80 = 120.
    expect(lida.itens.find((i) => i.nome === 'Pão de alho')?.quantidade).toBe(120);
  });

  it('SUBIR O ARQUIVO SEM EDITAR NÃO MUDA NADA', async () => {
    // Este é o teste que vale. Se baixar e subir de volta acusasse mudança,
    // toda importação mexeria no catálogo à toa, e ninguém confiaria na tela
    // de conferência depois da segunda vez.
    const lida = await relerComoPlanilha(await montarCatalogo(CATALOGO, 80));
    const comparacao = compararComCatalogo(lida.itens, CATALOGO, {
      pessoas: 80,
      atualizarPrecos: true,
      atualizarQuantidades: true,
      criarNovos: true,
    });

    expect(comparacao.precos).toEqual([]);
    expect(comparacao.quantidades).toEqual([]);
    expect(comparacao.novos).toEqual([]);
    expect(comparacao.iguais).toBe(CATALOGO.length);
  });

  it('editar um preço no Excel aparece como uma mudança só', async () => {
    const bytes = await montarCatalogo(CATALOGO, 80);
    const livro = new ExcelJS.Workbook();
    await livro.xlsx.load(bytes);
    const aba = livro.worksheets[0];

    // Acha a linha da picanha e troca o preço, que é o que o Alan faria.
    aba.eachRow((linha) => {
      if (String(linha.getCell(2).value ?? '') === 'Picanha') linha.getCell(6).value = 89.9;
    });

    const lida = await relerComoPlanilha(await livro.xlsx.writeBuffer());
    const comparacao = compararComCatalogo(lida.itens, CATALOGO, {
      pessoas: 80,
      atualizarPrecos: true,
      atualizarQuantidades: true,
      criarNovos: true,
    });

    expect(comparacao.precos).toHaveLength(1);
    expect(comparacao.precos[0]).toMatchObject({ de: 79.9, para: 89.9 });
    expect(comparacao.quantidades).toEqual([]);
    expect(comparacao.novos).toEqual([]);
  });

  it('item acrescentado no Excel entra como novo', async () => {
    const bytes = await montarCatalogo(CATALOGO, 80);
    const livro = new ExcelJS.Workbook();
    await livro.xlsx.load(bytes);
    const aba = livro.worksheets[0];

    const nova = aba.addRow([]);
    nova.getCell(2).value = 'Costela';
    nova.getCell(4).value = 16;
    nova.getCell(5).value = 'kg';
    nova.getCell(6).value = 39.9;

    const lida = await relerComoPlanilha(await livro.xlsx.writeBuffer());
    const comparacao = compararComCatalogo(lida.itens, CATALOGO, {
      pessoas: 80,
      atualizarPrecos: true,
      atualizarQuantidades: true,
      criarNovos: true,
    });

    expect(comparacao.novos).toHaveLength(1);
    // 16 kg para 80 pessoas são 200 g por pessoa.
    expect(comparacao.novos[0]).toMatchObject({ nome: 'Costela', preco: 39.9, porPessoa: 200 });
  });
});
