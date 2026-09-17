/** Categorias existem para agrupar na tela e na lista de compras. */
export type Categoria =
  | 'carne'
  | 'entrada'
  | 'guarnicao'
  | 'bebida'
  /** louça, rechô, bandeja: o que volta para casa depois do evento */
  | 'estrutura'
  | 'limpeza'
  | 'extra';

export type Unidade = 'kg' | 'un';

export type Item = {
  id: string;
  nome: string;
  /**
   * O preparo a que o item pertence: "Pão de alho", "Churrasco", "Maionese".
   *
   * É assim que o orçamento do cliente é organizado, e faz diferença: quatro
   * linhas de "Cheiro verde" em preparos diferentes não são duplicata, são
   * compras separadas que somam na lista.
   */
  grupo: string;
  categoria: Categoria;
  unidade: Unidade;

  /**
   * Quanto cada pessoa consome.
   *
   * Para carne é o peso QUE CHEGA AO PRATO, já assado e sem osso. Para o
   * resto é a quantidade no estado em que se compra, porque ninguém pensa
   * em arroz de outro jeito.
   *
   * Em gramas quando a unidade é kg, e em unidades quando é un.
   */
  porPessoa: number;

  /**
   * Quanto sobra do que você comprou, depois do osso, da gordura aparada e
   * da perda na brasa. Vai de 0 a 1.
   *
   * É a conta que a planilha não faz e que faz faltar carne na festa: costela
   * com osso rende perto de metade, então 400 g no prato são 800 g na compra.
   */
  rendimento: number;

  /** Custo por quilo, ou por unidade quando a unidade é `un`. */
  preco: number;
};

export type CustoExtra = {
  id: string;
  descricao: string;
  valor: number;
};

/** O apetite multiplica todo mundo de uma vez, sem mexer item por item. */
export type Apetite = 'leve' | 'normal' | 'forte';

/** O funil do evento. É o que a agenda usa para colorir e separar. */
export type Situacao = 'orcado' | 'confirmado' | 'realizado' | 'perdido';

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  orcado: 'Orçado',
  confirmado: 'Confirmado',
  realizado: 'Realizado',
  perdido: 'Perdido',
};

/** Equipe cobra por pessoa no evento; imposto e caixa sao linha fixa. */
export type PapelDeServico = 'equipe' | 'frete' | 'imposto' | 'taxa' | 'locacao';

export const ROTULO_PAPEL: Record<PapelDeServico, string> = {
  equipe: 'Equipe',
  frete: 'Frete',
  imposto: 'Imposto',
  taxa: 'Taxa',
  locacao: 'Locação',
};

/**
 * O tipo de evento, porque o cachê depende dele.
 *
 * O Alan cobra mais em casamento e festa de 15 anos que em aniversário e
 * corporativo, para o mesmo número de convidados. São duas tabelas diferentes,
 * e não um acréscimo por cima de uma só.
 */
export type TipoDeEvento = 'aniversario' | 'casamento';

export const ROTULO_TIPO_EVENTO: Record<TipoDeEvento, string> = {
  aniversario: 'Aniversário, corporativo',
  casamento: 'Casamento, 15 anos',
};

/**
 * Cachê que muda com o tamanho do evento. `max` nulo é "daqui para cima".
 *
 * `tipo` nulo significa que a faixa vale para qualquer tipo de evento, que é
 * como as faixas antigas funcionavam. As tabelas novas do Alan são por tipo.
 */
export type FaixaDeCache = {
  min: number;
  max: number | null;
  valor: number;
  tipo: TipoDeEvento | null;
};

export type Servico = {
  id: string;
  nome: string;
  papel: PapelDeServico;
  valorPadrao: number;
  usaFaixa: boolean;
  faixas: FaixaDeCache[];
  /**
   * Percentual sobre o total do orçamento. Zero significa valor fixo.
   *
   * É como o imposto funciona de verdade: o Alan paga 7% do que cobra, e não
   * 7% do que gasta. Isso é circular (o imposto entra no total sobre o qual
   * ele é calculado), e `calcular` resolve a circularidade em vez de aproximar.
   */
  percentual: number;
};

/** Uma linha de serviço dentro de um orçamento. */
export type ServicoDoEvento = {
  id: string;
  servicoId: string | null;
  nome: string;
  papel: PapelDeServico;
  /** Quem vai fazer. Na planilha do cliente isso é uma coluna. */
  pessoa: string;
  quantidade: number;
  valor: number;
  /** Percentual do total. Zero usa `quantidade x valor`. */
  percentual: number;
  /**
   * Alguém digitou o valor à mão.
   *
   * Sem isto, mudar o número de convidados sobrescreveria um desconto que a
   * Érica deu de propósito. Com isto, a tabela só manda enquanto ninguém
   * mexeu naquela linha.
   */
  valorManual: boolean;
};

