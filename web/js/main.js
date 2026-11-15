import { detectEnvironment } from './env.js';
import { startLocal } from './modes/local.js';
import { startHost } from './modes/host.js';
import { startPlayer } from './modes/player.js';

const root = document.getElementById('app');
const badge = document.getElementById('mode-badge');

const LABELS = {
  local: 'Mesma tela',
  host: 'Criador da sala',
  player: 'Jogador',
};

const env = await detectEnvironment();
document.documentElement.dataset.mode = env.mode;
badge.textContent = LABELS[env.mode];
badge.hidden = false;

if (env.mode === 'host') startHost(root, env);
else if (env.mode === 'player') startPlayer(root, env);
else startLocal(root, env);
