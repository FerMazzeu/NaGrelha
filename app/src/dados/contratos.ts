import type { ConteudoDoContrato, Contratante } from '../../supabase/functions/_shared/contrato';
import { supabase } from '../integrations/supabase/client';

export type SituacaoDoContrato = 'enviado' | 'assinado' | 'cancelado';

export type Contrato = {
  id: string;
  eventoId: string;
  token: string;
  situacao: SituacaoDoContrato;
  conteudo: ConteudoDoContrato;
  contratante: Contratante;
  enviadoEm: string;
  visualizadoEm: string | null;
  assinadoEm: string | null;
  hash: string | null;
  assinatura: Assinatura | null;
};

export type Assinatura = {
  email: string;
  ip: string;
  dispositivo?: string;
  metodo?: string;
  codigoEnviadoEm?: string;
};

type Linha = {
  id: string;
  evento_id: string;
  token: string;
  situacao: SituacaoDoContrato;
  conteudo: ConteudoDoContrato;
  contratante: Partial<Contratante> | null;
  enviado_em: string;
  visualizado_em: string | null;
  assinado_em: string | null;
  hash_documento: string | null;
  assinatura: Assinatura | null;
};

export const contratanteVazio = (): Contratante => ({ nome: '', cpf: '', endereco: '', email: '', telefone: '' });

const paraContrato = (l: Linha): Contrato => ({
  id: l.id,
  eventoId: l.evento_id,
  token: l.token,
  situacao: l.situacao,
  conteudo: l.conteudo,
  contratante: { ...contratanteVazio(), ...(l.contratante ?? {}) },
  enviadoEm: l.enviado_em,
  visualizadoEm: l.visualizado_em,
  assinadoEm: l.assinado_em,
  hash: l.hash_documento,
  assinatura: l.assinatura,
});

/** O endereço que o cliente abre. Parâmetro, como o do pedido: a Vercel não precisa de rota. */
export const linkDoContrato = (token: string) => `${window.location.origin}/?contrato=${token}`;

export const contratos = {
  /** Os contratos do evento, do mais novo para o mais antigo. */
  async doEvento(eventoId: string): Promise<Contrato[]> {
    const { data, error } = await supabase
      .from('contratos')
      .select('id, evento_id, token, situacao, conteudo, contratante, enviado_em, visualizado_em, assinado_em, hash_documento, assinatura')
      .eq('evento_id', eventoId)
      .order('enviado_em', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as Linha[]).map(paraContrato);
  },

  /** Gera o link. Quem gera fica registrado como representante do buffet. */
  async criar(eventoId: string, conteudo: ConteudoDoContrato): Promise<Contrato> {
    const { data: sessao } = await supabase.auth.getUser();
    if (!sessao.user) throw new Error('Sessão expirada. Entre de novo.');
    const { data, error } = await supabase
      .from('contratos')
      .insert({ evento_id: eventoId, conteudo, enviado_por: sessao.user.id })
      .select('id, evento_id, token, situacao, conteudo, contratante, enviado_em, visualizado_em, assinado_em, hash_documento, assinatura')
      .single();
    if (error) {
      if (error.code === '42501') throw new Error('Só quem é dono pode gerar contrato: o envio vale como aceite do buffet.');
      throw error;
    }
    return paraContrato(data as Linha);
  },

  async cancelar(id: string) {
    const { error } = await supabase.from('contratos').update({ situacao: 'cancelado' }).eq('id', id);
    if (error) throw error;
  },

  /** O nome de quem está logado, que assina pelo buffet. */
  async meuNome(): Promise<string> {
    const { data: sessao } = await supabase.auth.getUser();
    if (!sessao.user) return '';
    const { data } = await supabase.from('perfis').select('nome').eq('id', sessao.user.id).maybeSingle();
    return ((data?.nome as string | undefined) ?? sessao.user.email ?? '').trim();
  },
};
