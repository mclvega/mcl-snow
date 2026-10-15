/**
 * Mapa inspirado en fy_snow (Counter-Strike 1.6): explanada nevada simétrica, una casa en cada base,
 * cajas de madera y muros bajos en el centro. Unidades en metros; el suelo está en y = 0.
 */

export type TipoBloque = 'muro' | 'casa' | 'caja' | 'muroBajo' | 'torre' | 'arbol';

export interface Bloque {
  /** Centro en el plano y medidas. */
  x: number;
  z: number;
  w: number;
  d: number;
  /** Altura de la base y de la cima. */
  y0: number;
  y1: number;
  tipo: TipoBloque;
}

export type Equipo = 'ct' | 't';

export const LIMITE_X = 30;
export const LIMITE_Z = 22;

function b(tipo: TipoBloque, x: number, z: number, w: number, d: number, h: number, y0 = 0): Bloque {
  return { tipo, x, z, w, d, y0, y1: y0 + h };
}

/** Casa con hueco de puerta hacia el centro del mapa (signo = lado del mapa). */
function casa(cx: number, cz: number, signo: 1 | -1): Bloque[] {
  const w = 8;
  const d = 6;
  const h = 3.2;
  const g = 0.4;
  const frente = cz - (signo * d) / 2;
  const fondo = cz + (signo * d) / 2;
  return [
    b('casa', cx, fondo, w, g, h),
    b('casa', cx - w / 2, cz, g, d, h),
    b('casa', cx + w / 2, cz, g, d, h),
    // Fachada con puerta de 2 m en el medio.
    b('casa', cx - 2.5, frente, 3, g, h),
    b('casa', cx + 2.5, frente, 3, g, h),
    b('casa', cx, frente, 2, g, h - 2.3, 2.3),
  ];
}

function espejo(bloques: Bloque[]): Bloque[] {
  return bloques.flatMap((bl) => [bl, { ...bl, z: -bl.z }]);
}

export function crearMapa(): Bloque[] {
  const bloques: Bloque[] = [
    // Perímetro
    b('muro', 0, -LIMITE_Z - 0.5, LIMITE_X * 2 + 2, 1, 5),
    b('muro', 0, LIMITE_Z + 0.5, LIMITE_X * 2 + 2, 1, 5),
    b('muro', -LIMITE_X - 0.5, 0, 1, LIMITE_Z * 2, 5),
    b('muro', LIMITE_X + 0.5, 0, 1, LIMITE_Z * 2, 5),
    // Torre central y muros bajos para cubrirse
    b('torre', 0, 0, 4, 4, 3.5),
    b('muroBajo', -10, 0, 8, 0.6, 1.1),
    b('muroBajo', 10, 0, 8, 0.6, 1.1),
  ];
  bloques.push(...casa(-14, 17, 1), ...casa(14, 17, 1), ...casa(-14, -17, -1), ...casa(14, -17, -1));
  // Cajas: una mitad y su reflejo, para que el mapa sea justo para los dos equipos.
  bloques.push(
    ...espejo([
      b('caja', -5, 6, 1.2, 1.2, 1.2),
      b('caja', -3.6, 6, 1.2, 1.2, 1.2),
      b('caja', -3.6, 6, 1.2, 1.2, 1.2, 1.2),
      b('caja', 5, 7, 1.6, 1.6, 1.6),
      b('caja', 20, 5, 1.2, 1.2, 1.2),
      b('caja', 21.3, 5.5, 1.2, 1.2, 1.2),
      b('caja', -21, 9, 1.6, 1.6, 1.6),
      b('caja', 0, 11, 1.2, 1.2, 1.2),
      b('caja', 25, 13, 1.2, 1.2, 2.4),
      b('caja', -25, 3, 1.2, 1.2, 1.2),
      b('arbol', -27, 19, 0.8, 0.8, 4),
      b('arbol', 27, 19, 0.8, 0.8, 4),
      b('arbol', 0, 20, 0.8, 0.8, 4),
    ]),
  );
  return bloques;
}

/** Puntos de aparición de cada equipo. */
export function spawns(equipo: Equipo): Array<{ x: number; z: number }> {
  const z = equipo === 'ct' ? 19.5 : -19.5;
  return [-19, -9, -4, 0, 4, 9, 19, -24, 24].map((x) => ({ x, z: x === 0 ? z - Math.sign(z) : z }));
}

/** Puntos por los que patrullan los bots. */
export const PUNTOS_PATRULLA: Array<{ x: number; z: number }> = [
  { x: -20, z: 0 }, { x: 20, z: 0 }, { x: -6, z: 3 }, { x: 6, z: -3 }, { x: 0, z: 8 }, { x: 0, z: -8 },
  { x: -14, z: 10 }, { x: 14, z: 10 }, { x: -14, z: -10 }, { x: 14, z: -10 }, { x: -26, z: -12 }, { x: 26, z: 12 },
  { x: -14, z: 17 }, { x: 14, z: -17 }, { x: 14, z: 17 }, { x: -14, z: -17 },
];

