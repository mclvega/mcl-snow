import './styles.css';

import { app } from './app';
import { audio } from './audio';
import { ARMAS, ORDEN_ARMAS, type Arma } from './core/armas';
import { MODOS } from './core/difficulty';
import { Entrada } from './core/input';
import { iniciarBucle } from './core/loop';
import { iniciarPantallaCompleta } from './fullscreen';
import { controlesVacios, Partida } from './game/logica';
import { Render3D } from './game/render3d';
import { agregarRecord, limpiarNombre } from './storage';
import { panelConfiguracion } from './ui/configuracion';
import { boton, h, mostrarPanel } from './ui/dom';
import { pantallaPersonaje } from './ui/personaje';

const hud = document.getElementById('lienzo') as HTMLCanvasElement;
const ctx = hud.getContext('2d')!;
const lienzo3d = document.createElement('canvas');
lienzo3d.id = 'lienzo3d';
hud.before(lienzo3d);
const controles = document.getElementById('controles')!;
const entrada = new Entrada(
  [
    { nombre: 'arma', teclas: ['KeyQ'], mando: 3, etiqueta: '🔄' },
    { nombre: 'recargar', teclas: ['KeyR'], mando: 2, etiqueta: 'R' },
    { nombre: 'mira', teclas: ['KeyE'], mando: 4, etiqueta: '🔭' },
    { nombre: 'saltar', teclas: ['Space'], mando: 0, etiqueta: '⤒' },
    { nombre: 'disparar', teclas: [], mando: 7, etiqueta: '🔫' },
  ],
  controles,
);
const tactil = matchMedia('(pointer: coarse)').matches;
if (tactil) document.body.classList.add('tactil');

let partida: Partida | null = null;
let render: Render3D | null = null;

iniciarPantallaCompleta(() => app.g.config.pantallaCompleta);
app.aplicarConfig();

/* ---------- Tamaño ---------- */

let ancho = innerWidth;
let alto = innerHeight;
function ajustar() {
  ancho = innerWidth;
  alto = innerHeight;
  const dpr = Math.min(2, devicePixelRatio || 1);
  for (const c of [hud, lienzo3d]) {
    c.style.width = `${ancho}px`;
    c.style.height = `${alto}px`;
  }
  hud.width = Math.round(ancho * dpr);
  hud.height = Math.round(alto * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render?.ajustar(ancho, alto, Math.min(dpr, 1.5));
}
addEventListener('resize', ajustar);
ajustar();

/* ---------- Mirar: ratón (con el puntero bloqueado) o arrastrando en la mitad derecha ---------- */

let giroX = 0;
let giroY = 0;
let raton = false;
let zoomPendiente = false;
let armaPendiente: Arma | 'siguiente' | null = null;
const sensibilidad = () => app.g.config.sensibilidad / 5;

addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== lienzo3d) return;
  giroX += e.movementX * 0.0022 * sensibilidad();
  giroY += e.movementY * 0.0022 * sensibilidad();
});
lienzo3d.addEventListener('mousedown', (e) => {
  if (!partida || tactil) return;
  if (document.pointerLockElement !== lienzo3d) {
    void lienzo3d.requestPointerLock();
    return;
  }
  if (e.button === 0) raton = true;
  if (e.button === 2) zoomPendiente = true;
});
addEventListener('mouseup', (e) => e.button === 0 && (raton = false));
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => partida && (armaPendiente = 'siguiente') && e.preventDefault(), { passive: false });
addEventListener('keydown', (e) => {
  const arma = ORDEN_ARMAS.find((a) => ARMAS[a].tecla === e.key);
  if (arma) armaPendiente = arma;
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== lienzo3d && partida && !partida.terminada && !partida.pausada && !tactil) pausar();
});

