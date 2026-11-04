import { FATOR_CARVAO_PADRAO, MARGEM_PADRAO, PRECO_CARVAO_PADRAO, SELECAO_PADRAO } from './catalogo';
import { valorSugerido } from './calculo';
import type { Item, Orcamento, Servico, TipoDeEvento } from './tipos';
import { novoId } from '../formato';

/*
  Morava dentro do App.tsx. Saiu de lá quando o pedido do cliente pelo link
  passou a virar orçamento também: as duas portas precisam da mesma regra de
  partida, senão o rascunho do link nasce com serviço diferente do orçamento
  que a equipe cria na mão.
*/

/** Serviços que todo evento leva, conforme a planilha do cliente. */
const SERVICOS_DE_PARTIDA = ['Churrasqueiro', 'Organização (metrê)', 'Imposto (DAS)', 'Caixa'];

export function orcamentoNovo(
  catalogo: Item[],
  servicos: Servico[],
  adultos = 30,
  /**
   * Só o pedido do link passa: ele já sabe o tipo e o total com crianças. O
   * feito na mão nasce aniversário (ver `tipoEvento` abaixo), e o cachê sai da
   * tabela de aniversário. Com `null` ele procurava uma tabela "sem tipo",
   * que não existe mais, e nascia com o valor padrão em vez do da tabela.
   */
  sugestao: { tipo: TipoDeEvento | null; convidados: number } = { tipo: 'aniversario', convidados: adultos },
): Orcamento {
  const agora = new Date().toISOString();
  return {
    id: novoId(),
    cliente: '',
    contato: '',
    data: '',
    hora: '',
    local: '',
    observacoes: '',
    situacao: 'orcado',
    tipoEvento: 'aniversario',
    adultos,
    faixas: [],
    apetite: 'normal',
    duracaoHoras: 5,
    // Cópia do catálogo: o preço da picanha muda, o orçamento fechado não.
    itens: catalogo.map((i) => ({ ...i })),
    // Por nome, e nao por id: os ids agora vem do banco e mudam por projeto.
    selecionados: catalogo.filter((i) => SELECAO_PADRAO.includes(i.nome)).map((i) => i.id),
    // Já vem com o básico: esquecer a linha de serviço é o erro mais caro
    // possível aqui, porque ela sozinha passa dos insumos no orçamento deles.
    servicos: servicos
      .filter((s) => SERVICOS_DE_PARTIDA.includes(s.nome))
      .map((s) => ({
        id: `novo-${s.id}`,
        servicoId: s.id,
        nome: s.nome,
        papel: s.papel,
        pessoa: '',
        percentual: s.percentual,
        valorManual: false,
        quantidade: 1,
        valor: valorSugerido(s, sugestao.convidados, sugestao.tipo),
      })),
    custosExtras: [],
    margem: MARGEM_PADRAO,
    fatorCarvao: FATOR_CARVAO_PADRAO,
    precoCarvao: PRECO_CARVAO_PADRAO,
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

/**
 * Preço que faltava no orçamento, puxado do catálogo.
 *
 * O orçamento guarda uma cópia do item, e é isso que segura o preço de um
 * evento fechado. Mas item cadastrado ainda sem preço entra na cópia com zero,
 * e quando a equipe põe o preço no catálogo o orçamento continua com zero: a
 * mandioca na manteiga foi marcada em vários orçamentos e não cobrava nada.
 *
 * Só o zero é trocado. Preço que já existe no orçamento fica como está, mesmo
 * diferente do catálogo. E só em rascunho e orçado: evento confirmado não muda
 * de valor sozinho. Devolve o mesmo objeto quando não há nada a preencher.
 */
export function comPrecosQueFaltavam(orcamento: Orcamento, catalogo: Item[]): Orcamento {
  if (orcamento.situacao !== 'rascunho' && orcamento.situacao !== 'orcado') return orcamento;
  const preco = new Map(catalogo.map((i) => [i.id, i.preco]));
  let mudou = false;
  const itens = orcamento.itens.map((i) => {
    const doCatalogo = preco.get(i.id) ?? 0;
    if (i.preco > 0 || doCatalogo <= 0) return i;
    mudou = true;
    return { ...i, preco: doCatalogo };
  });
  return mudou ? { ...orcamento, itens } : orcamento;
}
