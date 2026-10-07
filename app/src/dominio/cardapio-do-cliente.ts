import { ROTULO_CATEGORIA } from './catalogo';
import { orcamentoNovo } from './orcamento-novo';
import type { Categoria, FaixaEtaria, Item, Orcamento, Servico, TipoDeEvento } from './tipos';

/**
 * O cardápio que o cliente vê pelo link, e o caminho de volta até orçamento.
 *
 * O catálogo do Alan não é um cardápio: é uma lista de COMPRA. "Maionese" lá
 * dentro é batata, cenoura, alho, maionese e cheiro verde, cada um com
 * quantidade e preço. Mostrar isso ao cliente pediria que ele escolhesse
 * "alho". Então aqui o catálogo é dobrado de volta em pratos.
 */

/** O que a função pública devolve: sem preço, sem gramatura. */
export type ItemPublico = {
  id: string;
  nome: string;
  grupo: string;
  categoria: Categoria;
  ordem: number;
};

/** Uma coisa que o cliente marca. Pode levar vários ingredientes junto. */
export type Prato = {
  chave: string;
  nome: string;
  /** Os ids do catálogo que entram quando o prato é marcado. */
  ids: string[];
  /**
   * Divide uma seção em partes, como "Escolha seu molho" dentro das massas.
   * A tela mostra o subtítulo antes do primeiro prato que o traz.
   */
  subtitulo?: string;
};

export type SecaoDoCardapio = {
  titulo: string;
  /** Diz ao cliente se ali ele escolhe um a um ou o prato inteiro. */
  dica: string;
  pratos: Prato[];
};

/**
 * Preparo que é a escolha do cliente item a item.
 *
 * Em CHURRASCO cada corte é uma decisão: tem quem não queira coração, tem
 * quem só queira picanha. Já na MAIONESE ninguém escolhe ingrediente. A regra
 * é: se a MAIORIA do preparo é carne ou bebida, ele abre item a item.
 *
 * Maioria, e não metade. Com "pelo menos metade", um ARROZ CARRETEIRO de
 * arroz e bacon dava 1 de 2 e abria item a item, com o cliente escolhendo
 * "Bacon" sozinho num cardápio de festa.
 */
const ESCOLHA_UM_A_UM: Categoria[] = ['carne', 'bebida'];

/**
 * Frios também são escolha item a item, qualquer que seja a categoria.
 *
 * Presunto, salame e queijo costumam ser cadastrados como entrada, e pela
 * regra da categoria a tábua de frios viraria um prato só. Mas é o caso que o
 * Alan descreveu na ligação: ele tem uns 25 frios, e quem marca frios escolhe
 * quais quer. E na proposta em PDF, frios e carne são as únicas coisas que ele
 * quer detalhadas.
 */
/*
 * Bebidas entram pela mesma porta. A água do Alan está cadastrada como
 * "extra" dentro de BEBIDAS, e pela regra da categoria ela ia "junto" com
 * qualquer bebida marcada, como o sal grosso vai com o corte: o cliente não
 * tinha caixinha para ela, e todo pedido com refrigerante chegava com água.
 * Foi o que ele achou testando o link com dois amigos.
 */
const PREPARO_DE_ESCOLHA = /\b(frios|bebidas?)\b/i;

/**
 * Preparos que nunca são escolha do cliente.
 *
 * Louça e limpeza já não saem do banco. Estes nomes cobrem o que costuma vir
 * cadastrado como "extra": carvão e acendedor não são prato, e "Fogo" num
 * cardápio de festa parece piada.
 *
 * "Extra" e "Outros" são as gavetas de sobra do catálogo do Alan. No primeiro
 * teste com o banco de verdade elas apareceram como se fossem pratos, com uma
 * caixinha "Outros" para o cliente marcar.
 */
const NAO_E_PRATO = /^(fogo|lou[cç]as?|produtos? de limpeza|limpeza|descart[aá]veis|estrutura|equipe|extras?|outros)$/i;

