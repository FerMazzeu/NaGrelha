import { contato, contatoSecao, gratidao, linkWhatsApp, rodape } from '../conteudo';
import { logoEscura } from '../fotos';
import { AberturaDeSecao, Citacao, Revelar, Selo } from './Base';
import { Instagram, porNome, Seta, Zap, type NomeDeIcone } from './Icones';

export default function Contato() {
  return (
    <>
      <section id="contato" className="secao brilho-brasa border-t border-borda">
        <div className="area">
          <Revelar>
            <AberturaDeSecao
              selo={contatoSecao.selo}
              titulo={contatoSecao.titulo}
              texto={contatoSecao.texto}
              centrada
            />
          </Revelar>

          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
            {contatoSecao.cartoes.map((cartao, i) => {
              const Icone = porNome[cartao.icone as NomeDeIcone];
              return (
                <Revelar key={cartao.titulo} atraso={i * 120} className="h-full">
                  <article
                    className={`cartao flex h-full flex-col p-8 ${
                      cartao.destaque ? '!border-brasa/45 bg-brasa/6' : ''
                    }`}
                  >
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-full ring-1 ${
                        cartao.destaque
                          ? 'bg-brasa/15 text-brasa-clara ring-brasa/35'
                          : 'bg-dourado/12 text-dourado ring-dourado/30'
                      }`}
                    >
                      <Icone className="h-6 w-6" />
                    </span>

                    <h3 className="titulo mt-6 text-2xl">{cartao.titulo}</h3>
                    <p className="selo mt-2">
                      {cartao.pessoa.nome} · {cartao.pessoa.exibicao}
                    </p>
                    <p className="corpo mt-4 flex-1 text-[0.95rem]">{cartao.texto}</p>
                    <p className="mt-4 text-sm text-fumaca">{cartao.nota}</p>

                    <a
                      href={linkWhatsApp(cartao.pessoa.telefone, cartao.mensagem)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`botao mt-7 w-full ${cartao.destaque ? 'botao-brasa' : 'botao-fantasma'}`}
                    >
                      <Zap className="h-5 w-5" />
                      {cartao.acao}
                    </a>
                  </article>
                </Revelar>
              );
            })}
          </div>

          <Revelar>
            <Citacao texto={contatoSecao.citacao} className="mt-14" />
          </Revelar>
        </div>
      </section>

      <section className="secao border-t border-borda bg-carvao-2">
        <div className="area mx-auto max-w-3xl text-center">
          <Revelar>
            <Selo risco={false}>{gratidao.selo}</Selo>
            <h2 className="titulo-secao mt-4">{gratidao.titulo}</h2>
            <div className="mt-6 space-y-5 text-left sm:text-center">
              {gratidao.paragrafos.map((p) => (
                <p key={p.slice(0, 24)} className="corpo">
                  {p}
                </p>
              ))}
            </div>
          </Revelar>
        </div>
      </section>

      <footer className="border-t border-borda">
        <div className="area flex flex-col items-center gap-8 py-12 text-center md:flex-row md:justify-between md:text-left">
          <div className="flex flex-col items-center gap-4 md:flex-row md:gap-6">
            <img src={logoEscura} alt="" width={160} height={112} className="h-14 w-auto" />
            <div>
              <p className="font-semibold text-creme">{rodape.assinatura}</p>
              <p className="mt-1 text-sm text-fumaca">{rodape.frase}</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <a
              href={contato.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="botao botao-fantasma !min-h-11 text-sm"
            >
              <Instagram className="h-4 w-4" />@{contato.instagram}
            </a>
            <a href="#topo" className="botao botao-fantasma !min-h-11 text-sm">
              Voltar ao topo
              <Seta className="h-4 w-4 -rotate-90" />
            </a>
          </div>
        </div>

        <div className="border-t border-borda/60">
          <div className="area flex flex-col gap-2 py-6 text-center text-xs text-fumaca sm:flex-row sm:justify-between sm:text-left">
            <p>
              Orçamentos com {contato.erica.nome}: {contato.erica.exibicao} · Consultoria com {contato.alan.nome}:{' '}
              {contato.alan.exibicao}
            </p>
            <p>© {new Date().getFullYear()} Na Grelha com Alan Xavier</p>
          </div>
        </div>
      </footer>
    </>
  );
}
