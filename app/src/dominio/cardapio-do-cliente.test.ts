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
    // Saiu como "Carreteiro" desde que foi para o tópico de finalização.
    const carreteiro = todos.find((p) => p.nome === 'Carreteiro')!;

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

  it('segue a sequência da planilha do Alan: entradas, guarnições, carnes', () => {
    // "Poderia colocar nessa sequência", com a planilha dele em anexo.
    // O carreteiro deste catálogo vai para o tópico de finalização.
    expect(titulos).toEqual(['Entradas', 'Guarnições', 'Churrasco', 'Para finalizar seu evento']);
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

  it('água em bebidas é opção para marcar, mesmo cadastrada como extra', () => {
    // Era assim no banco: a água como "extra" ia junto com qualquer bebida.
    const [bebidas] = montarCardapio([
      pub('ref', 'REFRIGERANTES 2LTS', 'BEBIDAS', 'bebida'),
      pub('chp', 'CHOPP', 'BEBIDAS', 'bebida'),
      pub('agc', 'Agua com gás', 'BEBIDAS', 'extra'),
      pub('ags', 'Agua sem gás', 'BEBIDAS', 'extra'),
    ]);

    expect(bebidas.titulo).toBe('Bebidas');
    // Já com a grafia corrigida para o cliente (ver CORRECOES).
    expect(bebidas.pratos.map((p) => p.nome)).toEqual(['Refrigerante 2 L', 'Chopp', 'Água com gás', 'Água sem gás']);
    expect(bebidas.pratos.find((p) => p.chave === 'ref')!.ids).toEqual(['ref']);
  });

  it('a regra dos frios não pega preparo que só contém a palavra', () => {
    // "FRIOSO" não existe, mas a regra é pela palavra inteira, e não por pedaço.
    const secoes = montarCardapio([pub('a', 'Arroz', 'ARROZ FRIOSO', 'guarnicao'), pub('b', 'Sal', 'ARROZ FRIOSO', 'guarnicao')]);

    expect(secoes[0].pratos.map((p) => p.nome)).toEqual(['Arroz frioso']);
  });

  /*
    Os preparos com os nomes exatos do banco: é assim que o Alan cadastrou, e
    é contra isso que os tópicos precisam funcionar.
  */
  const DO_BANCO = [
    pub('pen', 'PENNE', 'MASSA', 'guarnicao'),
    pub('par', 'QUEIJO PARMESÃO', 'MASSA', 'guarnicao'),
    pub('m2q', 'Provolone', 'MOLHO DOIS QUEIJO', 'entrada'),
    pub('sug', 'Tomate', 'MOLHO AO SUGO ARTESANAL', 'extra'),
    pub('fra', 'Fraldinha', 'MOLHO DE FRALDINHA', 'carne'),
    pub('fal', 'Alho', 'MOLHO DE FRALDINHA', 'extra'),
    pub('fce', 'Cebola', 'MOLHO DE FRALDINHA', 'extra'),
    pub('arr', 'Arroz', 'Arroz carreteiro', 'guarnicao'),
    pub('mac', 'Macarrão penne', 'Macarrão no disco Finalização', 'guarnicao'),
    pub('ham', 'Pão de hambúrguer', 'Hamburguer na grelha', 'entrada'),
    pub('far', 'Farinha', 'Farofa na grelha', 'guarnicao'),
  ];

  it('massa e molhos ficam juntos no "Cardápio especial", como na planilha', () => {
    const massas = montarCardapio(DO_BANCO).find((s) => s.titulo === 'Cardápio especial')!;

    expect(massas.pratos.map((p) => p.nome)).toEqual([
      'Massa penne',
      'Molho dois queijos',
      'Molho ao sugo',
      'Molho de fraldinha',
    ]);
  });

  it('a massa vem sob "Massas artesanais" e os molhos sob "Escolha seu molho"', () => {
    // "Massas artesanais" como subtítulo: foi a palavra que o Alan usou no áudio.
    const massas = montarCardapio(DO_BANCO).find((s) => s.titulo === 'Cardápio especial')!;

    expect(massas.pratos.map((p) => p.subtitulo ?? '')).toEqual([
      'Massas artesanais',
      'Escolha seu molho',
      'Escolha seu molho',
      'Escolha seu molho',
    ]);
  });

  it('o molho de fraldinha é prato inteiro, e não a fraldinha para escolher', () => {
    // Tem fraldinha dentro, mas é molho: marcar o molho leva tudo.
    const molho = montarCardapio(DO_BANCO).flatMap((s) => s.pratos).find((p) => p.nome === 'Molho de fraldinha')!;

    expect(molho.ids.sort()).toEqual(['fal', 'fce', 'fra']);
  });

  it('"Para finalizar seu evento" com carreteiro, macarrão no disco e hambúrguer', () => {
    const fim = montarCardapio(DO_BANCO).find((s) => s.titulo === 'Para finalizar seu evento')!;

    expect(fim.pratos.map((p) => p.nome)).toEqual(['Carreteiro', 'Macarrão no disco', 'Hambúrguer artesanal']);
  });

  it('o que foi para os tópicos sai das seções de antes', () => {
    const secoes = montarCardapio(DO_BANCO);
    const nomes = secoes.flatMap((s) => s.pratos.map((p) => p.nome));

    // Cada um aparece uma vez só.
    expect(nomes.filter((n) => /carreteiro|hamb|massa|molho|macarr/i.test(n)).length).toBe(7);
    // E a farofa, que não é de tópico nenhum, continua em Guarnições.
    expect(secoes.find((s) => s.titulo === 'Guarnições')?.pratos.map((p) => p.nome)).toEqual(['Farofa na grelha']);
  });

  it('a sequência inteira da planilha, de entradas até bebidas', () => {
    const titulos = montarCardapio([
      ...DO_BANCO,
      pub('pic', 'Picanha', 'Carnes para churrasco', 'carne'),
      pub('pao', 'Pão francês', 'Pão de alho', 'entrada'),
      pub('frs', 'Salame', 'FRIOS  ENTRADA', 'entrada'),
      pub('leg', 'Abobrinha', 'LEGUMES GRELHADO', 'guarnicao'),
      pub('doc', 'Bolo', 'SOBREMESA', 'extra'),
      pub('chp', 'Chopp', 'BEBIDAS', 'bebida'),
    ]).map((s) => s.titulo);

    expect(titulos).toEqual([
      'Frios',
      'Entradas',
      'Guarnições',
      'Carnes para churrasco',
      'Cardápio especial',
      'Para finalizar seu evento',
      'Sobremesa',
      'Bebidas',
    ]);
  });

  it('dentro das guarnições, a ordem é a da planilha, e não a do cadastro', () => {
    // No cadastro a maionese vem antes do tutu; na planilha do Alan, depois.
    const guarnicoes = montarCardapio([
      pub('s', 'Batata palha', 'SALPICÃO', 'guarnicao'),
      pub('m', 'Batata', 'Maionese', 'guarnicao'),
      pub('t', 'Feijão', 'TUTU A MINEIRA', 'guarnicao'),
      pub('f', 'Farinha', 'Farofa na grelha', 'guarnicao'),
      pub('x', 'Cuscuz', 'Cuscuz paulista', 'guarnicao'),
      pub('v', 'Tomate', 'Vinagrete defumado', 'guarnicao'),
      pub('a', 'Arroz branco', 'Arroz', 'guarnicao'),
    ])[0].pratos.map((p) => p.nome);

    // O cuscuz não está na planilha: vai para o fim.
    expect(guarnicoes).toEqual([
      'Arroz',
      'Vinagrete defumado',
      'Farofa na grelha',
      'Tutu à mineira',
      'Maionese',
      'Salpicão',
      'Cuscuz paulista',
    ]);
  });

  it('legumes grelhados entram no cardápio especial quando forem cadastrados', () => {
    const especial = montarCardapio([...DO_BANCO, pub('leg', 'Abobrinha', 'LEGUMES GRELHADO', 'guarnicao')]).find(
      (s) => s.titulo === 'Cardápio especial',
    )!;

    expect(especial.pratos.at(-1)).toMatchObject({ nome: 'Legumes grelhados', subtitulo: 'Grelhados' });
  });

  it('"Suco lt" vira só "Suco": o lt era litro, e o Alan pediu para tirar', () => {
    const [bebidas] = montarCardapio([pub('s', 'SUCO LT', 'BEBIDAS', 'bebida')]);

    expect(bebidas.pratos[0].nome).toBe('Suco');
  });

  it('o cliente lê a grafia certa, sem mudar o cadastro', () => {
    const nomes = montarCardapio([
      pub('a', 'Buratta', 'FRIOS  ENTRADA', 'entrada'),
      pub('b', 'NUTHELA', 'FRIOS  ENTRADA', 'entrada'),
      pub('c', 'kibe cru/pão sirio', 'FRIOS  ENTRADA', 'entrada'),
      pub('d', 'Presunto parma', 'FRIOS  ENTRADA', 'entrada'),
      pub('e', 'Feijão', 'TUTU A MINEIRA', 'guarnicao'),
    ]).map((s) => `${s.titulo}: ${s.pratos.map((p) => p.nome).join(', ')}`);

    expect(nomes).toEqual([
      'Frios: Burrata, Nutella, Quibe cru com pão sírio, Presunto de Parma',
      'Guarnições: Tutu à mineira',
    ]);
  });

  it('corte com nome estrangeiro fica como é chamado no Brasil', () => {
    const cortes = montarCardapio([
      pub('s', 'Shoulder', 'Carnes para churrasco', 'carne'),
      pub('a', 'Ancho', 'Carnes para churrasco', 'carne'),
      pub('c', 'Chorizo', 'Carnes para churrasco', 'carne'),
      pub('p', 'Panceta', 'Carnes para churrasco', 'carne'),
    ])[0].pratos.map((p) => p.nome);

    expect(cortes).toEqual(['Shoulder', 'Ancho', 'Chorizo', 'Panceta']);
  });

  it('o nome em caixa alta da planilha vira nome de cardápio', () => {
    expect(nomeDePrato('PÃO DE ALHO')).toBe('Pão de alho');
    expect(nomeDePrato('Coração de frango')).toBe('Coração de frango');
    // Cadastrado minúsculo no catálogo de verdade.
    expect(nomeDePrato('salame')).toBe('Salame');
  });

  it('"Extra" e "Outros" são gaveta do catálogo, não prato', () => {
    const secoes = montarCardapio([
      pub('ger', 'Geleia', 'Geleias artesanais', 'extra'),
      pub('x1', 'Gelo', 'Extra', 'extra'),
      pub('x2', 'Guardanapo', 'OUTROS', 'extra'),
    ]);

    expect(secoes.flatMap((s) => s.pratos.map((p) => p.nome))).toEqual(['Geleias artesanais']);
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
