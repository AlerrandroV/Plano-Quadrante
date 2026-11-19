// Modo "foco": esconde o cabeçalho do site e, quando o navegador permite,
// entra em tela cheia de verdade (some também a barra do navegador).
// No iPhone (Safari não tem tela cheia para páginas) e na WebView do app,
// só o cabeçalho some, o que já libera espaço.
import { h } from './dom.js';
import { isMuted, setMuted, onMuteChange, sfx } from './sound.js';
import { showModal } from './modal.js';

const root = document.documentElement;
const canFullscreen = !!(root.requestFullscreen || root.webkitRequestFullscreen);
const buttons = new Set();

function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function setFocus(on) {
  root.classList.toggle('focus', on);
  for (const b of buttons) {
    if (!b.isConnected) { buttons.delete(b); continue; }
    b.textContent = on ? 'Sair da tela cheia' : 'Tela cheia';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  window.dispatchEvent(new Event('resize')); // tabuleiro recalcula o tamanho
}

async function toggle() {
  const on = !root.classList.contains('focus');
  try {
    if (on && canFullscreen && !isFullscreen()) {
      await (root.requestFullscreen?.({ navigationUI: 'hide' }) ?? root.webkitRequestFullscreen());
    } else if (!on && isFullscreen()) {
      await (document.exitFullscreen?.() ?? document.webkitExitFullscreen());
    }
  } catch { /* sem permissão: segue só escondendo o cabeçalho */ }
  setFocus(on);
}

// Saiu da tela cheia pelo sistema (Esc, gesto de voltar): sai do modo foco.
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) {
  document.addEventListener(ev, () => {
    if (!isFullscreen() && root.classList.contains('focus') && canFullscreen) setFocus(false);
  });
}

export function fullscreenButton() {
  const on = root.classList.contains('focus');
  const b = h('button', {
    class: 'px-btn small', onclick: toggle, 'aria-pressed': on ? 'true' : 'false',
  }, on ? 'Sair da tela cheia' : 'Tela cheia');
  buttons.add(b);
  return b;
}

/** Ao voltar para telas fora da partida, mostra o cabeçalho de novo. */
export function leaveFocus() {
  if (!root.classList.contains('focus')) return;
  if (isFullscreen()) (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.())?.catch?.(() => {});
  setFocus(false);
}

/** Liga/desliga os efeitos sonoros (fica salvo no aparelho). */
export function soundButton() {
  const label = () => (isMuted() ? 'Som: não' : 'Som: sim');
  const b = h('button', {
    class: 'px-btn small', 'aria-pressed': String(!isMuted()),
    onclick: () => { setMuted(!isMuted()); },
  }, label());
  const off = onMuteChange(() => {
    if (!b.isConnected) { off(); return; }
    b.textContent = label();
    b.setAttribute('aria-pressed', String(!isMuted()));
  });
  return b;
}

/**
 * Botão "Menu" da partida: junta as opções numa janela do próprio jogo
 * (a barra de cima fica limpa no celular). items: [{ label, onClick }].
 */
export function menuButton(items = []) {
  return h('button', { class: 'px-btn small', onclick: () => { openMenu(items); } }, 'Menu');
}

function openMenu(items) {
  const soundLabel = () => (isMuted() ? 'Som: desligado' : 'Som: ligado');
  const sound = h('button', {
    class: 'px-btn wide',
    onclick: () => { setMuted(!isMuted()); sound.textContent = soundLabel(); },
  }, soundLabel());
  const on = root.classList.contains('focus');
  const m = showModal({
    title: 'Menu',
    content: [h('div', { class: 'menu-list' },
      items.map((it) => h('button', { class: 'px-btn wide', onclick: () => { m.close(); it.onClick(); } }, it.label)),
      sound,
      h('button', { class: 'px-btn wide', onclick: () => { m.close(); toggle(); } }, on ? 'Sair da tela cheia' : 'Tela cheia'))],
    actions: [{ label: 'Voltar', primary: true }],
  });
}
