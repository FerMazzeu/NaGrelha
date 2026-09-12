import { contato, hero, linkWhatsApp, mensagemPadrao, numeros } from '../conteudo';
import { dimensao, foto } from '../fotos';
import { Instagram, Seta, Zap } from './Icones';

export default function Hero() {
  return (
    <section id="topo" className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden">
      {/*
        A foto do topo é o LCP da página. Ela vem recortada do build no
        enquadramento final, carrega eager e com prioridade alta, e não usa
        lazy: o navegador precisa começar a baixar no primeiro instante.
      */}
      <img
        src={foto('hero')}
        alt="Cortes de carne assando na estação de fogo de chão do Na Grelha"
        width={dimensao('hero').largura}
        height={dimensao('hero').altura}
        loading="eager"
        decoding="sync"
        fetchPriority="high"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
      />
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(to bottom, rgb(18 16 14 / 0.82) 0%, rgb(18 16 14 / 0.55) 32%, rgb(18 16 14 / 0.78) 68%, #12100e 100%)',
        }}
      />

      <div className="area pb-12 pt-32 md:pb-16">
        <div className="max-w-3xl">
          <span className="selo selo-risco">{hero.selo}</span>

          <h1 className="titulo mt-5 text-[clamp(2.6rem,9vw,5.5rem)]">
            <span className="block">{hero.titulo[0]}</span>
            <span className="block text-dourado">{hero.titulo[1]}</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-creme/85 md:text-xl">{hero.texto}</p>

          {/*
            Dois botões, não três.
            O do Instagram disputava atenção com o de orçamento sem levar
            ninguém a lugar nenhum, então virou um link discreto ali embaixo.
          */}
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href={linkWhatsApp(contato.erica.telefone, mensagemPadrao)}
              target="_blank"
              rel="noopener noreferrer"
              className="botao botao-brasa"
            >
              <Zap className="h-5 w-5" />
              {hero.acaoPrimaria}
            </a>
            <a href="#cardapio" className="botao botao-fantasma">
              {hero.acaoSecundaria}
              <Seta className="h-4 w-4" />
            </a>
          </div>

          <div className="mt-8 flex flex-col gap-3 text-sm text-fumaca sm:flex-row sm:items-center sm:gap-6">
            <p>{hero.rodape}</p>
            <a
              href={contato.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 transition-colors hover:text-creme"
            >
              <Instagram className="h-4 w-4" />@{contato.instagram}
            </a>
          </div>
        </div>
      </div>

      {/* Os números fecham o topo: prova rápida antes de qualquer rolagem longa. */}
      <div className="border-t border-borda/70 bg-carvao/70 backdrop-blur-sm">
        <div className="area grid grid-cols-2 gap-x-6 gap-y-8 py-8 lg:grid-cols-4">
          {numeros.map((n) => (
            <div key={n.rotulo}>
              <p className="titulo text-3xl text-dourado md:text-4xl">{n.valor}</p>
              <p className="mt-1.5 text-sm font-semibold text-creme">{n.rotulo}</p>
              <p className="mt-1 text-xs leading-relaxed text-fumaca">{n.nota}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