/**
 * Tópicos que o Alan montou à mão, por cima da regra das categorias.
 *
 * Pela categoria, a massa caía em Acompanhamentos, o molho dois queijos em
 * Entradas e os outros dois molhos em Extras, e o hambúrguer em Entradas.
 * Nas palavras dele, parecia "que a gente analisou certinho aqui e tá
 * desorganizado". Massa artesanal é diferencial dele, e merece um tópico.
 *
 * O nome que o cliente lê fica aqui, e não no cadastro, de propósito: o nome
 * do preparo no catálogo é o que casa com a planilha do Alan na importação.
 * Renomear "Hamburguer na grelha" lá para "Hambúrguer artesanal" faria a
 * próxima planilha criar o hambúrguer de novo, duplicado.
 *
 * A ordem dos tópicos e dos preparos aqui é a ordem na tela.
 *
 * "Cardápio especial" é o nome do bloco na planilha do Alan; "Massas
 * artesanais" entra como SUBTÍTULO dentro dele, que foi a palavra que ele
 * usou no áudio ("colocar um subtítulo de massas artesanais").
 */
const TOPICOS: {
  titulo: string;
  dica: string;
  preparos: { padrao: RegExp; nome?: string; subtitulo?: string }[];
}[] = [
  {
    titulo: 'Cardápio especial',
    dica: 'Escolha a massa e o molho.',
    preparos: [
      { padrao: /^massa$/i, nome: 'Massa penne', subtitulo: 'Massas artesanais' },
      { padrao: /^massa\b/i, subtitulo: 'Massas artesanais' },
      { padrao: /^molho dois queijos?$/i, nome: 'Molho dois queijos', subtitulo: 'Escolha seu molho' },
      { padrao: /^molho ao sugo/i, nome: 'Molho ao sugo', subtitulo: 'Escolha seu molho' },
      { padrao: /^molho\b/i, subtitulo: 'Escolha seu molho' },
      // Está na planilha dele e ainda não no catálogo: entra aqui quando entrar.
      { padrao: /^legumes/i, nome: 'Legumes grelhados', subtitulo: 'Grelhados' },
    ],
  },
  {
    titulo: 'Para finalizar seu evento',
    dica: 'Servidos no fim da festa.',
    preparos: [
      { padrao: /carreteiro/i, nome: 'Carreteiro' },
      { padrao: /^macarr[aã]o no disco/i, nome: 'Macarrão no disco' },
      { padrao: /^hamb[uú]rguer/i, nome: 'Hambúrguer artesanal' },
    ],
  },
  {
    // Também da planilha, e também ainda fora do catálogo.
    titulo: 'Sobremesa',
    dica: 'Para fechar a festa.',
    preparos: [{ padrao: /sobremesa|confeitaria/i }],
  },
];

/*
  A ordem dos pratos dentro de cada seção, como na planilha do Alan.

  Sem isto a ordem era a do cadastro, e o tutu caía depois da maionese. O que
  não está aqui vem depois, na ordem do catálogo.
*/
const ORDEM_DOS_PRATOS = [
  /^p[aã]o de alho/i,
  /^chorip/i,
  /^batata r[uú]stica/i,
  /^p[aã]o de queijo/i,
  /^arroz$/i,
  /^vinagrete/i,
  /^farofa/i,
  /^tutu/i,
  /^maionese/i,
  /^salpic/i,
];

const posicaoNaPlanilha = (prato: Prato) => {
  const preparo = prato.chave.replace(/^p:/, '');
  const i = ORDEM_DOS_PRATOS.findIndex((r) => r.test(preparo.trim()));
  return i < 0 ? ORDEM_DOS_PRATOS.length : i;
};