export interface Cuerpo {
  x: number;
  y: number;
  z: number;
  vy: number;
  radio: number;
  alto: number;
  enSuelo: boolean;
}

const PASO_MAXIMO = 0.45;

/** Mueve un cuerpo cilíndrico por el plano y lo saca de los bloques; se sube solo a escalones bajos. */
export function moverCuerpo(c: Cuerpo, dx: number, dz: number, dt: number, bloques: Bloque[], gravedad = 20): void {
  c.x += dx;
  c.z += dz;
  for (const bl of bloques) {
    if (c.y >= bl.y1 - 0.01 || c.y + c.alto <= bl.y0) continue;
    const px = Math.max(bl.x - bl.w / 2, Math.min(c.x, bl.x + bl.w / 2));
    const pz = Math.max(bl.z - bl.d / 2, Math.min(c.z, bl.z + bl.d / 2));
    const ex = c.x - px;
    const ez = c.z - pz;
    const dist2 = ex * ex + ez * ez;
    if (dist2 >= c.radio * c.radio) continue;
    if (bl.y1 - c.y <= PASO_MAXIMO && c.enSuelo) {
      c.y = bl.y1;
      continue;
    }
    if (dist2 > 1e-8) {
      const dist = Math.sqrt(dist2);
      c.x = px + (ex / dist) * c.radio;
      c.z = pz + (ez / dist) * c.radio;
    } else {
      // El centro quedó dentro: salir por el lado más cercano.
      const sx = bl.w / 2 - Math.abs(c.x - bl.x) + c.radio;
      const sz = bl.d / 2 - Math.abs(c.z - bl.z) + c.radio;
      if (sx < sz) c.x += Math.sign(c.x - bl.x || 1) * sx;
      else c.z += Math.sign(c.z - bl.z || 1) * sz;
    }
  }

  // Gravedad y suelo: la cima más alta que hay debajo.
  c.vy -= gravedad * dt;
  let nuevaY = c.y + c.vy * dt;
  let suelo = 0;
  let techo = Infinity;
  for (const bl of bloques) {
    if (Math.abs(c.x - bl.x) > bl.w / 2 + c.radio * 0.5 || Math.abs(c.z - bl.z) > bl.d / 2 + c.radio * 0.5) continue;
    if (bl.y1 <= c.y + 0.01) suelo = Math.max(suelo, bl.y1);
    else if (bl.y0 >= c.y + c.alto - 0.01) techo = Math.min(techo, bl.y0);
  }
  if (nuevaY + c.alto > techo) {
    nuevaY = techo - c.alto;
    c.vy = Math.min(0, c.vy);
  }
  c.enSuelo = nuevaY <= suelo;
  if (c.enSuelo) {
    nuevaY = suelo;
    c.vy = 0;
  }
  c.y = nuevaY;
}

/** Distancia a la que un rayo entra en una caja alineada con los ejes (o Infinity si no la toca). */
export function rayoCaja(
  ox: number, oy: number, oz: number, dx: number, dy: number, dz: number,
  minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number,
): number {
  let t0 = 0;
  let t1 = Infinity;
  const ejes: Array<[number, number, number, number]> = [[ox, dx, minX, maxX], [oy, dy, minY, maxY], [oz, dz, minZ, maxZ]];
  for (const [o, d, mn, mx] of ejes) {
    if (Math.abs(d) < 1e-9) {
      if (o < mn || o > mx) return Infinity;
      continue;
    }
    let a = (mn - o) / d;
    let b2 = (mx - o) / d;
    if (a > b2) [a, b2] = [b2, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b2);
    if (t0 > t1) return Infinity;
  }
  return t0;
}

/** Distancia hasta el primer bloque que cruza el rayo. */
export function rayoMapa(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, bloques: Bloque[], max = 200): number {
  let mejor = oy + dy * max < 0 && dy < 0 ? -oy / dy : max;
  for (const bl of bloques) {
    if (bl.tipo === 'arbol') continue;
    const t = rayoCaja(ox, oy, oz, dx, dy, dz, bl.x - bl.w / 2, bl.y0, bl.z - bl.d / 2, bl.x + bl.w / 2, bl.y1, bl.z + bl.d / 2);
    if (t < mejor) mejor = t;
  }
  return mejor;
}

/** ¿Hay línea de visión entre dos puntos? */
export function seVen(a: { x: number; y: number; z: number }, b2: { x: number; y: number; z: number }, bloques: Bloque[]): boolean {
  const dx = b2.x - a.x;
  const dy = b2.y - a.y;
  const dz = b2.z - a.z;
  const l = Math.hypot(dx, dy, dz);
  return rayoMapa(a.x, a.y, a.z, dx / l, dy / l, dz / l, bloques, l) >= l - 0.05;
}
