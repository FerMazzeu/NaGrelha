/**
 * As "observações importantes" que fecham o orçamento.
 *
 * Saíam só no Excel, e o Alan pediu as mesmas no PDF: são as condições que ele
 * sempre mandou ao cliente (horário, pagamento, sobras). Ficam aqui para os
 * dois documentos lerem do mesmo lugar e não dizerem coisas diferentes.
 */
/*
  O texto e a ordem são os da planilha do Alan, que ele mandou como modelo.
  Só o português foi revisado:

  - vírgula depois de "Por razões de segurança";
  - "em até 4 dias antes" mistura duas construções ("em até 4 dias" e "até 4
    dias antes"); o prazo dele é o segundo, "até 4 (quatro) dias antes da data";
  - "fazemos com excelência" pede o objeto: "e o fazemos com excelência".

  O sentido de nenhuma frase foi mexido. "Mantendo sob sua propriedade" é
  ambíguo (de quem é o "sua"?), mas é texto de contrato do Alan, e quem
  decide o que ele quer dizer é ele.
*/
export function condicoesDoEvento(duracaoHoras: number) {
  return [
    `O evento tem duração de ${duracaoHoras} ${duracaoHoras === 1 ? 'hora' : 'horas'}, contando a partir do início.`,
    'Por razões de segurança, o buffet não disponibiliza alimentos preparados após o evento, mantendo sob sua propriedade as carnes cruas e os insumos não utilizados. Caso o contratante opte por levar quaisquer sobras, assume integralmente a responsabilidade por sua conservação e consumo, isentando o buffet de quaisquer encargos ou consequências decorrentes dessa decisão.',
    'Chegamos sempre cedo para que tudo seja preparado com calma e no padrão "Na Grelha" de qualidade.',
    'Sobre o pagamento, pedimos uma entrada ao fechar o evento e o restante até 4 (quatro) dias antes da data.',
    'Nossa equipe é uniformizada e treinada para atender a todos da melhor forma. Somos uma empresa familiar, comprometida em garantir a satisfação dos nossos clientes. Amamos o nosso trabalho e o fazemos com excelência.',
  ];
}

/**
 * Quem responde as dúvidas do cliente.
 *
 * É a Érica: é ela quem fica com o WhatsApp da empresa e atende. O número é o
 * do cadastro da equipe.
 */
export const CONTATO_DUVIDAS = { nome: 'Érica', telefone: '(35) 98863-8687' };
