import type {
  Conversa,
  Escala,
  FaixaEtaria,
  Item,
  Membro,
  MensagemSalva,
  Orcamento,
  Perfil,
  Servico,
} from '../dominio/tipos';

/**
 * A porta de entrada dos dados.
 *
 * Tudo é assíncrono de propósito. Foi isso que permitiu trocar o localStorage
 * pelo Supabase sem mexer em nenhuma tela nem no cálculo: quem entrou foi uma
 * implementação nova da mesma interface.
 */
export interface Repositorio {
  listarOrcamentos(): Promise<Orcamento[]>;
  obterOrcamento(id: string): Promise<Orcamento | null>;
  salvarOrcamento(orcamento: Orcamento): Promise<void>;
  removerOrcamento(id: string): Promise<void>;

  lerCatalogo(): Promise<Item[]>;
  salvarItem(item: Item): Promise<void>;
  criarItem(item: Omit<Item, 'id'>): Promise<Item>;
  removerItem(id: string): Promise<void>;

  /** Catálogo de serviços, com as faixas de cachê por tamanho de evento. */
  lerServicos(): Promise<Servico[]>;
  salvarServico(servico: Servico): Promise<void>;
  criarServico(servico: Omit<Servico, 'id' | 'faixas'>): Promise<Servico>;
  removerServico(id: string): Promise<void>;

  lerFaixasEtarias(): Promise<FaixaEtaria[]>;
  salvarFaixaEtaria(faixa: FaixaEtaria): Promise<void>;
  criarFaixaEtaria(faixa: Omit<FaixaEtaria, 'id'>): Promise<FaixaEtaria>;
  removerFaixaEtaria(id: string): Promise<void>;

  /** Conversas do assistente, do usuário logado. */
  listarConversas(): Promise<Conversa[]>;
  criarConversa(titulo: string, eventoId: string | null): Promise<Conversa>;
  lerMensagens(conversaId: string): Promise<MensagemSalva[]>;
  renomearConversa(id: string, titulo: string): Promise<void>;
  removerConversa(id: string): Promise<void>;
  /** Link temporário para uma imagem guardada no bucket privado. */
  urlDaImagem(caminho: string): Promise<string | null>;

  /** Quem tem login, inclusive quem ainda esta pendente de liberacao. */
  listarPerfis(): Promise<Perfil[]>;
  definirAcesso(id: string, aprovado: boolean): Promise<void>;
  definirPapel(id: string, papel: Perfil['papel']): Promise<void>;
  souDono(): Promise<boolean>;

  listarMembros(): Promise<Membro[]>;
  salvarMembro(membro: Membro): Promise<void>;
  criarMembro(membro: Omit<Membro, 'id'>): Promise<Membro>;
  removerMembro(id: string): Promise<void>;

  listarEscalas(eventoId: string): Promise<Escala[]>;
  escalar(eventoId: string, membroId: string, funcao: string, cache: number): Promise<void>;
  atualizarEscala(escala: Escala): Promise<void>;
  desescalar(id: string): Promise<void>;
}
