// Web Worker: o robô pensa aqui, sem travar a tela.
import { decide } from './index.js';

self.onmessage = (e) => {
  const { id, gameId, state, botId, level } = e.data;
  let action = null;
  try {
    action = decide(gameId, state, botId, level);
  } catch (err) {
    console.error(err);
  }
  self.postMessage({ id, action });
};
