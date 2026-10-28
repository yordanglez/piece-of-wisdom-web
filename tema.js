/* Piece of Wisdom · el tema y el correo, en todas las páginas.
 *
 * El tema sigue al del sistema hasta que se elige uno a mano; la elección se
 * guarda en este navegador. El <head> de cada página la aplica antes de pintar.
 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const ico = n => `<svg aria-hidden="true"><use href="#i-${n}"></use></svg>`;
  const raiz = document.documentElement;
  const temaActual = () => raiz.getAttribute('data-theme')
    || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  window.powTema = temaActual;

  function pintarInterruptor() {
    const b = $('#tema-toggle');
    if (!b) return;
    const oscuro = temaActual() === 'dark';
    b.innerHTML = `${ico(oscuro ? 'hoy' : 'sueno')}<span class="tema-texto">${oscuro ? 'De día' : 'De noche'}</span>`;
    b.setAttribute('aria-label', oscuro ? 'Cambiar al tema de día' : 'Cambiar al tema de noche');
  }
  $('#tema-toggle')?.addEventListener('click', () => {
    const nuevo = temaActual() === 'dark' ? 'light' : 'dark';
    raiz.setAttribute('data-theme', nuevo);
    try { localStorage.setItem('pow-tema', nuevo); } catch (e) { /* sin almacenamiento */ }
    pintarInterruptor();
  });
  window.matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', pintarInterruptor);
  pintarInterruptor();

  // Copiar el correo. Si el portapapeles no deja, el texto queda seleccionado.
  document.querySelectorAll('[data-copiar]').forEach(b => b.addEventListener('click', async () => {
    const etiqueta = b.querySelector('span');
    try {
      await navigator.clipboard.writeText(b.dataset.copiar);
      etiqueta.textContent = 'Copiado';
    } catch (e) {
      const t = b.previousElementSibling;
      if (t) {
        const r = document.createRange();
        r.selectNodeContents(t);
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      }
      etiqueta.textContent = 'Seleccionado';
    }
    setTimeout(() => { etiqueta.textContent = 'Copiar'; }, 1800);
  }));
})();
