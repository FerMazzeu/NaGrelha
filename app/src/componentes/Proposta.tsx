import { useEffect, useRef, useState } from 'react';
import { montarCardapio } from '../dominio/cardapio-do-cliente';
import { CONTATO_DUVIDAS, condicoesDoEvento } from '../dominio/condicoes';
import type { Orcamento, Resultado } from '../dominio/tipos';
import { dataCurta, inteiro, real } from '../formato';
import { baixar, gerarPdfDaProposta, linkDoWhatsApp, nomeDoPdf, podeCompartilhar } from '../pdf-da-proposta';

/**
 * A proposta que vai para o cliente, feita para virar PDF.
 *
 * Esta tela é o contrário do Excel que o Alan exporta. Lá vai tudo: preço do
 * quilo da picanha, cachê de cada pessoa da equipe, imposto, caixa, lucro. É
 * o arquivo de trabalho dele, e espelha a planilha que ele já usava.
 *
 * Aqui o cliente vê o que está comprando e quanto custa, e mais nada. Ele não
 * vê custo de insumo, não vê quanto a equipe ganha e não vê a margem. Essa
 * separação é a regra do documento, e não um detalhe de layout: foi a
 * primeira coisa que o Alan perguntou duas vezes na mesma conversa.
 *
 * Vira um arquivo PDF de verdade (ver `pdf-da-proposta.ts`), que vai anexado
 * no WhatsApp: o cliente abre, imprime e mostra para quem precisar. Imprimir
 * pelo navegador continua aqui para quem quiser o papel direto.
 */
