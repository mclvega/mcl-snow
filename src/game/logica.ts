import type { Modo } from '../core/difficulty';
import { ARMAS, ORDEN_ARMAS, multiplicadorZona, type Arma } from '../core/armas';
import { crearMapa, moverCuerpo, PUNTOS_PATRULLA, rayoCaja, rayoMapa, seVen, spawns, type Bloque, type Cuerpo, type Equipo } from '../core/mapa';
import { crearRng, type Rng } from '../core/rng';

export const ALTURA_OJOS = 1.6;
const VELOCIDAD = 5.2;
/** Da para subir a una caja de 1,2 m, como en CS. */
const SALTO = 7.5;
const DURACION_RONDA = 120;

export interface Controles {
  /** Movimiento relativo a la vista: x = lateral, z = adelante (-1) / atrás (+1). */
  x: number;
  z: number;
  giroX: number;
  giroY: number;
  disparar: boolean;
  saltar: boolean;
  recargar: boolean;
  arma: Arma | 'siguiente' | null;
  zoom: boolean;
  /** Ayuda de apuntado (pantallas táctiles). */
  asistido: boolean;
}

export const controlesVacios = (): Controles => ({ x: 0, z: 0, giroX: 0, giroY: 0, disparar: false, saltar: false, recargar: false, arma: null, zoom: false, asistido: false });

interface Municion {
  cargador: number;
  reserva: number;
}

export interface Soldado {
  id: number;
  nombre: string;
  equipo: Equipo;
  esJugador: boolean;
  cuerpo: Cuerpo;
  yaw: number;
  pitch: number;
  vida: number;
  vivo: boolean;
  arma: Arma;
  municion: Record<Arma, Municion>;
  cd: number;
  recargando: number;
  /** Para animaciones: segundos desde el último disparo y si se está moviendo. */
  disparo: number;
  moviendose: boolean;
  // IA
  objetivo: { x: number; z: number } | null;
  enemigo: Soldado | null;
  reaccion: number;
  revisar: number;
  atascado: number;
  ultimaPos: { x: number; z: number };
  muerteT: number;
}

export interface Trazo {
  x0: number; y0: number; z0: number;
  x1: number; y1: number; z1: number;
  t: number;
  propio: boolean;
}

export interface Impacto {
  x: number; y: number; z: number;
  t: number;
  sangre: boolean;
}

export interface EventosPartida {
  disparo?: (s: Soldado) => void;
  golpeRecibido?: () => void;
  acierto?: (cabeza: boolean) => void;
  baja?: (asesino: Soldado, victima: Soldado, cabeza: boolean) => void;
  finRonda?: (ganador: Equipo) => void;
  fin: (resumen: { rondas: number; bajas: number }) => void;
}

const NOMBRES_T = ['Ivan', 'Boris', 'Karim', 'Dmitri', 'Yusuf', 'Pavel', 'Omar', 'Sergei', 'Rashid', 'Viktor'];
const NOMBRES_CT = ['Mike', 'Tom', 'Jack', 'Ryan', 'Sam', 'Leo', 'Nick', 'Owen'];

export class Partida {
  readonly bloques: Bloque[] = crearMapa();
  soldados: Soldado[] = [];
  jugador!: Soldado;
  ronda = 0;
  marcador = { ct: 0, t: 0 };
  rondasPerdidas = 0;
  bajas = 0;
  tiempoRonda = DURACION_RONDA;
  /** Segundos de pausa entre rondas (> 0 mientras se muestra el resultado). */
  entreRondas = 0;
  ultimoGanador: Equipo | null = null;
  zoom = false;
  retroceso = 0;
  terminada = false;
  pausada = false;
  trazos: Trazo[] = [];
  impactos: Impacto[] = [];
  registro: Array<{ texto: string; t: number; propio: boolean }> = [];
  tiempo = 0;
  private rng: Rng;
  private siguienteId = 1;
  private modoRonda!: Modo;

