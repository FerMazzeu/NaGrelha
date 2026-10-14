/*
  O texto do contrato de buffet, montado a partir dos dados.

  Este arquivo é a ÚNICA fonte do texto. O app (tela de envio), a página que
  o cliente abre, o PDF e a edge function que registra a assinatura importam
  daqui. É o que garante que o texto que o cliente leu é o mesmo que o
  servidor guardou e de que tirou a impressão digital (hash): se cada lugar
  montasse o seu, uma vírgula diferente bastaria para a prova não bater.

  Sem import nenhum de propósito: roda no navegador e no Deno igual.

  O texto segue o contrato que o Alan já usava (o da cliente de jun/2027),
  com as cláusulas de carnes e bebidas escolhidas em cada contrato.

  Mudou o texto de uma cláusula? Suba MODELO_DO_CONTRATO. Contrato já
  assinado guarda o texto exato que foi assinado, então ele não muda junto.
*/

export const MODELO_DO_CONTRATO = '2026-10-14';

export type QuemFornece = 'buffet' | 'contratante';

/** O que vem do orçamento, congelado no momento em que o link é gerado. */
export type ConteudoDoContrato = {
  modelo: string;
  contratada: { nome: string; cnpj: string; endereco: string; telefone: string };
  /** Quem gerou o link pelo buffet: o envio vale como aceite da contratada. */
  representante: string;
  evento: {
    /** "Casamento", "Aniversário de 15 anos": como aparece na Cláusula Primeira. */
    descricao: string;
    /** AAAA-MM-DD. */
    data: string;
    hora: string;
    local: string;
    duracaoHoras: number;
    adultos: number;
    criancas: number;
  };
  cardapio: { titulo: string; itens: string[] }[];
  incluiEstrutura: boolean;
  carnes: QuemFornece;
  bebidas: QuemFornece;
  valorTotal: number;
  /** Zero: o contrato fala só "sinal pago no ato", como o modelo do Alan. */
  valorEntrada: number;
  valorAvaria: number;
  foro: string;
};

/** O que o cliente preenche no link. */
export type Contratante = {
  nome: string;
  cpf: string;
  endereco: string;
  email: string;
  telefone: string;
};

export type Bloco = {
  titulo?: string;
  paragrafos: string[];
  lista?: string[];
};

// ------------------------------------------------------------ formato ---

const doisDigitos = (n: number) => String(n).padStart(2, '0');

