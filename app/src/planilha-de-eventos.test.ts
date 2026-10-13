import { describe, expect, it } from 'vitest';
import { eventoExterno, fechadoPorFora, precoDoEvento } from './dominio/evento-externo';
import { Workbook } from 'exceljs';
import {
  COLUNAS_DO_MODELO,
  jaExiste,
  lerArquivoDeEventos,
  lerCsv,
  lerData,
  lerHora,
  lerLinhasDeEventos,
  SemCabecalho,
} from './planilha-de-eventos';

/*
  Nomes e valores inventados: este repositório é público. O que precisa ser
  fiel é o formato de uma lista de eventos feita à mão no Excel.
*/
const HOJE = '2026-10-13';

describe('lerLinhasDeEventos', () => {
  it('acha as colunas pelo nome, em qualquer ordem e com título antes', () => {
    const lidos = lerLinhasDeEventos(
      [
        ['EVENTOS 2025'],
        [],
        ['Valor (R$)', 'Nome do cliente', 'Nº de pessoas', 'Data do evento', 'Status'],
        ['R$ 4.500,00', 'Fulana de Tal', 60, new Date(Date.UTC(2025, 2, 15)), 'Realizado'],
        [3200, 'Beltrano', '40', '20/11/2026', 'fechado'],
      ],
      HOJE,
    );

    expect(lidos.eventos).toHaveLength(2);
    expect(lidos.eventos[0]).toMatchObject({
      linha: 4,
      avisos: [],
      dados: { cliente: 'Fulana de Tal', valor: 4500, convidados: 60, data: '2025-03-15', situacao: 'realizado' },
    });
    expect(lidos.eventos[1].dados).toMatchObject({ valor: 3200, convidados: 40, data: '2026-11-20', situacao: 'confirmado' });
  });

  it('sem situação, o que já passou foi realizado e o que vem está confirmado', () => {
    const { eventos } = lerLinhasDeEventos(
      [
        ['Cliente', 'Data', 'Valor'],
        ['A', '01/02/2025', 1000],
        ['B', '01/02/2027', 1000],
        ['C', '', 1000],
      ],
      HOJE,
    );
    expect(eventos.map((e) => e.dados.situacao)).toEqual(['realizado', 'confirmado', 'confirmado']);
  });

  it('casamento e 15 anos vão para a tabela de casamento', () => {
    const { eventos } = lerLinhasDeEventos(
      [
        ['Cliente', 'Tipo', 'Valor'],
        ['A', 'Casamento', 1],
        ['B', '15 anos', 1],
        ['C', 'Aniversário', 1],
        ['D', '', 1],
      ],
      HOJE,
    );
    expect(eventos.map((e) => e.dados.tipoEvento)).toEqual(['casamento', 'casamento', 'aniversario', 'aniversario']);
  });

  it('avisa o que faltou, mas não recusa a linha', () => {
    const { eventos } = lerLinhasDeEventos(
      [
        ['Cliente', 'Data', 'Valor', 'Convidados'],
        ['Sem nada', 'semana que vem', '', ''],
      ],
      HOJE,
    );
    expect(eventos[0].avisos).toEqual([
      'não entendi a data "semana que vem"',
      'sem data',
      'sem valor',
      'sem número de convidados',
    ]);
  });

  it('pula linha de total e conta linha sem cliente como ignorada', () => {
    const { eventos, ignoradas } = lerLinhasDeEventos(
      [
        ['Cliente', 'Valor'],
        ['A', 100],
        ['', 50],
        ['TOTAL', 150],
      ],
      HOJE,
    );
    expect(eventos).toHaveLength(1);
    expect(ignoradas).toEqual([{ linha: 3, texto: '50', motivo: 'sem nome de cliente' }]);
  });

  it('lê o resultado de célula com fórmula', () => {
    const { eventos } = lerLinhasDeEventos(
      [
        ['Cliente', 'Valor'],
        ['A', { formula: 'B1*2', result: 2400 }],
      ],
      HOJE,
    );
    expect(eventos[0].dados.valor).toBe(2400);
  });

  it('sem cabeçalho reconhecível, explica em vez de ler lixo', () => {
    expect(() => lerLinhasDeEventos([['a', 'b'], [1, 2]], HOJE)).toThrow(SemCabecalho);
  });
});