  constructor(private modo: () => Modo, private eventos: EventosPartida, semilla = Date.now(), private nombreJugador = 'Tú') {
    this.rng = crearRng(semilla);
    this.nuevaRonda();
  }

  /* ---------- Rondas ---------- */

  private crearSoldado(equipo: Equipo, esJugador: boolean, nombre: string, pos: { x: number; z: number }): Soldado {
    const arma: Arma = esJugador ? 'rifle' : this.rng.elegir(['rifle', 'rifle', 'rifle', 'pistola', 'francotirador'] as Arma[]);
    const municion = Object.fromEntries(ORDEN_ARMAS.map((a) => [a, { cargador: ARMAS[a].cargador, reserva: ARMAS[a].reserva }])) as Record<Arma, Municion>;
    return {
      id: this.siguienteId++, nombre, equipo, esJugador,
      cuerpo: { x: pos.x, y: 0, z: pos.z, vy: 0, radio: 0.35, alto: 1.75, enSuelo: true },
      yaw: equipo === 'ct' ? 0 : Math.PI, pitch: 0, vida: 100, vivo: true, arma, municion, cd: 0, recargando: 0, disparo: 9, moviendose: false,
      objetivo: null, enemigo: null, reaccion: 0, revisar: this.rng.siguiente() * 0.3, atascado: 0, ultimaPos: { ...pos }, muerteT: 0,
    };
  }

  /** Tamaño de cada equipo según la ronda: las rondas no se acaban y cada vez hay más enemigos. */
  static equipos(ronda: number) {
    return { aliados: Math.min(4, 1 + Math.floor(ronda / 3)), enemigos: Math.min(8, 2 + Math.floor(ronda / 2)) };
  }

  nuevaRonda() {
    this.ronda++;
    this.modoRonda = this.modo();
    this.tiempoRonda = DURACION_RONDA;
    this.entreRondas = 0;
    this.trazos = [];
    this.impactos = [];
    this.zoom = false;
    const { aliados, enemigos } = Partida.equipos(this.ronda);
    const sct = spawns('ct');
    const st = spawns('t');
    const anterior = this.jugador;
    this.jugador = this.crearSoldado('ct', true, this.nombreJugador, sct[3]);
    if (anterior) this.jugador.arma = anterior.arma;
    this.soldados = [this.jugador];
    for (let i = 0; i < aliados; i++) this.soldados.push(this.crearSoldado('ct', false, NOMBRES_CT[i % NOMBRES_CT.length], sct[(i + 4) % sct.length]));
    for (let i = 0; i < enemigos; i++) this.soldados.push(this.crearSoldado('t', false, NOMBRES_T[i % NOMBRES_T.length], st[i % st.length]));
  }

  private terminarRonda(ganador: Equipo) {
    if (this.entreRondas > 0) return;
    this.ultimoGanador = ganador;
    this.marcador[ganador]++;
    this.entreRondas = 4;
    if (ganador === 't') this.rondasPerdidas++;
    this.eventos.finRonda?.(ganador);
  }

  /** Rondas ganadas por tu equipo. */
  get rondasGanadas() {
    return this.marcador.ct;
  }

  /* ---------- Actualización ---------- */