export default function Proposta({
  orcamento,
  resultado,
  aoFechar,
}: {
  orcamento: Orcamento;
  resultado: Resultado;
  aoFechar: () => void;
}) {
  /*
    Detalhe só onde o cliente escolhe: carne e frios.

    A primeira versão listava tudo que estava marcado, por preparo, e o
    catálogo é uma lista de COMPRA: a maionese aparecia como "batata, alho,
    cenoura". O Alan pediu o detalhamento só dos cortes e dos frios; o resto
    entra pelo nome do prato. É a mesma regra do cardápio que o cliente marca
    pelo link, para a proposta falar a mesma língua do pedido dele.
  */
  const secoes = montarCardapio(
    orcamento.itens
      .filter((i) => orcamento.selecionados.includes(i.id))
      .map((i, ordem) => ({ id: i.id, nome: i.nome, grupo: i.grupo, categoria: i.categoria, ordem })),
  );

  /*
    Só a equipe entra em "o que está incluso".

    Imposto, caixa e taxa também são "serviços" do ponto de vista do cálculo,
    mas listar "Imposto (DAS)" numa proposta é mostrar a contabilidade dele
    para quem está comprando churrasco. Frete e locação ficam porque são coisa
    que o cliente recebe.
  */
  const inclusos = resultado.servicos
    .filter((s) => ['equipe', 'frete', 'locacao'].includes(s.servico.papel))
    .filter((s) => s.servico.quantidade > 0);

  const cobranca = resultado.cobranca.filter((c) => c.quantidade > 0);

  /*
    O PDF é gerado assim que a tela abre, e não no clique.

    O celular só abre o menu de compartilhar logo depois de um toque. Se o
    toque ainda tivesse que esperar o PDF ficar pronto, o iPhone recusava o
    compartilhamento e o botão parecia quebrado. Gerado antes, o toque manda
    na hora. O arquivo é refeito se a tela mudar (ela não muda aqui dentro,
    mas o orçamento pode ter sido salvo de novo antes de abrir).
  */
  const folha = useRef<HTMLElement>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    let vivo = true;
    const el = folha.current;
    if (!el) return;
    setPdf(null);
    setErro('');
    // Espera a logo carregar: sem ela, o PDF sai com um buraco no topo.
    const logo = el.querySelector('img');
    const pronta = logo && !logo.complete ? new Promise((r) => logo.addEventListener('load', r, { once: true })) : null;
    Promise.resolve(pronta)
      .then(() => gerarPdfDaProposta(el, nomeDoPdf(orcamento.cliente, orcamento.data)))
      .then((arquivo) => vivo && setPdf(arquivo))
      .catch((e) => {
        console.warn('pdf da proposta', e);
        if (vivo) setErro('Não consegui gerar o PDF. Use "Imprimir" e escolha Salvar como PDF.');
      });
    return () => {
      vivo = false;
    };
  }, [orcamento, resultado]);

  const recado = `Olá${orcamento.cliente ? `, ${orcamento.cliente.trim().split(' ')[0]}` : ''}! Segue o orçamento da Na Grelha com Alan Xavier.`;

  const enviar = async () => {
    if (!pdf) return;
    setAviso('');
    if (podeCompartilhar(pdf)) {
      try {
        await navigator.share({ files: [pdf], text: recado });
        return;
      } catch (e) {
        // Fechar o menu sem escolher não é erro.
        if ((e as Error).name === 'AbortError') return;
      }
    }
    // Sem menu de compartilhar (o computador, quase sempre): baixa o arquivo
    // e abre a conversa do cliente, e lá é só anexar.
    baixar(pdf);
    setAviso(`O PDF foi baixado (${pdf.name}). Na conversa que abriu, anexe o arquivo pelo clipe.`);
    window.open(linkDoWhatsApp(orcamento.contato, recado), '_blank', 'noopener');
  };

  return (
    <div className="proposta-raiz">
      {/* Barra de controle: existe na tela e some no papel. */}
      <div className="proposta-controles">
        <button type="button" className="botao botao-linha !min-h-10 !px-4 text-sm" onClick={aoFechar}>
          Voltar
        </button>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="botao botao-linha !min-h-10 !px-4 text-sm" onClick={() => window.print()}>
            Imprimir
          </button>
          <button
            type="button"
            className="botao botao-linha !min-h-10 !px-4 text-sm"
            disabled={!pdf}
            onClick={() => pdf && baixar(pdf)}
          >
            Baixar PDF
          </button>
          <button type="button" className="botao botao-brasa !min-h-10 !px-4 text-sm" disabled={!pdf} onClick={enviar}>
            {pdf ? 'Enviar PDF no WhatsApp' : erro ? 'PDF indisponível' : 'Preparando o PDF...'}
          </button>
        </div>
        {(erro || aviso) && <p className="basis-full text-sm text-fumaca">{erro || aviso}</p>}
      </div>

      <article ref={folha} className="proposta">
        <header className="proposta-topo">
          <img src="/logo.png" alt="Na Grelha com Alan Xavier" className="proposta-logo" />
          <div className="proposta-contato">
            <p className="proposta-marca">Na Grelha com Alan Xavier</p>
            <p>Comida boa feita com coração</p>
          </div>
        </header>

        <h1 className="proposta-titulo">Proposta de orçamento</h1>

        <dl className="proposta-dados">
          <Dado rotulo="Cliente" valor={orcamento.cliente} />
          {/* O telefone do cliente mora aqui em cima, junto de quem ele é.
              No rodapé ele parecia ser o telefone da empresa. */}
          <Dado rotulo="Telefone" valor={telefoneLegivel(orcamento.contato)} />
          <Dado
            rotulo="Data"
            valor={
              orcamento.data
                ? `${dataCurta(orcamento.data)}${orcamento.hora ? ` às ${orcamento.hora}` : ''}`
                : ''
            }
          />
          <Dado rotulo="Local" valor={orcamento.local} />
          <Dado rotulo="Duração" valor={`${inteiro(orcamento.duracaoHoras)} horas de serviço`} />
          <Dado rotulo="Convidados" valor={`${inteiro(resultado.convidados)} pessoas`} />
        </dl>

        {/* --------------------------------------------------------- cardápio */}
        <section className="proposta-secao">
          <h2>O que vai ser servido</h2>
          {secoes.length === 0 ? (
            <p className="proposta-vazio">Nenhum item selecionado ainda.</p>
          ) : (
            <div className="proposta-cardapio">
              {secoes.map((secao) => (
                <div key={secao.titulo} className="proposta-grupo">
                  <h3>{secao.titulo}</h3>
                  {/*
                    Só o nome, sem quantidade.

                    "16,7 kg de picanha" convida o cliente a discutir gramatura,
                    que é conta interna do Alan, e muda conforme o apetite e a
                    faixa etária.
                  */}
                  <ul>
                    {secao.pratos.map((p) => (
                      <li key={p.chave}>{p.nome}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------- serviço */}
        {inclusos.length > 0 && (
          <section className="proposta-secao">
            <h2>Serviço incluso</h2>
            <ul className="proposta-inclusos">
              {inclusos.map((s) => (
                <li key={s.servico.id}>
                  {s.servico.quantidade > 1 ? `${inteiro(s.servico.quantidade)}× ` : ''}
                  {s.servico.nome}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ---------------------------------------------------------- valores */}
        <section className="proposta-secao">
          <h2>Valores</h2>
          <table className="proposta-tabela">
            <thead>
              <tr>
                <th>Quem</th>
                <th className="num">Pessoas</th>
                <th className="num">Por pessoa</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {cobranca.map((c) => (
                <tr key={c.rotulo}>
                  <td>{c.rotulo}</td>
                  <td className="num">{inteiro(c.quantidade)}</td>
                  <td className="num">{real(c.unitario)}</td>
                  <td className="num">{real(c.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Valor total</td>
                <td className="num">{real(resultado.preco)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {orcamento.observacoes && (
          <section className="proposta-secao">
            <h2>Observações</h2>
            <p className="proposta-obs">{orcamento.observacoes}</p>
          </section>
        )}

        {/* As mesmas do Excel, que é o que o Alan sempre mandou ao cliente. */}
        <section className="proposta-secao">
          <h2>Observações importantes</h2>
          <ul className="proposta-condicoes">
            {condicoesDoEvento(orcamento.duracaoHoras).map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>

        <footer className="proposta-rodape">
          <p>
            Valores sujeitos a confirmação de data e número de convidados. O número de convidados pode
            ser ajustado até uma semana antes do evento.
          </p>
          <p className="proposta-duvidas">
            Dúvidas? Fale com a {CONTATO_DUVIDAS.nome}: {CONTATO_DUVIDAS.telefone} (WhatsApp)
          </p>
        </footer>
      </article>
    </div>
  );
}

/** "35999990000" → "(35) 99999-0000". O que não parece telefone fica como veio. */
function telefoneLegivel(contato: string) {
  const d = contato.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return contato.trim();
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  if (!valor) return null;
  return (
    <div>
      <dt>{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
  );
}
