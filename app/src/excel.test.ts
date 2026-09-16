import { describe, expect, it } from 'vitest';
import { Workbook } from 'exceljs';
import { calcular } from './dominio/calculo';
import type { Item, Orcamento } from './dominio/tipos';
import { montarPlanilha } from './excel';

const itens: Item[] = [
  { id: 'a', nome: 'Ancho', grupo: 'Churrasco', categoria: 'carne', unidade: 'kg', porPessoa: 100, rendimento: 1, preco: 63 },
  { id: 'b', nome: 'Pão francês', grupo: 'Pão de alho', categoria: 'entrada', unidade: 'un', porPessoa: 0.4, rendimento: 1, preco: 1 },
  { id: 'c', nome: 'Copo (dúzia)', grupo: 'Louças', categoria: 'estrutura', unidade: 'un', porPessoa: 0.2, rendimento: 1, preco: 10 },
];

const orcamento: Orcamento = {
  id: 'x',
  cliente: 'Casamento Marina',
  contato: '35988638687',
  data: '2026-10-18',
  hora: '19:00',
  local: 'Varginha',
  observacoes: 'Tem uma convidada celíaca.',
  situacao: 'confirmado',
  adultos: 30,
  faixas: [
    { id: 'f1', faixaId: 'f1', nome: 'Até 5 anos', percentual: 0, quantidade: 4 },
    { id: 'f2', faixaId: 'f2', nome: '6 a 10 anos', percentual: 50, quantidade: 6 },
  ],
  apetite: 'normal',
  duracaoHoras: 5,
  itens,
  selecionados: ['a', 'b', 'c'],
  servicos: [
    { id: 's1', servicoId: 's1', nome: 'Churrasqueiro', papel: 'equipe', pessoa: 'Alan', quantidade: 1, valor: 600, percentual: 0 },
    { id: 's2', servicoId: 's2', nome: 'Organização (metrê)', papel: 'equipe', pessoa: 'Érica', quantidade: 1, valor: 600, percentual: 0 },
    { id: 's3', servicoId: 's3', nome: 'Frete', papel: 'frete', pessoa: 'Eduardo', quantidade: 2, valor: 50, percentual: 0 },
    { id: 's4', servicoId: 's4', nome: 'Imposto (DAS)', papel: 'imposto', pessoa: '', quantidade: 1, valor: 325, percentual: 0 },
  ],
  custosExtras: [],
  margem: 0,
  fatorCarvao: 0.5,
  precoCarvao: 6.4,
  criadoEm: '',
  atualizadoEm: '',
};

/** Lê a planilha gerada de volta, que é a única prova de que ela abre. */
async function reler(bytes: ArrayBuffer) {
  const livro = new Workbook();
  await livro.xlsx.load(bytes);
  const texto = (nome: string) => {
    const aba = livro.getWorksheet(nome)!;
    const linhas: string[] = [];
    aba.eachRow((linha) => {
      const celulas: string[] = [];
      linha.eachCell({ includeEmpty: false }, (c) => celulas.push(String(c.value ?? '')));
      linhas.push(celulas.join(' | '));
    });
    return linhas.join('\n');
  };
  return { livro, texto };
}

describe('exportar em Excel', () => {
  it('gera um arquivo que o Excel consegue reabrir', async () => {
    const bytes = await montarPlanilha(orcamento, calcular(orcamento));
    const { livro } = await reler(bytes);
    expect(livro.worksheets.map((w) => w.name)).toEqual(['Orçamento', 'Lista de compras']);
  });

  it('traz o cliente, a data e o local', async () => {
    const { texto } = await reler(await montarPlanilha(orcamento, calcular(orcamento)));
    const t = texto('Orçamento');
    expect(t).toContain('Casamento Marina');
    expect(t).toContain('18/10/2026');
    expect(t).toContain('Varginha');
  });

  it('quebra a cobrança por faixa de idade', async () => {
    const { texto } = await reler(await montarPlanilha(orcamento, calcular(orcamento)));
    const t = texto('Orçamento');
    expect(t).toContain('Adultos');
    expect(t).toContain('Até 5 anos');
    expect(t).toContain('6 a 10 anos');
  });

  it('agrupa os insumos por preparo, como na planilha do cliente', async () => {
    const { texto } = await reler(await montarPlanilha(orcamento, calcular(orcamento)));
    const t = texto('Orçamento');
    expect(t).toContain('CHURRASCO');
    expect(t).toContain('PÃO DE ALHO');
    expect(t).toContain('LOUÇAS');
  });

  it('traz a seção de serviço com quem faz', async () => {
    const { texto } = await reler(await montarPlanilha(orcamento, calcular(orcamento)));
    const t = texto('Orçamento');
    expect(t).toContain('Churrasqueiro');
    expect(t).toContain('Alan');
    expect(t).toContain('Érica');
    expect(t).toContain('TOTAL SERVIÇO');
  });

  it('fecha com total geral e por convidado', async () => {
    const r = calcular(orcamento);
    const { livro } = await reler(await montarPlanilha(orcamento, r));
    const aba = livro.getWorksheet('Orçamento')!;

    const valorDe = (rotulo: string) => {
      let achado: number | undefined;
      aba.eachRow((linha) => {
        if (String(linha.getCell(1).value ?? '') === rotulo) achado = Number(linha.getCell(5).value);
      });
      return achado;
    };

    expect(valorDe('TOTAL GERAL')).toBeCloseTo(r.custoTotal, 2);
    expect(valorDe('VALOR COBRADO')).toBeCloseTo(r.preco, 2);
    expect(valorDe('POR CONVIDADO')).toBeCloseTo(r.precoPorPessoa, 2);
  });

  it('a lista de compras traz peso em kg, não em grama', async () => {
    const r = calcular(orcamento);
    const { livro } = await reler(await montarPlanilha(orcamento, r));
    const aba = livro.getWorksheet('Lista de compras')!;

    let ancho: number | undefined;
    aba.eachRow((linha) => {
      if (String(linha.getCell(1).value ?? '').trim() === 'Ancho') ancho = Number(linha.getCell(3).value);
    });

    // 40 pessoas equivalentes... 30 adultos + 6 criancas de 50% = 33
    // 33 x 100 g = 3300 g = 3,3 kg
    expect(ancho).toBeCloseTo(3.3, 1);
  });

  it('as observações do cliente entram no arquivo', async () => {
    const { texto } = await reler(await montarPlanilha(orcamento, calcular(orcamento)));
    expect(texto('Orçamento')).toContain('celíaca');
  });
});
