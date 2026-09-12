import { aviso, origem } from '../conteudo';
import { Foto, Moldura, Revelar, Selo, TituloSecao } from './Base';

export default function Origem() {
  return (
    <>
      <section id="origem" className="secao">
        <div className="area grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Revelar>
            <Selo>{origem.selo}</Selo>
            <TituloSecao texto={origem.titulo} className="mt-4" />
            <div className="mt-7 space-y-5">
              {origem.paragrafos.map((p) => (
                <p key={p.slice(0, 24)} className="corpo">
                  {p}
                </p>
              ))}
            </div>
          </Revelar>

          <Revelar atraso={120}>
            <figure>
              <Moldura proporcao="16 / 10">
                <Foto nome="equipe" alt="Equipe do Na Grelha reunida em um evento" />
              </Moldura>
              <figcaption className="mt-3 text-center text-sm text-fumaca">{origem.legendaFoto}</figcaption>
            </figure>
          </Revelar>
        </div>
      </section>

      {/* Faixa de fogo: separa a história do que a empresa entrega hoje. */}
      <section className="relative isolate overflow-hidden">
        <Foto
          nome="faixa-fogo"
          alt="Cortes assando sobre a brasa"
          className="absolute inset-0 -z-20"
        />
        <div className="absolute inset-0 -z-10 bg-carvao/82" />
        <div className="area py-20 text-center md:py-28">
          {/*
            O destaque fica no display, em caixa alta. A frase que explica volta
            para a fonte de texto: um parágrafo inteiro em Anton maiúsculo vira
            um bloco que ninguém lê.
          */}
          <Revelar>
            <p className="titulo mx-auto max-w-3xl text-[clamp(1.6rem,4.4vw,2.8rem)] text-brasa-clara">
              {aviso.destaque}
            </p>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-creme/90 md:text-xl">{aviso.texto}</p>
          </Revelar>
        </div>
      </section>
    </>
  );
}
