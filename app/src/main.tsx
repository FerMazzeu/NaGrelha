import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

/*
  Duas portas no mesmo endereço.

  `/?pedido` é a página que o cliente abre pelo link do WhatsApp: sem login,
  sem menu, só o formulário e o cardápio. Todo o resto é o app da equipe.

  As duas entram por `lazy` para o cliente não baixar o app inteiro (assistente,
  editor, Excel) só para marcar picanha e maionese num celular com 4G fraco.

  Parâmetro, e não caminho tipo `/pedido`: a Vercel não manda caminho
  desconhecido para o index.html sem configuração, e um link quebrado no
  WhatsApp do cliente é o pior lugar para descobrir isso.
*/
const ehPedidoDoCliente = new URLSearchParams(window.location.search).has('pedido');

const Raiz = ehPedidoDoCliente ? lazy(() => import('./pedido/PedidoDoCliente')) : lazy(() => import('./App'));

const raiz = document.getElementById('root');
if (!raiz) throw new Error('elemento #root nao encontrado');

createRoot(raiz).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Raiz />
    </Suspense>
  </StrictMode>,
);
