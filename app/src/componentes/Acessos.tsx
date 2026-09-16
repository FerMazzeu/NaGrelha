import { useState } from 'react';
import type { Perfil } from '../dominio/tipos';
import { dataCurta } from '../formato';

/**
 * Liberação de acesso.
 *
 * Quem se cadastra entra pendente e não enxerga nada até ser liberado aqui.
 * Isso não é uma tela que esconde botão: o `aprovado` é a coluna que a função
 * `e_membro()` lê, e é ela que todas as policies do banco avaliam. Enquanto
 * estiver falso, a consulta volta vazia mesmo que a pessoa saiba o endereço.
 *
 * Só aparece para o dono, e quem garante isso também é o banco: a policy de
 * update em `perfis` exige `e_dono()`.
 */
export default function Acessos({
  perfis,
  meuId,
  aoLiberar,
  aoMudarPapel,
}: {
  perfis: Perfil[];
  meuId: string;
  aoLiberar: (id: string, aprovado: boolean) => Promise<void>;
  aoMudarPapel: (id: string, papel: Perfil['papel']) => Promise<void>;
}) {
  const pendentes = perfis.filter((p) => !p.aprovado);
  const liberados = perfis.filter((p) => p.aprovado);

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="titulo text-lg text-dourado">Acessos ao app</h2>
        {pendentes.length > 0 && (
          <span className="rounded-full bg-brasa px-2.5 py-1 text-xs font-semibold text-creme">
            {pendentes.length} aguardando
          </span>
        )}
      </div>

      {pendentes.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-fumaca">
            Estas pessoas criaram conta e ainda não enxergam nada. Libere só quem você reconhece.
          </p>
          {pendentes.map((p) => (
            <Linha key={p.id} perfil={p} meuId={meuId} aoLiberar={aoLiberar} aoMudarPapel={aoMudarPapel} />
          ))}
        </div>
      )}

      <div className="mt-5">
        <p className="rotulo mb-2">Com acesso ({liberados.length})</p>
        <div className="space-y-2">
          {liberados.map((p) => (
            <Linha key={p.id} perfil={p} meuId={meuId} aoLiberar={aoLiberar} aoMudarPapel={aoMudarPapel} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Linha({
  perfil,
  meuId,
  aoLiberar,
  aoMudarPapel,
}: {
  perfil: Perfil;
  meuId: string;
  aoLiberar: (id: string, aprovado: boolean) => Promise<void>;
  aoMudarPapel: (id: string, papel: Perfil['papel']) => Promise<void>;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [confirmandoCorte, setConfirmandoCorte] = useState(false);
  const souEu = perfil.id === meuId;

  const rodar = async (acao: () => Promise<void>) => {
    setOcupado(true);
    try {
      await acao();
    } finally {
      setOcupado(false);
      setConfirmandoCorte(false);
    }
  };

  return (
    <div className={`cartao p-3 ${perfil.aprovado ? '' : 'border-brasa/40 bg-brasa/6'}`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{perfil.nome}</p>
            {perfil.papel === 'dono' && (
              <span className="shrink-0 rounded-full border border-dourado/50 px-2 py-0.5 text-[0.65rem] text-dourado">
                dono
              </span>
            )}
            {souEu && <span className="shrink-0 text-[0.65rem] text-fumaca">você</span>}
          </div>
          <p className="truncate text-sm text-fumaca">
            {perfil.email || 'e-mail não disponível'}
            {perfil.criadoEm ? ` · entrou em ${dataCurta(perfil.criadoEm.slice(0, 10))}` : ''}
          </p>
        </div>

        {!perfil.aprovado ? (
          <button
            type="button"
            className="botao botao-brasa !min-h-10 shrink-0 !px-4 text-sm"
            disabled={ocupado}
            onClick={() => rodar(() => aoLiberar(perfil.id, true))}
          >
            {ocupado ? '...' : 'Liberar'}
          </button>
        ) : (
          !souEu && (
            <button
              type="button"
              className="botao botao-linha !min-h-10 shrink-0 !px-3 text-sm !text-fumaca hover:!border-brasa hover:!text-brasa-clara"
              disabled={ocupado}
              onClick={() => setConfirmandoCorte(true)}
            >
              Tirar acesso
            </button>
          )
        )}
      </div>

      {confirmandoCorte && (
        <div className="mt-3 rounded-xl border border-brasa/40 bg-brasa/8 p-3">
          <p className="text-sm">
            Tirar o acesso de <strong>{perfil.nome}</strong>?
          </p>
          <p className="mt-1 text-xs text-fumaca">
            Ela continua com a conta, mas para de enxergar orçamentos, agenda e equipe na mesma hora.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="botao botao-brasa flex-1 !min-h-10"
              disabled={ocupado}
              onClick={() => rodar(() => aoLiberar(perfil.id, false))}
            >
              Tirar
            </button>
            <button
              type="button"
              className="botao botao-linha flex-1 !min-h-10"
              onClick={() => setConfirmandoCorte(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {perfil.aprovado && !souEu && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-fumaca">Papel</span>
          <div className="flex gap-1 rounded-full border border-borda p-0.5">
            {(['equipe', 'dono'] as const).map((papel) => (
              <button
                key={papel}
                type="button"
                aria-pressed={perfil.papel === papel}
                disabled={ocupado}
                onClick={() => rodar(() => aoMudarPapel(perfil.id, papel))}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  perfil.papel === papel ? 'bg-carvao-3 text-dourado' : 'text-fumaca hover:text-creme'
                }`}
              >
                {papel === 'dono' ? 'Dono' : 'Equipe'}
              </button>
            ))}
          </div>
          <span className="text-xs text-fumaca">Dono libera acesso dos outros.</span>
        </div>
      )}
    </div>
  );
}
