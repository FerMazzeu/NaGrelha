import { useEffect, useMemo, useState } from 'react';
import { Campo, CampoNumero, CampoTexto, Segmentado } from '../componentes/Campos';
import { lerCardapioPublico, lerFaixasPublicas, enviarPedido, type FaixaPublica } from '../dados/pedidos';
import { montarCardapio, type SecaoDoCardapio } from '../dominio/cardapio-do-cliente';
import type { TipoDeEvento } from '../dominio/tipos';
import { inteiro } from '../formato';
import { mensagemDe } from '../erro';

/**
 * A página que o cliente abre pelo link.
 *
 * Hoje ele espera de dois a três dias por um orçamento: alguém precisa ligar,
 * perguntar tudo, e sentar no Excel. Aqui ele mesmo diz quem é, onde e quando
 * é a festa, quantos vêm, e marca os pratos. O que ele manda vira um
 * orçamento em rascunho no app, e a equipe só confere e fecha o preço.
 *
 * Três decisões que valem lembrar:
 *
 * - NADA DE PREÇO. Nem estimativa. O preço depende de coisa que o cliente não
 *   vê (cachê da equipe, frete, imposto) e quem fecha é o Alan. Foi a primeira
 *   coisa que ele perguntou na ligação.
 * - PRATO, NÃO INGREDIENTE. O catálogo é uma lista de compra; aqui ele é
 *   dobrado de volta em pratos (ver `montarCardapio`).
 * - CELULAR PRIMEIRO. O link vai pelo WhatsApp, e quase todo mundo abre ali.
 */

type Etapa = 'carregando' | 'indisponivel' | 'preenchendo' | 'enviando' | 'enviado';

const hoje = () => new Date().toISOString().slice(0, 10);

