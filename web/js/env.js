// Descobre automaticamente onde o jogo está rodando.
//
//  - "local":  site estático (GitHub Pages, arquivo aberto direto, etc.).
//              Só dá para jogar todos na mesma tela.
//  - "host":   dentro do app Android (ou no servidor de desenvolvimento,
//              aberto no próprio PC). Este aparelho cria a sala.
//  - "player": navegador de um amigo que abriu o endereço da sala
//              (ex.: http://192.168.0.12:8080) na mesma rede Wi-Fi.
//
// Como funciona: o servidor da sala (app Android ou server/dev-server.mjs)
// responde em /pq-info.json. Um site estático não tem esse arquivo.
// Se o servidor existe e a página foi aberta pelo próprio aparelho
// (localhost / 127.0.0.1), somos o host; caso contrário, somos jogador.

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export async function detectEnvironment() {
  const params = new URLSearchParams(location.search);
  const forced = params.get('modo');
  const isGithubPages = location.hostname.endsWith('.github.io');

  // No GitHub Pages nunca existe servidor de sala: nem tenta consultar.
  if (isGithubPages || location.protocol === 'file:') {
    return { mode: 'local', isGithubPages, isApp: false, server: null };
  }

  const server = await fetchServerInfo();
  if (!server || forced === 'local') {
    return { mode: 'local', isGithubPages, isApp: false, server };
  }

  const isLoopback = LOOPBACK.has(location.hostname);
  let mode = isLoopback ? 'host' : 'player';
  // Útil para testar no PC: http://localhost:8080/?modo=jogador
  if (forced === 'jogador') mode = 'player';

  return { mode, isGithubPages: false, isApp: !!server.app, server };
}

async function fetchServerInfo() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch('pq-info.json', { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const info = await res.json();
    return info && info.server === 'plano-quadrante' ? info : null;
  } catch {
    return null;
  }
}

// Link para o APK mais recente publicado nas Releases do GitHub.
// No GitHub Pages o endereço é <dono>.github.io/<repositorio>/, então
// o repositório é descoberto pela própria URL (funciona em forks).
export function apkDownloadUrl() {
  const fallback = { owner: 'AlerrandroV', repo: 'Plano-Quadrante' };
  let { owner, repo } = fallback;
  if (location.hostname.endsWith('.github.io')) {
    owner = location.hostname.split('.')[0];
    const first = location.pathname.split('/').filter(Boolean)[0];
    repo = first || `${owner}.github.io`;
  }
  return {
    apk: `https://github.com/${owner}/${repo}/releases/latest/download/plano-quadrante.apk`,
    releases: `https://github.com/${owner}/${repo}/releases/latest`,
  };
}