/*
  Grafia certa para o cliente, sem mexer no cadastro.

  O nome no catálogo é o que o Alan escreveu na planilha dele, e é por ele que
  a importação casa um item com o que já existe. Corrigir "Buratta" lá faria a
  próxima planilha criar a burrata de novo. Então o catálogo fica como está, e
  o que o cliente lê, no link e no PDF, passa por esta lista.

  Ficam como estão, de propósito: Shoulder (corte do miolo da paleta, que no
  Brasil se chama assim, em inglês), Ancho e Chorizo (bife ancho e bife de
  chorizo, nomes argentinos das duas pontas do contrafilé), Panceta, Crostata,
  Terrine, e as marcas (Doritos, Pringles).

  A chave é o nome sem acento, sem caixa e com espaço normalizado: "AGUA COM
  GAS", "Agua com gás" e "água  com gás" caem todos na mesma correção.
*/
const CORRECOES: Record<string, string> = {
  'agua com gas': 'Água com gás',
  'agua sem gas': 'Água sem gás',
  // "Chopp", e não "chope" do dicionário: é como o Alan quer, e como bar e
  // marca escrevem. Fica sem entrada aqui; o arrumado normal já dá "Chopp".
  // "lt" é litro, e o Alan pediu para tirar.
  'suco lt': 'Suco',
  'refrigerantes 2lts': 'Refrigerante 2 L',
  'refrigerantes zero 2lts': 'Refrigerante zero 2 L',
  buratta: 'Burrata',
  nuthela: 'Nutella',
  // "Mussarela" é a mais comum, mas o VOLP registra "muçarela" e "mozarela".
  mussarela: 'Muçarela',
  mussarrela: 'Muçarela',
  'kibe cru/pao sirio': 'Quibe cru com pão sírio',
  'presunto parma': 'Presunto de Parma',
  // "À moda mineira": leva crase.
  'tutu a mineira': 'Tutu à mineira',
  calabreza: 'Calabresa',
  // O preparo se chama "FRIOS  ENTRADA" no catálogo, com espaço duplo, e
  // aparecia assim como título para o cliente.
  'frios entrada': 'Frios',
  // Maître, e não "metrê", que é como ele aparecia na proposta.
  'organizacao (metre)': 'Organização (maître)',
};

const chaveDeNome = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** O nome como o cliente deve ler: corrigido se estiver na lista, arrumado se não. */
export function nomeParaCliente(texto: string) {
  return CORRECOES[chaveDeNome(texto)] ?? nomeDePrato(texto);
}

/** "PÃO DE ALHO" → "Pão de alho", "salame" → "Salame". "Pão de Queijo" fica. */
export function nomeDePrato(texto: string) {
  const limpo = texto.trim().replace(/\s+/g, ' ');
  // Caixa mista fica como está, só garante a primeira maiúscula: no catálogo
  // tem "salame" cadastrado assim, e ele saía minúsculo no meio dos outros.
  const base = limpo === limpo.toUpperCase() ? limpo.toLocaleLowerCase('pt-BR') : limpo;
  return base.charAt(0).toLocaleUpperCase('pt-BR') + base.slice(1);
}

