import { describe, expect, it } from 'vitest';
import { MODOS } from '../src/core/difficulty';
import { crearMapa, moverCuerpo, rayoCaja, rayoMapa, seVen, spawns, type Cuerpo } from '../src/core/mapa';
import { PASO } from '../src/core/loop';
import { controlesVacios, Partida } from '../src/game/logica';
import { normalizarConfig } from '../src/settings';
import { agregarRecord, guardadoNuevo, normalizarGuardado } from '../src/storage';

const cuerpo = (x: number, z: number): Cuerpo => ({ x, y: 0, z, vy: 0, radio: 0.35, alto: 1.75, enSuelo: true });

describe('mapa', () => {
  const mapa = crearMapa();

  it('es simétrico entre las dos bases', () => {
    for (const b of mapa.filter((b) => b.tipo === 'caja')) {
      expect(mapa.some((o) => o.tipo === 'caja' && o.x === b.x && o.z === -b.z && o.y0 === b.y0)).toBe(true);
    }
  });

  it('los puntos de aparición están libres', () => {
    for (const e of ['ct', 't'] as const) {
      for (const s of spawns(e)) {
        const c = cuerpo(s.x, s.z);
        moverCuerpo(c, 0, 0, PASO, mapa);
        expect(Math.hypot(c.x - s.x, c.z - s.z)).toBeLessThan(0.01);
      }
    }
  });

  it('los muros frenan y las cajas bajas no', () => {
    const c = cuerpo(0, 3);
    for (let i = 0; i < 60; i++) moverCuerpo(c, 0, -0.1, PASO, mapa);
    expect(c.z).toBeGreaterThan(2); // la torre central (z de -2 a 2) lo detiene
    const borde = cuerpo(28, 0);
    for (let i = 0; i < 30; i++) moverCuerpo(borde, 0.2, 0, PASO, mapa);
    expect(borde.x).toBeLessThanOrEqual(30 - 0.35 + 1e-6);
  });

  it('se puede subir a una caja saltando', () => {
    const c = cuerpo(-5, 7.5);
    c.vy = 7.5;
    c.enSuelo = false;
    for (let i = 0; i < 90; i++) moverCuerpo(c, 0, i < 30 ? -0.05 : 0, PASO, mapa);
    expect(c.y).toBeCloseTo(1.2, 1);
  });

  it('los rayos chocan con las cajas y la torre tapa la vista', () => {
    expect(rayoCaja(0, 0.5, -5, 0, 0, 1, -1, 0, -1, 1, 1, 1)).toBeCloseTo(4);
    expect(rayoCaja(5, 0.5, -5, 0, 0, 1, -1, 0, -1, 1, 1, 1)).toBe(Infinity);
    expect(rayoMapa(0, 1.6, 10, 0, 0, -1, mapa)).toBeCloseTo(8);
    expect(seVen({ x: 0, y: 1.6, z: 10 }, { x: 0, y: 1.6, z: -10 }, mapa)).toBe(false);
    expect(seVen({ x: -20, y: 1.6, z: 2 }, { x: -20, y: 1.6, z: -2 }, mapa)).toBe(true);
  });
});

describe('partida', () => {
  it('las rondas no se acaban y crecen los equipos', () => {
    expect(Partida.equipos(1)).toEqual({ aliados: 1, enemigos: 2 });
    expect(Partida.equipos(20).enemigos).toBe(8);
  });

  it('dirección de la mirada', () => {
    const d = Partida.direccion(0, 0);
    expect(d.z).toBeCloseTo(-1);
    expect(Partida.direccion(Math.PI / 2, 0).x).toBeCloseTo(-1);
  });

  it('simula rondas con bots sin errores hasta terminar', () => {
    let fin: { rondas: number; bajas: number } | null = null;
    const rondas: string[] = [];
    const p = new Partida(() => MODOS.desafio, { fin: (r) => (fin = r), finRonda: (g) => rondas.push(g) }, 11);
    // El jugador se queda quieto disparando hacia delante.
    for (let i = 0; i < 60 * 60 * 8 && !fin; i++) {
      const c = controlesVacios();
      c.disparar = i % 20 < 10;
      if (!c.disparar) p.soltarGatillo();
      p.actualizar(PASO, c);
    }
    expect(rondas.length).toBeGreaterThan(0);
    expect(fin).not.toBeNull();
    expect(p.rondasPerdidas).toBeGreaterThanOrEqual(MODOS.desafio.vidas);
  });

  it('cambiar de arma y recargar', () => {
    const p = new Partida(() => MODOS.normal, { fin: () => undefined }, 3);
    const c = controlesVacios();
    c.arma = 'pistola';
    p.actualizar(PASO, c);
    expect(p.jugador.arma).toBe('pistola');
    p.jugador.municion.pistola.cargador = 2;
    const r = controlesVacios();
    r.recargar = true;
    p.actualizar(PASO, r);
    for (let i = 0; i < 60 * 3; i++) p.actualizar(PASO, controlesVacios());
    expect(p.jugador.municion.pistola.cargador).toBe(7);
  });
});

describe('guardado', () => {
  it('normaliza y ordena', () => {
    const g = normalizarGuardado({ records: [{ nombre: 'a', rondas: 2, bajas: 9, fecha: 'x' }, { nombre: 'b', rondas: 5, bajas: 1, fecha: 'x' }], look: { gender: 'alien' } });
    expect(g.records.map((r) => r.nombre)).toEqual(['b', 'a']);
    expect(g.look.gender).toBe('boy');
    expect(normalizarConfig({ sensibilidad: 99 }).sensibilidad).toBe(10);
    expect(normalizarConfig({}).pantallaCompleta).toBe(true);
    expect(agregarRecord(guardadoNuevo(), { nombre: 'c', rondas: 1, bajas: 1, fecha: 'x' })).toBe(true);
  });
});
