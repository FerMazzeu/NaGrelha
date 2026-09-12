import type { Escala, Item, Membro, Orcamento } from '../dominio/tipos';

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

  listarMembros(): Promise<Membro[]>;
  salvarMembro(membro: Membro): Promise<void>;
  criarMembro(membro: Omit<Membro, 'id'>): Promise<Membro>;
  removerMembro(id: string): Promise<void>;

  listarEscalas(eventoId: string): Promise<Escala[]>;
  escalar(eventoId: string, membroId: string, funcao: string, cache: number): Promise<void>;
  atualizarEscala(escala: Escala): Promise<void>;
  desescalar(id: string): Promise<void>;
}