const zonaMirar = h('div', { class: 'zona-mirar' });
controles.prepend(zonaMirar);
let toqueMirar = { id: -1, x: 0, y: 0 };
zonaMirar.addEventListener('pointerdown', (e) => {
  zonaMirar.setPointerCapture(e.pointerId);
  toqueMirar = { id: e.pointerId, x: e.clientX, y: e.clientY };
});
zonaMirar.addEventListener('pointermove', (e) => {
  if (e.pointerId !== toqueMirar.id) return;
  giroX += (e.clientX - toqueMirar.x) * 0.0055 * sensibilidad();
  giroY += (e.clientY - toqueMirar.y) * 0.0055 * sensibilidad();
  toqueMirar.x = e.clientX;
  toqueMirar.y = e.clientY;
});
const soltarMirar = (e: PointerEvent) => e.pointerId === toqueMirar.id && (toqueMirar.id = -1);
zonaMirar.addEventListener('pointerup', soltarMirar);
zonaMirar.addEventListener('pointercancel', soltarMirar);

document.body.append(h('button', { type: 'button', class: 'boton-pausa', 'aria-label': 'Pausa', text: '⏸', onclick: () => pausar() }));

/* ---------- Pantallas ---------- */

function jugando(si: boolean) {
  document.body.classList.toggle('jugando', si);
  if (!si) {
    entrada.limpiar();
    raton = false;
    if (document.pointerLockElement) document.exitPointerLock();
  } else if (!tactil) {
    void lienzo3d.requestPointerLock?.();
  }
}

const AYUDA = tactil
  ? 'Joystick izquierdo para moverte y arrastra a la derecha para mirar. 🔫 dispara, ⤒ salta, R recarga, 🔄 cambia de arma y 🔭 apunta con la AWP.'
  : 'WASD para moverte, ratón para mirar y clic para disparar. Clic derecho: mira de la AWP. Espacio salta, R recarga, Q o la rueda cambian de arma (1 a 4 para elegir). Esc pausa.';

function bienvenida() {
  jugando(false);
  const campo = h('input', { type: 'text', maxlength: '20', placeholder: 'Tu nombre', 'aria-label': 'Tu nombre' }) as HTMLInputElement;
  const error = h('p', { class: 'error-campo', 'aria-live': 'polite' });
  const seguir = () => {
    const nombre = limpiarNombre(campo.value);
    if (!nombre) {
      error.textContent = 'Escribe tu nombre (hasta 20 caracteres).';
      return;
    }
    app.g.nombre = nombre;
    app.guardar();
    menu();
  };
  campo.addEventListener('keydown', (e) => e.key === 'Enter' && seguir());
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('h1', { text: '❄️ McL Snow' }),
      h('p', { class: 'texto-suave', text: 'Combate por equipos en un mapa nevado, como fy_snow. Las rondas no se acaban y cada vez hay más enemigos.' }),
      campo,
      error,
      boton('Empezar', seguir, { variante: 'primario' }),
    ),
  );
  campo.focus();
}

function menu() {
  jugando(false);
  partida = null;
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('h1', { text: '❄️ McL Snow' }),
      h('p', { class: 'texto-suave', text: `¡Hola, ${app.nombre()}! · Mejor: ${app.g.records[0]?.rondas ?? 0} rondas` }),
      boton('Jugar', jugar, { variante: 'primario', icono: '▶' }),
      boton(`Dificultad: ${MODOS[app.g.config.dificultad].nombre}`, () => configuracion(), { icono: '🎯' }),
      boton('Personaje', () => pantallaPersonaje(menu), { icono: '👕' }),
      boton('Récords', records, { icono: '🏆' }),
      boton('Configuración', () => configuracion(), { icono: '⚙️' }),
      h('p', { class: 'texto-suave ayuda-texto', text: AYUDA }),
    ),
  );
}

function configuracion(volver: () => void = menu, enJuego = false) {
  mostrarPanel(
    h('div', { class: 'tarjeta ancha' },
      h('div', { class: 'cabecera' }, boton('Volver', () => volver(), { icono: '←' }), h('h2', { text: '⚙️ Configuración' })),
      panelConfiguracion({ enJuego, alReiniciar: () => (app.g.nombre ? configuracion(volver, enJuego) : bienvenida()) }),
    ),
  );
}

