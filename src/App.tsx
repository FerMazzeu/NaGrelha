import { useEffect, useState } from 'react';
import Cabecalho from './componentes/Cabecalho';
import Cardapio from './componentes/Cardapio';
import Contato from './componentes/Contato';
import Equipe from './componentes/Equipe';
import Extras from './componentes/Extras';
import Galeria from './componentes/Galeria';
import Hero from './componentes/Hero';
import Origem from './componentes/Origem';
import Promessa from './componentes/Promessa';
import { Zap } from './componentes/Icones';
import { contato, linkWhatsApp, mensagemPadrao } from './conteudo';

/**
 * Botão flutuante de WhatsApp.
 *
 * Só aparece depois que a pessoa passa do topo: enquanto o hero está na tela o
 * botão principal já está visível ali, e dois convites iguais ao mesmo tempo
 * competem entre si em vez de somar.
 */
function BotaoFlutuante() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const aoRolar = () => setVisivel(window.scrollY > window.innerHeight * 0.9);
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

  return (
    <a
      href={linkWhatsApp(contato.erica.telefone, mensagemPadrao)}
      target="_blank"
      rel="noopener noreferrer"
      aria-hidden={!visivel}
      tabIndex={visivel ? 0 : -1}
      className={`botao botao-brasa fixed bottom-5 right-5 z-40 !px-5 shadow-2xl transition-all duration-300 ${
        visivel ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      }`}
    >
      <Zap className="h-5 w-5" />
      <span className="hidden sm:inline">Pedir orçamento</span>
      <span className="sm:hidden">Orçamento</span>
    </a>
  );
}

export default function App() {
  return (
    <>
      <Cabecalho />
      <main>
        <Hero />
        <Origem />
        <Promessa />
        <Equipe />
        <Cardapio />
        <Extras />
        <Galeria />
        <Contato />
      </main>
      <BotaoFlutuante />
    </>
  );
}
