import { FATOR_CARVAO_PADRAO, MARGEM_PADRAO, PRECO_CARVAO_PADRAO } from './catalogo';
import { calcular } from './calculo';
import type { Orcamento, Resultado, Situacao, TipoDeEvento } from './tipos';
import { novoId } from '../formato';

/*
  Evento fechado fora do app.

  O Alan fechou festa pela planilha e pelo WhatsApp muito antes de o app
  existir, e ainda fecha de vez em quando. Sem esses eventos aqui dentro, a
  agenda mostra metade do mês e o financeiro, quando vier, soma metade do
  faturamento.

  Remontar cada um item por item seria inventar um cardápio que ninguém sabe
  mais qual foi. Então ele entra só com o que se sabe de verdade: quem, quando,
  quantos e por quanto. O preço é o combinado, e não uma conta.
*/

/** Evento que entrou com o valor combinado, sem orçamento montado no app. */
export const fechadoPorFora = (o: Pick<Orcamento, 'valorFechado'>) =>
  o.valorFechado !== null && o.valorFechado !== undefined;

/**
 * Quanto o evento vale, venha de onde vier.
 *
 * Toda tela que mostra ou soma preço de evento passa por aqui. Somar
 * `calcular(o).preco` direto dava zero para o evento de fora, que não tem
 * item nenhum para calcular.
 */
export function precoDoEvento(o: Orcamento, resultado?: Resultado) {
  if (fechadoPorFora(o)) return o.valorFechado as number;
  return (resultado ?? calcular(o)).preco;
}

export type DadosDoEventoExterno = {
  cliente: string;
  contato?: string;
  data?: string;
  hora?: string;
  local?: string;
  observacoes?: string;
  convidados: number;
  valor: number;
  tipoEvento?: TipoDeEvento;
  situacao?: Situacao;
};

/**
 * Situação de quem não disse a sua: evento que já passou foi realizado, o
 * resto está confirmado. Se ele está sendo trazido para cá, foi fechado.
 */
export function situacaoPelaData(data: string, hoje = new Date().toISOString().slice(0, 10)): Situacao {
  return data && data < hoje ? 'realizado' : 'confirmado';
}

/**
 * Monta o evento externo.
 *
 * Sem itens e sem serviços de propósito. Cada orçamento do app copia o
 * catálogo inteiro (uns 150 itens), e importar cem eventos antigos assim
 * seriam quinze mil linhas de cardápio que ninguém escolheu.
 */
export function eventoExterno(d: DadosDoEventoExterno): Orcamento {
  const agora = new Date().toISOString();
  const data = d.data ?? '';
  return {
    id: novoId(),
    cliente: d.cliente.trim(),
    contato: d.contato?.trim() ?? '',
    data,
    hora: d.hora ?? '',
    local: d.local?.trim() ?? '',
    observacoes: d.observacoes?.trim() ?? '',
    situacao: d.situacao ?? situacaoPelaData(data),
    tipoEvento: d.tipoEvento ?? 'aniversario',
    adultos: Math.max(0, Math.round(d.convidados)),
    faixas: [],
    apetite: 'normal',
    duracaoHoras: 5,
    itens: [],
    selecionados: [],
    servicos: [],
    custosExtras: [],
    margem: MARGEM_PADRAO,
    fatorCarvao: FATOR_CARVAO_PADRAO,
    precoCarvao: PRECO_CARVAO_PADRAO,
    valorFechado: Math.max(0, d.valor),
    criadoEm: agora,
    atualizadoEm: agora,
  };
}
