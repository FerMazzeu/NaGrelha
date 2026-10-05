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
const PREPARO_DE_ESCOLHA = /\bfrios\b/i;

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

/** "PÃO DE ALHO" → "Pão de alho", "salame" → "Salame". "Pão de Queijo" fica. */
export function nomeDePrato(texto: string) {
  const limpo = texto.trim();
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

const ORDEM_DAS_SECOES: Categoria[] = ['carne', 'entrada', 'guarnicao', 'bebida', 'extra'];

const TITULO_DA_SECAO: Partial<Record<Categoria, string>> = {
  entrada: 'Entradas',
  guarnicao: 'Acompanhamentos',
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

  for (const [preparo, doPreparo] of porPreparo) {
    if (NAO_E_PRATO.test(preparo.trim())) continue;

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
          titulo: nomeDePrato(preparo),
          dica: 'Marque cada um que você quer.',
          pratos: deEscolha.map((i) => ({ chave: i.id, nome: nomeDePrato(i.nome), ids: [i.id, ...junto] })),
        },
      });
      continue;
    }

    const categoria = secaoDoPrato(doPreparo);
    if (!inteiros.has(categoria)) inteiros.set(categoria, []);
    inteiros.get(categoria)!.push({
      chave: `p:${preparo}`,
      nome: nomeDePrato(preparo),
      ids: doPreparo.map((i) => i.id),
    });
  }

  const secoes: SecaoDoCardapio[] = [];
  for (const categoria of ORDEM_DAS_SECOES) {
    for (const u of umAUm.filter((x) => x.categoria === categoria)) secoes.push(u.secao);
    const pratos = inteiros.get(categoria);
    if (pratos?.length) {
      secoes.push({
        titulo: TITULO_DA_SECAO[categoria] ?? ROTULO_CATEGORIA[categoria],
        dica: 'Cada prato já vem completo.',
        pratos,
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
