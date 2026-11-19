// Janelas do próprio jogo (pixel art), no lugar das nativas do navegador.
//
// confirm(), prompt(), alert(), <dialog> e <details> têm a cara do sistema
// e, na WebView do app Android, confirm()/prompt() nem aparecem (devolvem
// "não" na hora). Por isso tudo passa por aqui.
import { h } from './dom.js';

let open = null;

function close() {
  if (!open) return;
  open.el.remove();
  document.removeEventListener('keydown', open.onKey);
  const done = open.done;
  open = null;
  done?.();
}

/**
 * Mostra uma janela. content: nós; actions: [{ label, primary, onClick }].
 * Fecha ao tocar fora ou no X (chama onClose).
 */
export function showModal({ title = '', content = [], actions = [], onClose = null, wide = false }) {
  close();
  const box = h('div', { class: 'px-modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Janela' },
    h('div', { class: 'px-modal-head' },
      title ? h('h2', {}, title) : h('span'),
      h('button', { class: 'px-close', 'aria-label': 'Fechar', onclick: () => { close(); onClose?.(); } }, 'X')),
    h('div', { class: 'px-modal-body' }, content),
    actions.length ? h('div', { class: 'px-modal-actions' }, actions.map((a) => h('button', {
      class: 'px-btn' + (a.primary ? ' primary' : ''),
      onclick: () => { close(); a.onClick?.(); },
    }, a.label))) : null);
  const el = h('div', { class: 'px-overlay', onclick: (e) => { if (e.target === el) { close(); onClose?.(); } } }, box);
  const onKey = (e) => { if (e.key === 'Escape') { close(); onClose?.(); } };
  document.addEventListener('keydown', onKey);
  document.body.append(el);
  open = { el, onKey, done: null };
  box.querySelector('.px-modal-actions .primary, .px-modal-body input, .px-close')?.focus();
  return { close };
}

/** Pergunta sim/não. Devolve uma Promise<boolean>. */
export function ask(text, { yes = 'Sim', no = 'Não', title = '' } = {}) {
  return new Promise((resolve) => {
    showModal({
      title,
      content: [h('p', { class: 'px-modal-text' }, text)],
      actions: [{ label: no, onClick: () => resolve(false) }, { label: yes, primary: true, onClick: () => resolve(true) }],
      onClose: () => resolve(false),
    });
  });
}

/** Pede um texto. Devolve Promise<string|null>. */
export function askText(label, value = '', { max = 20, ok = 'OK' } = {}) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'text', maxLength: max, value, 'aria-label': label });
    const finish = () => { const v = input.value.replace(/\s+/g, ' ').trim().slice(0, max); close(); resolve(v || null); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(); });
    showModal({
      title: label,
      content: [input],
      actions: [{ label: 'Cancelar', onClick: () => resolve(null) }, { label: ok, primary: true, onClick: () => { /* fechada por finish */ } }],
      onClose: () => resolve(null),
    });
    // O botão OK precisa ler o campo antes de fechar.
    const okBtn = document.querySelector('.px-modal-actions .primary');
    okBtn.onclick = () => { finish(); };
    setTimeout(() => input.focus(), 30);
  });
}

/** Bloco que abre/fecha (no lugar do <details> nativo). */
export function disclosure(label, content) {
  const body = h('div', { class: 'px-disclosure-body', hidden: true }, content);
  const btn = h('button', {
    class: 'px-disclosure', 'aria-expanded': 'false',
    onclick: () => {
      const openNow = body.hidden;
      body.hidden = !openNow;
      btn.setAttribute('aria-expanded', String(openNow));
      btn.textContent = (openNow ? '- ' : '+ ') + label;
    },
  }, '+ ' + label);
  return h('div', { class: 'px-disclosure-wrap' }, btn, body);
}
