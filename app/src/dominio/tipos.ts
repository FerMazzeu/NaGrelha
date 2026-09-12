/** Categorias existem para agrupar na tela e na lista de compras. */
export type Categoria = 'carne' | 'entrada' | 'guarnicao';

export type Unidade = 'kg' | 'un';

export type Item = {
  id: string;
  nome: string;
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

  adultos: number;
  /** Criança come perto da metade de um adulto. */
  criancas: number;
  apetite: Apetite;

  /** Cópia dos itens no momento do orçamento: preço muda, orçamento fechado não. */
  itens: Item[];
  /** Ids dos itens que entram neste evento. */
  selecionados: string[];

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
  linhas: LinhaCalculada[];
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
};
