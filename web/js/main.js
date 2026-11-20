import { detectEnvironment } from './env.js';
import { startLocal } from './modes/local.js';
import { startAppMenu } from './modes/menu.js';
import { startPlayer } from './modes/player.js';
import { sfx } from './ui/sound.js';

// "Clique" 16 bits em todos os botões do jogo.
document.addEventListener('click', (e) => {
  const b = e.target.closest?.('.px-btn, .btn, .tab, .game-card, .swatch, .color-btn, .menu-choice, .px-close, .pq-dice');
  if (b && !b.disabled) sfx(b.classList.contains('game-card') || b.classList.contains('swatch') ? 'select' : 'click');
}, true);

const root = document.getElementById('app');
const badge = document.getElementById('mode-badge');

const LABELS = {
  local: 'Mesma tela',
  host: 'Sala',
  player: 'Jogador',
};

const env = await detectEnvironment();
document.documentElement.dataset.mode = env.mode;
const setBadge = (text) => { badge.textContent = text; badge.hidden = false; };
setBadge(LABELS[env.mode]);

// No app (ou no servidor de desenvolvimento), quem abre escolhe o modo.
if (env.mode === 'host') startAppMenu(root, env, setBadge);
else if (env.mode === 'player') startPlayer(root, env);
else startLocal(root, env);