/** Onde o prato inteiro cai, pela categoria que mais aparece nele. */
function secaoDoPrato(itens: ItemPublico[]): Categoria {
  const conta = new Map<Categoria, number>();
  for (const i of itens) conta.set(i.categoria, (conta.get(i.categoria) ?? 0) + 1);
  return [...conta.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/*
  A sequência da planilha do Alan, que ele mandou pedindo "colocar nessa
  sequência": entradas, guarnições, carnes, cardápio especial, finalizações,
  sobremesa, bebidas. Os tópicos (cardápio especial em diante) entram no lugar
  marcado com `'topicos'`.

  Os frios são entrada, e por serem escolhidos item a item viram um bloco
  próprio, logo antes das outras entradas: na planilha, FRIOS é a primeira
  linha de ENTRADAS.
*/
const ORDEM_DAS_SECOES: (Categoria | 'topicos')[] = ['entrada', 'guarnicao', 'carne', 'topicos', 'bebida', 'extra'];

const TITULO_DA_SECAO: Partial<Record<Categoria, string>> = {
  entrada: 'Entradas',
  // "Guarnições", como na planilha dele.
  guarnicao: 'Guarnições',
  bebida: 'Bebidas',
  extra: 'Extras',
};

export function montarCardapio(itens: ItemPublico[]): SecaoDoCardapio[] {
  const visiveis = itens.filter((i) => i.categoria !== 'estrutura' && i.categoria !== 'limpeza');

  // Por preparo. Item sem preparo vai para o rótulo da categoria, como no app.
  const porPreparo = new Map<string, ItemPublico[]>();
  for (const i of visiveis) {
    const chave = i.grupo.trim() || ROTULO_CATEGORIA[i.categoria];
    if (!porPreparo.has(chave)) porPreparo.set(chave, []);
    porPreparo.get(chave)!.push(i);
  }

  const umAUm: { categoria: Categoria; secao: SecaoDoCardapio }[] = [];
  const inteiros = new Map<Categoria, Prato[]>();
  // Por tópico, e dentro dele pela posição da regra que pegou o preparo.
  const doTopico = TOPICOS.map(() => [] as { posicao: number; prato: Prato }[]);

  for (const [preparo, doPreparo] of porPreparo) {
    if (NAO_E_PRATO.test(preparo.trim())) continue;

    const t = TOPICOS.findIndex((x) => x.preparos.some((r) => r.padrao.test(preparo.trim())));
    if (t >= 0) {
      const posicao = TOPICOS[t].preparos.findIndex((r) => r.padrao.test(preparo.trim()));
      const regra = TOPICOS[t].preparos[posicao];
      doTopico[t].push({
        posicao,
        prato: {
          chave: `p:${preparo}`,
          nome: regra.nome ?? nomeParaCliente(preparo),
          ids: doPreparo.map((i) => i.id),
          ...(regra.subtitulo ? { subtitulo: regra.subtitulo } : {}),
        },
      });
      continue;
    }

    const tudoEscolha = PREPARO_DE_ESCOLHA.test(preparo);
    const deEscolha = tudoEscolha ? doPreparo : doPreparo.filter((i) => ESCOLHA_UM_A_UM.includes(i.categoria));
    if (tudoEscolha || deEscolha.length * 2 > doPreparo.length) {
      /*
        O que não é corte no preparo do churrasco (sal grosso, farofa de
        acompanhar) não vira opção: o cliente não escolhe sal. Ele vai junto
        com qualquer corte marcado, que é como o Alan compra.
      */
      const junto = doPreparo.filter((i) => !deEscolha.includes(i)).map((i) => i.id);
      umAUm.push({
        categoria: secaoDoPrato(deEscolha),
        secao: {
          titulo: nomeParaCliente(preparo),
          dica: 'Marque cada um que você quer.',
          pratos: deEscolha.map((i) => ({ chave: i.id, nome: nomeParaCliente(i.nome), ids: [i.id, ...junto] })),
        },
      });
      continue;
    }

    const categoria = secaoDoPrato(doPreparo);
    if (!inteiros.has(categoria)) inteiros.set(categoria, []);
    inteiros.get(categoria)!.push({
      chave: `p:${preparo}`,
      nome: nomeParaCliente(preparo),
      ids: doPreparo.map((i) => i.id),
    });
  }

  const secoes: SecaoDoCardapio[] = [];
  for (const lugar of ORDEM_DAS_SECOES) {
    if (lugar === 'topicos') {
      TOPICOS.forEach((topico, t) => {
        if (!doTopico[t].length) return;
        secoes.push({
          titulo: topico.titulo,
          dica: topico.dica,
          pratos: doTopico[t].sort((a, b) => a.posicao - b.posicao).map((x) => x.prato),
        });
      });
      continue;
    }
    for (const u of umAUm.filter((x) => x.categoria === lugar)) secoes.push(u.secao);
    const pratos = inteiros.get(lugar);
    if (pratos?.length) {
      secoes.push({
        titulo: TITULO_DA_SECAO[lugar] ?? ROTULO_CATEGORIA[lugar],
        dica: 'Cada prato já vem completo.',
        // `sort` é estável: o que não está na planilha mantém a ordem do catálogo.
        pratos: [...pratos].sort((a, b) => posicaoNaPlanilha(a) - posicaoNaPlanilha(b)),
      });
    }
  }
  return secoes;
}

// ------------------------------------------------------- pedido → orçamento --

export type CriancasDoPedido = { faixaId: string; quantidade: number }[];

/** O que o cliente mandou, como chega do banco. */
export type Pedido = {
  id: string;
  cliente: string;
  contato: string;
  tipoEvento: TipoDeEvento;
  data: string | null;
  hora: string;
  local: string;
  adultos: number;
  criancas: CriancasDoPedido;
  observacoes: string;
  itens: string[];
  criadoEm: string;
};

/**
 * Monta o rascunho a partir do pedido.
 *
 * Parte do mesmo orçamento novo que a equipe cria na mão, com os serviços de
 * sempre e o cachê pela tabela, e troca só o que o cliente disse. O preço não
 * é mostrado a ele em momento nenhum: quem fecha o preço é a equipe, ao
 * validar.
 */
export function pedidoParaOrcamento(
  pedido: Pedido,
  catalogo: Item[],
  servicos: Servico[],
  faixasDisponiveis: FaixaEtaria[],
): Orcamento {
  const faixas = pedido.criancas
    .filter((c) => c.quantidade > 0)
    .flatMap((c) => {
      const faixa = faixasDisponiveis.find((f) => f.id === c.faixaId);
      // Faixa apagada entre o pedido e a conversão: sem percentual não há
      // como cobrar, então ela não entra, e a observação abaixo registra.
      if (!faixa) return [];
      return [
        {
          id: `nova-${faixa.id}`,
          faixaId: faixa.id,
          nome: faixa.nome,
          percentual: faixa.percentual,
          quantidade: Math.round(c.quantidade),
        },
      ];
    });

  const convidados = pedido.adultos + faixas.reduce((s, f) => s + f.quantidade, 0);
  const base = orcamentoNovo(catalogo, servicos, pedido.adultos, {
    tipo: pedido.tipoEvento,
    convidados,
  });

  // Item que saiu do catálogo depois do pedido não volta como fantasma.
  const existentes = new Set(base.itens.map((i) => i.id));
  const selecionados = [...new Set(pedido.itens)].filter((id) => existentes.has(id));

  const perdidos = pedido.itens.length - selecionados.length;
  const criancasPerdidas = pedido.criancas.filter(
    (c) => c.quantidade > 0 && !faixasDisponiveis.some((f) => f.id === c.faixaId),
  ).length;

  const notas = [
    `Pedido feito pelo cliente no link em ${new Date(pedido.criadoEm).toLocaleDateString('pt-BR')}.`,
    perdidos > 0 ? `${perdidos} item(ns) marcado(s) pelo cliente não existe(m) mais no catálogo.` : '',
    criancasPerdidas > 0 ? 'Uma faixa de idade das crianças não existe mais: confira os convidados.' : '',
    pedido.observacoes.trim() ? `Recado do cliente: ${pedido.observacoes.trim()}` : '',
  ].filter(Boolean);

  return {
    ...base,
    cliente: pedido.cliente.trim(),
    contato: pedido.contato.trim(),
    data: pedido.data ?? '',
    hora: pedido.hora,
    local: pedido.local.trim(),
    tipoEvento: pedido.tipoEvento,
    situacao: 'rascunho',
    faixas,
    selecionados,
    observacoes: notas.join('\n'),
  };
}
