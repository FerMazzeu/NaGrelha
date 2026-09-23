import { useState } from 'react';
import type { FaixaEtaria } from '../dominio/tipos';
import { inteiro } from '../formato';
import { Campo, CampoNumero, CampoTexto } from './Campos';
import { Fechar } from './Icones';

/**
 * As faixas de idade das crianças.
 *
 * O percentual manda nas duas pontas da conta: quanto a criança come e quanto
 * ela paga. É por isso que a soma da cobrança fecha com o custo, sem sobra nem
 * falta, e é por isso que mexer aqui mexe no preço de todo orçamento novo.
 *
 * Estava só no banco até agora. O Alan pediu para poder regular, e faz sentido:
 * "até 5 anos não paga" é argumento de venda, e argumento de venda muda.
 */
export default function FaixasEtarias({
  faixas,
  aoSalvar,
  aoCriar,
  aoRemover,
}: {
  faixas: FaixaEtaria[];
  aoSalvar: (faixa: FaixaEtaria) => Promise<void>;
  aoCriar: (faixa: Omit<FaixaEtaria, 'id'>) => Promise<void>;
  aoRemover: (id: string) => Promise<void>;
}) {
  const [criando, setCriando] = useState(false);

  const ordenadas = [...faixas].sort((a, b) => a.idadeMin - b.idadeMin);
  const buracos = acharBuracos(ordenadas);

  const acrescentar = async () => {
    setCriando(true);
    try {
      // Começa onde a última terminou, porque faixa nova quase sempre é o
      // degrau seguinte, e buraco entre faixas deixa criança sem enquadrar.
      const ultima = ordenadas.at(-1);
      const min = ultima?.idadeMax != null ? ultima.idadeMax + 1 : (ultima?.idadeMin ?? -1) + 1;
      await aoCriar({ nome: `${min} a ${min + 4} anos`, idadeMin: min, idadeMax: min + 4, percentual: 50 });
    } finally {
      setCriando(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-fumaca">
        O percentual vale para o quanto a criança come e para o quanto ela paga. Vale para orçamento
        novo: o que já está salvo mantém o percentual do dia em que foi feito.
      </p>

      {buracos.length > 0 && (
        <p className="rounded-xl border border-brasa/50 bg-brasa/10 p-3 text-sm text-brasa-clara">
          Nenhuma faixa cobre {buracos.join(', ')}. Criança nessa idade não tem onde ser lançada.
        </p>
      )}

      <div className="space-y-3">
        {ordenadas.map((f) => (
          <Linha key={f.id} faixa={f} aoSalvar={aoSalvar} aoRemover={aoRemover} />
        ))}

        {!ordenadas.length && (
          <p className="cartao p-4 text-sm text-fumaca">
            Nenhuma faixa ainda. Sem faixa, criança só entra no orçamento como adulto.
          </p>
        )}
      </div>

      <button type="button" className="botao botao-linha w-full" disabled={criando} onClick={acrescentar}>
        {criando ? 'Criando...' : 'Nova faixa'}
      </button>
    </div>
  );
}

function Linha({
  faixa,
  aoSalvar,
  aoRemover,
}: {
  faixa: FaixaEtaria;
  aoSalvar: (f: FaixaEtaria) => Promise<void>;
  aoRemover: (id: string) => Promise<void>;
}) {
  const [rascunho, setRascunho] = useState(faixa);
  const [confirmando, setConfirmando] = useState(false);

  const sujo =
    rascunho.nome !== faixa.nome ||
    rascunho.idadeMin !== faixa.idadeMin ||
    rascunho.idadeMax !== faixa.idadeMax ||
    rascunho.percentual !== faixa.percentual;

  if (confirmando) {
    return (
      <div className="cartao border-brasa/40 bg-brasa/8 p-4">
        <p className="text-sm">Apagar a faixa {faixa.nome}?</p>
        <p className="mt-1 text-xs text-fumaca">
          Orçamento já salvo não muda. Ela só some das próximas contagens.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="botao botao-brasa !min-h-10 flex-1 text-sm"
            onClick={() => aoRemover(faixa.id)}
          >
            Apagar
          </button>
          <button
            type="button"
            className="botao botao-linha !min-h-10 flex-1 text-sm"
            onClick={() => setConfirmando(false)}
          >
            Não
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cartao p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Campo rotulo="Como aparece no orçamento">
            <CampoTexto
              valor={rascunho.nome}
              aoMudar={(v) => setRascunho({ ...rascunho, nome: v })}
              placeholder="6 a 10 anos"
              aria-label={`Nome da faixa ${faixa.nome}`}
            />
          </Campo>
        </div>
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          aria-label={`Apagar a faixa ${faixa.nome}`}
          className="botao botao-linha mt-6 !min-h-11 !w-11 shrink-0 !px-0 !text-fumaca"
        >
          <Fechar className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <Campo rotulo="De">
          <CampoNumero
            valor={rascunho.idadeMin}
            aoMudar={(v) => setRascunho({ ...rascunho, idadeMin: v })}
            sufixo="anos"
            aria-label={`Idade mínima da faixa ${faixa.nome}`}
          />
        </Campo>
        <Campo rotulo="Até">
          <CampoNumero
            valor={rascunho.idadeMax ?? 0}
            aoMudar={(v) => setRascunho({ ...rascunho, idadeMax: v > 0 ? v : null })}
            sufixo="anos"
            aria-label={`Idade máxima da faixa ${faixa.nome}`}
          />
        </Campo>
        <Campo rotulo="Paga">
          <CampoNumero
            valor={rascunho.percentual}
            aoMudar={(v) => setRascunho({ ...rascunho, percentual: v })}
            sufixo="%"
            aria-label={`Percentual da faixa ${faixa.nome}`}
          />
        </Campo>
      </div>

      <p className="mt-2 text-sm text-fumaca">{explicar(rascunho)}</p>

      {sujo && (
        <button type="button" className="botao botao-brasa mt-3 w-full" onClick={() => aoSalvar(rascunho)}>
          Salvar alteração
        </button>
      )}
    </div>
  );
}

/** A frase que o cliente vai ouvir, montada a partir dos números. */
function explicar(f: FaixaEtaria) {
  const idade =
    f.idadeMax === null
      ? `De ${inteiro(f.idadeMin)} anos para cima`
      : `De ${inteiro(f.idadeMin)} a ${inteiro(f.idadeMax)} anos`;

  if (f.percentual <= 0) return `${idade}: não paga e quase não pesa na compra.`;
  if (f.percentual >= 100) return `${idade}: paga e come como adulto.`;
  return `${idade}: paga ${inteiro(f.percentual)}% do adulto, e come perto disso.`;
}

/** Idades que nenhuma faixa cobre, entre zero e a última. */
function acharBuracos(ordenadas: FaixaEtaria[]) {
  const buracos: string[] = [];
  if (!ordenadas.length) return buracos;

  if (ordenadas[0].idadeMin > 0) {
    buracos.push(ordenadas[0].idadeMin === 1 ? '0 ano' : `0 a ${ordenadas[0].idadeMin - 1} anos`);
  }

  for (let i = 0; i < ordenadas.length - 1; i++) {
    const fim = ordenadas[i].idadeMax;
    if (fim === null) break;
    const proximo = ordenadas[i + 1].idadeMin;
    if (proximo > fim + 1) {
      buracos.push(fim + 1 === proximo - 1 ? `${fim + 1} anos` : `${fim + 1} a ${proximo - 1} anos`);
    }
  }

  return buracos;
}
