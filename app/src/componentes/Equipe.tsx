import { useMemo, useState } from 'react';
import type { Membro, Perfil } from '../dominio/tipos';
import Acessos from './Acessos';
import { casaBusca, real } from '../formato';
import { Campo, CampoNumero, CampoTexto } from './Campos';
import { Lupa } from './Icones';

const FUNCOES = ['Churrasqueiro', 'Auxiliar de grelha', 'Confeitaria', 'Ambientação', 'Organização', 'Garçom'];

export default function Equipe({
  membros,
  perfis,
  meuId,
  souDono,
  aoCriar,
  aoSalvar,
  aoRemover,
  aoLiberar,
  aoMudarPapel,
}: {
  membros: Membro[];
  perfis: Perfil[];
  meuId: string;
  souDono: boolean;
  aoCriar: (m: Omit<Membro, 'id'>) => Promise<void>;
  aoSalvar: (m: Membro) => Promise<void>;
  aoRemover: (id: string) => Promise<void>;
  aoLiberar: (id: string, aprovado: boolean) => Promise<void>;
  aoMudarPapel: (id: string, papel: Perfil['papel']) => Promise<void>;
}) {
  const [novo, setNovo] = useState({ nome: '', funcao: '', telefone: '', cachePadrao: 0 });
  const [abrindo, setAbrindo] = useState(false);
  const [busca, setBusca] = useState('');

  // Procura por nome e por função: "churrasqueiro" é tão útil quanto "André"
  // quando a pergunta é quem pode cobrir a grelha no sábado.
  const encontrados = useMemo(
    () => membros.filter((m) => casaBusca(busca, m.nome, m.funcao)),
    [membros, busca],
  );

  const criar = async () => {
    if (!novo.nome.trim()) return;
    await aoCriar({ ...novo, ativo: true });
    setNovo({ nome: '', funcao: '', telefone: '', cachePadrao: 0 });
    setAbrindo(false);
  };

  return (
    <div className="area py-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="titulo text-2xl">Equipe</h1>
          <p className="mt-1 text-sm text-fumaca">
            Quem pode ser escalado nos eventos, e quanto cada um custa por evento.
          </p>
        </div>
        <button type="button" className="botao botao-brasa" onClick={() => setAbrindo((v) => !v)}>
          {abrindo ? 'Cancelar' : 'Adicionar'}
        </button>
      </div>

      {abrindo && (
        <div className="cartao mt-4 space-y-4 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome">
              <CampoTexto valor={novo.nome} aoMudar={(v) => setNovo({ ...novo, nome: v })} placeholder="Nome" />
            </Campo>
            <Campo rotulo="Telefone">
              <CampoTexto
                valor={novo.telefone}
                aoMudar={(v) => setNovo({ ...novo, telefone: v })}
                placeholder="WhatsApp"
                inputMode="tel"
              />
            </Campo>
            <Campo rotulo="Função">
              <CampoTexto
                valor={novo.funcao}
                aoMudar={(v) => setNovo({ ...novo, funcao: v })}
                placeholder="O que faz no evento"
                list="funcoes"
              />
              <datalist id="funcoes">
                {FUNCOES.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </Campo>
            <Campo rotulo="Cachê padrão" dica="Entra como sugestão ao escalar num evento.">
              <CampoNumero
                valor={novo.cachePadrao}
                aoMudar={(v) => setNovo({ ...novo, cachePadrao: v })}
                sufixo="R$"
              />
            </Campo>
          </div>
          <button type="button" className="botao botao-brasa w-full" onClick={criar} disabled={!novo.nome.trim()}>
            Adicionar à equipe
          </button>
        </div>
      )}

      {/* Liberacao de acesso primeiro: quem entra novo fica travado ate aqui. */}
      {souDono && (
        <div className="mt-6">
          <Acessos perfis={perfis} meuId={meuId} aoLiberar={aoLiberar} aoMudarPapel={aoMudarPapel} />
        </div>
      )}

      {souDono && <div className="mt-8 border-t border-borda pt-6" />}

      {membros.length > 1 && (
        <div className="relative mt-4">
          <input
            type="search"
            className="campo pl-10"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Procurar por nome ou função"
            aria-label="Procurar membro da equipe"
          />
          <Lupa className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fumaca" />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-fumaca hover:text-creme"
            >
              ×
            </button>
          )}
        </div>
      )}

      {busca && (
        <p className="mt-2 text-sm text-fumaca">
          {encontrados.length === 0
            ? 'Ninguém com esse nome ou função.'
            : `${encontrados.length} ${encontrados.length === 1 ? 'pessoa' : 'pessoas'}`}
        </p>
      )}

      {!membros.length ? (
        <p className="cartao mt-6 p-6 text-sm text-fumaca">
          Ninguém cadastrado ainda. Comece pelo Alan, pela Érica, pelo André e pela Isabelle.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {encontrados.map((m) => (
            <LinhaDeMembro key={m.id} membro={m} aoSalvar={aoSalvar} aoRemover={aoRemover} />
          ))}
        </div>
      )}
    </div>
  );
}

function LinhaDeMembro({
  membro,
  aoSalvar,
  aoRemover,
}: {
  membro: Membro;
  aoSalvar: (m: Membro) => Promise<void>;
  aoRemover: (id: string) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(membro);

  if (!editando) {
    return (
      <div className="cartao flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{membro.nome}</p>
          <p className="truncate text-sm text-fumaca">
            {membro.funcao || 'sem função definida'}
            {membro.cachePadrao > 0 ? ` · ${real(membro.cachePadrao)} por evento` : ''}
          </p>
        </div>
        {membro.telefone && (
          <a
            href={`https://wa.me/${membro.telefone.replace(/\D/g, '').length <= 11 ? '55' : ''}${membro.telefone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="botao botao-linha !min-h-10 shrink-0 !px-3 text-sm"
          >
            Zap
          </a>
        )}
        <button
          type="button"
          className="botao botao-linha !min-h-10 shrink-0 !px-3 text-sm"
          onClick={() => {
            setRascunho(membro);
            setEditando(true);
          }}
        >
          Editar
        </button>
      </div>
    );
  }

  return (
    <div className="cartao space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome">
          <CampoTexto valor={rascunho.nome} aoMudar={(v) => setRascunho({ ...rascunho, nome: v })} />
        </Campo>
        <Campo rotulo="Telefone">
          <CampoTexto
            valor={rascunho.telefone}
            aoMudar={(v) => setRascunho({ ...rascunho, telefone: v })}
            inputMode="tel"
          />
        </Campo>
        <Campo rotulo="Função">
          <CampoTexto valor={rascunho.funcao} aoMudar={(v) => setRascunho({ ...rascunho, funcao: v })} />
        </Campo>
        <Campo rotulo="Cachê padrão">
          <CampoNumero
            valor={rascunho.cachePadrao}
            aoMudar={(v) => setRascunho({ ...rascunho, cachePadrao: v })}
            sufixo="R$"
          />
        </Campo>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="botao botao-brasa flex-1"
          onClick={async () => {
            await aoSalvar(rascunho);
            setEditando(false);
          }}
        >
          Salvar
        </button>
        <button type="button" className="botao botao-linha" onClick={() => setEditando(false)}>
          Cancelar
        </button>
        <button
          type="button"
          className="botao botao-linha !text-fumaca hover:!border-brasa hover:!text-brasa-clara"
          onClick={async () => {
            await aoRemover(membro.id);
            setEditando(false);
          }}
          title="Tira da equipe sem apagar o histórico de eventos"
        >
          Remover
        </button>
      </div>
    </div>
  );
}