function records() {
  const filas = app.g.records.length
    ? app.g.records.map((r, i) => h('div', { class: 'fila-mejora' }, h('span', { text: `${i + 1}. ${r.nombre}` }), h('span', { text: `${r.rondas} rondas · ${r.bajas} bajas` })))
    : [h('p', { class: 'texto-suave', text: 'Aún no hay récords. ¡Juega una partida!' })];
  mostrarPanel(h('div', { class: 'tarjeta' }, h('h2', { text: '🏆 Récords' }), ...filas, boton('Volver', menu, { icono: '←' })));
}

let marcaAcierto = 0;
let marcaCabeza = false;
let marcaDano = 0;

function jugar() {
  audio.iniciar();
  partida = new Partida(
    () => MODOS[app.g.config.dificultad],
    {
      disparo: (s) => {
        if (s.esJugador) audio.efecto('disparo');
        else if (partida && Math.hypot(s.cuerpo.x - partida.jugador.cuerpo.x, s.cuerpo.z - partida.jugador.cuerpo.z) < 25) audio.efecto('disparo');
      },
      acierto: (cabeza) => {
        marcaAcierto = 0.25;
        marcaCabeza = cabeza;
        audio.efecto('golpe');
      },
      golpeRecibido: () => {
        marcaDano = 0.6;
        audio.efecto('dano');
      },
      baja: (a) => a.esJugador && audio.efecto('muerte'),
      finRonda: () => audio.efecto('nivel'),
      fin,
    },
    Date.now(),
    app.nombre(),
  );
  if (!render) {
    render = new Render3D(lienzo3d, partida.bloques);
    ajustar();
  }
  mostrarPanel(null);
  jugando(true);
}

function pausar() {
  if (!partida || partida.terminada || partida.pausada) return;
  partida.pausada = true;
  jugando(false);
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('h2', { text: '⏸ Pausa' }),
      h('p', { class: 'texto-suave', text: `Ronda ${partida.ronda} · Antiterroristas ${partida.marcador.ct} – ${partida.marcador.t} Terroristas · Tus bajas: ${partida.bajas}` }),
      boton('Continuar', continuar, { variante: 'primario', icono: '▶' }),
      boton('Configuración', () => configuracion(volverAPausa, true), { icono: '⚙️' }),
      boton('Salir al menú', () => partida && fin({ rondas: partida.rondasGanadas, bajas: partida.bajas }), { icono: '🚪' }),
    ),
  );
}

function volverAPausa() {
  if (!partida) return menu();
  partida.pausada = false;
  pausar();
}

function continuar() {
  if (!partida) return;
  partida.pausada = false;
  mostrarPanel(null);
  jugando(true);
}

function fin(r: { rondas: number; bajas: number }) {
  if (partida) partida.terminada = true;
  jugando(false);
  const entra = (r.rondas > 0 || r.bajas > 0) && agregarRecord(app.g, { nombre: app.nombre(), rondas: r.rondas, bajas: r.bajas, fecha: new Date().toISOString().slice(0, 10) });
  app.guardar();
  const mejor = entra && app.g.records[0]?.rondas === r.rondas && app.g.records[0]?.bajas === r.bajas;
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('h2', { text: mejor ? '🏆 ¡Nuevo récord!' : 'Fin de la partida' }),
      h('p', { class: 'texto-suave', text: `Ganaste ${r.rondas} rondas con ${r.bajas} bajas.` }),
      boton('Jugar otra vez', jugar, { variante: 'primario', icono: '↻' }),
      boton('Récords', records, { icono: '🏆' }),
      boton('Menú', menu, { icono: '🏠' }),
    ),
  );
}

addEventListener('keydown', (e) => {
  if (e.code === 'KeyP') pausar();
});
document.addEventListener('visibilitychange', () => document.hidden && pausar());

/* ---------- HUD ---------- */

const NOMBRE_EQUIPO = { ct: 'Antiterroristas', t: 'Terroristas' };

