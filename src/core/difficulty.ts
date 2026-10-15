export type Dificultad = 'muyFacil' | 'facil' | 'normal' | 'desafio';

export interface Modo {
  nombre: string;
  /** Probabilidad base de que un bot acierte un disparo (0 a 1). */
  punteria: number;
  /** Segundos que tarda un bot en reaccionar al verte. */
  reaccion: number;
  /** Multiplicador del daño de los bots. */
  dano: number;
  /** Rondas que puedes perder antes de terminar la partida. */
  vidas: number;
}

export const MODOS: Record<Dificultad, Modo> = {
  muyFacil: { nombre: 'Muy fácil', punteria: 0.12, reaccion: 1.1, dano: 0.5, vidas: 5 },
  facil: { nombre: 'Fácil', punteria: 0.2, reaccion: 0.8, dano: 0.75, vidas: 4 },
  normal: { nombre: 'Normal', punteria: 0.3, reaccion: 0.55, dano: 1, vidas: 3 },
  desafio: { nombre: 'Desafío', punteria: 0.42, reaccion: 0.35, dano: 1.25, vidas: 3 },
};

export const DIFICULTADES = Object.keys(MODOS) as Dificultad[];