export function dataBr(iso: string) {
  const [a, m, d] = iso.split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

export function menosDias(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function moeda(v: number) {
  const [inteiro, centavos] = Math.abs(v).toFixed(2).split('.');
  return `${v < 0 ? '-' : ''}R$ ${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${centavos}`;
}

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

/** 0 a 999 por extenso. */
function ate999(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (resto) {
    if (resto < 20) partes.push(UNIDADES[resto]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(' e ');
}

/** Inteiro por extenso, até centenas de milhões: 5806 → "cinco mil, oitocentos e seis". */
export function inteiroPorExtenso(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'zero';
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const grupos: string[] = [];
  if (milhoes) grupos.push(`${ate999(milhoes)} ${milhoes === 1 ? 'milhão' : 'milhões'}`);
  if (milhares) grupos.push(milhares === 1 ? 'mil' : `${ate999(milhares)} mil`);
  if (resto) grupos.push(ate999(resto));
  if (grupos.length === 1) return grupos[0];
  // O último grupo leva "e" quando é redondo ou menor que cem (mil e cem,
  // dois mil e cinquenta); senão, vírgula (cinco mil, oitocentos e seis).
  const ultimo = grupos.pop()!;
  const liga = resto && (resto < 100 || resto % 100 === 0) ? ' e ' : ', ';
  return `${grupos.join(', ')}${liga}${ultimo}`;
}

/** R$ 5.806,80 → "cinco mil, oitocentos e seis reais e oitenta centavos". */
export function reaisPorExtenso(valor: number): string {
  const centavosTotais = Math.round(Math.abs(valor) * 100);
  const reais = Math.floor(centavosTotais / 100);
  const centavos = centavosTotais % 100;
  const partes: string[] = [];
  if (reais) {
    // "um milhão de reais", "dois mil reais": milhão redondo pede "de".
    const deMilhao = reais >= 1_000_000 && reais % 1_000_000 === 0;
    partes.push(`${inteiroPorExtenso(reais)}${deMilhao ? ' de' : ''} ${reais === 1 ? 'real' : 'reais'}`);
  }
  if (centavos) partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  return partes.length ? partes.join(' e ') : 'zero reais';
}

/** CPF só com dígitos, conferido pelos dígitos verificadores. */
export function cpfValido(cpf: string) {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

export function cpfFormatado(cpf: string) {
  const d = cpf.replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf;
}

export const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

/** O que falta o cliente preencher. Vazio: pode pedir o código. */
export function faltaNoContratante(c: Contratante): string[] {
  const falta: string[] = [];
  if (c.nome.trim().split(/\s+/).length < 2) falta.push('nome completo');
  if (!cpfValido(c.cpf)) falta.push('CPF válido');
  if (c.endereco.trim().length < 8) falta.push('endereço completo');
  if (!emailValido(c.email)) falta.push('e-mail válido');
  return falta;
}

// -------------------------------------------------------------- texto ---

/**
 * O contrato inteiro, em blocos.
 *
 * Campo do cliente ainda vazio aparece como linha a preencher, para ele ver
 * onde os dados dele vão entrar.
 */
export function blocosDoContrato(c: ConteudoDoContrato, quem: Contratante): Bloco[] {
  const vazio = '________________';
  const nome = quem.nome.trim() || vazio;
  const cpf = quem.cpf.trim() ? cpfFormatado(quem.cpf) : vazio;
  const endereco = quem.endereco.trim() || vazio;
  const e = c.evento;
  const restanteAte = e.data ? dataBr(menosDias(e.data, 4)) : 'a data combinada';
  const pessoas = (n: number, um: string, varios: string) => `${doisDigitos(n)} ${n === 1 ? um : varios}`;

  const blocos: Bloco[] = [
    {
      paragrafos: [
        `CONTRATANTE: ${nome}, inscrito(a) no CPF sob o nº ${cpf}, residente e domiciliado(a) em ${endereco}.`,
        `CONTRATADA: ${c.contratada.nome}, inscrita no CNPJ sob o nº ${c.contratada.cnpj}, com sede na ${c.contratada.endereco}, telefone ${c.contratada.telefone}.`,
        'As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas seguintes e pelas condições descritas abaixo.',
      ],
    },
    {
      titulo: 'CLÁUSULA PRIMEIRA - DO OBJETO',
      paragrafos: [
        `O presente contrato tem por objeto a prestação de serviços de buffet e churrasco pela CONTRATADA para o evento de ${e.descricao} da CONTRATANTE, a realizar-se no dia ${e.data ? dataBr(e.data) : 'a definir'}${e.hora ? `, com início previsto para as ${e.hora} horas` : ''}, no endereço informado pela CONTRATANTE${e.local ? ` em ${e.local}` : ''} (localização exata a ser compartilhada oportunamente).`,
      ],
    },
    {
      titulo: 'CLÁUSULA SEGUNDA - DO CARDÁPIO E DA ESTRUTURA',
      paragrafos: ['Os serviços contratados englobam o fornecimento do cardápio detalhado no orçamento aprovado, composto por:'],
      lista: [
        ...c.cardapio.filter((s) => s.itens.length).map((s) => `${s.titulo}: ${s.itens.join(', ')}.`),
        ...(c.incluiEstrutura
          ? ['Estrutura: inclusão de louças, pratos, copos e talheres adequados para o perfeito serviço do cardápio acima citado.']
          : []),
      ],
    },
    {
      titulo: 'CLÁUSULA TERCEIRA - DO FORNECIMENTO DE CARNES',
      paragrafos: [
        c.carnes === 'contratante'
          ? 'Fica expressamente acordado que as carnes que serão servidas no evento serão fornecidas exclusivamente pela CONTRATANTE. A CONTRATANTE se compromete a adquirir e entregar carnes de primeira qualidade e em quantidade suficiente para o atendimento do número de convidados estipulado. A CONTRATADA será responsável apenas pelo manuseio, preparo e serviço das carnes no local do evento.'
          : 'As carnes servidas no evento serão fornecidas pela CONTRATADA, conforme o cardápio do orçamento aprovado e em quantidade dimensionada para o número de convidados estipulado na Cláusula Quinta, sendo de sua responsabilidade a aquisição, o transporte, o preparo e o serviço.',
      ],
    },
    {
      titulo: c.bebidas === 'contratante' ? 'CLÁUSULA QUARTA - DA EXCLUSÃO DE BEBIDAS' : 'CLÁUSULA QUARTA - DAS BEBIDAS',
      paragrafos: [
        c.bebidas === 'contratante'
          ? 'Fica expressamente acordado que a CONTRATADA não possui qualquer responsabilidade pelo fornecimento, transporte, resfriamento ou serviço de bebidas (sejam alcoólicas ou não alcoólicas) no evento. Todo o fornecimento e logística de bebidas correrão por conta e custos exclusivos da CONTRATANTE.'
          : 'As bebidas relacionadas no cardápio do orçamento aprovado serão fornecidas pela CONTRATADA. Bebidas não relacionadas no orçamento correrão por conta e custos exclusivos da CONTRATANTE.',
      ],
    },
    {
      titulo: 'CLÁUSULA QUINTA - DO NÚMERO DE CONVIDADOS',
      paragrafos: [
        `O serviço será dimensionado e prestado para o total fixado de ${pessoas(e.adultos, 'Convidado Adulto', 'Convidados Adultos')}${e.criancas > 0 ? ` e ${pessoas(e.criancas, 'Criança', 'Crianças')}` : ''}.`,
      ],
    },
    {
      titulo: 'CLÁUSULA SEXTA - DO TEMPO DE DURAÇÃO',
      paragrafos: [
        `O evento terá a duração máxima de ${e.duracaoHoras} (${inteiroPorExtenso(e.duracaoHoras)}) ${e.duracaoHoras === 1 ? 'hora' : 'horas'}, contabilizadas a partir do horário oficial de início estabelecido. A equipe da CONTRATADA compromete-se a chegar antecipadamente para garantir a adequada montagem e preparação.`,
      ],
    },
    {
      titulo: 'CLÁUSULA SÉTIMA - DO PREÇO E DA FORMA DE PAGAMENTO',
      paragrafos: [
        `Pela prestação dos serviços descritos, a CONTRATANTE pagará à CONTRATADA o valor total de ${moeda(c.valorTotal)} (${reaisPorExtenso(c.valorTotal)}), distribuídos da seguinte forma:`,
      ],
      lista: [
        c.valorEntrada > 0
          ? `Entrada: sinal de ${moeda(c.valorEntrada)} (${reaisPorExtenso(c.valorEntrada)}), pago no ato do fechamento e assinatura deste contrato.`
          : 'Entrada: sinal pago no ato do fechamento e assinatura deste contrato.',
        `Saldo restante: o valor remanescente deverá ser integralmente quitado em até 4 (quatro) dias antes da data de realização do evento (até ${restanteAte}).`,
      ],
    },
    {
      titulo: 'CLÁUSULA OITAVA - DA ATUALIZAÇÃO E ALTERAÇÃO DE VALORES',
      paragrafos: [
        'Em razão da distância temporal até a data de realização do evento, as partes reconhecem que poderá haver alterações no valor total do contrato. Eventuais reajustes serão aplicados estritamente para cobrir variações imprevisíveis ou aumentos expressivos nos custos dos insumos alimentícios e na remuneração/diárias dos funcionários e prestadores de serviços da CONTRATADA. Qualquer alteração será comunicada de forma justificada à CONTRATANTE.',
      ],
    },
    {
      titulo: 'CLÁUSULA NONA - DAS REGRAS DE SEGURANÇA E SOBRAS DE ALIMENTOS',
      paragrafos: [
        'Por razões de segurança alimentar, a CONTRATADA não disponibilizará alimentos preparados após o encerramento do evento. Da mesma forma, não serão mantidas sob a propriedade do buffet carnes cruas e insumos que não tenham sido utilizados. Caso a CONTRATANTE opte por levar quaisquer sobras, esta assumirá integralmente a responsabilidade civil e criminal por sua conservação, acondicionamento e consumo subsequente, isentando a CONTRATADA de quaisquer encargos.',
      ],
    },
    {
      titulo: 'CLÁUSULA DÉCIMA - DOS DANOS E AVARIAS DE UTENSÍLIOS',
      paragrafos: [
        `Em caso de quebra, perda, extravio ou avaria de qualquer item da estrutura fornecida (incluindo pratos, copos, talheres, taças ou louças em geral), fica acertada a indenização obrigatória por parte da CONTRATANTE no valor fixo de ${moeda(c.valorAvaria)} (${reaisPorExtenso(c.valorAvaria)}) por peça danificada.`,
      ],
    },
    {
      titulo: 'CLÁUSULA DÉCIMA PRIMEIRA - DA RESCISÃO E QUEBRA DE CONTRATO',
      paragrafos: [
        'Em caso de quebra de contrato, cancelamento ou desistência por iniciativa da CONTRATANTE, fica acertada a não devolução do valor combinado da entrada (sinal), o qual será integralmente retido pela CONTRATADA como indenização por retenção de data e custos operacionais prévios. Caso a rescisão sem justa causa ocorra por parte da CONTRATADA, esta deverá restituir integralmente o valor recebido a título de sinal, acrescido de multa equivalente.',
      ],
    },
    {
      titulo: 'CLÁUSULA DÉCIMA SEGUNDA - DA ASSINATURA ELETRÔNICA',
      paragrafos: [
        'As partes reconhecem como válida a assinatura deste contrato por meio eletrônico, nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001 e da Lei nº 14.063/2020. A CONTRATANTE assina mediante código de confirmação enviado ao seu e-mail, ficando registrados a data, a hora, o endereço IP e o dispositivo utilizados. A CONTRATADA manifesta seu aceite pelo envio deste contrato por seu representante.',
      ],
    },
    {
      titulo: 'CLÁUSULA DÉCIMA TERCEIRA - DO FORO',
      paragrafos: [
        `Para dirimir quaisquer dúvidas ou controvérsias decorrentes da interpretação ou execução deste instrumento, as partes elegem o Foro da Comarca de ${c.foro}.`,
      ],
    },
  ];
  return blocos;
}

export const TITULO_DO_CONTRATO = 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE BUFFET E CHURRASCO';

/**
 * O contrato como texto corrido, linha por linha.
 *
 * É sobre ESTE texto que a impressão digital (SHA-256) é calculada na
 * assinatura. Qualquer mudança de uma letra muda o hash.
 */
export function textoDoContrato(c: ConteudoDoContrato, quem: Contratante): string {
  const linhas = [TITULO_DO_CONTRATO, ''];
  for (const b of blocosDoContrato(c, quem)) {
    if (b.titulo) linhas.push(b.titulo);
    linhas.push(...b.paragrafos);
    for (const [i, item] of (b.lista ?? []).entries()) linhas.push(`${b.titulo?.includes('PREÇO') ? `${i + 1}.` : '-'} ${item}`);
    linhas.push('');
  }
  linhas.push(`CONTRATANTE: ${quem.nome.trim().toUpperCase()}, CPF ${cpfFormatado(quem.cpf)}, e-mail ${quem.email.trim().toLowerCase()}`);
  linhas.push(`CONTRATADA: ${c.contratada.nome}, representada por ${c.representante}`);
  linhas.push(`Modelo do contrato: ${c.modelo}`);
  return linhas.join('\n');
}

/** SHA-256 em hexadecimal, igual no navegador e no Deno. */
export async function impressaoDigital(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
