import { describe, expect, it } from 'vitest';
import { montarCardapio, nomeDePrato, pedidoParaOrcamento, type ItemPublico, type Pedido } from './cardapio-do-cliente';
import type { Categoria, FaixaEtaria, Item, Servico } from './tipos';

const pub = (id: string, nome: string, grupo: string, categoria: Categoria): ItemPublico => ({
  id,
  nome,
  grupo,
  categoria,
  ordem: 0,
});

/** O formato da planilha do Alan: ingrediente agrupado por preparo. */
const CATALOGO_PUBLICO: ItemPublico[] = [
  pub('pic', 'Picanha', 'CHURRASCO', 'carne'),
  pub('fra', 'Fraldinha', 'CHURRASCO', 'carne'),
  pub('cor', 'Coração de frango', 'CHURRASCO', 'carne'),
  pub('pao', 'Pão francês', 'PÃO DE ALHO', 'entrada'),
  pub('mus', 'Mussarela', 'PÃO DE ALHO', 'entrada'),
  pub('bat', 'Batata inglesa', 'MAIONESE', 'guarnicao'),
  pub('alh', 'Alho', 'MAIONESE', 'guarnicao'),
  pub('arr', 'Arroz', 'ARROZ CARRETEIRO', 'guarnicao'),
  pub('bac', 'Bacon', 'ARROZ CARRETEIRO', 'carne'),
  pub('cvn', 'Carvão', 'FOGO', 'extra'),
  pub('cop', 'Copo', 'LOUÇAS', 'estrutura'),
];

describe('cardápio do cliente', () => {
  const secoes = montarCardapio(CATALOGO_PUBLICO);
  const titulos = secoes.map((s) => s.titulo);
  const todos = secoes.flatMap((s) => s.pratos);

  it('o churrasco abre corte a corte', () => {
    const churrasco = secoes.find((s) => s.titulo === 'Churrasco')!;

    expect(churrasco.pratos.map((p) => p.nome)).toEqual(['Picanha', 'Fraldinha', 'Coração de frango']);
    expect(churrasco.pratos[0].ids).toEqual(['pic']);
  });

  it('a maionese é um prato só, e leva os ingredientes junto', () => {
    // O cliente não escolhe "alho". Ele escolhe maionese.
    const maionese = todos.find((p) => p.nome === 'Maionese')!;

    expect(maionese.ids.sort()).toEqual(['alh', 'bat']);
    expect(todos.some((p) => p.nome === 'Alho')).toBe(false);
  });

  it('bacon no carreteiro é tempero, não corte para escolher', () => {
    // Arroz e bacon: 1 carne em 2. Com "pelo menos metade" isso abria item a
    // item e o cliente via "Bacon" sozinho no cardápio.
    const carreteiro = todos.find((p) => p.nome === 'Arroz carreteiro')!;

    expect(carreteiro.ids.sort()).toEqual(['arr', 'bac']);
    expect(todos.some((p) => p.nome === 'Bacon')).toBe(false);
  });

  it('o sal grosso do churrasco vai junto com o corte, e não vira opção', () => {
    const [churrasco] = montarCardapio([
      pub('pic', 'Picanha', 'CHURRASCO', 'carne'),
      pub('fra', 'Fraldinha', 'CHURRASCO', 'carne'),
      pub('sal', 'Sal grosso', 'CHURRASCO', 'extra'),
    ]);

    expect(churrasco.pratos.map((p) => p.nome)).toEqual(['Picanha', 'Fraldinha']);
    expect(churrasco.pratos[0].ids).toEqual(['pic', 'sal']);
  });

  it('fogo e louça nunca viram prato', () => {
    expect(todos.some((p) => /carv[aã]o|fogo|copo/i.test(p.nome))).toBe(false);
  });

  it('a carne vem primeiro, depois entradas e acompanhamentos', () => {
    expect(titulos[0]).toBe('Churrasco');
    expect(titulos.indexOf('Entradas')).toBeLessThan(titulos.indexOf('Acompanhamentos'));
  });

  it('frios abrem item a item, mesmo cadastrados como entrada', () => {
    // O Alan tem uns 25 frios, e quem quer frios escolhe quais.
    const [frios] = montarCardapio([
      pub('pre', 'Presunto', 'FRIOS', 'entrada'),
      pub('sal', 'Salame', 'FRIOS', 'entrada'),
      pub('que', 'Queijo prato', 'FRIOS', 'entrada'),
    ]);

    expect(frios.titulo).toBe('Frios');
    expect(frios.pratos.map((p) => p.nome)).toEqual(['Presunto', 'Salame', 'Queijo prato']);
    expect(frios.pratos[0].ids).toEqual(['pre']);
  });

  it('a regra dos frios não pega preparo que só contém a palavra', () => {
    // "FRIOSO" não existe, mas a regra é pela palavra inteira, e não por pedaço.
    const secoes = montarCardapio([pub('a', 'Arroz', 'ARROZ FRIOSO', 'guarnicao'), pub('b', 'Sal', 'ARROZ FRIOSO', 'guarnicao')]);

    expect(secoes[0].pratos.map((p) => p.nome)).toEqual(['Arroz frioso']);
  });

  it('o nome em caixa alta da planilha vira nome de cardápio', () => {
    expect(nomeDePrato('PÃO DE ALHO')).toBe('Pão de alho');
    expect(nomeDePrato('Coração de frango')).toBe('Coração de frango');
  });
});

