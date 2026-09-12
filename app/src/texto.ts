import { ROTULO_CATEGORIA } from './dominio/catalogo';
import type { Orcamento, Resultado } from './dominio/tipos';
import { dataCurta, inteiro, quantidade, real } from './formato';

/**
 * A proposta que vai para o cliente.
 *
 * Não leva custo, nem aproveitamento, nem margem: leva o que ele recebe e
 * quanto custa. O preço por pessoa aparece porque é por ele que o cliente
 * compara, e é o que o site promete como orçamento fechado.
 */
export function textoDaProposta(orcamento: Orcamento, resultado: Resultado) {
  const linhas: string[] = [];
  const pessoas = orcamento.adultos + orcamento.criancas;

  linhas.push('*NA GRELHA COM ALAN XAVIER*');
  linhas.push('Proposta de buffet de churrasco');
  linhas.push('');

  if (orcamento.cliente) linhas.push(`*Cliente:* ${orcamento.cliente}`);
  if (orcamento.data) linhas.push(`*Data:* ${dataCurta(orcamento.data)}`);
  if (orcamento.local) linhas.push(`*Local:* ${orcamento.local}`);
  linhas.push(
    `*Convidados:* ${inteiro(orcamento.adultos)} adultos` +
      (orcamento.criancas > 0 ? ` e ${inteiro(orcamento.criancas)} crianças` : ''),
  );
  linhas.push('');

  for (const categoria of ['carne', 'entrada', 'guarnicao'] as const) {
    const doGrupo = resultado.linhas.filter((l) => l.item.categoria === categoria);
    if (!doGrupo.length) continue;
    linhas.push(`*${ROTULO_CATEGORIA[categoria]}*`);
    for (const l of doGrupo) linhas.push(`• ${l.item.nome}`);
    linhas.push('');
  }

  linhas.push(`Servimos *${inteiro(resultado.carnePorPessoa)} g de carne por pessoa*, no prato.`);
  linhas.push('Tudo preparado no local, com estrutura e equipe nossas.');
  linhas.push('Ao final recolhemos tudo e deixamos o espaço em ordem.');
  linhas.push('');
  linhas.push(`*Valor total: ${real(resultado.preco)}*`);
  if (pessoas > 0) linhas.push(`Equivale a ${real(resultado.preco / pessoas)} por convidado.`);
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
 * Aqui os números são de peso cru, já corrigidos pelo aproveitamento, porque
 * é isso que se pede no açougue.
 */
export function textoDaListaDeCompras(orcamento: Orcamento, resultado: Resultado) {
  const linhas: string[] = [];

  linhas.push('*LISTA DE COMPRAS*');
  linhas.push(
    [orcamento.cliente, orcamento.data ? dataCurta(orcamento.data) : '']
      .filter(Boolean)
      .join(' · ') || 'Evento sem nome',
  );
  linhas.push('');

  for (const categoria of ['carne', 'entrada', 'guarnicao'] as const) {
    const doGrupo = resultado.linhas.filter((l) => l.item.categoria === categoria);
    if (!doGrupo.length) continue;
    linhas.push(`*${ROTULO_CATEGORIA[categoria]}*`);
    for (const l of doGrupo) {
      linhas.push(`• ${l.item.nome}: ${quantidade(l.comprar, l.item.unidade)}`);
    }
    linhas.push('');
  }

  if (resultado.carvaoKg > 0) {
    linhas.push('*Insumos*');
    linhas.push(`• Carvão: ${inteiro(resultado.carvaoKg)} kg`);
    linhas.push('');
  }

  linhas.push(`Carne crua no total: ${resultado.carneCrua.toFixed(1).replace('.', ',')} kg`);
  linhas.push(`Custo estimado das compras: ${real(resultado.custoItens + resultado.custoCarvao)}`);

  return linhas.join('\n');
}