  actualizar(dt: number, c: Controles) {
    if (this.pausada || this.terminada) return;
    this.tiempo += dt;
    for (const t of this.trazos) t.t -= dt;
    this.trazos = this.trazos.filter((t) => t.t > 0);
    for (const i of this.impactos) i.t -= dt;
    this.impactos = this.impactos.filter((i) => i.t > 0);
    for (const r of this.registro) r.t -= dt;
    this.registro = this.registro.filter((r) => r.t > 0);
    this.retroceso = Math.max(0, this.retroceso - dt * 0.12);

    if (this.entreRondas > 0) {
      this.entreRondas -= dt;
      for (const s of this.soldados) if (!s.vivo) s.muerteT += dt;
      if (this.entreRondas <= 0) {
        if (this.rondasPerdidas >= this.modoRonda.vidas) {
          this.terminada = true;
          this.eventos.fin({ rondas: this.rondasGanadas, bajas: this.bajas });
          return;
        }
        this.nuevaRonda();
      }
      return;
    }

    this.tiempoRonda -= dt;
    this.actualizarJugador(dt, c);
    for (const s of this.soldados) {
      if (!s.vivo) {
        s.muerteT += dt;
        continue;
      }
      s.cd -= dt;
      s.disparo += dt;
      if (s.recargando > 0) {
        s.recargando -= dt;
        if (s.recargando <= 0) this.completarRecarga(s);
      }
      if (!s.esJugador) this.actualizarBot(s, dt);
    }

    const vivosCt = this.soldados.some((s) => s.equipo === 'ct' && s.vivo);
    const vivosT = this.soldados.some((s) => s.equipo === 't' && s.vivo);
    if (!vivosT) this.terminarRonda('ct');
    else if (!vivosCt) this.terminarRonda('t');
    else if (this.tiempoRonda <= 0) {
      const ct = this.soldados.filter((s) => s.equipo === 'ct' && s.vivo).length;
      const t = this.soldados.filter((s) => s.equipo === 't' && s.vivo).length;
      this.terminarRonda(ct > t ? 'ct' : 't');
    }
  }

  private actualizarJugador(dt: number, c: Controles) {
    const j = this.jugador;
    if (!j.vivo) return;
    const sens = this.zoom ? 0.3 : 1;
    j.yaw -= c.giroX * sens;
    j.pitch = Math.max(-1.45, Math.min(1.45, j.pitch - c.giroY * sens));

    if (c.asistido) this.asistir(dt);

    if (c.arma) {
      const siguiente = c.arma === 'siguiente' ? ORDEN_ARMAS[(ORDEN_ARMAS.indexOf(j.arma) + 1) % ORDEN_ARMAS.length] : c.arma;
      if (siguiente !== j.arma) {
        j.arma = siguiente;
        j.recargando = 0;
        j.cd = 0.4;
        this.zoom = false;
      }
    }
    if (c.zoom && ARMAS[j.arma].zoom) this.zoom = !this.zoom;
    if (c.recargar) this.recargar(j);

    const largo = Math.hypot(c.x, c.z);
    const mx = largo > 1 ? c.x / largo : c.x;
    const mz = largo > 1 ? c.z / largo : c.z;
    const vel = (j.arma === 'cuchillo' ? 1.15 : j.arma === 'francotirador' ? 0.85 : 1) * VELOCIDAD * (this.zoom ? 0.5 : 1);
    // Adelante es -z en el sistema de la cámara; se rota por el yaw.
    const sin = Math.sin(j.yaw);
    const cos = Math.cos(j.yaw);
    const dx = (mx * cos + mz * sin) * vel * dt;
    const dz = (-mx * sin + mz * cos) * vel * dt;
    j.moviendose = largo > 0.1;
    if (c.saltar && j.cuerpo.enSuelo) j.cuerpo.vy = SALTO;
    moverCuerpo(j.cuerpo, dx, dz, dt, this.bloques);

    if (c.disparar) this.disparar(j);
  }

  /** Ayuda de apuntado: acerca la mira al enemigo visible más cercano al centro. */
  private asistir(dt: number) {
    const j = this.jugador;
    const ojo = this.ojo(j);
    let mejor: { dYaw: number; dPitch: number; angulo: number } | null = null;
    for (const e of this.soldados) {
      if (!e.vivo || e.equipo === j.equipo) continue;
      const pecho = { x: e.cuerpo.x, y: e.cuerpo.y + 1.25, z: e.cuerpo.z };
      const dx = pecho.x - ojo.x;
      const dy = pecho.y - ojo.y;
      const dz = pecho.z - ojo.z;
      const yaw = Math.atan2(-dx, -dz);
      const pitch = Math.atan2(dy, Math.hypot(dx, dz));
      const dYaw = Math.atan2(Math.sin(yaw - j.yaw), Math.cos(yaw - j.yaw));
      const dPitch = pitch - j.pitch;
      const angulo = Math.hypot(dYaw, dPitch);
      if (angulo > 0.25 || (mejor && angulo > mejor.angulo) || !seVen(ojo, pecho, this.bloques)) continue;
      mejor = { dYaw, dPitch, angulo };
    }
    if (!mejor) return;
    const k = Math.min(1, dt * 4);
    j.yaw += mejor.dYaw * k;
    j.pitch += mejor.dPitch * k;
  }

