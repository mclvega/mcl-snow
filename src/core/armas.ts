export type Arma = 'rifle' | 'pistola' | 'francotirador' | 'cuchillo';

export interface DatosArma {
  nombre: string;
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
  zoom?: number;
}

export const ARMAS: Record<Arma, DatosArma> = {
  rifle: { nombre: 'Rifle AK', tecla: '1', dano: 34, cadencia: 0.1, automatica: true, cargador: 30, reserva: 90, recarga: 2.4, precision: 0.006, dispersionMovimiento: 0.05, retroceso: 0.012, alcance: 120 },
  francotirador: { nombre: 'AWP', tecla: '2', dano: 115, cadencia: 1.4, automatica: false, cargador: 10, reserva: 30, recarga: 3.6, precision: 0.001, dispersionMovimiento: 0.12, retroceso: 0.05, alcance: 200, zoom: 4 },
  pistola: { nombre: 'Deagle', tecla: '3', dano: 54, cadencia: 0.3, automatica: false, cargador: 7, reserva: 35, recarga: 2.2, precision: 0.008, dispersionMovimiento: 0.04, retroceso: 0.03, alcance: 80 },
  cuchillo: { nombre: 'Cuchillo', tecla: '4', dano: 65, cadencia: 0.6, automatica: false, cargador: Infinity, reserva: 0, recarga: 0, precision: 0, dispersionMovimiento: 0, retroceso: 0, alcance: 1.8 },
};

export const ORDEN_ARMAS: Arma[] = ['rifle', 'francotirador', 'pistola', 'cuchillo'];

/** Daño según la zona: cabeza ×4, como en CS. */
export const multiplicadorZona = (zona: 'cabeza' | 'cuerpo' | 'piernas') => (zona === 'cabeza' ? 4 : zona === 'piernas' ? 0.75 : 1);
