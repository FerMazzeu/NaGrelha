import { useEffect, useMemo, useState } from 'react';
import {
  blocosDoContrato,
  cpfFormatado,
  faltaNoContratante,
  moeda,
  dataBr,
  TITULO_DO_CONTRATO,
  type ConteudoDoContrato,
  type Contratante,
} from '../../supabase/functions/_shared/contrato';
import { funcao, SUPABASE_PUBLISHABLE_KEY } from '../integrations/supabase/client';
import { baixar } from '../pdf-da-proposta';
import { pdfDoContrato } from '../pdf-do-contrato';

/*
  A página que o cliente abre pelo link do contrato: /?contrato=<token>.

  Sem login e sem o app: só o contrato, os campos que ele preenche e a
  assinatura por código no e-mail. Fala apenas com a edge function
  `contrato`, que acha o contrato pelo token e mais nada.

  Fundo claro, como papel: é documento para ler com calma, no celular, e
  muita gente imprime.
*/

type Aberto = {
  situacao: 'enviado' | 'assinado';
  conteudo: ConteudoDoContrato;
  contratante: Partial<Contratante> | null;
  assinadoEm: string | null;
  hash: string | null;
  enviadoEm: string;
  assinatura: { email: string; ip: string; dispositivo?: string } | null;
};

const token = new URLSearchParams(window.location.search).get('contrato') ?? '';

