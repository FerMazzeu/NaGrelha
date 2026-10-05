/**
 * O texto de um erro, venha de onde vier.
 *
 * O app inteiro fazia `e instanceof Error ? e.message : String(e)`. Só que o
 * erro do Supabase chega no navegador como objeto comum, `{ code, message,
 * details, hint }`, e não como `Error`. Então toda gravação que falhava
 * mostrava "[object Object]" na tela — inclusive o "muitos pedidos, tenta
 * daqui a pouco" do link do cliente, que virava "confere a internet".
 */
export function mensagemDe(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
