import { calcular } from './calculo';
import { CATEGORIAS, ROTULO_CATEGORIA } from './catalogo';
import { fechadoPorFora } from './evento-externo';
import type { Categoria, Orcamento, Unidade } from './tipos';

/*
  A lista de compras de vários eventos juntos: a do mês.

  O Alan compra para o mês no atacado, e não festa por festa. Com a lista de
  cada orçamento separada, ele somava de cabeça a picanha de quatro eventos
  no corredor do mercado. Aqui a soma já vem feita, e cada linha diz quanto
  vai para cada evento, para separar na hora de montar as caixas.

  A quantidade de cada evento é a da lista de compras dele, já arredondada
  para o que se compra (embalagem, quilo cheio). Somar essas quantidades é
  o que ele vai separar de verdade, evento por evento.
*/

export type ParteDoEvento = { eventoId: string; cliente: string; data: string; comprar: number };

export type ItemDaCompra = {
  nome: string;
  unidade: Unidade;
  categoria: Categoria;
  /** Gramas quando a unidade é kg; unidades ou litros nas outras. */
  comprar: number;
  custo: number;
  embalagens: number[];
  /** Quanto vai para cada evento, na ordem da data. */
  porEvento: ParteDoEvento[];
};

export type ComprasJuntas = {
  itens: ItemDaCompra[];
  /** Os itens agrupados como na lista de um evento: açougue, hortifruti, mercearia. */
  porCategoria: [string, ItemDaCompra[]][];
  carvaoKg: number;
  custoCarvao: number;
  carneCruaKg: number;
  custoTotal: number;
  eventos: Orcamento[];
};

/** Evento que entra na soma: fechado no app, com cardápio. */
export const temCardapio = (o: Orcamento) => !fechadoPorFora(o) && o.selecionados.length > 0;

export function juntarCompras(orcamentos: Orcamento[]): ComprasJuntas {
  const eventos = orcamentos.filter(temCardapio).sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999'));
  const itens = new Map<string, ItemDaCompra>();
  let carvaoKg = 0;
  let custoCarvao = 0;
  let carneCruaKg = 0;

  for (const o of eventos) {
    const r = calcular(o);
    carvaoKg += r.carvaoKg;
    custoCarvao += r.custoCarvao;
    carneCruaKg += r.carneCrua;
    for (const l of r.linhas) {
      if (l.comprar <= 0) continue;
      // Mesmo nome e mesma unidade é o mesmo produto: o alho do carreteiro
      // e o da maionese viram uma linha só. Unidade diferente (bacon em quilo
      // e em pacote) fica separado, porque a soma daria um número que não existe.
      const chave = `${l.item.nome.trim().toLowerCase()}|${l.item.unidade}`;
      let item = itens.get(chave);
      if (!item) {
        item = {
          nome: l.item.nome.trim(),
          unidade: l.item.unidade,
          categoria: l.item.categoria,
          comprar: 0,
          custo: 0,
          embalagens: l.item.embalagens ?? [],
          porEvento: [],
        };
        itens.set(chave, item);
      }
      item.comprar += l.comprar;
      item.custo += l.custo;
      // Dois preparos do mesmo evento com o mesmo item somam na parte daquele evento.
      const parte = item.porEvento.find((p) => p.eventoId === o.id);
      if (parte) parte.comprar += l.comprar;
      else item.porEvento.push({ eventoId: o.id, cliente: o.cliente || 'Sem nome', data: o.data, comprar: l.comprar });
    }
  }

  const lista = [...itens.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  // Na ordem do catálogo, que é a do mercado: açougue primeiro.
  const porCategoria = new Map<string, ItemDaCompra[]>();
  for (const categoria of CATEGORIAS) {
    const daCategoria = lista.filter((i) => i.categoria === categoria);
    if (daCategoria.length) porCategoria.set(ROTULO_CATEGORIA[categoria], daCategoria);
  }

  const custoItens = lista.reduce((s, i) => s + i.custo, 0);
  return {
    itens: lista,
    porCategoria: [...porCategoria],
    carvaoKg,
    custoCarvao,
    carneCruaKg,
    custoTotal: custoItens + custoCarvao,
    eventos,
  };
}