async function chamar<T>(corpo: Record<string, unknown>): Promise<T> {
  const r = await fetch(funcao('contrato'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY },
    body: JSON.stringify({ token, ...corpo }),
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(dados?.message ?? 'Não consegui falar com o servidor. Confira a internet e tente de novo.');
  return dados as T;
}

const vazio: Contratante = { nome: '', cpf: '', endereco: '', email: '', telefone: '' };

/** 52998224725 → 529.982.247-25 enquanto digita. */
function mascaraCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

export default function ContratoDoCliente() {
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const [erro, setErro] = useState('');
  const [quem, setQuem] = useState<Contratante>(vazio);
  const [concordo, setConcordo] = useState(false);
  const [etapa, setEtapa] = useState<'preencher' | 'codigo'>('preencher');
  const [emailMascarado, setEmailMascarado] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [tentouSemDados, setTentouSemDados] = useState(false);

  useEffect(() => {
    document.title = 'Contrato | Na Grelha com Alan Xavier';
    chamar<Aberto>({ acao: 'abrir' })
      .then((a) => {
        setAberto(a);
        setQuem({ ...vazio, ...(a.contratante ?? {}) });
      })
      .catch((e) => setErro(e instanceof Error ? e.message : String(e)));
  }, []);

  const blocos = useMemo(() => (aberto ? blocosDoContrato(aberto.conteudo, quem) : []), [aberto, quem]);
  const falta = faltaNoContratante(quem);

  const pedirCodigo = async () => {
    setTentouSemDados(true);
    setAviso('');
    if (falta.length || !concordo) return;
    setEnviando(true);
    try {
      const r = await chamar<{ email: string }>({ acao: 'pedir-codigo', contratante: quem });
      setEmailMascarado(r.email);
      setEtapa('codigo');
      setCodigo('');
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  };

  const assinar = async () => {
    setAviso('');
    setEnviando(true);
    try {
      const r = await chamar<{ assinadoEm: string; hash: string }>({ acao: 'assinar', codigo });
      setAberto((a) =>
        a
          ? {
              ...a,
              situacao: 'assinado',
              assinadoEm: r.assinadoEm,
              hash: r.hash,
              contratante: quem,
              assinatura: { email: quem.email.trim().toLowerCase(), ip: '' },
            }
          : a,
      );
      // Busca de novo para o comprovante vir com o IP e o aparelho registrados.
      chamar<Aberto>({ acao: 'abrir' }).then(setAberto).catch(() => undefined);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  };

  const baixarPdf = async () => {
    if (!aberto) return;
    const assinado = aberto.situacao === 'assinado' && aberto.assinadoEm && aberto.hash;
    const arquivo = await pdfDoContrato(
      aberto.conteudo,
      { ...vazio, ...(aberto.contratante ?? quem) },
      assinado
        ? {
            assinadoEm: aberto.assinadoEm!,
            hash: aberto.hash!,
            email: aberto.assinatura?.email ?? '',
            ip: aberto.assinatura?.ip ?? '',
            dispositivo: aberto.assinatura?.dispositivo,
            enviadoEm: aberto.enviadoEm,
          }
        : null,
    );
    baixar(arquivo);
  };

  if (erro) {
    return (
      <Pagina>
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-semibold">{erro}</p>
          <p className="mt-2 text-sm text-[#7a6e62]">Se precisar, fale com o buffet pelo WhatsApp.</p>
        </div>
      </Pagina>
    );
  }
  if (!aberto) {
    return (
      <Pagina>
        <p className="text-center text-sm text-[#7a6e62]">Abrindo o contrato...</p>
      </Pagina>
    );
  }

  const assinado = aberto.situacao === 'assinado';
  const ev = aberto.conteudo.evento;
  const travado = etapa === 'codigo' || assinado;

  return (
    <Pagina>
      {/* Resumo: o cliente confere o principal antes de ler as cláusulas. */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-xs font-bold tracking-[0.2em] text-[#c4261d]">CONTRATO DO SEU EVENTO</p>
        <h1 className="mt-2 text-xl font-bold leading-tight">
          {ev.descricao}
          {ev.data ? ` em ${dataBr(ev.data)}` : ''}
        </h1>
        <p className="mt-1 text-sm text-[#52514e]">
          {[ev.hora && `às ${ev.hora}`, ev.local, `${ev.adultos + ev.criancas} convidados`].filter(Boolean).join(' · ')}
        </p>
        <p className="mt-3 text-2xl font-bold">{moeda(aberto.conteudo.valorTotal)}</p>
        {assinado && (
          <p className="mt-3 rounded-xl bg-[#e8f5ec] p-3 text-sm font-semibold text-[#1d6b3d]">
            ✓ Assinado em{' '}
            {new Date(aberto.assinadoEm!).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}
          </p>
        )}
      </div>

      {!assinado && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-bold">Seus dados</h2>
          <p className="mt-1 text-sm text-[#52514e]">Eles entram no contrato logo abaixo, enquanto você digita.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Nome completo" erro={tentouSemDados && falta.includes('nome completo')}>
              <input className={entrada} value={quem.nome} disabled={travado} autoComplete="name" onChange={(e) => setQuem({ ...quem, nome: e.target.value })} />
            </Campo>
            <Campo rotulo="CPF" erro={tentouSemDados && falta.includes('CPF válido')}>
              <input
                className={entrada}
                value={mascaraCpf(quem.cpf)}
                disabled={travado}
                inputMode="numeric"
                onChange={(e) => setQuem({ ...quem, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) })}
              />
            </Campo>
            <div className="sm:col-span-2">
              <Campo rotulo="Endereço completo (rua, número, bairro, cidade)" erro={tentouSemDados && falta.includes('endereço completo')}>
                <input className={entrada} value={quem.endereco} disabled={travado} autoComplete="street-address" onChange={(e) => setQuem({ ...quem, endereco: e.target.value })} />
              </Campo>
            </div>
            <Campo rotulo="E-mail (o código de assinatura vai para ele)" erro={tentouSemDados && falta.includes('e-mail válido')}>
              <input className={entrada} value={quem.email} disabled={travado} type="email" inputMode="email" autoComplete="email" onChange={(e) => setQuem({ ...quem, email: e.target.value })} />
            </Campo>
            <Campo rotulo="Telefone (opcional)">
              <input className={entrada} value={quem.telefone} disabled={travado} inputMode="tel" autoComplete="tel" onChange={(e) => setQuem({ ...quem, telefone: e.target.value })} />
            </Campo>
          </div>
        </div>
      )}

      {/* O contrato. */}
      <article className="rounded-2xl bg-white p-5 text-[0.92rem] leading-relaxed shadow-sm sm:p-8">
        <h2 className="text-center text-base font-bold">{TITULO_DO_CONTRATO}</h2>
        {blocos.map((b, i) => (
          <section key={i} className="mt-5">
            {b.titulo && <h3 className="mb-1.5 text-sm font-bold">{b.titulo}</h3>}
            {b.paragrafos.map((p, j) => (
              <p key={j} className="mt-1.5 text-justify">
                {p}
              </p>
            ))}
            {b.lista && (
              <ul className={`mt-1.5 space-y-1 pl-5 ${b.titulo?.includes('PREÇO') ? 'list-decimal' : 'list-disc'}`}>
                {b.lista.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <section className="mt-8 border-t border-[#e5ddd2] pt-4 text-sm text-[#52514e]">
          <p>
            <strong className="text-[#1a1512]">CONTRATANTE:</strong> {quem.nome.trim().toUpperCase() || '________________'}
            {quem.cpf && ` · CPF ${cpfFormatado(quem.cpf)}`}
          </p>
          <p className="mt-1">
            <strong className="text-[#1a1512]">CONTRATADA:</strong> {aberto.conteudo.contratada.nome}, representada por{' '}
            {aberto.conteudo.representante}
          </p>
          {assinado && aberto.hash && (
            <p className="mt-3 break-all font-mono text-xs">Código de verificação (SHA-256): {aberto.hash}</p>
          )}
        </section>
      </article>

      {/* Assinatura. Fica embaixo do texto: assina quem rolou até aqui. */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        {assinado ? (
          <>
            <h2 className="font-bold">Contrato assinado</h2>
            <p className="mt-1 text-sm text-[#52514e]">
              Uma cópia do comprovante foi para {aberto.assinatura?.email}. Baixe o PDF para guardar.
            </p>
            <button type="button" className={botao} onClick={() => void baixarPdf()}>
              Baixar o contrato assinado (PDF)
            </button>
          </>
        ) : etapa === 'preencher' ? (
          <>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#c4261d]" checked={concordo} onChange={(e) => setConcordo(e.target.checked)} />
              <span>Li o contrato inteiro e concordo com todas as cláusulas.</span>
            </label>
            {tentouSemDados && (falta.length > 0 || !concordo) && (
              <p className="mt-3 text-sm font-semibold text-[#c4261d]">
                {falta.length ? `Falta preencher: ${falta.join(', ')}.` : 'Marque que leu e concorda para continuar.'}
              </p>
            )}
            <button type="button" className={botao} disabled={enviando} onClick={() => void pedirCodigo()}>
              {enviando ? 'Enviando o código...' : 'Receber o código de assinatura por e-mail'}
            </button>
            <button type="button" className="mt-3 w-full text-sm text-[#7a6e62] underline" onClick={() => void baixarPdf()}>
              Baixar uma cópia para ler depois (PDF)
            </button>
          </>
        ) : (
          <>
            <h2 className="font-bold">Digite o código</h2>
            <p className="mt-1 text-sm text-[#52514e]">
              Mandamos 6 números para <strong>{emailMascarado}</strong>. Pode levar um minuto; confira também o spam. O código vale por
              10 minutos.
            </p>
            <input
              className={`${entrada} mt-4 text-center font-mono text-2xl tracking-[0.5em]`}
              value={codigo}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              aria-label="Código de 6 dígitos"
            />
            <button type="button" className={botao} disabled={enviando || codigo.length !== 6} onClick={() => void assinar()}>
              {enviando ? 'Assinando...' : 'Assinar o contrato'}
            </button>
            <div className="mt-3 flex justify-between text-sm text-[#7a6e62]">
              <button type="button" className="underline" onClick={() => setEtapa('preencher')}>
                Corrigir meus dados
              </button>
              <button type="button" className="underline" disabled={enviando} onClick={() => void pedirCodigo()}>
                Mandar outro código
              </button>
            </div>
          </>
        )}
        {aviso && <p className="mt-3 rounded-xl bg-[#fdecea] p-3 text-sm text-[#a01d16]">{aviso}</p>}
      </div>

      <p className="pb-8 text-center text-xs text-[#7a6e62]">
        Assinatura eletrônica com código por e-mail (MP 2.200-2/2001 e Lei 14.063/2020). Ficam registrados a data, a hora, o IP e o
        aparelho usados.
      </p>
    </Pagina>
  );
}

const entrada =
  'w-full rounded-xl border border-[#d8cec2] bg-[#fdfbf8] px-3 py-3 text-base text-[#1a1512] outline-none focus:border-[#c4261d] disabled:bg-[#f1ece5] disabled:text-[#52514e]';
const botao =
  'mt-4 w-full rounded-xl bg-[#c4261d] px-4 py-3.5 text-base font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50';

function Campo({ rotulo, erro = false, children }: { rotulo: string; erro?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-xs font-semibold ${erro ? 'text-[#c4261d]' : 'text-[#52514e]'}`}>{rotulo}</span>
      {children}
    </label>
  );
}

function Pagina({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100svh] bg-[#f7f2ea] text-[#1a1512]">
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-10 w-10 rounded-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
          <div>
            <p className="font-bold leading-tight">Na Grelha</p>
            <p className="text-xs text-[#7a6e62]">com Alan Xavier</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
