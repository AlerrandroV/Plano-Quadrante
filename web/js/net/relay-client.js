// Conexão WebSocket com o servidor da sala (app Android ou dev-server).
//
// O servidor é só um "carteiro": quem manda no jogo é o host.
//
// Protocolo (JSON):
//   host  -> servidor: {t:'send', to:id, data} | {t:'broadcast', data}
//   servidor -> host:  {t:'clients', list:[{id,name}]} (ao conectar)
//                      {t:'join', id, name} | {t:'leave', id}
//                      {t:'msg', id, data}
//   jogador -> servidor: qualquer objeto JSON (repassado ao host como 'msg')
//   servidor -> jogador: o `data` enviado pelo host, ou
//                        {type:'_host-offline'} se o host caiu.

export function connectRelay({ role, id, name, onMessage, onStatus }) {
  let ws = null;
  let closedByUs = false;
  let retry = 0;
  let timer = null;
  const queue = [];

  function url() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const q = new URLSearchParams({ role });
    if (id) q.set('id', id);
    if (name) q.set('name', name);
    // Caminho relativo à página (funciona mesmo servido numa subpasta).
    const base = location.pathname.replace(/[^/]*$/, '');
    return `${proto}//${location.host}${base}ws?${q}`;
  }

  function open() {
    onStatus?.('connecting');
    ws = new WebSocket(url());
    ws.onopen = () => {
      retry = 0;
      onStatus?.('open');
      while (queue.length) ws.send(queue.shift());
    };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      onMessage(msg);
    };
    ws.onclose = () => {
      if (closedByUs) return;
      onStatus?.('reconnecting');
      // Celular bloqueou a tela, Wi-Fi oscilou... tenta de novo.
      const delay = Math.min(5000, 500 * 2 ** retry++);
      timer = setTimeout(open, delay);
    };
    ws.onerror = () => { /* onclose cuida da reconexão */ };
  }

  open();

  return {
    send(obj) {
      const text = JSON.stringify(obj);
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(text);
      else queue.push(text);
    },
    close() {
      closedByUs = true;
      clearTimeout(timer);
      ws?.close();
    },
  };
}
