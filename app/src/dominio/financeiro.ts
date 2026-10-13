import { precoDoEvento } from './evento-externo';
import type { Escala, Membro, Orcamento } from './tipos';

/*
  O controle de caixa.

  Substitui a planilha do Alan, que era uma aba por ano com os eventos (valor,
  entrada, restante, quanto ele e a Érica tiraram) e, embaixo, o dinheiro no
  banco, em espécie e investido, menos o que já tinha entrado de evento que
  ainda não aconteceu. O número que importava no fim era o "CAIXA": quanto do
  dinheiro é livre de verdade.

  Aqui tudo sai de lançamentos. Nada é digitado como total: saldo, a receber,
  a pagar e caixa livre são contas em cima do que entrou e saiu. Assim um
  número não pode discordar do outro, que era o risco da planilha.
*/

export type TipoDeConta = 'banco' | 'especie' | 'investimento' | 'cartao';

export const ROTULO_TIPO_CONTA: Record<TipoDeConta, string> = {
  banco: 'Banco',
  especie: 'Dinheiro em espécie',
  investimento: 'Investimento',
  cartao: 'Cartão',
};

export type Conta = {
  id: string;
  nome: string;
  tipo: TipoDeConta;
  /**
   * O saldo no dia em que o controle começou. O que foi pago ANTES dessa data
   * já está dentro dele e não soma de novo: é o que deixa importar o
   * histórico antigo sem mexer no saldo de hoje.
   */
  saldoInicial: number;
  saldoInicialEm: string;
  ativo: boolean;
};

export type TipoDeLancamento = 'entrada' | 'saida' | 'transferencia';

export type GrupoDeCategoria =
  | 'receita'
  | 'custo_evento'
  | 'equipe'
  | 'prolabore'
  | 'imposto'
  | 'despesa_fixa'
  | 'investimento'
  | 'outros';

export const ROTULO_GRUPO: Record<GrupoDeCategoria, string> = {
  receita: 'Receita',
  custo_evento: 'Custo dos eventos',
  equipe: 'Equipe',
  prolabore: 'Pró-labore dos sócios',
  imposto: 'Impostos',
  despesa_fixa: 'Despesas fixas',
  investimento: 'Investimento',
  outros: 'Outros',
};

export type Categoria = {
  id: string;
  nome: string;
  tipo: 'entrada' | 'saida';
  grupo: GrupoDeCategoria;
  ativo: boolean;
};

export type FormaDePagamento = '' | 'pix' | 'dinheiro' | 'cartao' | 'boleto' | 'transferencia' | 'outro';

export const ROTULO_FORMA: Record<FormaDePagamento, string> = {
  '': 'Não informado',
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  outro: 'Outro',
};

export type Lancamento = {
  id: string;
  tipo: TipoDeLancamento;
  descricao: string;
  /** Sempre positivo. O sentido vem do tipo. */
  valor: number;
  vencimento: string;
  /** Vazio é previsto: conta a receber ou a pagar. */
  pagoEm: string;
  contaId: string | null;
  /** Só na transferência: o dinheiro sai de `contaId` e entra aqui. */
  contaDestinoId: string | null;
  categoriaId: string | null;
  eventoId: string | null;
  membroId: string | null;
  /** Quem recebeu ou pagou, quando não é da equipe: sócio, fornecedor. */
  pessoa: string;
  forma: FormaDePagamento;
  observacoes: string;
};

/** Algo que alguém precisa conferir e responder: "o que é BASF?". */
export type Pendencia = {
  id: string;
  titulo: string;
  detalhe: string;
  eventoId: string | null;
  valor: number | null;
  situacao: 'aberta' | 'resolvida';
  resposta: string;
  resolvidaEm: string;
  criadoEm: string;
};

/** Centavo: soma de dinheiro não pode carregar o 0,000000001 do ponto flutuante. */
export const centavos = (v: number) => Math.round(v * 100) / 100;

const pago = (l: Lancamento) => !!l.pagoEm;

