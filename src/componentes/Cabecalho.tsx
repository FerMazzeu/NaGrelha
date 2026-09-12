import { useEffect, useState } from 'react';
import { contato, linkWhatsApp, mensagemPadrao, navegacao } from '../conteudo';
import { logoEscura } from '../fotos';
import { Fechar, Menu, Zap } from './Icones';

export default function Cabecalho() {
  const [rolou, setRolou] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 24);
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

  // menu aberto no celular não pode deixar a página rolar por baixo
  useEffect(() => {
    document.body.style.overflow = aberto ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [aberto]);

  const orcamento = linkWhatsApp(contato.erica.telefone, mensagemPadrao);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        rolou || aberto ? 'border-b border-borda bg-carvao/95 backdrop-blur' : 'border-b border-transparent'
      }`}
    >
      <div className="area flex h-20 items-center justify-between gap-4">
        <a href="#topo" className="flex shrink-0 items-center" aria-label="Na Grelha com Alan Xavier, ir para o topo">
          <img src={logoEscura} alt="Na Grelha com Alan Xavier" width={160} height={112} className="h-11 w-auto md:h-12" />
        </a>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Seções do site">
          {navegacao.map((item) => (
            <a
              key={item.alvo}
              href={`#${item.alvo}`}
              className="text-sm font-medium text-fumaca transition-colors hover:text-creme"
            >
              {item.rotulo}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={orcamento}
            target="_blank"
            rel="noopener noreferrer"
            className="botao botao-brasa hidden !min-h-11 !px-5 text-sm sm:inline-flex"
          >
            <Zap className="h-4 w-4" />
            Pedir orçamento
          </a>

          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="botao botao-fantasma !min-h-11 !w-11 !px-0 lg:hidden"
            aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={aberto}
          >
            {aberto ? <Fechar className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {aberto && (
        <div className="border-t border-borda bg-carvao lg:hidden">
          <nav className="area flex flex-col py-4" aria-label="Seções do site">
            {navegacao.map((item) => (
              <a
                key={item.alvo}
                href={`#${item.alvo}`}
                onClick={() => setAberto(false)}
                className="border-b border-borda/60 py-4 font-display text-xl uppercase tracking-wide text-creme last:border-b-0"
              >
                {item.rotulo}
              </a>
            ))}
            <a
              href={orcamento}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setAberto(false)}
              className="botao botao-brasa mt-5"
            >
              <Zap className="h-5 w-5" />
              Pedir orçamento no WhatsApp
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
