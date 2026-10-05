/**
 * As "observações importantes" que fecham o orçamento.
 *
 * Saíam só no Excel, e o Alan pediu as mesmas no PDF: são as condições que ele
 * sempre mandou ao cliente (horário, pagamento, sobras). Ficam aqui para os
 * dois documentos lerem do mesmo lugar e não dizerem coisas diferentes.
 */
export function condicoesDoEvento(duracaoHoras: number) {
  return [
    `O evento tem duração de ${duracaoHoras} horas, contando a partir do início.`,
    'Chegamos sempre cedo para que tudo seja preparado com calma e no padrão Na Grelha de qualidade.',
    'Sobre o pagamento, pedimos uma entrada ao fechar o evento e o restante em até 4 dias antes.',
    'Por razões de segurança o buffet não disponibiliza alimentos preparados após o evento, mantendo sob sua propriedade as carnes cruas e insumos não utilizados.',
    'Nossa equipe é uniformizada e treinada para atender todos da melhor forma. Somos uma empresa familiar.',
  ];
}

/**
 * Quem responde as dúvidas do cliente.
 *
 * É a Érica: é ela quem fica com o WhatsApp da empresa e atende. O número é o
 * do cadastro da equipe.
 */
export const CONTATO_DUVIDAS = { nome: 'Érica', telefone: '(35) 98863-8687' };