  ojo(s: Soldado) {
    return { x: s.cuerpo.x, y: s.cuerpo.y + ALTURA_OJOS, z: s.cuerpo.z };
  }

  /** Dirección de la mirada a partir de yaw y pitch. */
  static direccion(yaw: number, pitch: number) {
    const cp = Math.cos(pitch);
    return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
  }

  private recargar(s: Soldado) {
    const d = ARMAS[s.arma];
    const m = s.municion[s.arma];
    if (s.recargando > 0 || !Number.isFinite(d.cargador) || m.cargador >= d.cargador || m.reserva <= 0) return;
    s.recargando = d.recarga;
    this.zoom = s.esJugador ? false : this.zoom;
  }

  private completarRecarga(s: Soldado) {
    const d = ARMAS[s.arma];
    const m = s.municion[s.arma];
    const falta = Math.min(d.cargador - m.cargador, m.reserva);
    m.cargador += falta;
    m.reserva -= falta;
  }

  private gatilloSoltado = true;

  private disparar(s: Soldado, precisionExtra = 0) {
    const d = ARMAS[s.arma];
    const m = s.municion[s.arma];
    if (s.esJugador && !d.automatica && !this.gatilloSoltado) return;
    if (s.cd > 0 || s.recargando > 0) return;
    if (m.cargador <= 0) {
      this.recargar(s);
      return;
    }
    if (s.esJugador) this.gatilloSoltado = false;
    s.cd = d.cadencia;
    s.disparo = 0;
    if (Number.isFinite(d.cargador)) m.cargador--;
    this.eventos.disparo?.(s);

    const ojo = this.ojo(s);
    let dispersion = d.precision + (s.moviendose || !s.cuerpo.enSuelo ? d.dispersionMovimiento : 0) + precisionExtra;
    if (s.esJugador) {
      dispersion += this.retroceso;
      // Sin zoom, el francotirador es muy impreciso (como en CS).
      if (s.arma === 'francotirador' && !this.zoom) dispersion += 0.08;
    }
    const yaw = s.yaw + (this.rng.siguiente() - 0.5) * 2 * dispersion;
    const pitch = s.pitch + (this.rng.siguiente() - 0.5) * 2 * dispersion + (s.esJugador ? this.retroceso * 0.5 : 0);
    const dir = Partida.direccion(yaw, pitch);
    if (s.esJugador) {
      this.retroceso = Math.min(0.08, this.retroceso + d.retroceso);
      if (s.arma === 'francotirador') this.zoom = false;
    }

    const hasta = rayoMapa(ojo.x, ojo.y, ojo.z, dir.x, dir.y, dir.z, this.bloques, d.alcance);
    let golpe: { s: Soldado; t: number; zona: 'cabeza' | 'cuerpo' | 'piernas' } | null = null;
    for (const o of this.soldados) {
      if (!o.vivo || o === s || o.equipo === s.equipo) continue;
      const { x, y, z } = o.cuerpo;
      const zonas: Array<['cabeza' | 'cuerpo' | 'piernas', number, number, number]> = [
        ['cabeza', 1.38, 1.78, 0.17],
        ['cuerpo', 0.75, 1.38, 0.3],
        ['piernas', 0, 0.75, 0.22],
      ];
      for (const [zona, y0, y1, r] of zonas) {
        const t = rayoCaja(ojo.x, ojo.y, ojo.z, dir.x, dir.y, dir.z, x - r, y + y0, z - r, x + r, y + y1, z + r);
        if (t < hasta && (!golpe || t < golpe.t)) golpe = { s: o, t, zona };
      }
    }
    const fin = golpe ? golpe.t : hasta;
    const px = ojo.x + dir.x * fin;
    const py = ojo.y + dir.y * fin;
    const pz = ojo.z + dir.z * fin;
    if (s.arma !== 'cuchillo') this.trazos.push({ x0: ojo.x, y0: ojo.y - 0.15, z0: ojo.z, x1: px, y1: py, z1: pz, t: 0.06, propio: s.esJugador });
    if (golpe) {
      this.impactos.push({ x: px, y: py, z: pz, t: 0.5, sangre: true });
      let dano = d.dano * multiplicadorZona(golpe.zona);
      if (!s.esJugador && golpe.s.esJugador) dano *= this.modoRonda.dano;
      this.herir(golpe.s, dano, s, golpe.zona === 'cabeza');
    } else if (fin < d.alcance - 0.01) {
      this.impactos.push({ x: px, y: py, z: pz, t: 2, sangre: false });
    }
  }