function dibujarHud(p: Partida, dt: number) {
  ctx.clearRect(0, 0, ancho, alto);
  const j = p.jugador;
  const cx = ancho / 2;
  const cy = alto / 2;
  marcaAcierto = Math.max(0, marcaAcierto - dt);
  marcaDano = Math.max(0, marcaDano - dt);

  if (marcaDano > 0) {
    const g = ctx.createRadialGradient(cx, cy, Math.min(ancho, alto) * 0.3, cx, cy, Math.max(ancho, alto) * 0.7);
    g.addColorStop(0, 'rgba(200,0,0,0)');
    g.addColorStop(1, `rgba(200,0,0,${marcaDano * 0.6})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ancho, alto);
  }

  if (p.zoom && j.vivo) {
    // Mira telescópica de la AWP.
    const r = Math.min(ancho, alto) * 0.45;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.rect(0, 0, ancho, alto);
    ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();
  } else if (j.vivo) {
    const hueco = 5 + p.retroceso * 300 + (j.moviendose ? 8 : 0);
    ctx.strokeStyle = '#4dff4d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.moveTo(cx + dx * hueco, cy + dy * hueco);
      ctx.lineTo(cx + dx * (hueco + 8), cy + dy * (hueco + 8));
    }
    ctx.stroke();
  }
  if (marcaAcierto > 0) {
    ctx.strokeStyle = marcaCabeza ? '#ff4040' : '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      ctx.moveTo(cx + dx * 6, cy + dy * 6);
      ctx.lineTo(cx + dx * 13, cy + dy * 13);
    }
    ctx.stroke();
  }

  ctx.textBaseline = 'middle';
  const sombra = (texto: string, x: number, y: number, color = '#fff') => {
    ctx.fillStyle = '#000a';
    ctx.fillText(texto, x + 1.5, y + 1.5);
    ctx.fillStyle = color;
    ctx.fillText(texto, x, y);
  };

  // Nombres de los aliados.
  if (render) {
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const s of p.soldados) {
      if (s.esJugador || !s.vivo || s.equipo !== j.equipo) continue;
      const pt = render.proyectar(s.cuerpo.x, s.cuerpo.y + 2.05, s.cuerpo.z, ancho, alto);
      if (pt.visible) sombra(s.nombre, pt.x, pt.y, '#7fd0ff');
    }
  }

  // Marcador, tiempo y ronda.
  ctx.textAlign = 'center';
  ctx.font = 'bold 18px system-ui, sans-serif';
  const seg = Math.max(0, Math.ceil(p.tiempoRonda));
  sombra(`${p.marcador.ct}  ·  ${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}  ·  ${p.marcador.t}`, cx, 22);
  ctx.font = '12px system-ui, sans-serif';
  const vidas = MODOS[app.g.config.dificultad].vidas;
  sombra(`Ronda ${p.ronda} · Rondas que puedes perder: ${'❤'.repeat(Math.max(0, vidas - p.rondasPerdidas))}`, cx, 44);

  // Vida y munición.
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  sombra(`✚ ${Math.ceil(j.vida)}`, 18, alto - 32, j.vida > 30 ? '#ffd27a' : '#ff5a5a');
  ctx.textAlign = 'right';
  const d = ARMAS[j.arma];
  const m = j.municion[j.arma];
  const derecha = tactil ? ancho - 18 : ancho - 18;
  const abajo = tactil ? 70 : alto - 32;
  if (Number.isFinite(d.cargador)) sombra(j.recargando > 0 ? 'Recargando…' : `${m.cargador} | ${m.reserva}`, derecha, abajo, m.cargador === 0 ? '#ff5a5a' : '#ffd27a');
  ctx.font = '13px system-ui, sans-serif';
  sombra(d.nombre, derecha, abajo - 24);

  // Registro de bajas.
  ctx.font = '13px system-ui, sans-serif';
  p.registro.forEach((r, i) => sombra(r.texto, ancho - 18, (tactil ? 100 : 22) + i * 20, r.propio ? '#ffd27a' : '#fff'));

  dibujarRadar(p);

  // Mensajes grandes.
  ctx.textAlign = 'center';
  if (p.entreRondas > 0 && p.ultimoGanador) {
    ctx.font = 'bold 30px system-ui, sans-serif';
    sombra(`Ganan los ${NOMBRE_EQUIPO[p.ultimoGanador]}`, cx, cy - 60, p.ultimoGanador === 'ct' ? '#7fd0ff' : '#ff9a5a');
    ctx.font = '15px system-ui, sans-serif';
    sombra(p.rondasPerdidas >= MODOS[app.g.config.dificultad].vidas ? 'Fin de la partida' : `Siguiente ronda: ${Partida.equipos(p.ronda + 1).enemigos} enemigos`, cx, cy - 28);
  } else if (!j.vivo) {
    ctx.font = 'bold 22px system-ui, sans-serif';
    sombra('Has caído · tus aliados siguen luchando', cx, cy - 60, '#ff9a9a');
  }
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

/** Radar: aliados siempre; enemigos solo si están cerca o acaban de disparar. */
function dibujarRadar(p: Partida) {
  const r = 52;
  const ox = 18 + r;
  const oy = (tactil ? 64 : 18) + r;
  const escala = r / 28;
  const j = p.jugador;
  ctx.fillStyle = '#0008';
  ctx.beginPath();
  ctx.arc(ox, oy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff6';
  ctx.stroke();
  const sin = Math.sin(j.yaw);
  const cos = Math.cos(j.yaw);
  for (const s of p.soldados) {
    if (!s.vivo) continue;
    const enemigo = s.equipo !== j.equipo;
    const dist = Math.hypot(s.cuerpo.x - j.cuerpo.x, s.cuerpo.z - j.cuerpo.z);
    if (enemigo && dist > 10 && s.disparo > 1.2) continue;
    // Arriba del radar es hacia donde miras.
    const dx = s.cuerpo.x - j.cuerpo.x;
    const dz = s.cuerpo.z - j.cuerpo.z;
    let rx = (dx * cos - dz * sin) * escala;
    let ry = (dx * sin + dz * cos) * escala;
    const l = Math.hypot(rx, ry);
    if (l > r - 4) {
      rx = (rx / l) * (r - 4);
      ry = (ry / l) * (r - 4);
    }
    ctx.fillStyle = s.esJugador ? '#fff' : enemigo ? '#ff4a4a' : '#4ab0ff';
    ctx.beginPath();
    ctx.arc(ox + rx, oy + ry, s.esJugador ? 4 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---------- Bucle ---------- */

let fps = 60;
let ultimo = performance.now();
iniciarBucle(
  (dt) => {
    entrada.actualizar();
    if (!partida || partida.pausada) {
      giroX = giroY = 0;
      return;
    }
    const c = controlesVacios();
    c.x = entrada.x;
    c.z = entrada.y;
    c.giroX = giroX;
    c.giroY = giroY;
    giroX = giroY = 0;
    c.disparar = raton || entrada.activo('disparar');
    c.saltar = entrada.activo('saltar');
    c.recargar = entrada.pulsado('recargar');
    c.zoom = zoomPendiente || entrada.pulsado('mira');
    c.arma = armaPendiente ?? (entrada.pulsado('arma') ? 'siguiente' : null);
    c.asistido = tactil && app.g.config.apuntadoAsistido;
    zoomPendiente = false;
    armaPendiente = null;
    if (!c.disparar) partida.soltarGatillo();
    partida.actualizar(dt, c);
  },
  () => {
    const ahora = performance.now();
    const dt = Math.min(0.1, (ahora - ultimo) / 1000);
    fps = fps * 0.9 + (1 / Math.max(0.001, dt)) * 0.1;
    ultimo = ahora;
    if (partida && render) {
      render.dibujar(partida, app.g.look, !app.g.config.animacionesReducidas, dt);
      dibujarHud(partida, dt);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, ancho, alto);
    }
    if (app.g.config.mostrarFps) {
      ctx.fillStyle = '#9f9';
      ctx.font = '11px monospace';
      ctx.fillText(`${Math.round(fps)} FPS`, 8, alto - 8);
    }
  },
);

if (import.meta.env.DEV && location.search.includes('demo')) jugar();
else if (app.g.nombre) menu();
else bienvenida();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
