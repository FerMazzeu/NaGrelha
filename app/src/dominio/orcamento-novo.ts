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
   * orçamento feito na mão continua sugerindo cachê como sempre sugeriu.
   */
  sugestao: { tipo: TipoDeEvento | null; convidados: number } = { tipo: null, convidados: adultos },
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