/** Dia ISO menos `n` dias, sem fuso: data de evento é data, não instante. */
export function diasAntes(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export const hojeIso = () => {
  // Data local, e não UTC: às 22h de Brasília o UTC já é amanhã.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ------------------------------------------------------------------ saldo ---

/**
 * Quanto um lançamento pago move numa conta: positivo entra, negativo sai.
 * Zero quando não é com ela.
 */
export function efeitoNaConta(l: Lancamento, contaId: string) {
  if (!pago(l)) return 0;
  if (l.tipo === 'entrada') return l.contaId === contaId ? l.valor : 0;
  if (l.tipo === 'saida') return l.contaId === contaId ? -l.valor : 0;
  // transferência
  if (l.contaId === contaId) return -l.valor;
  if (l.contaDestinoId === contaId) return l.valor;
  return 0;
}

/**
 * Saldo de cada conta numa data (fim do dia), hoje por padrão.
 *
 * Conta só o que foi pago a partir do dia do saldo inicial: o que veio antes
 * já está nele.
 */
export function saldos(contas: Conta[], lancamentos: Lancamento[], ate = '9999-12-31') {
  return contas.map((c) => {
    const movimento = lancamentos
      .filter((l) => pago(l) && l.pagoEm >= c.saldoInicialEm && l.pagoEm <= ate)
      .reduce((s, l) => s + efeitoNaConta(l, c.id), 0);
    return { conta: c, saldo: centavos(c.saldoInicial + movimento) };
  });
}

// ---------------------------------------------------------------- extrato ---

export type LinhaDoExtrato = {
  lancamento: Lancamento;
  /** Quanto mexeu no que está sendo visto: uma conta ou todas juntas. */
  efeito: number;
  /** O saldo depois desta linha. */
  saldo: number;
};

/**
 * O livro caixa: o que foi pago, em ordem, com o saldo andando.
 *
 * Com `contaId` nulo é o caixa todo junto, e transferência entre contas não
 * muda nada (sai de uma, entra na outra), mas aparece mesmo assim, porque
 * quem confere o extrato do banco precisa achar ela.
 *
 * Lançamento anterior ao saldo inicial da conta aparece, mas não move o
 * saldo: ele já está dentro do número de partida.
 */
export function extrato(
  contas: Conta[],
  lancamentos: Lancamento[],
  contaId: string | null,
  de: string,
  ate: string,
): { saldoAnterior: number; linhas: LinhaDoExtrato[]; saldoFinal: number } {
  const vistas = contaId ? contas.filter((c) => c.id === contaId) : contas;
  const conta = (l: Lancamento) =>
    vistas.reduce((s, c) => s + (l.pagoEm >= c.saldoInicialEm ? efeitoNaConta(l, c.id) : 0), 0);
  const tocaNaVista = (l: Lancamento) =>
    !contaId || l.contaId === contaId || l.contaDestinoId === contaId;

  const pagos = lancamentos
    .filter((l) => pago(l) && tocaNaVista(l))
    .sort((a, b) => a.pagoEm.localeCompare(b.pagoEm) || a.id.localeCompare(b.id));

  const anteriorAoPeriodo = (dia: string) =>
    vistas.reduce((s, c) => s + (c.saldoInicialEm < dia ? c.saldoInicial : 0), 0);

  let saldo = anteriorAoPeriodo(de);
  for (const l of pagos) if (l.pagoEm < de) saldo += conta(l);
  const saldoAnterior = centavos(saldo);

  const linhas: LinhaDoExtrato[] = [];
  // Saldo inicial de conta que começou dentro do período entra no dia dele.
  const inicios = vistas.filter((c) => c.saldoInicialEm >= de && c.saldoInicialEm <= ate);
  for (const l of pagos.filter((x) => x.pagoEm >= de && x.pagoEm <= ate)) {
    for (const c of inicios.filter((c) => c.saldoInicialEm <= l.pagoEm)) {
      saldo += c.saldoInicial;
      inicios.splice(inicios.indexOf(c), 1);
    }
    const efeito = conta(l);
    saldo += efeito;
    linhas.push({ lancamento: l, efeito: centavos(efeito), saldo: centavos(saldo) });
  }
  for (const c of inicios) saldo += c.saldoInicial;

  return { saldoAnterior, linhas, saldoFinal: centavos(saldo) };
}

// -------------------------------------------------------------- a receber ---

/** O restante vence quatro dias antes da festa: é a condição do Alan. */
export const DIAS_ANTES_DO_EVENTO = 4;

export type Recebivel = {
  evento: Orcamento;
  total: number;
  recebido: number;
  /** Combinado e lançado como previsto, ainda não pago. */
  previsto: number;
  restante: number;
  vencimento: string;
  situacao: 'quitado' | 'parcial' | 'aberto';
  atrasado: boolean;
};

/** Evento que é dinheiro: fechado, aconteceu ou vai acontecer. */
const valeDinheiro = (o: Orcamento) => o.situacao === 'confirmado' || o.situacao === 'realizado';

/**
 * O que cada evento fechado deve, e quanto já pagou.
 *
 * Não existe "conta a receber" digitada para evento: o valor é o do evento, e
 * o que entrou são os lançamentos de entrada ligados a ele. Mudou o preço do
 * evento, mudou o a receber, sem ninguém lembrar de atualizar duas coisas.
 */
export function recebiveis(orcamentos: Orcamento[], lancamentos: Lancamento[], hoje = hojeIso()): Recebivel[] {
  return orcamentos.filter(valeDinheiro).map((evento) => {
    const doEvento = lancamentos.filter((l) => l.eventoId === evento.id && l.tipo === 'entrada');
    const recebido = centavos(doEvento.filter(pago).reduce((s, l) => s + l.valor, 0));
    const previsto = centavos(doEvento.filter((l) => !pago(l)).reduce((s, l) => s + l.valor, 0));
    const total = centavos(precoDoEvento(evento));
    const restante = centavos(Math.max(0, total - recebido));
    const vencimento = evento.data ? diasAntes(evento.data, DIAS_ANTES_DO_EVENTO) : '';
    return {
      evento,
      total,
      recebido,
      previsto,
      restante,
      vencimento,
      situacao: restante <= 0.009 ? 'quitado' : recebido > 0 ? 'parcial' : 'aberto',
      atrasado: restante > 0.009 && !!vencimento && vencimento < hoje,
    };
  });
}

// ---------------------------------------------------------------- a pagar ---

export type APagar =
  | { origem: 'lancamento'; lancamento: Lancamento; valor: number; vencimento: string; atrasado: boolean }
  | {
      origem: 'cache';
      escala: Escala;
      membro: Membro | undefined;
      evento: Orcamento;
      valor: number;
      vencimento: string;
      atrasado: boolean;
    };

/**
 * O que falta pagar: as saídas previstas, e o cachê de quem foi escalado em
 * evento fechado e ainda não recebeu.
 *
 * O cachê sai da escala, e não de um lançamento digitado: escalou, já aparece.
 * Pagou (saída paga ligada ao evento e à pessoa), some.
 */
export function aPagar(
  lancamentos: Lancamento[],
  escalas: Escala[],
  membros: Membro[],
  orcamentos: Orcamento[],
  hoje = hojeIso(),
  /**
   * O dia em que o controle começou. Cachê de evento anterior já foi pago
   * fora daqui, e sem este corte toda escala antiga apareceria como vencida.
   */
  desde = '',
): APagar[] {
  const previstas: APagar[] = lancamentos
    .filter((l) => l.tipo === 'saida' && !pago(l))
    .map((l) => ({
      origem: 'lancamento' as const,
      lancamento: l,
      valor: l.valor,
      vencimento: l.vencimento,
      atrasado: l.vencimento < hoje,
    }));

  const porId = new Map(orcamentos.map((o) => [o.id, o]));
  const caches: APagar[] = [];
  for (const escala of escalas) {
    const evento = porId.get(escala.eventoId);
    if (!evento || !valeDinheiro(evento) || escala.cache <= 0) continue;
    if (desde && evento.data && evento.data < desde) continue;
    const jaPago = lancamentos
      .filter((l) => l.tipo === 'saida' && l.eventoId === escala.eventoId && l.membroId === escala.membroId)
      .reduce((s, l) => s + l.valor, 0);
    const falta = centavos(escala.cache - jaPago);
    if (falta <= 0.009) continue;
    const vencimento = evento.data || hoje;
    caches.push({
      origem: 'cache',
      escala,
      membro: membros.find((m) => m.id === escala.membroId),
      evento,
      valor: falta,
      vencimento,
      atrasado: vencimento < hoje,
    });
  }

  return [...previstas, ...caches].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

/** O primeiro dia do controle: o saldo inicial mais antigo entre as contas. */
export function inicioDoControle(contas: Conta[], hoje = hojeIso()) {
  return contas.reduce((m, c) => (c.saldoInicialEm < m ? c.saldoInicialEm : m), hoje);
}

// ----------------------------------------------------------------- resumo ---

export type Resumo = {
  saldoTotal: number;
  porConta: { conta: Conta; saldo: number }[];
  aReceber: number;
  aReceberAtrasado: number;
  aPagar: number;
  aPagarAtrasado: number;
  /**
   * Já recebido de evento que ainda não aconteceu. Está no banco, mas vai ser
   * gasto naquele evento: é o "ADIANTAMENTO 2027" da planilha.
   */
  adiantado: number;
  /**
   * Saldo menos o adiantado menos o que falta pagar fora dos eventos futuros:
   * o "CAIXA" da planilha. O custo de evento que ainda vai acontecer não sai
   * de novo, porque é para ele que o adiantamento está guardado.
   */
  caixaLivre: number;
};

export function resumir(
  contas: Conta[],
  lancamentos: Lancamento[],
  orcamentos: Orcamento[],
  escalas: Escala[],
  membros: Membro[],
  hoje = hojeIso(),
): Resumo {
  const porConta = saldos(contas.filter((c) => c.ativo), lancamentos);
  const saldoTotal = centavos(porConta.reduce((s, x) => s + x.saldo, 0));
  const rec = recebiveis(orcamentos, lancamentos, hoje);
  const pag = aPagar(lancamentos, escalas, membros, orcamentos, hoje, inicioDoControle(contas, hoje));
  const adiantado = centavos(
    rec.filter((r) => r.evento.data && r.evento.data >= hoje).reduce((s, r) => s + r.recebido, 0),
  );
  const totalAPagar = centavos(pag.reduce((s, p) => s + p.valor, 0));
  const dataDoEvento = new Map(orcamentos.map((o) => [o.id, o.data]));
  const deEventoFuturo = (p: APagar) => {
    const id = p.origem === 'cache' ? p.evento.id : p.lancamento.eventoId;
    const data = id ? dataDoEvento.get(id) : '';
    return !!data && data >= hoje;
  };
  const aPagarForaDeEventoFuturo = centavos(pag.filter((p) => !deEventoFuturo(p)).reduce((s, p) => s + p.valor, 0));
  return {
    saldoTotal,
    porConta,
    aReceber: centavos(rec.reduce((s, r) => s + r.restante, 0)),
    aReceberAtrasado: centavos(rec.filter((r) => r.atrasado).reduce((s, r) => s + r.restante, 0)),
    aPagar: totalAPagar,
    aPagarAtrasado: centavos(pag.filter((p) => p.atrasado).reduce((s, p) => s + p.valor, 0)),
    adiantado,
    caixaLivre: centavos(saldoTotal - adiantado - aPagarForaDeEventoFuturo),
  };
}

// -------------------------------------------------------------- resultado ---

/** Entradas e saídas pagas por mês (AAAA-MM). Transferência não é resultado. */
export function porMes(lancamentos: Lancamento[], meses: string[]) {
  return meses.map((mes) => {
    const doMes = lancamentos.filter((l) => pago(l) && l.pagoEm.startsWith(mes));
    const entradas = centavos(doMes.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0));
    const saidas = centavos(doMes.filter((l) => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0));
    return { mes, entradas, saidas, resultado: centavos(entradas - saidas) };
  });
}

/** Os últimos `n` meses até o de `hoje`, do mais antigo ao mais novo. */
export function ultimosMeses(n: number, hoje = hojeIso()) {
  const [ano, mes] = hoje.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(ano, mes - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

/**
 * Resultado por grupo de categoria num período: o "quanto sobrou" do mês ou
 * do ano. Lançamento sem categoria cai em "outros", e não some.
 */
export function resultadoPorGrupo(lancamentos: Lancamento[], categorias: Categoria[], de: string, ate: string) {
  const grupoDe = new Map(categorias.map((c) => [c.id, c.grupo]));
  const linhas = new Map<GrupoDeCategoria, { entradas: number; saidas: number }>();
  for (const l of lancamentos) {
    if (!pago(l) || l.tipo === 'transferencia' || l.pagoEm < de || l.pagoEm > ate) continue;
    const grupo = (l.categoriaId && grupoDe.get(l.categoriaId)) || (l.tipo === 'entrada' ? 'receita' : 'outros');
    const atual = linhas.get(grupo) ?? { entradas: 0, saidas: 0 };
    if (l.tipo === 'entrada') atual.entradas += l.valor;
    else atual.saidas += l.valor;
    linhas.set(grupo, atual);
  }
  const ordem = Object.keys(ROTULO_GRUPO) as GrupoDeCategoria[];
  const grupos = ordem
    .filter((g) => linhas.has(g))
    .map((g) => ({ grupo: g, entradas: centavos(linhas.get(g)!.entradas), saidas: centavos(linhas.get(g)!.saidas) }));
  const entradas = centavos(grupos.reduce((s, g) => s + g.entradas, 0));
  const saidas = centavos(grupos.reduce((s, g) => s + g.saidas, 0));
  return { grupos, entradas, saidas, resultado: centavos(entradas - saidas) };
}

export type ResultadoDoEvento = {
  evento: Orcamento;
  total: number;
  recebido: number;
  restante: number;
  /** Saídas ligadas ao evento, menos o pró-labore. */
  custos: number;
  /** Pró-labore dos sócios no evento, por pessoa: as colunas ALAN e ERICA. */
  prolabore: { pessoa: string; valor: number }[];
  /** Valor do evento menos custos e pró-labore lançados. */
  sobra: number;
};

/**
 * Cada evento fechado do ano, como na planilha: valor, entrada, restante,
 * quanto cada sócio tirou, e o que sobrou para a empresa.
 *
 * Conta lançamento pago e previsto: o pró-labore de evento futuro já
 * combinado entra, porque é assim que o Alan olha o ano.
 */
export function resultadoPorEvento(
  orcamentos: Orcamento[],
  lancamentos: Lancamento[],
  categorias: Categoria[],
  ano: string,
): ResultadoDoEvento[] {
  const grupoDe = new Map(categorias.map((c) => [c.id, c.grupo]));
  return recebiveis(
    orcamentos.filter((o) => o.data.startsWith(ano)),
    lancamentos,
  )
    .sort((a, b) => a.evento.data.localeCompare(b.evento.data))
    .map((r) => {
      const saidas = lancamentos.filter((l) => l.eventoId === r.evento.id && l.tipo === 'saida');
      const ehProlabore = (l: Lancamento) => !!l.categoriaId && grupoDe.get(l.categoriaId) === 'prolabore';
      const porPessoa = new Map<string, number>();
      for (const l of saidas.filter(ehProlabore)) {
        const quem = l.pessoa || 'Sócio';
        porPessoa.set(quem, (porPessoa.get(quem) ?? 0) + l.valor);
      }
      const prolabore = [...porPessoa].map(([pessoa, valor]) => ({ pessoa, valor: centavos(valor) }));
      const custos = centavos(saidas.filter((l) => !ehProlabore(l)).reduce((s, l) => s + l.valor, 0));
      const totalProlabore = prolabore.reduce((s, p) => s + p.valor, 0);
      return {
        evento: r.evento,
        total: r.total,
        recebido: r.recebido,
        restante: r.restante,
        custos,
        prolabore,
        sobra: centavos(r.total - custos - totalProlabore),
      };
    });
}

/** Lançamento novo em branco, do tipo pedido, com hoje como data. */
export function lancamentoNovo(tipo: TipoDeLancamento, parcial: Partial<Lancamento> = {}): Lancamento {
  const hoje = hojeIso();
  return {
    id: '',
    tipo,
    descricao: '',
    valor: 0,
    vencimento: hoje,
    pagoEm: hoje,
    contaId: null,
    contaDestinoId: null,
    categoriaId: null,
    eventoId: null,
    membroId: null,
    pessoa: '',
    forma: '',
    observacoes: '',
    ...parcial,
  };
}

/**
 * Repete um lançamento mês a mês: aluguel, contador, parcela de equipamento.
 *
 * Gera as cópias de uma vez, previstas, em vez de uma regra que roda sozinha
 * depois: o que vai sair aparece na lista de a pagar e dá para mudar uma
 * parcela sem mexer nas outras. Dia 31 em fevereiro cai no último dia do mês.
 */
export function repetirMensal(base: Lancamento, vezes: number): Lancamento[] {
  const [ano, mes, dia] = base.vencimento.split('-').map(Number);
  return Array.from({ length: Math.max(1, vezes) }, (_, i) => {
    const ultimoDia = new Date(Date.UTC(ano, mes - 1 + i + 1, 0)).getUTCDate();
    const d = new Date(Date.UTC(ano, mes - 1 + i, Math.min(dia, ultimoDia)));
    const vencimento = d.toISOString().slice(0, 10);
    return {
      ...base,
      vencimento,
      // Só a primeira pode já estar paga; as próximas são previsão.
      pagoEm: i === 0 ? base.pagoEm : '',
      descricao: vezes > 1 ? `${base.descricao} (${i + 1}/${vezes})` : base.descricao,
    };
  });
}