// ------------------------------------------------------------------ pedido --

const item = (id: string, nome: string): Item => ({
  id,
  nome,
  grupo: 'CHURRASCO',
  categoria: 'carne',
  unidade: 'kg',
  porPessoa: 100,
  rendimento: 0.7,
  preco: 50,
});

const CATALOGO: Item[] = [item('pic', 'Picanha'), item('fra', 'Fraldinha'), item('cor', 'Coração de frango')];

const SERVICOS: Servico[] = [
  {
    id: 's1',
    nome: 'Churrasqueiro',
    papel: 'equipe',
    valorPadrao: 400,
    usaFaixa: true,
    faixas: [
      { min: 0, max: 99, valor: 500, tipo: 'aniversario' },
      { min: 0, max: 99, valor: 900, tipo: 'casamento' },
    ],
    percentual: 0,
  } as Servico,
];

const FAIXAS: FaixaEtaria[] = [
  { id: 'kid', nome: '0 a 5 anos', idadeMin: 0, idadeMax: 5, percentual: 0 },
  { id: 'teen', nome: '6 a 10 anos', idadeMin: 6, idadeMax: 10, percentual: 50 },
];

const PEDIDO: Pedido = {
  id: 'p1',
  cliente: '  Beltrana  ',
  contato: '(35) 99999-0000',
  tipoEvento: 'casamento',
  data: '2026-11-08',
  hora: '12:00',
  local: 'Lavras',
  adultos: 60,
  criancas: [
    { faixaId: 'teen', quantidade: 8 },
    { faixaId: 'kid', quantidade: 0 },
  ],
  observacoes: 'Tem gente vegetariana.',
  itens: ['pic', 'fra', 'fra'],
  criadoEm: '2026-10-04T15:00:00Z',
};

describe('pedido do link vira rascunho', () => {
  const o = pedidoParaOrcamento(PEDIDO, CATALOGO, SERVICOS, FAIXAS);

  it('nasce como rascunho, para alguém validar', () => {
    expect(o.situacao).toBe('rascunho');
  });

  it('leva os dados do cliente', () => {
    expect(o).toMatchObject({
      cliente: 'Beltrana',
      contato: '(35) 99999-0000',
      data: '2026-11-08',
      hora: '12:00',
      local: 'Lavras',
      adultos: 60,
      tipoEvento: 'casamento',
    });
  });

  it('marca só o que o cliente escolheu, sem repetir', () => {
    expect(o.selecionados).toEqual(['pic', 'fra']);
  });

  it('as crianças entram na faixa certa, e faixa zerada não entra', () => {
    expect(o.faixas).toEqual([
      expect.objectContaining({ faixaId: 'teen', nome: '6 a 10 anos', percentual: 50, quantidade: 8 }),
    ]);
  });

  it('o cachê sai pela tabela do tipo de evento que o cliente disse', () => {
    // Casamento paga mais. Se o tipo não chegasse, sairia o de aniversário.
    expect(o.servicos[0].valor).toBe(900);
  });

  it('o recado do cliente vai para as observações', () => {
    expect(o.observacoes).toContain('Tem gente vegetariana.');
    expect(o.observacoes).toContain('Pedido feito pelo cliente no link');
  });

  it('item que saiu do catálogo não volta como fantasma, e fica registrado', () => {
    const r = pedidoParaOrcamento({ ...PEDIDO, itens: ['pic', 'sumiu'] }, CATALOGO, SERVICOS, FAIXAS);

    expect(r.selecionados).toEqual(['pic']);
    expect(r.observacoes).toMatch(/não existe\(m\) mais no catálogo/);
  });

  it('pedido sem data não inventa uma', () => {
    expect(pedidoParaOrcamento({ ...PEDIDO, data: null }, CATALOGO, SERVICOS, FAIXAS).data).toBe('');
  });
});