export default function PedidoDoCliente() {
  const [etapa, setEtapa] = useState<Etapa>('carregando');
  const [secoes, setSecoes] = useState<SecaoDoCardapio[]>([]);
  const [faixas, setFaixas] = useState<FaixaPublica[]>([]);
  const [erroDeEnvio, setErroDeEnvio] = useState('');
  const [tentou, setTentou] = useState(false);

  const [cliente, setCliente] = useState('');
  const [contato, setContato] = useState('');
  const [tipoEvento, setTipoEvento] = useState<TipoDeEvento>('aniversario');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [local, setLocal] = useState('');
  const [adultos, setAdultos] = useState(0);
  const [criancas, setCriancas] = useState<Record<string, number>>({});
  const [observacoes, setObservacoes] = useState('');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([lerCardapioPublico(), lerFaixasPublicas()])
      .then(([itens, fx]) => {
        setSecoes(montarCardapio(itens));
        setFaixas(fx);
        setEtapa('preenchendo');
      })
      .catch((e) => {
        console.warn('cardápio indisponível', e);
        setEtapa('indisponivel');
      });
  }, []);

  const pratos = useMemo(() => secoes.flatMap((s) => s.pratos), [secoes]);

  const faltas = [
    cliente.trim().length < 2 && 'seu nome',
    contato.replace(/\D/g, '').length < 10 && 'um WhatsApp com DDD',
    !data && 'a data da festa',
    !local.trim() && 'o local',
    adultos < 1 && 'quantos adultos',
    marcados.size === 0 && 'pelo menos um prato',
  ].filter(Boolean) as string[];

  const alternar = (chave: string) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });

  const enviar = async () => {
    setTentou(true);
    setErroDeEnvio('');
    if (faltas.length) {
      document.getElementById('faltas')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setEtapa('enviando');
    try {
      await enviarPedido({
        cliente,
        contato,
        tipoEvento,
        data,
        hora,
        local,
        adultos,
        criancas: Object.entries(criancas).map(([faixaId, quantidade]) => ({ faixaId, quantidade })),
        observacoes,
        itens: pratos.filter((p) => marcados.has(p.chave)).flatMap((p) => p.ids),
      });
      setEtapa('enviado');
      window.scrollTo({ top: 0 });
    } catch (e) {
      const msg = mensagemDe(e);
      setErroDeEnvio(
        /muitos pedidos/i.test(msg)
          ? 'Recebemos muitos pedidos agora há pouco. Tenta de novo em alguns minutos, por favor.'
          : 'Não consegui enviar. Confere a internet e tenta de novo — o que você preencheu continua aqui.',
      );
      setEtapa('preenchendo');
    }
  };

  // ------------------------------------------------------------ cabeçalho --
  const topo = (
    <header className="area flex flex-col items-center pt-8 text-center">
      <img src="/logo-escuro.png" alt="Na Grelha com Alan Xavier" className="h-20 w-auto" />
      <h1 className="titulo mt-5 text-2xl text-dourado">Monte o cardápio da sua festa</h1>
    </header>
  );

  if (etapa === 'carregando') {
    return (
      <div className="min-h-[100svh]">
        {topo}
        <p className="area mt-8 text-center text-sm text-fumaca">Carregando o cardápio...</p>
      </div>
    );
  }

  if (etapa === 'indisponivel') {
    return (
      <div className="min-h-[100svh]">
        {topo}
        <div className="area mt-8">
          <div className="cartao p-5 text-center">
            <p className="font-semibold">O cardápio não abriu agora.</p>
            <p className="mt-2 text-sm text-fumaca">
              Tenta de novo daqui a pouco, ou chama a gente no WhatsApp que montamos com você.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (etapa === 'enviado') {
    return (
      <div className="min-h-[100svh]">
        {topo}
        <div className="area mt-8 max-w-xl">
          <div className="cartao border-verde/50 p-6 text-center">
            <p className="titulo text-xl text-verde">Pedido recebido</p>
            <p className="mt-3 text-sm text-fumaca">
              Obrigado, {cliente.trim().split(' ')[0]}! A gente vai conferir o cardápio e te mandar o orçamento
              pelo WhatsApp {contato}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] pb-32">
      {topo}
      <p className="area mx-auto mt-2 max-w-xl text-center text-sm text-fumaca">
        Conta pra gente sobre o evento e marque o que você quer servir. Não é compromisso: a gente confere e te
        manda o orçamento pelo WhatsApp.
      </p>

      <div className="area mt-8 max-w-2xl space-y-8">
        {/* ------------------------------------------------------- a festa */}
        <section className="cartao space-y-4 p-5">
          <h2 className="titulo text-lg text-dourado">Sobre a festa</h2>

          <Campo rotulo="Seu nome">
            <CampoTexto valor={cliente} aoMudar={setCliente} autoComplete="name" placeholder="Nome e sobrenome" />
          </Campo>

          <Campo rotulo="WhatsApp" dica="É por onde vamos te mandar o orçamento.">
            <CampoTexto
              valor={contato}
              aoMudar={setContato}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(35) 99999-0000"
            />
          </Campo>

          <Campo rotulo="Tipo de festa">
            <Segmentado<TipoDeEvento>
              valor={tipoEvento}
              aoMudar={setTipoEvento}
              opcoes={[
                { valor: 'aniversario', rotulo: 'Aniversário e outras' },
                { valor: 'casamento', rotulo: 'Casamento ou 15 anos' },
              ]}
            />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Data">
              <input
                type="date"
                className="campo"
                value={data}
                min={hoje()}
                onChange={(e) => setData(e.target.value)}
              />
            </Campo>
            <Campo rotulo="Horário">
              <input type="time" className="campo" value={hora} onChange={(e) => setHora(e.target.value)} />
            </Campo>
          </div>

          <Campo rotulo="Local da festa" dica="Cidade e, se já souber, o salão ou a chácara.">
            <CampoTexto valor={local} aoMudar={setLocal} placeholder="Chácara Recanto, Varginha" />
          </Campo>
        </section>

        {/* ---------------------------------------------------- convidados */}
        <section className="cartao space-y-4 p-5">
          <h2 className="titulo text-lg text-dourado">Convidados</h2>

          <Campo rotulo="Adultos">
            <CampoNumero valor={adultos} aoMudar={(v) => setAdultos(Math.round(v))} sufixo="pessoas" />
          </Campo>

          {faixas.length > 0 && (
            <div>
              <p className="rotulo mb-1.5">Crianças</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {faixas.map((f) => (
                  <label key={f.id} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 text-sm">{f.nome}</span>
                    <span className="w-28 shrink-0">
                      <CampoNumero
                        valor={criancas[f.id] ?? 0}
                        aoMudar={(v) => setCriancas((c) => ({ ...c, [f.id]: Math.round(v) }))}
                        aria-label={`Crianças de ${f.nome}`}
                      />
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ------------------------------------------------------ cardápio */}
        {secoes.map((secao) => {
          const marcadosAqui = secao.pratos.filter((p) => marcados.has(p.chave)).length;
          return (
            <section key={secao.titulo}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="titulo text-lg text-dourado">{secao.titulo}</h2>
                <span className="shrink-0 text-xs text-fumaca">
                  {marcadosAqui > 0 ? `${inteiro(marcadosAqui)} marcado${marcadosAqui > 1 ? 's' : ''}` : secao.dica}
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {secao.pratos.map((p) => {
                  const marcado = marcados.has(p.chave);
                  return (
                    <label
                      key={p.chave}
                      className={`cartao flex cursor-pointer items-center gap-3 p-3.5 transition-colors ${
                        marcado ? 'border-dourado/70 bg-dourado/10' : 'hover:border-dourado/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternar(p.chave)}
                        className="h-5 w-5 shrink-0 accent-[#e3a53f]"
                      />
                      <span className={`min-w-0 flex-1 ${marcado ? 'font-semibold text-creme' : ''}`}>{p.nome}</span>
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* -------------------------------------------------------- recado */}
        <section className="cartao p-5">
          <Campo rotulo="Quer contar mais alguma coisa?" dica="Restrição alimentar, tema da festa, horário de montagem...">
            <textarea
              className="campo rolagem-discreta min-h-24 resize-y"
              value={observacoes}
              maxLength={2000}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </Campo>
        </section>

        {tentou && faltas.length > 0 && (
          <p id="faltas" className="rounded-xl border border-dourado/50 bg-dourado/10 p-3 text-sm text-dourado">
            Falta preencher {faltas.join(', ').replace(/, ([^,]*)$/, ' e $1')}.
          </p>
        )}
        {erroDeEnvio && (
          <p className="rounded-xl border border-brasa/50 bg-brasa/10 p-3 text-sm text-brasa-clara">{erroDeEnvio}</p>
        )}
      </div>

      {/* Enviar fica sempre à mão: o cardápio é longo, e procurar o botão no
          fim da página depois de marcar tudo é onde a pessoa desiste. */}
      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-carvao/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="area flex max-w-2xl items-center justify-between gap-4 py-3">
          <p className="text-sm text-fumaca">
            {marcados.size === 0
              ? 'Nenhum prato marcado'
              : `${inteiro(marcados.size)} ${marcados.size === 1 ? 'prato marcado' : 'pratos marcados'}`}
          </p>
          <button type="button" className="botao botao-brasa" disabled={etapa === 'enviando'} onClick={enviar}>
            {etapa === 'enviando' ? 'Enviando...' : 'Enviar pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}
