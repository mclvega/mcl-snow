export type Arma = 'rifle' | 'm4' | 'subfusil' | 'escopeta' | 'francotirador' | 'pistola' | 'glock' | 'cuchillo' | 'karambit' | 'machete';

export type Categoria = 'principal' | 'secundaria' | 'cuerpo';

export interface DatosArma {
  nombre: string;
  categoria: Categoria;
  tecla: string;
  dano: number;
  /** Segundos entre disparos. */
  cadencia: number;
  automatica: boolean;
  cargador: number;
  reserva: number;
  recarga: number;
  /** Dispersión en radianes (quieto / moviéndose). */
  precision: number;
  dispersionMovimiento: number;
  retroceso: number;
  alcance: number;
  /** Proyectiles por disparo (la escopeta lanza perdigones). */
  perdigones: number;
  /** Multiplicador de la velocidad al llevarla. */
  movilidad: number;
  zoom?: number;
}

const base = { perdigones: 1, movilidad: 1 };

export const ARMAS: Record<Arma, DatosArma> = {
  rifle: { ...base, nombre: 'AK-47', categoria: 'principal', tecla: '1', dano: 34, cadencia: 0.1, automatica: true, cargador: 30, reserva: 90, recarga: 2.4, precision: 0.006, dispersionMovimiento: 0.05, retroceso: 0.012, alcance: 120 },
  m4: { ...base, nombre: 'M4A1', categoria: 'principal', tecla: '2', dano: 29, cadencia: 0.09, automatica: true, cargador: 30, reserva: 90, recarga: 3.0, precision: 0.004, dispersionMovimiento: 0.04, retroceso: 0.009, alcance: 120 },
  subfusil: { ...base, nombre: 'MP5', categoria: 'principal', tecla: '3', dano: 24, cadencia: 0.075, automatica: true, cargador: 30, reserva: 120, recarga: 2.2, precision: 0.012, dispersionMovimiento: 0.02, retroceso: 0.006, alcance: 60, movilidad: 1.1 },
  escopeta: { ...base, nombre: 'Escopeta M3', categoria: 'principal', tecla: '4', dano: 20, cadencia: 0.9, automatica: false, cargador: 8, reserva: 32, recarga: 3.2, precision: 0.07, dispersionMovimiento: 0.03, retroceso: 0.04, alcance: 25, perdigones: 9 },
  francotirador: { ...base, nombre: 'AWP', categoria: 'principal', tecla: '5', dano: 115, cadencia: 1.4, automatica: false, cargador: 10, reserva: 30, recarga: 3.6, precision: 0.001, dispersionMovimiento: 0.12, retroceso: 0.05, alcance: 200, zoom: 4, movilidad: 0.85 },
  pistola: { ...base, nombre: 'Deagle', categoria: 'secundaria', tecla: '6', dano: 54, cadencia: 0.3, automatica: false, cargador: 7, reserva: 35, recarga: 2.2, precision: 0.008, dispersionMovimiento: 0.04, retroceso: 0.03, alcance: 80 },
  glock: { ...base, nombre: 'Glock', categoria: 'secundaria', tecla: '7', dano: 25, cadencia: 0.15, automatica: false, cargador: 20, reserva: 120, recarga: 2.0, precision: 0.01, dispersionMovimiento: 0.025, retroceso: 0.012, alcance: 60, movilidad: 1.05 },
  cuchillo: { ...base, nombre: 'Cuchillo', categoria: 'cuerpo', tecla: '8', dano: 65, cadencia: 0.6, automatica: false, cargador: Infinity, reserva: 0, recarga: 0, precision: 0, dispersionMovimiento: 0, retroceso: 0, alcance: 1.8, movilidad: 1.15 },
  karambit: { ...base, nombre: 'Karambit', categoria: 'cuerpo', tecla: '9', dano: 50, cadencia: 0.38, automatica: true, cargador: Infinity, reserva: 0, recarga: 0, precision: 0, dispersionMovimiento: 0, retroceso: 0, alcance: 1.6, movilidad: 1.2 },
  machete: { ...base, nombre: 'Machete', categoria: 'cuerpo', tecla: '0', dano: 100, cadencia: 0.95, automatica: false, cargador: Infinity, reserva: 0, recarga: 0, precision: 0, dispersionMovimiento: 0, retroceso: 0, alcance: 2.3, movilidad: 1.05 },
};

export const ORDEN_ARMAS = Object.keys(ARMAS) as Arma[];

/** Armas que llevan los bots (las de cuerpo a cuerpo solo las usan de cerca). */
export const ARMAS_BOTS: Arma[] = ['rifle', 'rifle', 'm4', 'm4', 'subfusil', 'escopeta', 'francotirador', 'pistola', 'glock'];

export const esCuerpoACuerpo = (a: Arma) => ARMAS[a].categoria === 'cuerpo';

/** Daño según la zona: cabeza ×4, como en CS. */
export const multiplicadorZona = (zona: 'cabeza' | 'cuerpo' | 'piernas') => (zona === 'cabeza' ? 4 : zona === 'piernas' ? 0.75 : 1);
