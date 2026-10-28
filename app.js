/* Piece of Wisdom · la web.
 *
 * Cuatro piezas, sin dependencias:
 *   1. El tema (Noche / Cielo) vive aparte, en tema.js.
 *   2. El móvil de la demo: el mismo recorrido que la app —Hoy, Tu sesión,
 *      Preparando, el reproductor y el cierre— con sus textos. No genera
 *      nada: el guion es un ejemplo fijo y no hay voz, y la página lo dice.
 *   3. Los sonidos de fondo, sintetizados aquí con Web Audio.
 *   4. El lector de salmos y el minuto de respiración.
 */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ico = (n, attrs = '') => `<svg aria-hidden="true" ${attrs}><use href="#i-${n}"></use></svg>`;
  const reducido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // El tema (Noche / Cielo) y copiar el correo viven en tema.js, que cargan
  // todas las páginas.
  const raiz = document.documentElement;
  const temaActual = () => (window.powTema ? window.powTema() : 'dark');

  // ── 3. Sonidos (Web Audio) ──────────────────────────────────────────────
  // Van antes que la demo porque la demo los usa.

  /** Mientras el minuto de respiración suena, la demo no apaga sus olas. */
  let respirando = false;

  const Sonido = (() => {
    let ctx = null;
    let master = null;
    const capas = {};
    const buffers = {};

    function iniciar() {
      if (ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      return true;
    }

    /** Ruido de 6 s en bucle: blanco, rosa o marrón. */
    function ruido(tipo) {
      if (buffers[tipo]) return buffers[tipo];
      const n = ctx.sampleRate * 6;
      const buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, ultimo = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        if (tipo === 'blanco') d[i] = w * 0.5;
        else if (tipo === 'rosa') {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else {
          ultimo = (ultimo + 0.02 * w) / 1.02;
          d[i] = ultimo * 3.2;
        }
      }
      // Fundido corto en la junta del bucle para que no haga clic.
      const f = Math.floor(ctx.sampleRate * 0.05);
      for (let i = 0; i < f; i++) { const k = i / f; d[i] *= k; d[n - 1 - i] *= k; }
      buffers[tipo] = buf;
      return buf;
    }

    function fuente(tipo) {
      const s = ctx.createBufferSource();
      s.buffer = ruido(tipo);
      s.loop = true;
      s.start(0, Math.random() * 5);
      return s;
    }
    function filtro(type, frequency, Q = 0.7) {
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = frequency; f.Q.value = Q;
      return f;
    }
    function lfo(hz, cuanto, destino) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = hz; g.gain.value = cuanto;
      o.connect(g); g.connect(destino); o.start();
      return o;
    }

    /** Cada receta conecta su sonido a `sal` y devuelve cómo pararlo. */
    const RECETAS = {
      'Lluvia suave'(sal) {
        const s = fuente('rosa'), hp = filtro('highpass', 450), lp = filtro('lowpass', 7000);
        const g = ctx.createGain(); g.gain.value = 0.9;
        s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(sal);
        const s2 = fuente('marron'), lp2 = filtro('lowpass', 300); const g2 = ctx.createGain(); g2.gain.value = 0.35;
        s2.connect(lp2); lp2.connect(g2); g2.connect(sal);
        return () => { s.stop(); s2.stop(); };
      },
      Olas(sal) {
        const s = fuente('marron'), lp = filtro('lowpass', 650);
        const g = ctx.createGain(); g.gain.value = 0.55;
        const o = lfo(0.085, 0.42, g.gain);
        s.connect(lp); lp.connect(g); g.connect(sal);
        const e = fuente('rosa'), hp = filtro('bandpass', 1800, 0.5); const ge = ctx.createGain(); ge.gain.value = 0.05;
        const o2 = lfo(0.085, 0.05, ge.gain);
        e.connect(hp); hp.connect(ge); ge.connect(sal);
        return () => { s.stop(); e.stop(); o.stop(); o2.stop(); };
      },
      Viento(sal) {
        const s = fuente('blanco'), bp = filtro('bandpass', 520, 1.1);
        const o = lfo(0.055, 260, bp.frequency);
        const g = ctx.createGain(); g.gain.value = 0.55;
        const o2 = lfo(0.031, 0.25, g.gain);
        s.connect(bp); bp.connect(g); g.connect(sal);
        return () => { s.stop(); o.stop(); o2.stop(); };
      },
      Fuego(sal) {
        const s = fuente('marron'), lp = filtro('lowpass', 420);
        const g = ctx.createGain(); g.gain.value = 0.5;
        s.connect(lp); lp.connect(g); g.connect(sal);
        const hp = filtro('highpass', 1500);
        const gc = ctx.createGain(); gc.gain.value = 0;
        const c = fuente('blanco'); c.connect(hp); hp.connect(gc); gc.connect(sal);
        let vivo = true;
        (function chasquido() {
          if (!vivo) return;
          const t = ctx.currentTime + 0.01;
          const a = 0.15 + Math.random() * 0.5;
          gc.gain.setValueAtTime(0, t);
          gc.gain.linearRampToValueAtTime(a, t + 0.003);
          gc.gain.exponentialRampToValueAtTime(0.0001, t + 0.02 + Math.random() * 0.05);
          setTimeout(chasquido, 40 + Math.random() * (Math.random() < 0.2 ? 900 : 260));
        })();
        return () => { vivo = false; s.stop(); c.stop(); };
      },
      'Cuencos tibetanos'(sal) {
        let vivo = true;
        const golpe = () => {
          if (!vivo) return;
          const t = ctx.currentTime + 0.02;
          const base = [174.6, 196, 220.5][Math.floor(Math.random() * 3)];
          [[1, 0.5], [2.76, 0.2], [5.4, 0.08], [1.004, 0.3]].forEach(([m, a]) => {
            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.type = 'sine'; o.frequency.value = base * m;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(a * 0.5, t + 0.04);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 9);
            o.connect(g); g.connect(sal); o.start(t); o.stop(t + 9.2);
          });
          setTimeout(golpe, 7000 + Math.random() * 5000);
        };
        golpe();
        return () => { vivo = false; };
      },
    };

    const NOMBRES = Object.keys(RECETAS);
    const curva = v => v * v; // el oído escucha el volumen en curva, no en línea

    function encender(nombre, nivel) {
      if (!iniciar() || capas[nombre]) return;
      ctx.resume();
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(master);
      const parar = RECETAS[nombre](g);
      // Entra con un fundido de dos segundos, como en la app.
      g.gain.setTargetAtTime(curva(nivel), ctx.currentTime, 0.6);
      capas[nombre] = { g, parar };
    }
    function nivel(nombre, v) {
      const c = capas[nombre];
      if (c) c.g.gain.setTargetAtTime(curva(v), ctx.currentTime, 0.15);
    }
    function apagar(nombre) {
      const c = capas[nombre];
      if (!c) return;
      delete capas[nombre];
      c.g.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      setTimeout(() => { try { c.parar(); c.g.disconnect(); } catch (e) { /* ya parado */ } }, 2200);
    }
    const apagarTodo = () => Object.keys(capas).forEach(apagar);
    const suena = nombre => !!capas[nombre];
    const disponible = () => !!(window.AudioContext || window.webkitAudioContext);
    return { NOMBRES, encender, nivel, apagar, apagarTodo, suena, disponible };
  })();

  const ICONO_SONIDO = {
    'Lluvia suave': 'sonido', Olas: 'calma', Viento: 'respiracion', Fuego: 'vela', 'Cuencos tibetanos': 'campana',
  };

  // ── 2. La demo ──────────────────────────────────────────────────────────

  const vistaEl = $('#demo-vista');
  const capasEl = $('#demo-capas');
  const pantallaEl = $('#pantalla');

  const TEMAS = [
    { cat: 'Calma', label: 'Calma', sub: 'Bajar el ritmo', icon: 'calma', titulo: 'Soltar lo que pesa', portada: 'calma-soltar' },
    { cat: 'Sueño', label: 'Sueño', sub: 'Dejar el día', icon: 'sueno', titulo: 'Una noche serena', portada: 'sueno-noche-serena' },
    { cat: 'Enfoque', label: 'Enfoque', sub: 'Volver a una cosa', icon: 'enfoque', titulo: 'Un solo punto', portada: 'enfoque-un-punto' },
    { cat: 'Gratitud', label: 'Gratitud', sub: 'Mirar lo que sí está', icon: 'gratitud', titulo: 'Lo que amanece', portada: 'gratitud-amanecer' },
    { cat: 'Cristiana evangélica', label: 'Tiempo con Dios', sub: 'Oración y Palabra', icon: 'fe', titulo: 'En su presencia', portada: 'fe-presencia' },
    { cat: 'Autoestima', label: 'Autoestima', sub: 'Volver a ti', icon: 'autoestima', titulo: 'Tu luz de dentro', portada: 'autoestima-luz-interior' },
    { cat: 'Duelo', label: 'Duelo', sub: 'Acompañar la pérdida', icon: 'duelo', titulo: 'Acompañar lo que falta', portada: 'duelo-acompanar' },
    { cat: 'Respiración', label: 'Respiración', sub: 'Solo respirar', icon: 'respiracion', titulo: 'Solo respirar', portada: 'respiracion-silencio' },
    { cat: 'Sabiduría', label: 'Sabiduría', sub: 'Una idea para hoy', icon: 'sabiduria', titulo: 'Un paso en el camino', portada: 'sabiduria-camino' },
  ];
  const temaDe = cat => TEMAS.find(t => t.cat === cat) || TEMAS[0];

  const VOCES = [
    { name: 'Ruth', desc: 'Neutro · muy suave, para dormir' },
    { name: 'Mateo', desc: 'Neutro · grave, pausado' },
    { name: 'Elena', desc: 'Castellano · cálida y lenta' },
    { name: 'Samuel', desc: 'Neutro · pastoral' },
  ];
  const TIMERS = [
    { m: 0, label: 'Desactivado' }, { m: -1, label: 'Al terminar la sesión' },
    { m: 10, label: '10 minutos' }, { m: 20, label: '20 minutos' }, { m: 30, label: '30 minutos' },
  ];
  const ANIMOS = [{ key: 'ligero', label: 'Más ligero' }, { key: 'igual', label: 'Igual' }, { key: 'removido', label: 'Removido' }];

  /** El guion de ejemplo de la app, repartido sobre la duración elegida. */
  const GUION = [
    { f: 0, text: 'Acomódate y suelta los hombros.' },
    { f: 0.2, text: 'No tienes que terminarlo todo para permitirte descansar.' },
    { f: 0.36, text: 'Vuelve al sonido de mi voz, sin prisa.' },
    { f: 0.5, text: 'Permite que tu respiración te recuerde que estás a salvo, justo aquí.' },
    { f: 0.68, text: 'Deja que el día se quede donde está.' },
    { f: 0.86, text: 'Cuando quieras, vuelve despacio a lo que tienes delante.' },
  ];

  /** La Palabra de ejemplo por tema: versículos literales de `salmos.js`. */
  const PALABRA = {
    Calma: [46, [10]], 'Sueño': [121, [3, 4]], Enfoque: [27, [4]], Gratitud: [103, [1, 2]],
    'Cristiana evangélica': [23, [1, 2]], Autoestima: [139, [14]], Duelo: [23, [4]],
    'Respiración': [62, [1]], 'Sabiduría': [121, [1, 2]],
  };
  function palabraDe(cat) {
    const [cap, vs] = PALABRA[cat] || PALABRA.Calma;
    const salmo = (window.SALMOS || []).find(s => s.ref === `Salmo ${cap}`);
    if (!salmo) return null;
    // Sin el título del salmo («Salmo de David.», «Cántico gradual.»…) y con la
    // primera palabra en caja normal: la versalita es tipografía de la edición.
    const text = vs.map(v => salmo.v[v - 1]).join(' ')
      .replace(/^[^.]*?(?:Salmo|Cántico)[^.]*\.\s*/, '')
      .replace(/^([A-ZÁÉÍÓÚÑ]{2,})/, w => w.charAt(0) + w.slice(1).toLowerCase());
    const ref = `Salmo ${cap}:${vs.length > 1 ? `${vs[0]}-${vs[vs.length - 1]}` : vs[0]}`;
    return { text, ref, version: 'Reina-Valera 1909' };
  }

  /** La biblioteca de ejemplo de Escuchar: portadas que no usan los temas. */
  const BIBLIOTECA = [
    { titulo: 'Una pausa a media tarde', cat: 'Calma', min: 5, portada: 'calma-pausa' },
    { titulo: 'Dejar el día', cat: 'Sueño', min: 15, portada: 'calma-dejar-el-dia' },
    { titulo: 'Antes de dormir', cat: 'Sueño', min: 20, portada: 'sueno-antes-de-dormir' },
    { titulo: 'Silencio para empezar', cat: 'Respiración', min: 5, portada: 'respiracion-silencio' },
  ];

  // Un mensaje de riesgo no se responde con una meditación. La app lo criba en
  // el servidor; la demo hace una criba sencilla para no fingir lo contrario.
  const RIESGO = /(suicid|matarme|me quiero morir|quiero morir|quitarme la vida|no quiero vivir|no quiero seguir|acabar con todo|acabar con mi vida|hacerme dano|autolesi|cortarme)/;
  const normal = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const VEL = 10; // la demo corre diez veces más deprisa
  const S = {
    vista: 'hoy', pila: [],
    notas: [], borrador: '', origen: 'dia',
    cat: 'Calma', mas: false, dur: 10, voz: 'Ruth',
    biblia: false, fe: false,
    sonidos: [{ n: 'Lluvia suave', v: 0.6 }],
    capa: null,
    prog: 0, preparando: false, lista: null,
    sesion: null, pos: 0, play: false, texto: false, sleep: 0, avisado: false,
    animo: null, pieza: false, idea: 0, reflexion: '',
    diario: null, escucharTab: 'Sesiones',
  };
  const PASO = { hoy: 0, intencion: 1, generar: 1, pasaje: 1, progreso: 2, riesgo: 2, player: 3, cierre: 4 };
  const TABS = ['hoy', 'escuchar', 'camino'];

  const ahora = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const hoyLargo = () => {
    try {
      const s = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
      return s.charAt(0).toUpperCase() + s.slice(1);
    } catch (e) { return 'Hoy'; }
  };
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const corta = t => (t.length > 34 ? `${t.slice(0, 32).trimEnd()}…` : t);
  const portadaUrl = p => `assets/${temaActual() === 'dark' ? 'noche' : 'dia'}/portadas/${p}.jpg`;

  // ── piezas de la interfaz del móvil ──

  const topbar = (titulo, icono = 'chevronAtras', label = 'Atrás', accion = 'atras', derecha = '') => `
    <div style="display:grid;grid-template-columns:4.8em 1fr auto;align-items:center;margin:0 -1.2em 1em">
      <button class="p-icono" data-a="${accion}" aria-label="${label}">${ico(icono)}</button>
      <span class="p-control p-centro" style="font-weight:600">${titulo || ''}</span>
      ${derecha || '<span style="width:4.8em"></span>'}
    </div>`;
  const toggle = (on, extra = '') => `<span class="p-toggle ${on ? 'on' : ''}" ${extra}></span>`;
  const tabbar = () => `
    <nav class="p-tabbar" aria-label="Pestañas de la app">
      ${[['hoy', 'hoy', 'Hoy'], ['escuchar', 'auriculares', 'Escuchar'], ['camino', 'camino', 'Mi camino']]
        .map(([v, i, l]) => `<button class="p-tab ${S.vista === v ? 'on' : ''}" data-a="tab" data-v="${v}" ${S.vista === v ? 'aria-current="page"' : ''}>${ico(i)}<span>${l}</span></button>`).join('')}
    </nav>`;

  // ── vistas ──

  const V = {};

  V.hoy = () => {
    const n = S.notas.length;
    const trabajo = S.preparando || (S.lista && !S.sesion?.escuchada);
    return `
    <div class="vista con-barra" style="padding-left:1.6em;padding-right:1.6em">
      <div class="banda horizonte-arte" style="top:19.6em;height:26em"></div>
      <div class="p-fila" style="padding:0 .8em;margin-bottom:1.2em;min-height:4.8em">
        <span class="p-marca">piece of wisdom</span>
        <span style="color:var(--secondary);width:2.6em;height:2.6em">${ico('avatar', 'style="width:2.6em;height:2.6em"')}</span>
      </div>
      ${trabajo ? `
        <button class="p-card" data-a="${S.preparando ? 'ir' : 'escuchar-lista'}" data-v="progreso" style="width:100%;border:0;cursor:pointer;display:flex;align-items:center;gap:1.2em;padding:1.6em 2em;margin-bottom:1.4em;text-align:left;color:var(--fg)">
          ${ico(S.preparando ? 'reloj' : 'play', 'style="width:2em;height:2em;flex:none"')}
          <span style="flex:1;min-width:0;display:grid;gap:.2em">
            <span class="p-control">${S.preparando ? 'Preparando tu sesión' : 'Tu sesión está lista'}</span>
            <span class="p-meta" id="hoy-fase" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${S.preparando ? fase() : esc(S.sesion.titulo)}</span>
          </span>
          ${ico('chevron', 'style="width:1.9em;height:1.9em;color:var(--secondary)"')}
        </button>` : ''}
      <div style="padding:1.2em .8em 9.6em;display:grid;gap:1em">
        <p class="p-meta">${hoyLargo()}</p>
        <p class="p-hero">Lo que va pasando.</p>
        <p class="p-body grande">¿Qué traes hoy?</p>
      </div>
      <div class="p-card" style="padding:1.8em 2em 1.4em;display:grid;gap:1em;margin-bottom:1.4em">
        <label class="p-meta" for="demo-nota">Nueva nota</label>
        <textarea id="demo-nota" class="p-textarea" rows="2" maxlength="500" placeholder="Escribe lo que traes ahora…">${esc(S.borrador)}</textarea>
        <div style="display:flex;justify-content:flex-end">
          <button class="p-pildora" data-a="guardar-nota" id="btn-guardar-nota" ${S.borrador.trim() ? '' : 'disabled'}><span>Guardar nota</span></button>
        </div>
      </div>
      ${n ? `
        <div class="p-destacada" style="margin-bottom:1.4em">
          <div class="p-fila" style="margin-bottom:1.6em">
            <span style="font-size:1.5em;font-weight:600">Tu día</span>
            <span class="p-meta">${n} ${n === 1 ? 'nota' : 'notas'}</span>
          </div>
          ${S.notas.map((x, i) => `
            <div class="p-linea">
              <div class="raya"><i class="punto"></i>${i < n - 1 ? '<i class="hilo"></i>' : ''}</div>
              <div class="cuerpo">
                <span class="p-meta">${x.hora}</span>
                <p class="texto">${esc(x.texto)}</p>
                <button class="p-cristal" data-a="desde" data-id="${x.id}" aria-label="Sesión de la nota de las ${x.hora}"><span>Sesión de esto</span></button>
              </div>
            </div>`).join('')}
        </div>` : ''}
      <div class="p-card" style="display:grid;gap:.8em">
        <button class="p-boton" data-a="preparar" ${n ? '' : 'disabled'}><span>Preparar una sesión con mi día</span>${ico('adelante')}</button>
        <button class="p-enlace" data-a="ir" data-v="intencion"><span>Prefiero elegir un tema</span>${ico('adelante')}</button>
      </div>
      <p class="p-meta apagado" style="text-align:right;margin-top:1em;padding:0 1.2em">
        ${n ? '1 crédito · Guion y voz creados con IA' : 'Escribe algo, o elige un tema · Guion y voz creados con IA'}
      </p>
    </div>${tabbar()}`;
  };

  V.intencion = () => {
    const lista = S.mas ? TEMAS : TEMAS.slice(0, 5);
    return `
    <div class="vista">
      <div class="banda horizonte-arte" style="top:13em;height:26em;opacity:.55"></div>
      ${topbar('')}
      <p class="p-control p-acento" style="margin-bottom:.6em">Tu intención</p>
      <p class="p-hero" style="margin-bottom:14em">¿Qué necesitas ahora?</p>
      <div style="display:grid;gap:1em">
        ${lista.map(t => `
          <button class="p-opcion ${t.cat === S.cat ? 'on' : ''}" data-a="cat" data-v="${t.cat}" aria-pressed="${t.cat === S.cat}">
            ${ico(t.icon)}
            <span class="txt"><span class="p-control">${t.label}</span><span class="p-meta">${t.sub}</span></span>
            ${t.cat === S.cat ? `<span class="p-check">${ico('check')}</span>` : ico('chevron', 'style="width:1.8em;height:1.8em;color:var(--muted)"')}
          </button>`).join('')}
      </div>
      <button class="p-enlace" data-a="mas" style="margin:.8em 0 .6em"><span>${S.mas ? 'Ver menos temas' : 'Ver más temas'}</span>${ico(S.mas ? 'bajar' : 'adelante')}</button>
      <button class="p-boton" data-a="ir" data-v="generar"><span>Elegir ${temaDe(S.cat).label}</span>${ico('adelante')}</button>
    </div>`;
  };

  V.generar = () => {
    const hay = S.notas.length > 0;
    const opciones = hay ? [
      { id: 'dia', label: 'Todo mi día', sub: `${S.notas.length} ${S.notas.length === 1 ? 'nota' : 'notas'} de hoy` },
      ...S.notas.slice(-2).reverse().map(x => ({ id: x.id, label: `Solo la nota de las ${x.hora}`, sub: `“${corta(x.texto)}”` })),
    ].slice(0, 3) : [];
    const filas = [
      { icon: 'enfoque', label: 'Intención', value: temaDe(S.cat).label, a: 'ir', v: 'intencion' },
      { icon: 'microfono', label: 'Voz', value: S.voz, a: 'capa', v: 'voz' },
      { icon: 'altavoz', label: 'Sonidos', value: S.sonidos.length ? S.sonidos.map(x => x.n).join(' · ') : 'Sin sonidos', a: 'capa', v: 'sonido' },
    ];
    return `
    <div class="vista">
      ${topbar('Tu sesión')}
      <p class="p-hero" style="margin:1em 0 2em">${hay ? '¿Desde dónde?' : 'A tu manera.'}</p>
      ${hay ? `<div style="display:grid;gap:.8em;margin-bottom:2em">
        ${opciones.map(o => `
          <button class="p-opcion ${S.origen === o.id ? 'on' : ''}" data-a="origen" data-v="${o.id}" style="min-height:6.4em" aria-pressed="${S.origen === o.id}">
            <span class="txt"><span class="p-control">${o.label}</span><span class="p-meta">${esc(o.sub)}</span></span>
            <span class="p-radio"></span>
          </button>`).join('')}
      </div>` : `<p class="p-body" style="margin-bottom:2em">Hoy no has escrito nada, así que la sesión sale del tema que elijas. Puedes escribir algo en Hoy si prefieres partir de ahí.</p>`}
      <button class="p-opcion ${S.biblia ? 'on' : ''}" data-a="biblia" role="switch" aria-checked="${S.biblia}">
        ${ico('sabiduria', 'style="color:var(--light)"')}
        <span class="txt"><span class="p-control">Incluir una Palabra bíblica</span><span class="p-meta">${S.biblia ? 'Un pasaje elegido por lo que escribiste · RV 1909' : 'Un pasaje elegido por lo que escribiste'}</span></span>
        ${toggle(S.biblia)}
      </button>
      <p class="p-control p-acento" style="margin:2.2em 0 1em">Duración</p>
      <div class="p-chips" style="margin-bottom:1.6em" role="group" aria-label="Duración en minutos">
        ${[5, 10, 15, 20].map(d => `<button class="p-chip ${S.dur === d ? 'on' : ''}" data-a="dur" data-v="${d}" aria-pressed="${S.dur === d}" aria-label="${d} minutos"><span>${d}</span></button>`).join('')}
      </div>
      <div class="p-grupo">
        ${filas.map(f => `<button class="p-row" data-a="${f.a}" data-v="${f.v}">${ico(f.icon)}<span class="lab">${f.label}</span><span class="val">${esc(f.value)}</span>${ico('chevron')}</button>`).join('')}
      </div>
      <button class="p-boton" data-a="crear" style="margin-top:2.2em"><span>${S.biblia ? 'Ver la Palabra elegida' : 'Crear mi sesión · 1 crédito'}</span>${ico('adelante')}</button>
      <p class="p-meta p-centro" style="margin-top:1.2em">Guion y voz creados con IA</p>
    </div>`;
  };

  V.pasaje = () => {
    const p = palabraDe(S.cat);
    return `
    <div class="vista">
      <div class="banda presencia-arte" style="top:12em;height:26em;opacity:.8"></div>
      ${topbar('')}
      <p class="p-eyebrow" style="margin-bottom:1em">Tu Palabra bíblica</p>
      <p class="p-hero" style="margin-bottom:6em">Una Palabra para lo que viviste.</p>
      <div class="p-card" style="padding:2.4em 2.2em">
        <p style="font-size:2.2em;line-height:1.45;margin-bottom:.6em">“${esc(p ? p.text : '')}”</p>
        <p class="p-meta">${p ? `${p.ref} · ${p.version}` : ''}</p>
      </div>
      <p class="p-meta" style="margin:1.4em .4em 0">En la app, el pasaje se elige por lo que escribiste. El texto se cita literal, no lo escribe el modelo.</p>
      <button class="p-boton" data-a="crear-ya" style="margin-top:2.2em"><span>Crear mi sesión · 1 crédito</span>${ico('adelante')}</button>
      <p class="p-meta p-centro" style="margin-top:1.2em">Guion y voz creados con IA</p>
    </div>`;
  };

  function fase() {
    if (S.prog >= 100) return 'Tu sesión está lista.';
    if (S.prog < 38) return 'Escribiendo tu guion';
    if (S.prog < 74) return 'Poniéndole voz';
    return 'Mezclando el sonido';
  }

  V.progreso = () => {
    const lista = S.prog >= 100;
    return `
    <div class="vista fija" style="padding-bottom:2.4em">
      <div class="banda presencia-arte" style="top:21em;height:33em"></div>
      ${topbar('', 'bajar', 'Volver a Hoy', 'a-hoy')}
      <p class="p-eyebrow" style="margin-bottom:1em">Preparando tu sesión</p>
      <p class="p-hero">Tu pausa ya empieza.</p>
      <div style="margin-top:auto">
        <p class="p-phrase p-centro" style="margin-bottom:.75em">Respira a tu ritmo.</p>
        <p class="p-meta p-centro" id="prog-fase" style="margin-bottom:1.4em">${fase()}</p>
        <div class="p-progreso" style="margin-bottom:2em" role="progressbar" aria-label="Progreso" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(S.prog)}" id="prog-barra">
          <div class="lleno" style="width:${S.prog}%"></div><div class="luz" style="left:${S.prog}%"></div>
        </div>
        <p class="p-meta p-centro" style="margin-bottom:2.6em">Puedes salir de esta pantalla.<br>Te avisamos aquí cuando esté lista.</p>
        <div id="prog-boton">${lista
          ? `<button class="p-boton" data-a="escuchar-lista"><span>Escuchar la sesión</span></button>`
          : `<button class="p-boton secundario" data-a="a-hoy"><span>Volver a Hoy</span></button>`}</div>
        <p class="p-meta p-centro" style="margin-top:1.2em">Guion y voz creados con IA</p>
      </div>
    </div>`;
  };

  V.riesgo = () => `
    <div class="vista fija" style="justify-content:center">
      <p class="p-eyebrow" style="margin-bottom:1.4em">Hoy no</p>
      <p class="p-detail" style="margin-bottom:1.4em">Esto merece algo más que una meditación.</p>
      <p class="p-body" style="margin-bottom:2.8em">Lo que has escrito suena a algo que pesa demasiado para llevarlo a solas. Habla hoy con alguien: una persona de confianza, un profesional de la salud o, si estás en peligro, los servicios de emergencia de tu país.</p>
      <button class="p-boton" data-a="a-hoy"><span>Volver</span></button>
      <p class="p-meta p-centro" style="margin-top:1.4em">No se ha consumido ningún crédito.</p>
    </div>`;

  /** Las líneas del guion con su segundo, para la duración y la Palabra de esta sesión. */
  function lineas() {
    const total = S.sesion.total;
    const l = GUION.map(g => ({ at: Math.round(g.f * total), text: g.text }));
    if (S.sesion.palabra) {
      l.splice(4, 0, { at: Math.round(0.58 * total), text: `“${S.sesion.palabra.text}”`, palabra: true });
    }
    return l;
  }
  const lineaActual = () => {
    const l = lineas();
    let i = 0;
    l.forEach((x, k) => { if (S.pos >= x.at) i = k; });
    return { l, i };
  };

  V.player = () => {
    const ses = S.sesion;
    const { l, i } = lineaActual();
    const pct = (S.pos / ses.total) * 100;
    const marca = l.find(x => x.palabra);
    const timer = TIMERS.find(t => t.m === S.sleep);
    if (S.texto) {
      return `
      <div class="vista fija">
        ${topbar('Texto de la sesión', 'chevronAtras', 'Volver a la escucha', 'texto-fuera')}
        <p class="p-meta" style="margin-bottom:2em">${esc(ses.titulo)} · ${ses.voz}</p>
        <div class="p-lineas" style="flex:1;overflow-y:auto;scrollbar-width:none" id="lineas">
          ${l.map((x, k) => `<button class="${k === i ? 'actual' : ''}" data-a="saltar" data-v="${x.at}" aria-label="Saltar a: ${esc(x.text.slice(0, 40))}">${esc(x.text)}</button>`).join('')}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding-top:1.4em">
          <button class="p-play" data-a="play" style="width:5.6em;height:5.6em" aria-label="${S.play ? 'Pausar' : 'Reproducir'}">${ico(S.play ? 'pausa' : 'play', 'style="width:2em;height:2em"')}</button>
          <button class="p-enlace" data-a="texto-fuera" style="width:auto"><span style="font-weight:600">Volver a la escucha</span></button>
        </div>
      </div>`;
    }
    return `
    <div class="vista fija" style="padding-bottom:2.2em">
      <div class="banda horizonte-arte" style="top:24em;height:30em"></div>
      ${topbar('', 'bajar', 'Cerrar la sesión', 'cerrar-sesion', `
        <button class="p-fila" data-a="capa" data-v="timer" aria-label="Temporizador" style="border:0;background:transparent;cursor:pointer;gap:.8em;padding:1.2em;color:${S.sleep ? 'var(--light)' : 'var(--fg)'}">
          ${ico('sueno', 'style="width:2em;height:2em"')}<span class="p-control">${S.sleep ? timer.label.replace('Al terminar la sesión', 'Al terminar') : 'Temporizador'}</span>
        </button>`)}
      <p class="p-eyebrow" style="margin-bottom:.8em">Tu sesión</p>
      <p class="p-title" style="margin-bottom:.8em">${esc(ses.titulo)}</p>
      <p class="p-meta">${Math.round(ses.total / 60)} min · Voz ${ses.voz}</p>
      <div style="margin-top:auto">
        <p class="p-phrase p-centro" id="frase" style="margin-bottom:1.1em;min-height:4em">${esc(l[i].text)}</p>
        <div class="p-barra" id="barra" role="slider" tabindex="0" aria-label="Posición de la sesión" aria-valuemin="0" aria-valuemax="${ses.total}" aria-valuenow="${Math.round(S.pos)}" aria-valuetext="${mmss(S.pos)} de ${mmss(ses.total)}">
          ${marca ? `<i style="position:absolute;left:${(marca.at / ses.total) * 100}%;top:-.3em;width:.2em;height:1em;background:var(--light);border-radius:.1em"></i>` : ''}
          <div class="lleno" style="width:${pct}%"></div><div class="luz" style="left:${pct}%"></div>
        </div>
        <div class="p-tiempos p-meta"><span id="t-pos">${mmss(S.pos)}</span><span>${mmss(ses.total)}</span></div>
        <div style="display:flex;align-items:center;justify-content:center;gap:2.6em;margin:1.8em 0 2.4em">
          <button class="p-salto" data-a="seek" data-v="-15" aria-label="Retroceder 15 segundos">${ico('saltarAtras')}<b>15</b></button>
          <button class="p-play" data-a="play" aria-label="${S.play ? 'Pausar' : 'Reproducir'}">${ico(S.play ? 'pausa' : 'play')}</button>
          <button class="p-salto" data-a="seek" data-v="15" aria-label="Avanzar 15 segundos">${ico('saltarAdelante')}<b>15</b></button>
        </div>
        <div style="display:flex;gap:1.2em">
          <button class="p-boton secundario" data-a="capa" data-v="sonido">${ico('niveles')}<span>Sonido</span></button>
          ${marca
            ? `<button class="p-boton secundario" data-a="saltar" data-v="${marca.at}">${ico('sabiduria')}<span>Ir al pasaje</span></button>`
            : `<button class="p-boton secundario" data-a="texto-dentro">${ico('texto')}<span>Ver texto</span></button>`}
        </div>
        <p class="p-meta p-centro" style="margin-top:1.6em">Guion y voz creados con IA</p>
      </div>
    </div>`;
  };

  V.cierre = () => {
    const ses = S.sesion;
    const candidatas = GUION.slice(1, 5).map(g => g.text);
    const idea = candidatas[S.idea % candidatas.length];
    const p = ses && ses.palabra;
    return `
    <div class="vista">
      <div class="banda primera-arte" style="top:13em;height:24em"></div>
      ${topbar('', 'cerrar', 'Terminar', 'terminar')}
      <p class="p-eyebrow" style="margin-bottom:1em">Al terminar</p>
      <p class="p-hero" style="margin-bottom:12em">¿Cómo te vas?</p>
      <div class="p-animos" style="margin-bottom:2.2em" role="group" aria-label="Cómo te vas">
        ${ANIMOS.map(a => `<button class="p-animo ${S.animo === a.key ? 'on' : ''}" data-a="animo" data-v="${a.key}" aria-pressed="${S.animo === a.key}"><i></i><span>${a.label}</span></button>`).join('')}
      </div>
      <p class="p-eyebrow" style="color:var(--secondary);margin-bottom:.8em">${p ? 'Una Palabra para llevarte' : 'Una idea para llevarte'}</p>
      <p class="p-phrase" style="margin-bottom:.8em">${esc(p ? `“${p.text}”` : idea)}</p>
      <div class="p-fila" style="margin-bottom:2.2em">
        ${p ? `<span class="p-meta">${p.ref}</span>` : ''}
        <button data-a="pieza" style="border:0;background:transparent;cursor:pointer;padding:.4em 0;color:var(--light);font-size:1.3em;font-weight:600">${S.pieza ? 'Guardada como pieza ✓' : 'Guardar como pieza'}</button>
        ${p ? '' : `<button data-a="otra" style="border:0;background:transparent;cursor:pointer;padding:.4em 0;color:var(--light);display:flex;gap:.6em;align-items:center"><span style="font-size:1.3em">Otra frase</span>${ico('adelante', 'style="width:1.4em;height:1.4em"')}</button>`}
      </div>
      <label class="p-control p-acento" for="demo-reflexion" style="display:block;margin-bottom:1em">Tu reflexión</label>
      <div class="p-campo">
        <textarea id="demo-reflexion" class="p-textarea" rows="3" maxlength="300" placeholder="Algo que quieras recordar de este día.">${esc(S.reflexion)}</textarea>
      </div>
      <div style="margin-top:2em;display:grid;gap:.4em">
        <button class="p-boton" data-a="al-diario"><span>Guardar en mi diario</span>${ico('adelante')}</button>
        <button class="p-enlace" data-a="terminar"><span>Ahora no</span></button>
      </div>
    </div>`;
  };

  V.escuchar = () => `
    <div class="vista con-barra">
      <div class="p-fila" style="margin-bottom:1.6em;min-height:4.8em">
        <span class="p-marca">Escuchar</span>
      </div>
      <div style="display:flex;padding:.4em;border-radius:99em;background:var(--surface-low);margin-bottom:2.2em" role="tablist" aria-label="Sesiones o sonidos">
        ${['Sesiones', 'Sonidos'].map(t => `<button role="tab" aria-selected="${S.escucharTab === t}" data-a="esc-tab" data-v="${t}" style="flex:1;min-height:4.4em;border:0;border-radius:99em;cursor:pointer;font-size:1em;background:${S.escucharTab === t ? 'var(--encendido)' : 'transparent'};color:${S.escucharTab === t ? 'var(--on-encendido)' : 'var(--fg)'}"><span style="font-size:1.4em;font-weight:${S.escucharTab === t ? 600 : 400}">${t}</span></button>`).join('')}
      </div>
      ${S.escucharTab === 'Sesiones' ? `
        <p class="p-section" style="margin-bottom:1.2em">Para esta noche</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.2em">
          ${BIBLIOTECA.map((b, k) => `
            <button data-a="biblioteca" data-v="${k}" style="border:0;background:transparent;padding:0;cursor:pointer;text-align:left;color:var(--fg);display:grid;gap:.8em">
              <span class="p-portada" style="background-image:url(${portadaUrl(b.portada)})"></span>
              <span style="font-size:1.5em;line-height:1.3">${b.titulo}</span>
              <span class="p-meta">${b.min} min · ${temaDe(b.cat).label}</span>
            </button>`).join('')}
        </div>
        <p class="p-meta p-centro" style="margin-top:2em">Escuchar de la biblioteca no gasta crédito.</p>` : `
        <div class="p-card" style="padding:.6em 2em">${filasSonido()}</div>
        <p class="p-meta" style="margin-top:1.6em">Toca para encenderlos y mézclalos a tu gusto. No consumen créditos. Aquí se generan en tu navegador; en la app hay catorce.</p>`}
    </div>${tabbar()}`;

  V.camino = () => {
    const d = S.diario;
    if (!d) {
      return `
      <div class="vista con-barra">
        <div class="p-fila" style="margin-bottom:1.6em;min-height:4.8em"><span class="p-marca">Mi camino</span></div>
        <p class="p-title" style="margin-bottom:1em">Aquí se irá quedando tu camino.</p>
        <p class="p-body" style="margin-bottom:2.2em">Cuando escuches tu primera sesión, aparecerán aquí los audios, las frases que decidas guardar y los días en que te hiciste un hueco. Tu diario no necesita esperar a nada.</p>
        <div style="display:grid;place-items:center;margin-bottom:2.4em">
          <div style="width:19em;height:19em;border-radius:9.5em;background:var(--arte-primera-luz) center / cover;box-shadow:inset 0 0 0 1px var(--selection-border), 0 1.4em 3.4em -1.4em var(--shadow)"></div>
        </div>
        <button class="p-boton" data-a="tab" data-v="hoy" style="margin-bottom:1em"><span>Crear mi primera sesión</span>${ico('adelante')}</button>
        <button class="p-boton secundario" data-a="tab" data-v="escuchar"><span>Explorar la biblioteca</span></button>
        <p class="p-meta p-centro" style="margin-top:1.4em">Escuchar de la biblioteca no gasta crédito.</p>
      </div>${tabbar()}`;
    }
    const animo = ANIMOS.find(a => a.key === d.animo);
    const bloque = (titulo, cuerpo) => `<div style="display:grid;gap:.6em;padding:1.6em 0;border-top:1px solid var(--separator)"><p class="p-eyebrow" style="color:var(--secondary)">${titulo}</p>${cuerpo}</div>`;
    return `
      <div class="vista con-barra">
        <div class="p-fila" style="margin-bottom:1.6em;min-height:4.8em"><span class="p-marca">Mi camino</span></div>
        <p class="p-hero" style="margin-bottom:2em">Esta semana volviste <span class="p-acento">1 día</span>.</p>
        <div class="p-card">
          <p class="p-meta" style="margin-bottom:.4em">${hoyLargo()}</p>
          <p class="p-section" style="margin-bottom:1em">Tu diario de hoy</p>
          ${d.notas.length ? bloque('Lo que traías', d.notas.map(x => `<p class="p-body">${esc(x.texto)}</p>`).join('')) : ''}
          ${bloque('Lo que escuchaste', `<p class="p-control">${esc(d.titulo)}</p><p class="p-meta">${d.min} min · Voz ${d.voz}</p>`)}
          ${animo ? bloque('Cómo te fuiste', `<p class="p-control" style="display:flex;align-items:center;gap:.6em"><i style="width:1em;height:1em;border-radius:50%;background:var(--selection);display:inline-block"></i>${animo.label}</p>`) : ''}
          ${d.pieza ? bloque('Una idea para llevarte', `<p class="p-body">${esc(d.pieza)}</p>`) : ''}
          ${d.reflexion ? bloque('Tu reflexión', `<p class="p-body">${esc(d.reflexion)}</p><p class="p-meta">Solo tú ves tu diario. No se usa para crear sesiones.</p>`) : ''}
        </div>
        <p class="p-meta" style="margin-top:1.4em">Cada sesión escribe una página. No hay que llenar nada: se compone con lo que ya hiciste.</p>
      </div>${tabbar()}`;
  };

  function filasSonido() {
    return Sonido.NOMBRES.map(n => {
      const capa = S.sonidos.find(x => x.n === n);
      const on = !!capa;
      return `
        <div class="p-sonido">
          ${ico(ICONO_SONIDO[n])}
          <span class="nombre">${n}</span>
          <button class="p-toggle ${on ? 'on' : ''}" data-a="sonido" data-v="${n}" role="switch" aria-checked="${on}" aria-label="${n}"></button>
          <input type="range" min="0" max="100" value="${Math.round((capa ? capa.v : 0.6) * 100)}" data-nivel="${n}" aria-label="Volumen de ${n}" ${on ? '' : 'disabled'}>
        </div>`;
    }).join('');
  }

  // ── capas: hojas y diálogos ──

  const CAPAS = {
    sonido: () => `
      <div class="p-hoja" role="dialog" aria-modal="true" aria-label="Sonidos">
        <div class="asa"></div>
        <p class="p-section" style="margin-bottom:.4em">Sonidos</p>
        <p class="p-meta" style="margin-bottom:1em">${S.vista === 'player'
          ? 'Los cambios entran con un fundido de dos segundos: nunca cortan la voz.'
          : 'Estos sonidos acompañarán a la sesión. Podrás cambiarlos mientras la escuchas.'}</p>
        ${Sonido.disponible() ? filasSonido() : '<p class="p-body">Este navegador no puede reproducir los sonidos de la demo.</p>'}
        <button class="p-boton" data-a="cerrar-capa" style="margin-top:1.6em"><span>Listo</span></button>
      </div>`,
    voz: () => `
      <div class="p-hoja" role="dialog" aria-modal="true" aria-label="Voz">
        <div class="asa"></div>
        <p class="p-section" style="margin-bottom:1.4em">Voz</p>
        <div style="display:grid;gap:.8em">
          ${VOCES.map(v => `
            <button class="p-opcion ${S.voz === v.name ? 'on' : ''}" data-a="voz" data-v="${v.name}" style="min-height:6.4em" aria-pressed="${S.voz === v.name}">
              <span class="txt"><span class="p-control">${v.name}</span><span class="p-meta">${v.desc}</span></span>
              <span class="p-radio"></span>
            </button>`).join('')}
        </div>
        <p class="p-meta" style="margin-top:1.4em">Voces sintéticas. En la demo no suenan.</p>
        <button class="p-boton" data-a="cerrar-capa" style="margin-top:1.6em"><span>Listo</span></button>
      </div>`,
    timer: () => `
      <div class="p-hoja" role="dialog" aria-modal="true" aria-label="Temporizador">
        <div class="asa"></div>
        <p class="p-section" style="margin-bottom:1.4em">Temporizador</p>
        <div style="display:grid;gap:.8em">
          ${TIMERS.map(t => `
            <button class="p-opcion ${S.sleep === t.m ? 'on' : ''}" data-a="sleep" data-v="${t.m}" style="min-height:5.6em" aria-pressed="${S.sleep === t.m}">
              <span class="txt"><span class="p-control">${t.label}</span></span><span class="p-radio"></span>
            </button>`).join('')}
        </div>
        <p class="p-meta p-centro" style="margin:1.6em 0 1.8em">El sonido bajará suavemente durante el último medio minuto.</p>
        <button class="p-boton" data-a="cerrar-capa"><span>Aplicar temporizador</span></button>
      </div>`,
    fe: () => `
      <div class="p-dialogo" role="alertdialog" aria-modal="true" aria-labelledby="dlg-fe">
        <p class="p-section p-centro" id="dlg-fe" style="margin-bottom:.6em">¿Incluir referencias de fe?</p>
        <p class="p-body p-centro" style="margin-bottom:2.2em">Para elegir un pasaje hace falta tu permiso para usar referencias religiosas. Es una decisión aparte del interruptor de esta sesión, y puedes retirarla cuando quieras en Privacidad.</p>
        <button class="p-boton" data-a="fe-si"><span>Sí, con Reina-Valera 1909</span></button>
        <button class="p-boton secundario" data-a="cerrar-capa" style="margin-top:1em"><span>Ahora no</span></button>
      </div>`,
  };

  // ── pintar ──

  let avisoT = null;
  function aviso(texto, ms = 4200) {
    clearTimeout(avisoT);
    $('.p-aviso', pantallaEl)?.remove();
    const d = document.createElement('div');
    d.className = 'p-aviso';
    d.setAttribute('role', 'status');
    d.innerHTML = `<p class="p-meta" style="color:var(--fg)">${texto}</p>`;
    pantallaEl.appendChild(d);
    avisoT = setTimeout(() => d.remove(), ms);
  }

  function pintarPasos() {
    const p = PASO[S.vista];
    $$('#pasos .paso').forEach((li, k) => {
      if (k === p) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
  }

  const NOMBRE_VISTA = {
    hoy: 'Hoy', intencion: 'Elegir un tema', generar: 'Tu sesión', pasaje: 'Tu Palabra bíblica',
    progreso: 'Preparando tu sesión', riesgo: 'Hoy no', player: 'Reproductor', cierre: 'Al terminar',
    escuchar: 'Escuchar', camino: 'Mi camino',
  };

  function pintar(enfocar) {
    const anterior = vistaEl.dataset.vista;
    vistaEl.innerHTML = V[S.vista]();
    vistaEl.dataset.vista = S.vista;
    pintarCapa();
    pintarPasos();
    if (anterior !== S.vista) {
      $('#demo-anuncio').textContent = `Pantalla: ${NOMBRE_VISTA[S.vista]}`;
      const v = $('.vista', vistaEl);
      if (v && reducido()) v.style.animation = 'none';
    }
    if (enfocar) $(enfocar, vistaEl)?.focus({ preventScroll: true });
    if (S.vista === 'player' && S.texto) $('#lineas .actual')?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }

  function pintarCapa() {
    if (!S.capa) { capasEl.innerHTML = ''; return; }
    capasEl.innerHTML = `<div class="p-velo" data-a="cerrar-capa"></div>${CAPAS[S.capa]()}`;
    $('.p-hoja button, .p-dialogo button', capasEl)?.focus({ preventScroll: true });
  }

  function ir(v, { apilar = true } = {}) {
    if (apilar && S.vista !== v) S.pila.push(S.vista);
    if (S.vista === 'escuchar' && v !== 'escuchar' && !respirando) Sonido.apagarTodo();
    S.vista = v;
    S.capa = null;
    if (v !== 'player') { S.texto = false; pausar(); }
    pintar();
    vistaEl.scrollTop = 0;
  }
  function atras() {
    const v = S.pila.pop() || 'hoy';
    ir(v, { apilar: false });
  }

  // ── acciones ──

  function guardarNota(texto) {
    const t = texto.trim();
    if (!t) return;
    S.notas.push({ id: `n${Date.now()}${Math.random().toString(36).slice(2, 5)}`, texto: t.slice(0, 500), hora: ahora() });
    S.origen = 'dia';
  }

  function crear() {
    const desde = S.origen === 'dia' ? S.notas : S.notas.filter(x => x.id === S.origen);
    if (desde.some(x => RIESGO.test(normal(x.texto)))) {
      S.pila = ['hoy'];
      ir('riesgo', { apilar: false });
      return;
    }
    const tema = temaDe(S.cat);
    S.lista = null;
    S.sesion = {
      titulo: tema.titulo, cat: S.cat, voz: S.voz, total: S.dur * 60,
      palabra: S.biblia ? palabraDe(S.cat) : null, escuchada: false,
    };
    S.prog = 0;
    S.preparando = true;
    S.pila = ['hoy'];
    ir('progreso', { apilar: false });
    simularPreparacion();
  }

  let progT = null;
  function simularPreparacion() {
    clearInterval(progT);
    const paso = reducido() ? 12 : 2.2;
    progT = setInterval(() => {
      S.prog = Math.min(100, S.prog + paso * (0.6 + Math.random() * 0.8));
      if (S.prog >= 100) {
        clearInterval(progT);
        S.preparando = false;
        S.lista = true;
        S.pos = 0;
      }
      if (S.vista === 'progreso') {
        const b = $('#prog-barra');
        if (b) {
          $('.lleno', b).style.width = `${S.prog}%`;
          $('.luz', b).style.left = `${S.prog}%`;
          b.setAttribute('aria-valuenow', Math.round(S.prog));
          $('#prog-fase').textContent = fase();
          if (S.prog >= 100) $('#prog-boton').innerHTML = '<button class="p-boton" data-a="escuchar-lista"><span>Escuchar la sesión</span></button>';
        }
      } else if (S.vista === 'hoy') {
        if (S.prog >= 100) pintar();
        else { const f = $('#hoy-fase'); if (f) f.textContent = fase(); }
      }
    }, 160);
  }

  // Reproducción simulada: avanza el reloj y la frase, y deja sonar las capas.
  let playT = null;
  let ultimo = 0;
  function reproducir() {
    if (!S.sesion) return;
    if (S.pos >= S.sesion.total) S.pos = 0;
    S.play = true;
    S.sesion.escuchada = true;
    S.inicioSleep = S.pos;
    S.sonidos.forEach(x => Sonido.encender(x.n, x.v));
    ultimo = performance.now();
    clearInterval(playT);
    playT = setInterval(tic, 200);
    if (!S.avisado) {
      S.avisado = true;
      aviso(S.sonidos.length
        ? 'La demo no lleva voz: el guion avanza en pantalla y suenan los sonidos de fondo.'
        : 'La demo no lleva voz. Prueba a encender un sonido con «Sonido».');
    }
  }
  function pausar() {
    if (!S.play) return;
    S.play = false;
    clearInterval(playT);
    Sonido.apagarTodo();
  }
  function tic() {
    const t = performance.now();
    const dt = ((t - ultimo) / 1000) * VEL;
    ultimo = t;
    S.pos = Math.min(S.sesion.total, S.pos + dt);
    const transcurrido = S.pos - S.inicioSleep;
    const fin = S.pos >= S.sesion.total || (S.sleep > 0 && transcurrido >= S.sleep * 60);
    if (fin) {
      pausar();
      if (S.vista === 'player') {
        if (S.pos >= S.sesion.total) { setTimeout(() => { if (S.vista === 'player') ir('cierre'); }, 900); }
        pintar();
      }
      return;
    }
    if (S.vista !== 'player') return;
    actualizarReproductor();
  }
  function actualizarReproductor() {
    const { l, i } = lineaActual();
    const pct = (S.pos / S.sesion.total) * 100;
    const barra = $('#barra');
    if (barra) {
      $('.lleno', barra).style.width = `${pct}%`;
      $('.luz', barra).style.left = `${pct}%`;
      barra.setAttribute('aria-valuenow', Math.round(S.pos));
      barra.setAttribute('aria-valuetext', `${mmss(S.pos)} de ${mmss(S.sesion.total)}`);
      $('#t-pos').textContent = mmss(S.pos);
    }
    const frase = $('#frase');
    if (frase && frase.textContent !== l[i].text) frase.textContent = l[i].text;
    const lin = $$('#lineas button');
    if (lin.length) {
      lin.forEach((b, k) => b.classList.toggle('actual', k === i));
      if (!lin[i].dataset.visto) { lin.forEach(b => delete b.dataset.visto); lin[i].dataset.visto = '1'; lin[i].scrollIntoView({ block: 'center', behavior: reducido() ? 'auto' : 'smooth' }); }
    }
  }

  function prepararDemo(paso) {
    // Los pasos de la izquierda llevan a cada pantalla con un ejemplo listo.
    if (paso >= 1 && !S.notas.length) guardarNota('Mañana tengo una entrevista y no paro de darle vueltas.');
    if (paso >= 3 && !S.sesion) {
      S.sesion = { titulo: temaDe(S.cat).titulo, cat: S.cat, voz: S.voz, total: S.dur * 60, palabra: S.biblia ? palabraDe(S.cat) : null, escuchada: false };
      S.prog = 100; S.lista = true; S.preparando = false;
    }
    if (paso === 0) { S.pila = []; ir('hoy', { apilar: false }); setTimeout(() => $('#demo-nota')?.focus({ preventScroll: true }), 60); }
    if (paso === 1) { S.pila = ['hoy']; ir('generar', { apilar: false }); }
    if (paso === 2) { S.pila = ['hoy']; S.origen = 'dia'; crear(); }
    if (paso === 3) { S.pila = ['hoy']; ir('player', { apilar: false }); }
    if (paso === 4) { S.pila = ['hoy']; ir('cierre', { apilar: false }); }
  }

  const ACCIONES = {
    atras,
    ir: el => ir(el.dataset.v),
    tab: el => { S.pila = []; ir(el.dataset.v, { apilar: false }); },
    'guardar-nota': () => {
      const ta = $('#demo-nota');
      guardarNota(ta ? ta.value : S.borrador);
      S.borrador = '';
      pintar('#demo-nota');
    },
    preparar: () => { S.origen = 'dia'; ir('generar'); },
    desde: el => { S.origen = el.dataset.id; ir('generar'); },
    cat: el => { S.cat = el.dataset.v; pintar(); },
    mas: () => { S.mas = !S.mas; pintar(); },
    origen: el => { S.origen = el.dataset.v; pintar(); },
    biblia: () => {
      if (S.biblia) { S.biblia = false; pintar(); return; }
      if (!S.fe) { S.capa = 'fe'; pintarCapa(); return; }
      S.biblia = true; pintar();
    },
    'fe-si': () => { S.fe = true; S.biblia = true; S.capa = null; pintar(); },
    dur: el => { S.dur = Number(el.dataset.v); pintar(); },
    capa: el => { S.capa = el.dataset.v; pintarCapa(); },
    'cerrar-capa': () => {
      const era = S.capa;
      S.capa = null;
      // Los sonidos que se probaron en la hoja callan al cerrarla, salvo que
      // la sesión esté sonando o se esté en Escuchar.
      if (era === 'sonido' && !S.play && S.vista !== 'escuchar') Sonido.apagarTodo();
      pintar();
    },
    voz: el => { S.voz = el.dataset.v; pintarCapa(); },
    sleep: el => { S.sleep = Number(el.dataset.v); S.inicioSleep = S.pos; pintarCapa(); },
    sonido: el => {
      const n = el.dataset.v;
      const i = S.sonidos.findIndex(x => x.n === n);
      if (i >= 0) { S.sonidos.splice(i, 1); Sonido.apagar(n); }
      else { S.sonidos.push({ n, v: 0.6 }); Sonido.encender(n, 0.6); }
      const on = i < 0;
      el.classList.toggle('on', on);
      el.setAttribute('aria-checked', String(on));
      const r = el.parentElement.querySelector('input[type="range"]');
      if (r) { r.disabled = !on; if (on) r.value = 60; }
    },
    crear: () => {
      if (S.biblia) { ir('pasaje'); return; }
      crear();
    },
    'crear-ya': () => crear(),
    'a-hoy': () => { S.pila = []; ir('hoy', { apilar: false }); },
    'escuchar-lista': () => { S.pila = ['hoy']; S.pos = 0; ir('player', { apilar: false }); reproducir(); pintar(); },
    play: () => { if (S.play) pausar(); else reproducir(); pintar(); },
    seek: el => {
      S.pos = Math.max(0, Math.min(S.sesion.total - 1, S.pos + Number(el.dataset.v) * 1));
      actualizarReproductor();
    },
    saltar: el => { S.pos = Number(el.dataset.v); actualizarReproductor(); if (!S.play) pintar(); },
    'texto-dentro': () => { S.texto = true; pintar(); },
    'texto-fuera': () => { S.texto = false; pintar(); },
    'cerrar-sesion': () => { pausar(); S.animo = null; S.pieza = false; S.idea = 0; S.reflexion = ''; ir('cierre'); },
    animo: el => { S.animo = S.animo === el.dataset.v ? null : el.dataset.v; pintar(); },
    pieza: () => { S.pieza = !S.pieza; pintar(); },
    otra: () => { S.idea++; S.pieza = false; pintar(); },
    'al-diario': () => {
      const ta = $('#demo-reflexion');
      S.reflexion = ta ? ta.value.trim() : S.reflexion;
      const candidatas = GUION.slice(1, 5).map(g => g.text);
      const ses = S.sesion || { titulo: 'Tu pausa', total: 600, voz: S.voz };
      S.diario = {
        notas: S.notas.slice(), titulo: ses.titulo, min: Math.round(ses.total / 60), voz: ses.voz,
        animo: S.animo, reflexion: S.reflexion,
        pieza: S.pieza ? (ses.palabra ? `“${ses.palabra.text}” ${ses.palabra.ref}` : candidatas[S.idea % candidatas.length]) : null,
      };
      S.pila = [];
      ir('camino', { apilar: false });
      aviso('Guardado en tu diario. Solo tú lo ves.');
    },
    terminar: () => { S.pila = []; ir('hoy', { apilar: false }); },
    'esc-tab': el => { S.escucharTab = el.dataset.v; if (el.dataset.v !== 'Sonidos') Sonido.apagarTodo(); pintar(); },
    biblioteca: el => {
      const b = BIBLIOTECA[Number(el.dataset.v)];
      Sonido.apagarTodo();
      S.sesion = { titulo: b.titulo, cat: b.cat, voz: 'Ruth', total: b.min * 60, palabra: null, escuchada: false };
      S.pos = 0;
      S.pila = ['escuchar'];
      ir('player', { apilar: false });
      reproducir();
      pintar();
    },
  };

  pantallaEl.addEventListener('click', e => {
    const el = e.target.closest('[data-a]');
    if (!el || !pantallaEl.contains(el) || el.disabled) return;
    const f = ACCIONES[el.dataset.a];
    if (f) { e.preventDefault(); f(el); }
  });

  pantallaEl.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'demo-nota') {
      S.borrador = t.value;
      const b = $('#btn-guardar-nota');
      if (b) b.disabled = !t.value.trim();
    } else if (t.id === 'demo-reflexion') {
      S.reflexion = t.value;
    } else if (t.dataset.nivel) {
      const capa = S.sonidos.find(x => x.n === t.dataset.nivel);
      if (capa) { capa.v = t.value / 100; Sonido.nivel(capa.n, capa.v); }
    }
  });

  pantallaEl.addEventListener('keydown', e => {
    if (e.target.id === 'demo-nota' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ACCIONES['guardar-nota']();
    }
    if (e.key === 'Escape' && S.capa) { e.preventDefault(); ACCIONES['cerrar-capa'](); }
    if (e.target.id === 'barra' && S.sesion && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      S.pos = Math.max(0, Math.min(S.sesion.total - 1, S.pos + (e.key === 'ArrowRight' ? 15 : -15)));
      actualizarReproductor();
    }
  });

  // Tocar la barra de tiempo para saltar.
  pantallaEl.addEventListener('pointerdown', e => {
    const b = e.target.closest('#barra');
    if (!b || !S.sesion) return;
    const r = b.getBoundingClientRect();
    S.pos = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (S.sesion.total - 1);
    actualizarReproductor();
  });

  /** Lleva el móvil a la vista si no se ve entero, sin mover si ya se ve. */
  function mostrarMovil() {
    const r = pantallaEl.getBoundingClientRect();
    if (r.top < 60 || r.bottom > window.innerHeight) {
      pantallaEl.scrollIntoView({ behavior: reducido() ? 'auto' : 'smooth', block: 'center' });
    }
  }

  // Pasos, sugerencias y temas, desde fuera del móvil.
  $$('#pasos [data-paso]').forEach(b => b.addEventListener('click', () => { prepararDemo(Number(b.dataset.paso)); mostrarMovil(); }));
  $$('[data-sugerencia]').forEach(b => b.addEventListener('click', () => {
    guardarNota(b.dataset.sugerencia);
    S.pila = [];
    ir('hoy', { apilar: false });
    const v = $('.vista', vistaEl);
    const d = $('.p-destacada', vistaEl);
    if (v && d) v.scrollTop = d.offsetTop - 40;
    mostrarMovil();
  }));
  $$('#lista-temas [data-tema]').forEach(b => b.addEventListener('click', () => {
    S.cat = b.dataset.tema;
    S.pila = ['hoy', 'intencion'];
    ir('generar', { apilar: false });
    $('#pruebala').scrollIntoView({ behavior: reducido() ? 'auto' : 'smooth', block: 'start' });
  }));

  // La hora del móvil es la tuya.
  const reloj = () => { const h = $('#demo-hora'); if (h) h.textContent = ahora().replace(/^0/, ''); };
  reloj();
  setInterval(reloj, 15000);

  // Las portadas de Escuchar dependen del tema.
  new MutationObserver(() => { if (S.vista === 'escuchar') pintar(); })
    .observe(raiz, { attributes: true, attributeFilter: ['data-theme'] });

  // Si el móvil sale de la vista, la demo deja de sonar.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting && !respirando && (S.play || S.sonidos.some(x => Sonido.suena(x.n)))) {
        pausar(); Sonido.apagarTodo();
        if (S.vista === 'player' || S.vista === 'escuchar') pintar();
      }
    }), { threshold: 0.15 }).observe(pantallaEl);
  }

  pintar();

  // ── 4a. Salmos ──────────────────────────────────────────────────────────

  const listaSalmos = $('#salmos-lista');
  if (listaSalmos && window.SALMOS) {
    let actual = 0;
    const pintarSalmo = () => {
      const s = window.SALMOS[actual];
      $('#lector-titulo').textContent = `${s.ref} · ${s.titulo}`;
      $('#lector-sub').textContent = s.sub;
      $('#lector-texto').innerHTML = s.v.map((t, i) => `<p><sup>${i + 1}</sup>${esc(t)}</p>`).join('');
      $('#lector-texto').scrollTop = 0;
      $$('.salmo-btn', listaSalmos).forEach((b, i) => b.setAttribute('aria-pressed', String(i === actual)));
    };
    listaSalmos.innerHTML = window.SALMOS.map((s, i) => `
      <button class="salmo-btn" type="button" data-i="${i}" aria-pressed="false">
        <span class="txt"><b>${esc(s.titulo)}</b><span>${esc(s.sub)}</span></span>
        <span class="ref">${s.ref.replace('Salmo ', 'Sal ')}</span>
      </button>`).join('');
    listaSalmos.addEventListener('click', e => {
      const b = e.target.closest('.salmo-btn');
      if (!b) return;
      actual = Number(b.dataset.i);
      pintarSalmo();
      if (window.matchMedia('(max-width: 860px)').matches) $('#lector').scrollIntoView({ behavior: reducido() ? 'auto' : 'smooth', block: 'start' });
    });
    pintarSalmo();
  }

  // ── 4b. Un minuto ───────────────────────────────────────────────────────

  const boton = $('#respira-boton');
  if (boton) {
    const luz = $('#respira-luz');
    const faseEl = $('#respira-fase');
    const cuenta = $('#respira-cuenta');
    const olas = $('#respira-olas');
    const VECES = 6;
    let t = null;
    let activo = false;

    const reposo = () => {
      luz.style.transitionDuration = '1.2s';
      luz.style.transform = 'translate(-50%, -50%) scale(.55)';
      luz.style.opacity = '.55';
    };
    const parar = (texto = 'Cuando quieras.') => {
      activo = false;
      respirando = false;
      clearTimeout(t);
      boton.textContent = 'Empezar';
      faseEl.textContent = texto;
      cuenta.textContent = 'Cuatro segundos para tomar aire, seis para soltarlo.';
      reposo();
      Sonido.apagar('Olas');
    };
    const respiracion = n => {
      if (!activo) return;
      if (n > VECES) { parar('Bien. Vuelve cuando quieras.'); return; }
      cuenta.textContent = `Respiración ${n} de ${VECES}`;
      faseEl.textContent = 'Toma aire';
      luz.style.transitionDuration = '4s';
      luz.style.transform = 'translate(-50%, -50%) scale(1.25)';
      luz.style.opacity = '1';
      t = setTimeout(() => {
        if (!activo) return;
        faseEl.textContent = 'Suéltalo despacio';
        luz.style.transitionDuration = '6s';
        luz.style.transform = 'translate(-50%, -50%) scale(.55)';
        luz.style.opacity = '.5';
        t = setTimeout(() => respiracion(n + 1), 6000);
      }, 4000);
    };
    boton.addEventListener('click', () => {
      if (activo) { parar(); return; }
      activo = true;
      respirando = true;
      boton.textContent = 'Parar';
      if (olas.checked) Sonido.encender('Olas', 0.55);
      respiracion(1);
    });
    olas.addEventListener('change', () => {
      if (!activo) return;
      if (olas.checked) Sonido.encender('Olas', 0.55); else Sonido.apagar('Olas');
    });
    reposo();
  }
})();