/**
 * Faixa etária das crianças.
 *
 * Substitui a regra fixa de "criança paga metade". O percentual vale para as
 * duas pontas da conta: quanto a criança come e quanto ela paga.
 */
export type FaixaEtaria = {
  id: string;
  nome: string;
  idadeMin: number;
  idadeMax: number | null;
  percentual: number;
};

export type FaixaNoEvento = {
  id: string;
  faixaId: string | null;
  nome: string;
  percentual: number;
  quantidade: number;
};

/**
 * Quem tem login no app.
 *
 * `aprovado` e o que a RLS olha: perfil pendente enxerga zero linha de
 * negocio, independente do que a tela mostre.
 */
export type Perfil = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  papel: 'dono' | 'equipe';
  aprovado: boolean;
  criadoEm: string;
};

/** Uma conversa do assistente. O histórico da barra lateral. */
export type Conversa = {
  id: string;
  titulo: string;
  eventoId: string | null;
  atualizadoEm: string;
};

/**
 * Arquivo que a pessoa mandou junto da mensagem: foto de referencia, audio
 * gravado, planilha em texto.
 *
 * `caminho` e a posicao no bucket privado, e nunca uma URL: link assinado
 * expira, entao ele e pedido na hora de mostrar.
 */
export type Anexo = {
  caminho: string;
  mime: string;
  nome: string;
};

export type MensagemSalva = {
  id: string;
  papel: 'user' | 'assistant';
  conteudo: string;
  /** Caminho no bucket quando a mensagem trouxe imagem. */
  imagemUrl: string | null;
  anexos: Anexo[];
  criadoEm: string;
};

export type Membro = {
  id: string;
  nome: string;
  funcao: string;
  telefone: string;
  cachePadrao: number;
  ativo: boolean;
};

export type Escala = {
  id: string;
  eventoId: string;
  membroId: string;
  funcao: string;
  cache: number;
  confirmado: boolean;
};

export type Orcamento = {
  id: string;
  cliente: string;
  contato: string;
  data: string;
  hora: string;
  local: string;
  observacoes: string;
  situacao: Situacao;
  /** Manda no cachê da equipe: casamento custa mais que aniversário. */
  tipoEvento: TipoDeEvento;

  adultos: number;
  /**
   * Crianças por faixa etária. Cada faixa tem um percentual que diz quanto
   * daquele convidado conta, para comer e para pagar.
   */
  faixas: FaixaNoEvento[];
  apetite: Apetite;
  duracaoHoras: number;

  /** Cópia dos itens no momento do orçamento: preço muda, orçamento fechado não. */
  itens: Item[];
  /** Ids dos itens que entram neste evento. */
  selecionados: string[];

  servicos: ServicoDoEvento[];
  custosExtras: CustoExtra[];
  /** Markup sobre o custo, em porcentagem. 60 significa custo mais 60%. */
  margem: number;
  /** Quilos de carvão por quilo de carne crua. */
  fatorCarvao: number;
  precoCarvao: number;

  criadoEm: string;
  atualizadoEm: string;
};

export type LinhaCalculada = {
  item: Item;
  /** Total que vai ao prato, somando todos os convidados. */
  servido: number;
  /** Total a comprar, já corrigido pelo aproveitamento. */
  comprar: number;
  custo: number;
};

export type Resultado = {
  pessoasEquivalentes: number;
  /** Cabeças de verdade, para a linha de "X convidados" na proposta. */
  convidados: number;
  linhas: LinhaCalculada[];
  servicos: { servico: ServicoDoEvento; total: number }[];
  custoServicos: number;
  /** Gramas de carne no prato, por pessoa. O número que o Alan discute. */
  carnePorPessoa: number;
  /** Quilos de carne crua a comprar. */
  carneCrua: number;
  carvaoKg: number;
  custoCarvao: number;
  custoItens: number;
  custosExtras: number;
  custoTotal: number;
  custoPorPessoa: number;
  preco: number;
  precoPorPessoa: number;
  lucro: number;
  /** Margem sobre o preço de venda, que é diferente do markup sobre o custo. */
  margemSobrePreco: number;
  /** Quanto um adulto paga. Criança paga a fração da faixa dela. */
  precoPorAdulto: number;
  cobranca: { rotulo: string; quantidade: number; unitario: number; total: number }[];
};
