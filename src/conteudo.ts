/**
 * Todo o texto do site mora aqui, separado da marcação.
 *
 * Duas regras valem para qualquer coisa escrita neste arquivo:
 * 1. Sem travessão. Dois períodos, vírgula ou dois-pontos resolvem.
 * 2. Português do Brasil. O material de origem misturava as duas normas
 *    ("gastronómica", "partilhar", "seleccionados") e o cliente atende em Minas.
 */

export const contato = {
  erica: {
    nome: 'Érica',
    papel: 'Orçamentos e agenda',
    telefone: '5535988638687',
    exibicao: '(35) 98863-8687',
  },
  alan: {
    nome: 'Alan Xavier',
    papel: 'Consultoria técnica',
    telefone: '5535988219023',
    exibicao: '(35) 98821-9023',
  },
  instagram: 'nagrelha_alanxavier',
  instagramUrl: 'https://instagram.com/nagrelha_alanxavier',
} as const;

export function linkWhatsApp(telefone: string, mensagem: string) {
  return `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
}

export const mensagemPadrao =
  'Olá! Vim pelo site do Na Grelha e gostaria de um orçamento para o meu evento.';

export const navegacao = [
  { rotulo: 'A origem', alvo: 'origem' },
  { rotulo: 'Como funciona', alvo: 'promessa' },
  { rotulo: 'Equipe', alvo: 'equipe' },
  { rotulo: 'Cardápio', alvo: 'cardapio' },
  { rotulo: 'Galeria', alvo: 'galeria' },
  { rotulo: 'Orçamento', alvo: 'contato' },
] as const;

export const hero = {
  selo: 'Buffet de churrasco · Tradição desde 2024',
  titulo: ['O sabor da grelha', 'no seu evento'],
  texto: 'Comida boa feita com o coração. A gente assume a brasa, e você aproveita a festa.',
  acaoPrimaria: 'Pedir orçamento no WhatsApp',
  acaoSecundaria: 'Ver o cardápio',
  rodape: 'De 15 a 300 convidados, com estrutura completa no local.',
};

export const numeros = [
  { valor: '2024', rotulo: 'Ano de fundação', nota: 'Construído com fé e amor pelo fogo' },
  { valor: '100+', rotulo: 'Eventos realizados', nota: 'Celebrações inesquecíveis em todo o estado' },
  { valor: '15 a 300', rotulo: 'Convidados por evento', nota: 'Da confraternização pequena à festa grande' },
  { valor: '100%', rotulo: 'Dedicação', nota: 'Do primeiro ao último convidado' },
];

export const origem = {
  selo: 'A origem',
  titulo: 'Do fogo entre amigos ao reconhecimento',
  paragrafos: [
    'Começou de um jeito simples e genuíno. Alan Xavier era o assador oficial das reuniões de amigos, aquele que todos pediam para ficar na grelha porque o resultado saía sempre diferente: mais saboroso, mais preciso, mais especial.',
    'Com o tempo, o talento encontrou a oportunidade. As feiras da cidade foram o primeiro palco público, onde o aroma da brasa atraía filas e os elogios começaram a ganhar forma de negócio. As marmitas de domingo viraram ritual para quem descobria o sabor daquela grelha.',
    'O primeiro grande desafio chegou com um evento de 50 pessoas, um teste de fogo de verdade. A logística, a pressão, a responsabilidade de alimentar tanta gente com a mesma qualidade. Alan não só superou o desafio: saiu dele com a certeza de ter encontrado sua missão.',
    'Hoje o reconhecimento é consequência da dedicação. Cada evento é tratado com a paixão do primeiro churrasco entre amigos, agora com a estrutura, a técnica e a experiência de quem já serviu centenas de celebrações.',
  ],
  legendaFoto: 'A equipe que faz cada evento acontecer',
};

export const aviso = {
  destaque: 'Isto não é foto ilustrativa.',
  texto:
    'O que você vê no nosso perfil é o que chega na sua mesa. Cada foto é um prato real, e cada prato é uma promessa cumprida.',
};

export const promessa = {
  selo: 'Como funciona',
  titulo: ['Devolvemos a sua festa', 'a você'],
  texto:
    'Chega de ficar preso à brasa no seu próprio evento. O Na Grelha assume a grelha para você curtir cada momento.',
  itens: [
    {
      icone: 'festa',
      titulo: 'Você na festa, não na brasa',
      texto: 'Da churrasqueira acesa ao último corte, nós assumimos tudo. Enquanto a costela assa, você brinda.',
    },
    {
      icone: 'carne',
      titulo: 'Carne no ponto, sempre',
      texto:
        'Sem carne seca, sem costela dura, sem erro. Cada corte sai da brasa no ponto exato, do primeiro ao último convidado.',
    },
    {
      icone: 'caminhao',
      titulo: 'Brasa que chega até você',
      texto:
        'Levamos carvão, grelha, estação completa e acompanhamentos frescos. Você não toca em nenhuma panela.',
    },
    {
      icone: 'brilho',
      titulo: 'Saída limpa, festa completa',
      texto:
        'Depois do último corte recolhemos tudo e deixamos o espaço em ordem. Você fica com os elogios, e a bagunça fica com a gente.',
    },
  ],
};

export const diferencial = {
  selo: 'O diferencial',
  titulo: ['O diferencial que', 'conecta'],
  texto:
    'Não vendemos buffet de churrasco. Entregamos uma experiência, serviço afiado e uma festa que pega fogo do começo ao fim.',
  blocos: [
    {
      icone: 'fogo',
      titulo: 'Hospitalidade de churrasqueiro',
      paragrafos: [
        'O Na Grelha não só assa. Somos uma equipe contagiante, com uma vibe irresistível, que transforma momentos especiais em celebrações cheias de sabor.',
        'Fogo aceso, convidados satisfeitos e elogios do início ao fim. Quem prova a nossa grelha sempre pede bis.',
      ],
      destaque: null,
    },
    {
      icone: 'balanca',
      titulo: 'Cada grama calculada',
      paragrafos: [
        'Não medimos carne no olho. Sabemos a gramatura exata por pessoa, por corte e por evento.',
        'Sem sobra desperdiçada, sem carvão a mais, sem surpresa no orçamento. Cada real vira sabor no prato.',
      ],
      destaque: 'Transparência total: orçamento fechado, sem custo oculto.',
    },
  ],
};

export const equipe = {
  selo: 'Quem faz acontecer',
  titulo: 'A sua celebração merece a assinatura do chef',
  texto: 'Dedicação, confiança e amor em cada detalhe.',
  destaques: [
    {
      foto: 'alan',
      nome: 'Alan Xavier',
      papel: 'Churrasqueiro-chefe',
      paragrafos: [
        'Por trás de cada brasa selada e de cada corte suculento está a paixão e a maestria de Alan Xavier. Mais do que churrasqueiro, Alan é o artista que transforma ingrediente em experiência.',
        'Com anos de dedicação ao fogo e à carne, ele não apenas executa: dá a cada evento a sua energia e o conhecimento profundo da arte do churrasco. A presença dele garante que cada detalhe, do aroma à apresentação, saia impecável.',
      ],
    },
    {
      foto: 'erica',
      nome: 'Érica',
      papel: 'Atendimento, ambientação e confeitaria',
      paragrafos: [
        'Érica é quem atende você desde o primeiro contato. É com ela que sai o orçamento, o cardápio fechado e a data reservada, e é ela que acompanha cada detalhe até o dia do evento.',
        'Ela também cuida da ambientação, para o espaço estar pronto e acolhedor quando o primeiro convidado chegar.',
        'E fecha a celebração com a confeitaria. Cada doce é preparado com ingrediente fresco e carinho, para a festa terminar na nota mais doce.',
      ],
    },
  ],
  ambientacao: {
    foto: 'erica-ambiente',
    titulo: 'Preparação da festa, do começo ao fim',
    paragrafos: [
      'Além do atendimento, Érica também cuida da preparação do ambiente, com os detalhes que transformam o evento em uma experiência mais bonita, organizada e acolhedora.',
      'Ela auxilia na escolha e organização do local, mesas, cadeiras, toalhas, decoração de mesa e ornamentação, trazendo harmonia e praticidade para cada etapa da celebração.',
    ],
  },
  apoio: [
    {
      foto: 'andre',
      nome: 'André',
      papel: 'Preparação e execução',
      texto:
        'Ao lado do Alan, André é presença fundamental na preparação e na execução do churrasco. Com dedicação e responsabilidade, garante que cada corte e cada detalhe saiam com excelência.',
    },
    {
      foto: 'isabelle',
      nome: 'Isabelle',
      papel: 'Organização e detalhes',
      texto:
        'Junto da Érica na organização, Isabelle é essencial para que tudo aconteça com cuidado, agilidade e atenção. Comprometimento e carinho que fazem diferença em cada celebração.',
    },
  ],
  fechamento: 'Mais do que uma equipe, somos pessoas que acreditam, se dedicam e fazem cada evento acontecer.',
};

export const familia = {
  selo: 'Da nossa família para a sua',
  titulo: 'Cuidado, confiança e presença do começo ao fim',
  paragrafos: [
    'No Na Grelha, cada evento é preparado com o carinho e a atenção de uma empresa familiar. Valorizamos o contato próximo, o ambiente acolhedor e a confiança construída em cada celebração.',
    'Aqui você não encontra apenas um serviço contratado, e sim pessoas que se importam com cada detalhe. Do primeiro contato até a realização do evento, as mesmas pessoas seguem ao seu lado, acompanhando cada etapa com responsabilidade e verdade.',
    'Essa é a essência do Na Grelha: levar para a sua festa o cuidado, a união e o calor humano que fazem parte da nossa família.',
  ],
  fechamento: 'Mais do que servir bem, queremos fazer você se sentir em família.',
};

export const cardapio = {
  selo: 'O cardápio',
  titulo: ['Uma refeição completa,', 'não apenas um churrasco'],
  texto:
    'Churrasco bom não tem fila, não tem carne fria e não tem convidado esquecido. O nosso fluxo garante isso do primeiro ao último prato.',
  /*
    Cinco itens, não sete.
    "Guarnições na hora" saiu daqui porque tem seção própria e detalhada mais
    abaixo, e "Macarrão à sua escolha" foi absorvido por "Massas", que dizia a
    mesma coisa com outras palavras. O primeiro item é largo: a grade deixa de
    ser mais uma fileira de cartões iguais.
  */
  itens: [
    {
      foto: 'entradas',
      titulo: 'Entradas na brasa',
      texto:
        'O famoso pão de alho com queijo derretido, o choripán artesanal com chimichurri e linguiça temperada, e a batata rústica em cortes generosos, crocante por fora e macia por dentro.',
      largo: true,
    },
    {
      foto: 'cortes',
      titulo: 'Cortes nobres no ponto',
      texto:
        'Cortes premium Angus e Nelore. Ancho, chorizo, costela, fraldinha, maminha e picanha saindo da brasa viva direto para o prato.',
      largo: false,
    },
    {
      foto: 'massas',
      titulo: 'Massas e molhos artesanais',
      texto:
        'Massa fresca cozida na hora, com molhos feitos por nós: um vermelho de fraldinha e um de provolone com filé de alcatra. Você escolhe o molho, a carne e os acompanhamentos, e o prato é montado na hora.',
      largo: false,
    },
    {
      foto: 'ilha',
      titulo: 'Ilha gastronômica',
      texto:
        'Diferentes preparos reunidos num só espaço. Opções quentes, acompanhamentos e sabores variados para cada convidado montar o prato do seu jeito.',
      largo: false,
    },
    {
      foto: 'frios',
      titulo: 'Mesa de frios',
      texto:
        'Queijos, embutidos, pães, frutas e acompanhamentos frescos. Organizada para receber os convidados com variedade e uma apresentação que chama atenção.',
      largo: false,
    },
  ],
  fechamento: {
    titulo: 'Do amante de chorizo ao fã do burguer grelhado, cada convidado acha o prato favorito na nossa grelha.',
    destaque: 'Ninguém fica insatisfeito.',
  },
};

/*
  A seção "Vitrine gastronômica" foi removida.
  Os três cartões dela repetiam, com outras palavras, o que o cardápio, a seção
  de cortes e a do burguer já diziam. O que valia a pena ali era a citação do
  Alan, que passou a abrir a seção de técnica.
*/

export const cortes = {
  selo: 'A técnica',
  titulo: ['Por que a carne sai', 'sempre no ponto'],
  texto:
    'O cardápio diz o que vai ser servido. Esta parte é sobre como, que é onde um churrasco de evento costuma falhar: carne que descansa demais, corte que resseca, convidado que come frio.',
  citacao: {
    texto: 'Só o melhor chega à nossa grelha. Cada corte é escolhido como se fosse para a nossa família, e vai para a sua.',
    autor: 'Alan Xavier',
  },
  passos: [
    {
      numero: '01',
      titulo: 'Tudo começa na escolha',
      texto: 'Qualidade não é detalhe, é o ponto de partida. Cada corte é selecionado a dedo, com critério e respeito pela matéria-prima.',
    },
    {
      numero: '02',
      titulo: 'A brasa faz o resto',
      texto:
        'Na grelha de carvão o fogo vivo transforma cada peça. A crosta que estala, o interior suculento, o aroma defumado. Isso não se improvisa.',
    },
    {
      numero: '03',
      titulo: 'O ponto certo, sempre',
      texto:
        'Alan sabe exatamente quando virar, quando afastar e quando servir. Do primeiro ao último convidado, cada peça sai no ponto, sem margem para erro.',
    },
    {
      numero: '04',
      titulo: 'O resultado é a memória',
      texto:
        'No fim, o que fica não é só o sabor. É o convidado que pergunta quem fez o churrasco, e o anfitrião que não precisou se preocupar com nada.',
    },
  ],
};

export const guarnicoes = {
  selo: 'O que acompanha',
  titulo: ['Guarnições feitas', 'no local, na hora'],
  texto:
    'Churrasco de excelência não se faz só de carne. Nada aqui chega pronto de casa: tudo é preparado no local, durante o evento, com receitas desenvolvidas ao longo de anos para acompanhar cada corte.',
  itens: [
    { foto: 'arroz', titulo: 'Arroz soltinho', texto: 'Preparado na hora, grão a grão. O tempero certo para acompanhar qualquer corte da brasa.' },
    { foto: 'farofa', titulo: 'Farofinha artesanal', texto: 'Feita na hora com abacaxi, bacon crocante e ervas selecionadas. A farofinha que virou marca registrada.' },
    { foto: 'maionese', titulo: 'Maionese', texto: 'Feita na hora, cremosa e equilibrada, com variações que surpreendem a cada evento.' },
    { foto: 'salada', titulo: 'Salada tropical', texto: 'Colorida, nutritiva e da época. O equilíbrio perfeito para fechar o prato com sabor de verdade.' },
  ],
};

export const burguer = {
  selo: 'Burguer na grelha',
  titulo: ['O sabor da grelha,', 'no nosso burguer'],
  paragrafos: [
    'Quando o burguer encontra a grelha de carvão acontece algo fora do comum. O fogo vivo cria uma crosta caramelizada, a fumaça penetra na carne, e o resultado é um sabor que nenhuma chapa replica.',
    'É servido com a nossa batata rústica, no pão brioche tostado na própria grelha, com molhos exclusivos, no estilo finger food.',
    'Ideal para eventos mais descontraídos, aniversários, festas de 15 anos, ou como opção de finalização. O burguer do Alan tem fã declarado que pede por ele em cada evento.',
  ],
  extra: 'E se você já estiver satisfeito, não fica sem o seu burguer: a gente embala para você levar para casa.',
  nota: 'Disponível como opção principal ou complementar no buffet.',
};

export const bebidas = {
  selo: 'Serviços adicionais',
  titulo: 'Bebidas para completar a sua festa',
  texto:
    'Além da parte gastronômica, cuidamos também das bebidas do evento. É um serviço contratado à parte, organizado conforme o perfil da celebração e o número de convidados.',
  itens: [
    { icone: 'chopp', titulo: 'Chopp', texto: 'Cerveja bem gelada para animar a festa do começo ao fim.' },
    { icone: 'refri', titulo: 'Refrigerantes', texto: 'Opções refrescantes para todos os gostos e idades.' },
    { icone: 'agua', titulo: 'Água', texto: 'Água mineral sempre disponível para os convidados.' },
  ],
  fechamento: 'Você aproveita a festa. O Na Grelha fica por conta do restante.',
};

export const visual = {
  selo: 'O visual',
  titulo: ['O visual', 'gastronômico'],
  texto:
    'A comida é uma experiência completa, para o paladar e para os olhos. Cada prato é montado para ser fotografado, compartilhado e admirado antes de ser saboreado.',
  itens: [
    {
      titulo: 'Feito para fotografar',
      texto:
        'Cada prato é montado com consciência visual. Os seus convidados vão querer fotografar antes de comer, e essas fotos viram a melhor publicidade que existe.',
    },
    {
      titulo: 'Apresentação de elite',
      texto:
        'Usamos louças, tábuas e utensílios selecionados, com parrillas e estação de fogo de chão. O visual premium eleva a percepção de todo o evento.',
    },
    {
      titulo: 'Memórias visuais',
      texto:
        'As fotos do evento ficam para sempre. Quando os convidados compartilham as imagens da comida, estão compartilhando a memória da sua celebração. E todas as fotos são originais.',
    },
  ],
};

export const galeria = {
  selo: 'Galeria',
  titulo: 'Tudo isto já saiu da nossa grelha',
  texto: 'Fotos reais dos nossos eventos. Nenhuma delas é banco de imagem.',
  /*
    Um texto alternativo por foto, na ordem em que elas são geradas em
    scripts/imagens.mjs. Antes eram quinze vezes a mesma frase, o que para
    quem usa leitor de tela é ruído, e joga fora quinze chances de descrever
    comida de verdade.
  */
  alternativos: [
    'Peça de carne sendo retirada da grelha com a brasa acesa embaixo',
    'Costela inteira assando em espeto vertical diante do fogo',
    'Linguiças e sobrecoxas douradas servidas com molho',
    'Grelha grande com linguiças e legumes no meio da fumaça',
    'Costelinhas douradas empilhadas logo depois de saírem da brasa',
    'Pedaços de frango grelhado descansando sobre a tábua',
    'Asas de frango douradas servidas com molho da casa',
    'Frango grelhado em pedaços, pronto para servir',
    'Mesa de doces e salgados montada e decorada para o evento',
    'Potes de molhos artesanais com o rótulo do Na Grelha',
    'Temperos, molhos e frutas organizados na estação de trabalho',
    'Espetinho de abacaxi sendo montado na hora',
    'Bandeja de asas de frango recém-saídas da grelha',
    'Picanha fatiada sobre a tábua, ainda rosada por dentro',
    'Legumes coloridos grelhados na chapa',
    'Dois burgers no pão brioche tostado na grelha',
  ],
};

export const contatoSecao = {
  selo: 'Orçamento',
  titulo: ['A sua celebração merece a assinatura', 'do chef Alan Xavier'],
  texto:
    'Cada evento é único. Cada convidado merece o melhor. Cada memória merece ser construída com sabor, técnica e a paixão de quem vive para a grelha.',
  cartoes: [
    {
      icone: 'telefone',
      titulo: 'Central de orçamentos',
      pessoa: contato.erica,
      texto:
        'Atendimento comercial, orçamentos e disponibilidade de agenda. Cardápio personalizado, gramatura e detalhes do evento.',
      nota: 'WhatsApp com resposta rápida e proposta personalizada.',
      acao: 'Falar com a Érica',
      mensagem:
        'Olá, Érica! Vim pelo site do Na Grelha e gostaria de um orçamento. Meu evento é para cerca de ___ convidados, no dia ___.',
      destaque: true,
    },
    {
      icone: 'chef',
      titulo: 'Consultoria técnica',
      pessoa: contato.alan,
      texto:
        'Fale direto com o chef sobre qualquer dúvida técnica: cortes, formato de serviço e o melhor desenho para a sua celebração.',
      nota: 'Para dúvidas sobre cardápio, estrutura e execução.',
      acao: 'Falar com o Alan',
      mensagem: 'Olá, Alan! Vim pelo site do Na Grelha e queria tirar uma dúvida sobre o formato do meu evento.',
      destaque: false,
    },
  ],
  citacao:
    'Não vendemos apenas churrasco. Vendemos o momento em que os seus convidados fecham os olhos na primeira mordida e dizem: que festa incrível.',
};

export const gratidao = {
  selo: 'Gratidão',
  titulo: 'Agradecemos a sua confiança',
  paragrafos: [
    'A cada evento, a cada sorriso e a cada elogio, sentimos a certeza de que estamos no caminho certo. A sua confiança é o combustível que mantém a chama acesa e a grelha sempre quente.',
    'É uma honra fazer parte do seu momento especial e transformar celebrações em memórias inesquecíveis. O nosso compromisso é com a excelência, o sabor autêntico e a paixão pela brasa.',
  ],
};

export const rodape = {
  assinatura: 'Na Grelha com Alan Xavier. Tradição desde 2024.',
  frase: 'Comida boa feita com o coração.',
};
