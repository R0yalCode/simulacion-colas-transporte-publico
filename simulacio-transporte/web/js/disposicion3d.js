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
/**
 * Máximo de pasajeros individuales que la escena puede representar.
 * La cola real del modelo no se recorta: el excedente se contabiliza aparte.
 */
export const MAXIMO_FIGURAS = 150;

/** Separación horizontal entre puestos de una misma fila. */
export const PASO_COLA = 0.62;
/** Puestos por bloque horizontal (bloque izquierdo y bloque derecho). */
export const COLUMNAS_POR_BLOQUE = 14;
/** Inicio del bloque izquierdo (bajo la marquesina). */
export const X_BLOQUE_IZQUIERDO = 2.45;
/** Inicio del bloque derecho (extensión sobre la acera). */
export const X_BLOQUE_DERECHO = 11.35;
/** Bandas de profundidad (Z) de la fila principal. */
export const FILAS_FRENTE = [6.95, 7.75];
/** Bandas de profundidad (Z) del desbordamiento. */
export const FILAS_DESBORDAMIENTO = [10.55, 11.35, 12.15, 12.95];

/**
 * Zonas de la cola, en orden de llenado.
 *
 * La cola crece de forma progresiva: primero ocupa el refugio de la
 * marquesina (A), después se extiende sobre la acera (B) y solo cuando se
 * desborda la zona sheltered aparece la banda lateral (C) y la espera
 * adicional (D).
 */
export const ZONAS_COLA = [
  {
    id: 'A',
    etiqueta: 'Refugio',
    descripcion: 'Fila principal bajo la marquesina, junto a la puerta del autobús.',
    filas: FILAS_FRENTE,
    x: X_BLOQUE_IZQUIERDO,
    columnas: COLUMNAS_POR_BLOQUE,
  },
  {
    id: 'B',
    etiqueta: 'Extensión de la fila',
    descripcion: 'Continuación de la fila sobre la acera, fuera de la marquesina.',
    filas: FILAS_FRENTE,
    x: X_BLOQUE_DERECHO,
    columnas: COLUMNAS_POR_BLOQUE,
  },
  {
    id: 'C',
    etiqueta: 'Desbordamiento lateral',
    descripcion: 'Segunda banda: la fila desborda lateralmente el refugio.',
    filas: FILAS_DESBORDAMIENTO,
    x: X_BLOQUE_IZQUIERDO,
    columnas: COLUMNAS_POR_BLOQUE,
  },
  {
    id: 'D',
    etiqueta: 'Espera adicional',
    descripcion: 'Cola extendida en la zona despejada de la parada.',
    filas: FILAS_DESBORDAMIENTO,
    x: X_BLOQUE_DERECHO,
    columnas: COLUMNAS_POR_BLOQUE,
  },
];

const SUAVIZADO_PUERTA = (valor) => valor * valor * (3 - 2 * valor);

/**
 * Puestos de la cola precomputados: cada índice tiene una posición fija, de
 * modo que un pasajero conserva su sitio y la disposición es determinista.
 */
const PUESTOS_COLA = (() => {
  const puestos = [];
  for (const zona of ZONAS_COLA) {
    for (const z of zona.filas) {
      for (let columna = 0; columna < zona.columnas; columna += 1) {
        const indice = puestos.length;
        const balanceo = (((indice * 37) % 7) - 3) * 0.022;
        puestos.push({
          x: zona.x + columna * PASO_COLA,
          y: 0,
          z: z + balanceo,
          zona: zona.id,
          indice,
        });
      }
    }
  }
  return puestos;
})();

/** Puestos disponibles en la escena (mayor que el máximo de figuras). */
export const PUESTOS_TOTAL = PUESTOS_COLA.length;

/** Capacidad de cada zona, en pasajeros. */
export function capacidadZonas() {
  const capacidades = {};
  for (const zona of ZONAS_COLA) {
    capacidades[zona.id] = zona.filas.length * zona.columnas;
  }
  return capacidades;
}

/**
 * Posición del pasajero que ocupa el puesto `indice` de la cola.
 *
 * Las posiciones son fijas por índice (no dependen del tamaño de la cola):
 * la disposición es determinista y un pasajero no cambia de sitio cuando la
 * cola crece.
 */
export function posicionCola(indice) {
  const i = Math.max(0, Math.floor(indice) || 0);
  const puesto = PUESTOS_COLA[Math.min(i, PUESTOS_COLA.length - 1)];
  return { x: puesto.x, y: puesto.y, z: puesto.z, zona: puesto.zona };
}

/** Zona que contiene el puesto `indice` (null si el índice está fuera de rango). */
export function zonaDeIndice(indice) {
  const i = Math.floor(indice) || 0;
  if (i < 0 || i >= PUESTOS_COLA.length) return null;
  return PUESTOS_COLA[i].zona;
}

/** Índices del primer y último puesto de cada zona. */
export function rangosZonas() {
  const rangos = {};
  for (const zona of ZONAS_COLA) rangos[zona.id] = { inicio: null, fin: 0 };
  PUESTOS_COLA.forEach((puesto, indice) => {
    const rango = rangos[puesto.zona];
    if (rango.inicio === null) rango.inicio = indice;
    rango.fin = indice + 1;
  });
  return rangos;
}

/** Rectángulo que ocupa una zona en el plano XZ (para pintar el suelo). */
export function limitesZona(id) {
  const zona = ZONAS_COLA.find((item) => item.id === id);
  if (!zona) return null;
  const xMin = zona.x - PASO_COLA * 0.5;
  const xMax = zona.x + (zona.columnas - 1) * PASO_COLA + PASO_COLA * 0.5;
  const zMin = Math.min(...zona.filas) - 0.42;
  const zMax = Math.max(...zona.filas) + 0.42;
  return { xMin, xMax, zMin, zMax, centroX: (xMin + xMax) / 2, centroZ: (zMin + zMax) / 2 };
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
