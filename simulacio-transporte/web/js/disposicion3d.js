/**
 * Geometría pura de la escena 3D: coordenadas del mundo, colocación de la cola,
 * recorrido del autobús y encuadres de cámara.
 *
 * No importa Three.js ni toca el DOM, de modo que se puede probar con
 * `node --test`. La escena 3D consume estas funciones y añade la animación.
 */

import { clamp, mezclar } from './util.js';

/** Eje X: recorrido del autobús. Eje Z: profundidad calzada → acera. */
export const CARRIL_Z = 2.6;
export const ACERA_Z = 5.2;
export const COLA_Z = 6.9;
export const COLA_X_INICIO = 4.6;
export const PUERTA_X = 3.15;
export const PUERTA_Z = 5.35;
export const BUS_X_PARADA = 0;
export const BUS_X_ENTRADA = -58;
export const BUS_X_SALIDA = 58;
export const SEPARACION_MIN = 0.5;
export const SEPARACION_MAX = 0.82;
export const MAXIMO_FIGURAS = 32;

const SUAVIZADO_PUERTA = (valor) => valor * valor * (3 - 2 * valor);

/** Separación entre pasajeros: se comprime cuando la cola es muy larga. */
export function separacionCola(total) {
  const n = Math.max(1, Math.floor(total));
  if (n <= 16) return SEPARACION_MAX;
  return Math.max(SEPARACION_MIN, (16 * SEPARACION_MAX) / n);
}

/** Posición de la figura que ocupa el puesto `indice` de una cola de `total`. */
export function posicionCola(indice, total) {
  const separacion = separacionCola(total);
  const balanceo = (((indice * 37) % 7) - 3) * 0.022;
  return {
    x: COLA_X_INICIO + indice * separacion,
    y: 0,
    z: COLA_Z + balanceo,
  };
}

/** Punto de la acera donde termina el recorrido de quien aborda. */
export function posicionPuerta() {
  return { x: PUERTA_X, y: 0, z: PUERTA_Z };
}

/** Avance del autobús según su fase visual. Devuelve su coordenada X. */
export function posicionBus(fase, progreso) {
  const p = clamp(Number(progreso) || 0, 0, 1);
  if (fase === 'aproximando') {
    return mezclar(BUS_X_ENTRADA, BUS_X_PARADA, 1 - Math.pow(1 - p, 2));
  }
  if (fase === 'saliendo') {
    return mezclar(BUS_X_PARADA, BUS_X_SALIDA, Math.pow(p, 1.4));
  }
  return BUS_X_PARADA;
}

/** ¿El autobús debe estar en escena en esta fase? */
export function busVisible(fase) {
  return fase === 'aproximando' || fase === 'detenido' || fase === 'abordando' || fase === 'saliendo';
}

/** ¿Las puertas deben estar abiertas? */
export function puertasAbiertas(fase) {
  return fase === 'detenido' || fase === 'abordando';
}

/** Progreso [0,1] de cada caminante que aborda, según el avance del abordaje. */
export function progresoCaminante(indice, abordados, progreso) {
  const total = Math.max(1, abordados);
  const avance = clamp(Number(progreso) || 0, 0, 1) * total;
  return SUAVIZADO_PUERTA(clamp(avance - indice, 0, 1));
}

/** Encuadres de las dos cámaras solicitadas. */
export const CAMARAS = {
  calle: {
    etiqueta: 'Calle',
    posicion: [13.5, 4.4, 16.5],
    objetivo: [3.2, 2.0, 5.2],
    fov: 48,
  },
  elevada: {
    etiqueta: 'Elevada',
    posicion: [18, 23, 30],
    objetivo: [6.5, 0.4, 4.8],
    fov: 42,
  },
};