  /** Se llama cuando el jugador suelta el gatillo (armas semiautomáticas). */
  soltarGatillo() {
    this.gatilloSoltado = true;
  }

  private herir(v: Soldado, dano: number, atacante: Soldado, cabeza: boolean) {
    v.vida -= dano;
    if (v.esJugador) this.eventos.golpeRecibido?.();
    if (atacante.esJugador) this.eventos.acierto?.(cabeza);
    // Al recibir un disparo, el bot se gira hacia quien le disparó.
    if (!v.esJugador && v.vivo && !v.enemigo) {
      v.enemigo = atacante;
      v.reaccion = this.modoRonda.reaccion * 0.6;
    }
    if (v.vida > 0) return;
    v.vida = 0;
    v.vivo = false;
    v.muerteT = 0;
    if (atacante.esJugador) this.bajas++;
    this.registro.unshift({ texto: `${atacante.nombre} ${cabeza ? '🎯' : '🔫'} ${v.nombre}`, t: 5, propio: atacante.esJugador || v.esJugador });
    this.registro = this.registro.slice(0, 5);
    this.eventos.baja?.(atacante, v, cabeza);
  }

  /* ---------- Bots ---------- */

  private actualizarBot(s: Soldado, dt: number) {
    s.revisar -= dt;
    const ojo = this.ojo(s);

    // Buscar enemigos visibles cada cierto tiempo (no en cada paso, para ahorrar).
    if (s.revisar <= 0) {
      s.revisar = 0.25;
      if (s.enemigo && (!s.enemigo.vivo || !seVen(ojo, this.pecho(s.enemigo), this.bloques))) s.enemigo = null;
      if (!s.enemigo) {
        let mejor: Soldado | null = null;
        let d = 70;
        for (const o of this.soldados) {
          if (!o.vivo || o.equipo === s.equipo) continue;
          const dist = Math.hypot(o.cuerpo.x - s.cuerpo.x, o.cuerpo.z - s.cuerpo.z);
          if (dist >= d) continue;
          // Campo de visión de unos 220°: lo que tiene justo detrás no lo ve.
          const ang = Math.atan2(-(o.cuerpo.x - s.cuerpo.x), -(o.cuerpo.z - s.cuerpo.z));
          const dif = Math.abs(Math.atan2(Math.sin(ang - s.yaw), Math.cos(ang - s.yaw)));
          if (dif > 1.9 && dist > 4) continue;
          if (!seVen(ojo, this.pecho(o), this.bloques)) continue;
          mejor = o;
          d = dist;
        }
        if (mejor) {
          s.enemigo = mejor;
          s.reaccion = this.modoRonda.reaccion * (0.8 + this.rng.siguiente() * 0.5);
        }
      }
    }

    const e = s.enemigo;
    if (e) {
      const p = this.pecho(e);
      const dx = p.x - ojo.x;
      const dz = p.z - ojo.z;
      const yaw = Math.atan2(-dx, -dz);
      const dif = Math.atan2(Math.sin(yaw - s.yaw), Math.cos(yaw - s.yaw));
      s.yaw += dif * Math.min(1, dt * 8);
      s.pitch = Math.atan2(p.y - ojo.y, Math.hypot(dx, dz));
      s.reaccion -= dt;
      // Pasos laterales mientras dispara.
      const lado = Math.sin(this.tiempo * 1.7 + s.id) > 0 ? 1 : -1;
      const v = VELOCIDAD * 0.45;
      moverCuerpo(s.cuerpo, Math.cos(s.yaw) * lado * v * dt, -Math.sin(s.yaw) * lado * v * dt, dt, this.bloques);
      s.moviendose = true;
      if (s.reaccion <= 0 && Math.abs(dif) < 0.2) {
        const dist = Math.hypot(dx, dz);
        // La puntería empeora con la distancia y mejora un poco con cada ronda.
        const acierto = Math.min(0.85, this.modoRonda.punteria * (1 + Math.min(this.ronda, 20) * 0.03) * Math.max(0.35, 1 - dist / 60) * (e.moviendose ? 0.8 : 1));
        const errar = this.rng.siguiente() > acierto;
        const antes = s.pitch;
        // Si falla, el disparo sale desviado a propósito (se ve el trazo pasar cerca).
        if (errar) s.pitch += (this.rng.siguiente() < 0.5 ? 1 : -1) * (0.04 + this.rng.siguiente() * 0.05);
        else s.pitch = Math.atan2(p.y + (this.rng.siguiente() < 0.15 ? 0.45 : 0) - ojo.y, dist);
        this.disparar(s, errar ? 0.02 : 0);
        s.pitch = antes;
        if (s.municion[s.arma].cargador <= 0) this.recargar(s);
      }
      return;
    }

    // Patrulla: hacia un punto; si se atasca, cambia de punto.
    if (!s.objetivo || Math.hypot(s.objetivo.x - s.cuerpo.x, s.objetivo.z - s.cuerpo.z) < 1.2) {
      const lado = s.equipo === 'ct' ? -1 : 1;
      const candidatos = PUNTOS_PATRULLA.filter((p) => this.rng.siguiente() < 0.5 || Math.sign(p.z) === lado);
      s.objetivo = this.rng.elegir(candidatos.length ? candidatos : PUNTOS_PATRULLA);
    }
    const dx = s.objetivo.x - s.cuerpo.x;
    const dz = s.objetivo.z - s.cuerpo.z;
    const l = Math.hypot(dx, dz) || 1;
    const yaw = Math.atan2(-dx, -dz);
    s.yaw += Math.atan2(Math.sin(yaw - s.yaw), Math.cos(yaw - s.yaw)) * Math.min(1, dt * 5);
    s.pitch = 0;
    const v = VELOCIDAD * 0.8;
    moverCuerpo(s.cuerpo, (dx / l) * v * dt, (dz / l) * v * dt, dt, this.bloques);
    s.moviendose = true;
    s.atascado += dt;
    if (s.atascado > 1) {
      if (Math.hypot(s.cuerpo.x - s.ultimaPos.x, s.cuerpo.z - s.ultimaPos.z) < 0.6) {
        s.objetivo = this.rng.elegir(PUNTOS_PATRULLA);
        if (s.cuerpo.enSuelo) s.cuerpo.vy = SALTO * 0.8;
      }
      s.atascado = 0;
      s.ultimaPos = { x: s.cuerpo.x, z: s.cuerpo.z };
    }
  }

  private pecho(s: Soldado) {
    return { x: s.cuerpo.x, y: s.cuerpo.y + 1.2, z: s.cuerpo.z };
  }
}
