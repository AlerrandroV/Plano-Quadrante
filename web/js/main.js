import { detectEnvironment } from './env.js';
import { startLocal } from './modes/local.js';
import { startAppMenu } from './modes/menu.js';
import { startPlayer } from './modes/player.js';

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
