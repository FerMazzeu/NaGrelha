import { ROTULO_CATEGORIA } from './dominio/catalogo';
import { ROTULO_PAPEL, type Orcamento, type Resultado } from './dominio/tipos';
import { dataCurta, decimal, inteiro, quantidade, real } from './formato';

/** As condições que a planilha do cliente traz como observação fixa. */
export const CONDICOES = [
  'O evento tem duração de {horas} horas, contando a partir do início.',
  'Chegamos sempre cedo para que tudo seja preparado com calma e no padrão Na Grelha de qualidade.',
  'Sobre o pagamento, pedimos uma entrada ao fechar o evento e o restante em até 4 dias antes.',
  'Por razões de segurança o buffet não disponibiliza alimentos preparados após o evento, mantendo sob sua propriedade as carnes cruas e insumos não utilizados. Caso o contratante opte por levar quaisquer sobras, assume integralmente a responsabilidade por sua conservação e consumo.',
  'Nossa equipe é uniformizada e treinada para atender todos da melhor forma. Somos uma empresa familiar, comprometida em garantir a satisfação dos nossos clientes.',
];

/**
 * A proposta que vai para o cliente.
 *
 * Não leva custo, nem aproveitamento, nem margem: leva o que ele recebe e
 * quanto custa. A cobrança vem quebrada por faixa etária, porque "criança até
 * 5 anos não paga" é argumento de venda e precisa estar escrito.
 */
export function textoDaProposta(orcamento: Orcamento, resultado: Resultado) {
  const linhas: string[] = [];

  linhas.push('*NA GRELHA COM ALAN XAVIER*');
  linhas.push('Proposta de buffet de churrasco');
  linhas.push('');

  if (orcamento.cliente) linhas.push(`*Cliente:* ${orcamento.cliente}`);
  if (orcamento.data) linhas.push(`*Data:* ${dataCurta(orcamento.data)}${orcamento.hora ? ` às ${orcamento.hora}` : ''}`);
  if (orcamento.local) linhas.push(`*Local:* ${orcamento.local}`);
  linhas.push(`*Convidados:* ${inteiro(resultado.convidados)}`);
  linhas.push('');

  // cardápio agrupado pelo preparo, que é como o cliente lê
  const porGrupo = new Map<string, string[]>();
  for (const l of resultado.linhas) {
    if (l.item.categoria === 'estrutura' || l.item.categoria === 'limpeza') continue;
    const chave = l.item.grupo || ROTULO_CATEGORIA[l.item.categoria];
    if (!porGrupo.has(chave)) porGrupo.set(chave, []);
    porGrupo.get(chave)!.push(l.item.nome);
  }

  if (porGrupo.size) {
    linhas.push('*O QUE ESTÁ INCLUSO*');
    for (const [grupo] of porGrupo) linhas.push(`• ${grupo}`);
    linhas.push('');
  }

  const equipe = resultado.servicos.filter((x) => x.servico.papel === 'equipe');
  if (equipe.length) {
    linhas.push('*EQUIPE NO EVENTO*');
    for (const x of equipe) {
      linhas.push(`• ${x.servico.nome}${x.servico.quantidade > 1 ? ` (${inteiro(x.servico.quantidade)})` : ''}`);
    }
    linhas.push('');
  }

  if (resultado.carnePorPessoa > 0) {
    linhas.push(`Servimos *${inteiro(resultado.carnePorPessoa)} g de carne por pessoa*, no prato.`);
  }
  linhas.push('Tudo preparado no local, com estrutura e equipe nossas.');
  linhas.push('Ao final recolhemos tudo e deixamos o espaço em ordem.');
  linhas.push('');

  linhas.push('*VALORES*');
  for (const c of resultado.cobranca) {
    if (c.quantidade <= 0) continue;
    const valor = c.unitario > 0 ? `${inteiro(c.quantidade)} x ${real(c.unitario)} = ${real(c.total)}` : `${inteiro(c.quantidade)} — isento`;
    linhas.push(`• ${c.rotulo}: ${valor}`);
  }
  linhas.push('');
  linhas.push(`*Valor total: ${real(resultado.preco)}*`);
  linhas.push('');

  linhas.push('*CONDIÇÕES*');
  for (const c of CONDICOES) {
    linhas.push(`• ${c.replace('{horas}', inteiro(orcamento.duracaoHoras))}`);
  }
  linhas.push('');
  linhas.push('Orçamento fechado, sem custo oculto.');

  if (orcamento.observacoes.trim()) {
    linhas.push('');
    linhas.push(orcamento.observacoes.trim());
  }

  return linhas.join('\n');
}

/**
 * A lista de compras, que é o outro lado da mesma conta.
 *
 * Agrupada por preparo e não por categoria: é assim que se compra e é assim
 * que a planilha do cliente sempre foi organizada.
 */
export function textoDaListaDeCompras(orcamento: Orcamento, resultado: Resultado) {
  const linhas: string[] = [];

  linhas.push('*LISTA DE COMPRAS*');
  linhas.push(
    [orcamento.cliente, orcamento.data ? dataCurta(orcamento.data) : '']
      .filter(Boolean)
      .join(' · ') || 'Evento sem nome',
  );
  linhas.push(`${inteiro(resultado.convidados)} convidados`);
  linhas.push('');

  const porGrupo = new Map<string, typeof resultado.linhas>();
  for (const l of resultado.linhas) {
    const chave = l.item.grupo || ROTULO_CATEGORIA[l.item.categoria];
    if (!porGrupo.has(chave)) porGrupo.set(chave, []);
    porGrupo.get(chave)!.push(l);
  }

  for (const [grupo, itens] of porGrupo) {
    linhas.push(`*${grupo.toUpperCase()}*`);
    for (const l of itens) {
      linhas.push(`• ${l.item.nome}: ${quantidade(l.comprar, l.item.unidade)}`);
    }
    linhas.push('');
  }

  if (resultado.carvaoKg > 0) {
    linhas.push('*CARVÃO*');
    linhas.push(`• Carvão: ${inteiro(resultado.carvaoKg)} kg`);
    linhas.push('');
  }

  if (resultado.carneCrua > 0) linhas.push(`Carne crua no total: ${decimal(resultado.carneCrua)} kg`);
  linhas.push(`Custo estimado das compras: ${real(resultado.custoItens + resultado.custoCarvao)}`);

  return linhas.join('\n');
}

/** A escala, para mandar no grupo da equipe. */
export function textoDaEscala(orcamento: Orcamento, resultado: Resultado) {
  const linhas: string[] = [];
  linhas.push('*ESCALA DO EVENTO*');
  linhas.push(
    [orcamento.cliente, orcamento.data ? dataCurta(orcamento.data) : '', orcamento.hora]
      .filter(Boolean)
      .join(' · '),
  );
  if (orcamento.local) linhas.push(orcamento.local);
  linhas.push(`${inteiro(resultado.convidados)} convidados, ${inteiro(orcamento.duracaoHoras)} horas de evento`);
  linhas.push('');

  for (const x of resultado.servicos) {
    const quem = x.servico.pessoa ? ` — ${x.servico.pessoa}` : '';
    const qtd = x.servico.quantidade > 1 ? ` (${inteiro(x.servico.quantidade)})` : '';
    linhas.push(`• [${ROTULO_PAPEL[x.servico.papel]}] ${x.servico.nome}${qtd}${quem}: ${real(x.total)}`);
  }

  linhas.push('');
  linhas.push(`Total de serviço: ${real(resultado.custoServicos)}`);

  return linhas.join('\n');
}