describe('datas e horas', () => {
  it('entende os jeitos comuns', () => {
    expect(lerData('15/03/2024')).toBe('2024-03-15');
    expect(lerData('5/3/24')).toBe('2024-03-05');
    expect(lerData('2024-03-15')).toBe('2024-03-15');
    expect(lerData(45366)).toBe('2024-03-15'); // número de série do Excel
    expect(lerData('31/02/2024')).toBeNull();
    expect(lerData(60)).toBeNull();
  });

  it('hora em texto e como fração do dia', () => {
    expect(lerHora('19:30')).toBe('19:30');
    expect(lerHora('19h')).toBe('19:00');
    expect(lerHora(0.8125)).toBe('19:30');
    expect(lerHora('tarde')).toBe('');
  });
});

describe('lerCsv', () => {
  it('ponto e vírgula, aspas e quebra de linha do Windows', () => {
    expect(lerCsv('﻿Cliente;Valor\r\n"Silva; filhos";"1.200,00"\r\n')).toEqual([
      ['Cliente', 'Valor'],
      ['Silva; filhos', '1.200,00'],
    ]);
  });

  it('vírgula quando é ela que separa', () => {
    expect(lerCsv('Cliente,Valor\nA,100')).toEqual([
      ['Cliente', 'Valor'],
      ['A', '100'],
    ]);
  });
});

describe('evento fechado por fora', () => {
  const evento = eventoExterno({ cliente: ' Fulana ', convidados: 50, valor: 5000, data: '2025-01-10' });

  it('nasce sem cardápio e com o valor combinado', () => {
    expect(evento).toMatchObject({ cliente: 'Fulana', adultos: 50, itens: [], servicos: [], valorFechado: 5000 });
    expect(fechadoPorFora(evento)).toBe(true);
  });

  it('o preço é o combinado, e não a conta', () => {
    expect(precoDoEvento(evento)).toBe(5000);
    expect(precoDoEvento({ ...evento, valorFechado: null })).toBe(0);
  });

  it('reconhece o mesmo cliente na mesma data como repetido', () => {
    expect(jaExiste({ cliente: 'fulana', convidados: 0, valor: 0, data: '2025-01-10' }, [evento])).toBe(true);
    expect(jaExiste({ cliente: 'fulana', convidados: 0, valor: 0, data: '2025-01-11' }, [evento])).toBe(false);
    expect(jaExiste({ cliente: 'fulana', convidados: 0, valor: 0, data: '' }, [evento])).toBe(false);
  });
});

describe('lerArquivoDeEventos', () => {
  it('lê um .xlsx de verdade no formato do modelo, com data, moeda e fórmula', async () => {
    const livro = new Workbook();
    const aba = livro.addWorksheet('Eventos');
    aba.columns = COLUNAS_DO_MODELO.map((c) => ({ header: c.titulo, width: c.largura }));
    aba.addRow(['Fulana', new Date(Date.UTC(2025, 4, 3)), '19:30', 80, 7200, 'Casamento', 'Realizado', 'Salão X']);
    aba.addRow(['Beltrano', new Date(Date.UTC(2027, 0, 9)), null, 30, { formula: '1500*2', result: 3000 }]);
    const bytes = await livro.xlsx.writeBuffer();

    const lidos = await lerArquivoDeEventos(new File([bytes as ArrayBuffer], 'eventos.xlsx'));

    expect(lidos.eventos.map((e) => e.dados)).toMatchObject([
      { cliente: 'Fulana', data: '2025-05-03', hora: '19:30', convidados: 80, valor: 7200, tipoEvento: 'casamento', situacao: 'realizado', local: 'Salão X' },
      { cliente: 'Beltrano', data: '2027-01-09', convidados: 30, valor: 3000, situacao: 'confirmado' },
    ]);
  });
});
