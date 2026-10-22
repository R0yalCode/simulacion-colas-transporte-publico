/**
 * Capa de reproducción: interpreta los eventos precalculados por el motor
 * Python y reconstruye el estado visual en cualquier instante simulado.
 *
 * No duplica la lógica de simulación: aplica exclusivamente los hechos que el
 * motor decide (quién llega, quién aborda, capacidad, asientos libres). Las
 * ventanas de aproximación/abordaje/salida son intervalos visuales derivados
 * de los instantes matemáticos y nunca modifican los resultados.
 *
 * Módulo puro (sin DOM): se prueba con `node --test web/tests/`.
 */

import { clamp } from './util.js';
import { LIMITE_VISUAL_MAX } from './estado.js';

/** Ventanas visuales máximas (en minutos simulados). */
export const VENTANA_APROXIMACION_MAX = 2.0;
export const VENTANA_ABORDAJE_MAX = 1.0;
export const VENTANA_SALIDA_MAX = 0.75;
/** Fracciones del hueco entre autobuses reservadas a cada ventana visual. */
export const FRACCION_APROXIMACION = 0.35;
export const FRACCION_ABORDAJE = 0.30;
export const FRACCION_SALIDA = 0.20;
/** Fracción de la ventana de abordaje dedicada a la apertura de puertas. */
export const FRACCION_DETENIDO = 0.2;

const EPSILON = 1e-9;

export function ultimoIndiceMenorOIgual(tiempos, t) {
  let bajo = 0;
  let alto = tiempos.length - 1;
  let resultado = -1;
  while (bajo <= alto) {
    const medio = (bajo + alto) >> 1;
    if (tiempos[medio] <= t + EPSILON) {
      resultado = medio;
      bajo = medio + 1;
    } else {
      alto = medio - 1;
    }
  }
  return resultado;
}

export class Ejecucion {
  /**
   * @param {object} payload Respuesta de `/api/simular`.
   */
  constructor(payload) {
    if (!payload || !Array.isArray(payload.eventos)) {
      throw new Error('Ejecución inválida: falta la lista de eventos.');
    }
    this.config = payload.config || {};
    this.resultados = payload.resultados || {};
    this.metricasTeoricas = payload.metricas_teoricas || {};
    this.advertencias = payload.advertencias || [];
    this.eventos = payload.eventos;
    this.serieCola = payload.serie_cola || [];
    this.duracion = Number(this.config.duracion) || 0;
    this.colaInicial = Number(this.config.cola_inicial) || 0;
    /** Clasificación matemática calculada por el servidor (fuente de verdad). */
    this.estado = payload.estado || null;
    /** Estado operativo de la ejecución completa (cola real frente a Qmáx). */
    this.estadoOperativo = payload.estado_operativo || null;
    /** Umbral operativo Qmáx configurado para la ejecución. */
    this.limiteCola = Number(this.config.limite_cola) || Number(this.resultados.limite_cola) || LIMITE_VISUAL_MAX;

    this.tiemposEventos = this.eventos.map((ev) => ev.tiempo);
    this.numPasajerosLlegados = 0;
    this.numAutobuses = 0;
    this._llegadaPorPasajero = new Map();
    for (let id = 0; id < this.colaInicial; id += 1) {
      this._llegadaPorPasajero.set(id, 0);
    }
    this._buses = [];
    this.eventos.forEach((ev) => {
      if (ev.tipo === 'pasajero') {
        this.numPasajerosLlegados += 1;
        this._llegadaPorPasajero.set(ev.pasajero_id, ev.tiempo);
      } else {
        this.numAutobuses += 1;
        this._buses.push({
          ...ev,
          ocupadosAlLlegar: ev.asientos_ocupados_al_llegar,
          libresAlSalir: ev.asientos_libres - ev.abordados,
        });
      }
    });
    this.tiemposBuses = this._buses.map((b) => b.tiempo);
    this._ventanas = this._calcularVentanas();
    this._construirSeriesAuxiliares();
    this._cacheEstado = null;
  }

  // ------------------------------------------------------------------
  // Índices y series auxiliares (precomputados una sola vez)
  // ------------------------------------------------------------------

  _calcularVentanas() {
    const ventanas = [];
    for (let i = 0; i < this._buses.length; i += 1) {
      const t = this._buses[i].tiempo;
      const tPrevio = i === 0 ? 0 : this._buses[i - 1].tiempo;
      const tSiguiente = i + 1 < this._buses.length ? this._buses[i + 1].tiempo : this.duracion;
      const huecoPrevio = Math.max(t - tPrevio, 0);
      const huecoSiguiente = Math.max(tSiguiente - t, 0);
      ventanas.push({
        aproximacion: Math.min(VENTANA_APROXIMACION_MAX, FRACCION_APROXIMACION * huecoPrevio),
        abordaje: Math.min(VENTANA_ABORDAJE_MAX, FRACCION_ABORDAJE * huecoSiguiente),
        salida: Math.min(VENTANA_SALIDA_MAX, FRACCION_SALIDA * huecoSiguiente),
      });
    }
    return ventanas;
  }

  _construirSeriesAuxiliares() {
    const acum = { tiempos: [], llegados: [], transportados: [], pendientes: [] };
    let llegados = 0;
    let transportados = 0;
    for (const ev of this.eventos) {
      if (ev.tipo === 'pasajero') llegados += 1;
      else transportados += ev.abordados;
      acum.tiempos.push(ev.tiempo);
      acum.llegados.push(llegados);
      acum.transportados.push(transportados);
      acum.pendientes.push(this.colaInicial + llegados - transportados);
    }
    this._acumulado = acum;

    const esperas = [];
    for (const bus of this._buses) {
      for (const id of bus.pasajeros_abordados_ids) {
        const llegada = this._llegadaPorPasajero.get(id);
        const w = Math.max(0, bus.tiempo - (llegada === undefined ? 0 : llegada));
        esperas.push({ t: bus.tiempo, w, id, autobusId: bus.autobus_id });
      }
    }
    this._esperas = esperas;

    const tiemposSerie = this.serieCola.map((p) => p[0]);
    const areas = new Array(this.serieCola.length).fill(0);
    for (let i = 1; i < this.serieCola.length; i += 1) {
      areas[i] = areas[i - 1] + this.serieCola[i - 1][1] * (this.serieCola[i][0] - this.serieCola[i - 1][0]);
    }
    this._tiemposSerie = tiemposSerie;
    this._areasSerie = areas;
  }

  indiceUltimoEvento(t) {
    return ultimoIndiceMenorOIgual(this.tiemposEventos, t) + 1;
  }

  /** Área (pasajeros·minuto) bajo la curva de cola en [0, t]. */
  areaColaHasta(t) {
    if (t <= 0 || this.serieCola.length === 0) return 0;
    const i = ultimoIndiceMenorOIgual(this._tiemposSerie, t);
    if (i < 0) return 0;
    return this._areasSerie[i] + this.serieCola[i][1] * (t - this._tiemposSerie[i]);
  }

  // ------------------------------------------------------------------
  // Reconstrucción de estado
  // ------------------------------------------------------------------

  _estadoBase() {
    const cola = [];
    for (let id = 0; id < this.colaInicial; id += 1) cola.push(id);
    return {
      tiempo: 0,
      indice: 0,
      llegados: 0,
      transportados: 0,
      autobuses: 0,
      cola,
      colaMax: this.colaInicial,
      sumaEsperas: 0,
      numEsperas: 0,
      esperaMax: 0,
      ocupadosAcumulados: 0,
      capacidadAcumulada: 0,
      busesCompletos: 0,
    };
  }

  _clonarEstado(estado) {
    return { ...estado, cola: estado.cola.slice() };
  }

  /**
   * Estado material completo del instante t: cola (ids en orden FIFO),
   * contadores acumulados y estimadores hasta t.
   */
  estadoEn(t) {
    const tiempo = clamp(Number(t) || 0, 0, this.duracion);
    const indice = this.indiceUltimoEvento(tiempo);
    let estado;
    const cache = this._cacheEstado;
    if (cache && indice >= cache.indice && tiempo >= cache.tiempo) {
      estado = this._clonarEstado(cache);
    } else {
      estado = this._estadoBase();
    }
    this._aplicarEventos(estado, indice);
    estado.tiempo = tiempo;
    estado.indice = indice;
    this._cacheEstado = estado;
    return estado;
  }

  _aplicarEventos(estado, hastaIndice) {
    for (let k = estado.indice; k < hastaIndice; k += 1) {
      const ev = this.eventos[k];
      if (ev.tipo === 'pasajero') {
        estado.llegados += 1;
        estado.cola.push(ev.pasajero_id);
        if (ev.cola > estado.colaMax) estado.colaMax = ev.cola;
      } else {
        estado.autobuses += 1;
        estado.transportados += ev.abordados;
        if (ev.asientos_libres === 0) estado.busesCompletos += 1;
        estado.ocupadosAcumulados += ev.asientos_ocupados_al_llegar + ev.abordados;
        estado.capacidadAcumulada += ev.capacidad;
        for (const id of ev.pasajeros_abordados_ids) {
          const llegada = this._llegadaPorPasajero.get(id);
          if (llegada !== undefined) {
            const w = Math.max(0, ev.tiempo - llegada);
            estado.sumaEsperas += w;
            estado.numEsperas += 1;
            if (w > estado.esperaMax) estado.esperaMax = w;
          }
        }
        if (estado.cola.length === ev.cola) {
          estado.cola = estado.cola.slice(ev.abordados);
        } else {
          const ids = new Set(ev.pasajeros_abordados_ids);
          estado.cola = estado.cola.filter((id) => !ids.has(id));
        }
        if (ev.cola > estado.colaMax) estado.colaMax = ev.cola;
      }
    }
    estado.indice = hastaIndice;
  }

  /** Indicadores en vivo con definiciones explícitas (instante t). */
  estadisticasEn(t) {
    return estadisticasDeEstado(this, this.estadoEn(t));
  }

  /** Puntos de la serie de cola hasta el instante t (pasos discretos). */
  serieColaHasta(t) {
    const i = ultimoIndiceMenorOIgual(this._tiemposSerie, t);
    return i < 0 ? [] : this.serieCola.slice(0, i + 1);
  }

  // ------------------------------------------------------------------
  // Autobús visible en el instante t (fases visuales)
  // ------------------------------------------------------------------

  _vistaBus(fase, bus, progreso, mostrados) {
    return {
      fase,
      progreso: clamp(progreso, 0, 1),
      mostrados,
      id: bus.autobus_id,
      tiempo: bus.tiempo,
      capacidad: bus.capacidad,
      asientosLibres: bus.asientos_libres,
      ocupadosAlLlegar: bus.ocupadosAlLlegar,
      libresAlSalir: bus.libresAlSalir,
      abordados: bus.abordados,
      colaAntes: bus.cola_antes,
    };
  }

  /**
   * Autobús que debe verse en t y en qué fase visual.
   * `reducido` desactiva aproximación/salida para usuarios con movimiento reducido.
   */
  busVisualEn(t, opciones = {}) {
    const reducido = !!opciones.reducido;
    const tiempo = clamp(Number(t) || 0, 0, this.duracion);
    const i = ultimoIndiceMenorOIgual(this.tiemposBuses, tiempo);
    if (i >= 0) {
      const bus = this._buses[i];
      const v = this._ventanas[i];
      const d = tiempo - bus.tiempo;
      if (!reducido) {
        if (d < v.abordaje) {
          const fraccion = v.abordaje > 0 ? d / v.abordaje : 1;
          if (fraccion < FRACCION_DETENIDO) {
            return this._vistaBus('detenido', bus, 0, 0);
          }
          const f = (fraccion - FRACCION_DETENIDO) / (1 - FRACCION_DETENIDO);
          return this._vistaBus('abordando', bus, f, Math.round(bus.abordados * f));
        }
        if (d < v.abordaje + v.salida) {
          const f = v.salida > 0 ? (d - v.abordaje) / v.salida : 1;
          return this._vistaBus('saliendo', bus, f, bus.abordados);
        }
      } else if (d < v.abordaje) {
        return this._vistaBus('abordando', bus, 1, bus.abordados);
      }
    }
    if (!reducido) {
      const j = i + 1;
      if (j < this._buses.length) {
        const bus = this._buses[j];
        const v = this._ventanas[j];
        const falta = bus.tiempo - tiempo;
        if (v.aproximacion > 0 && falta >= 0 && falta <= v.aproximacion) {
          return this._vistaBus('aproximando', bus, 1 - falta / v.aproximacion, 0);
        }
      }
    }
    return null;
  }

  // ------------------------------------------------------------------
  // Datos para registro, gráficos y exportación
  // ------------------------------------------------------------------

  eventosRecientes(t, limite = 80) {
    const indice = this.indiceUltimoEvento(t);
    const desde = Math.max(0, indice - limite);
    return { indice, eventos: this.eventos.slice(desde, indice) };
  }

  serieAcumuladaHasta(t) {
    const indice = this.indiceUltimoEvento(t);
    return {
      indice,
      tiempos: this._acumulado.tiempos.slice(0, indice),
      llegados: this._acumulado.llegados.slice(0, indice),
      transportados: this._acumulado.transportados.slice(0, indice),
      pendientes: this._acumulado.pendientes.slice(0, indice),
    };
  }

  esperasHasta(t, maxPuntos = 3000) {
    const tiempo = clamp(Number(t) || 0, 0, this.duracion);
    let total = 0;
    let suma = 0;
    let maximo = 0;
    let corte = 0;
    for (const punto of this._esperas) {
      if (punto.t > tiempo + EPSILON) break;
      total += 1;
      suma += punto.w;
      if (punto.w > maximo) maximo = punto.w;
      corte += 1;
    }
    const paso = Math.max(1, Math.ceil(corte / maxPuntos));
    const puntos = [];
    const mediaAcumulada = [];
    let acumulado = 0;
    for (let i = 0; i < corte; i += 1) {
      const punto = this._esperas[i];
      acumulado += punto.w;
      const esUltimo = i === corte - 1;
      if (i % paso === 0 || esUltimo) {
        puntos.push({ t: punto.t, w: punto.w, id: punto.id });
      }
      if (i % paso === 0 || esUltimo) {
        mediaAcumulada.push({ t: punto.t, media: acumulado / (i + 1) });
      }
    }
    return {
      puntos,
      mediaAcumulada,
      total,
      media: total > 0 ? suma / total : 0,
      maximo,
      muestreado: paso > 1,
    };
  }

  busesHasta(t, maximo = 14) {
    const i = ultimoIndiceMenorOIgual(this.tiemposBuses, t);
    if (i < 0) return [];
    const desde = Math.max(0, i + 1 - maximo);
    return this._buses.slice(desde, i + 1);
  }
}

// --------------------------------------------------------------------
// Indicadores derivados del estado material
// --------------------------------------------------------------------

/**
 * Convierte un estado material en indicadores en vivo.
 * Definiciones:
 * - esperando: tamaño instantáneo de la cola.
 * - transportados: acumulado de pasajeros que ya abordaron.
 * - esperaMedia: media de los tiempos de espera de los pasajeros abordados.
 * - colaMediaTemporal: (área bajo la curva de cola en [0,t]) / t.
 * - ocupacionAcumulada: asientos ocupados tras el abordaje / capacidad total
 *   de los autobuses que llegaron hasta t (los que aún esperan no cuentan).
 */
export function estadisticasDeEstado(ejecucion, estado) {
  const t = estado.tiempo;
  const limite = ejecucion.limiteCola || LIMITE_VISUAL_MAX;
  return {
    tiempo: t,
    duracion: ejecucion.duracion,
    indice: estado.indice,
    llegados: estado.llegados,
    esperando: estado.cola.length,
    transportados: estado.transportados,
    autobuses: estado.autobuses,
    colaMax: estado.colaMax,
    limiteCola: limite,
    saturado: estado.cola.length >= limite,
    esperaMedia: estado.numEsperas > 0 ? estado.sumaEsperas / estado.numEsperas : 0,
    esperaMax: estado.esperaMax,
    numEsperas: estado.numEsperas,
    colaMediaTemporal: t > 0 ? ejecucion.areaColaHasta(t) / t : 0,
    ocupacionAcumulada:
      estado.capacidadAcumulada > 0 ? estado.ocupadosAcumulados / estado.capacidadAcumulada : 0,
    busesCompletos: estado.busesCompletos,
  };
}

// --------------------------------------------------------------------
// Textos y exportación CSV (derivados de eventos reales)
// --------------------------------------------------------------------

export function etiquetaEvento(ev) {
  if (ev.tipo === 'pasajero') return 'Llegada';
  if (ev.asientos_libres === 0) return 'Autobús lleno';
  return 'Autobús';
}

export function textoEvento(ev) {
  if (ev.tipo === 'pasajero') {
    return `Pasajero #${ev.pasajero_id} se incorpora a la cola · en espera: ${ev.cola}`;
  }
  return (
    `Autobús #${ev.autobus_id} · asientos libres: ${ev.asientos_libres}/${ev.capacidad}` +
    ` · abordan: ${ev.abordados} · cola: ${ev.cola_antes} → ${ev.cola}`
  );
}

export function csvEventos(ejecucion) {
  const filas = [
    'tiempo_min,tipo,id_pasajero,id_autobus,capacidad,asientos_libres,asientos_ocupados_al_llegar,cola_antes,abordados,cola_despues',
  ];
  for (const ev of ejecucion.eventos) {
    if (ev.tipo === 'pasajero') {
      filas.push([ev.tiempo.toFixed(4), 'pasajero', ev.pasajero_id, '', '', '', '', '', '', ev.cola].join(','));
    } else {
      filas.push(
        [
          ev.tiempo.toFixed(4),
          'autobus',
          '',
          ev.autobus_id,
          ev.capacidad,
          ev.asientos_libres,
          ev.asientos_ocupados_al_llegar,
          ev.cola_antes,
          ev.abordados,
          ev.cola,
        ].join(','),
      );
    }
  }
  return filas.join('\n');
}

export function csvResumen(ejecucion) {
  const filas = ['metrica,valor'];
  const r = ejecucion.resultados;
  const agregar = (nombre, valor) => filas.push(`${nombre},${valor}`);
  for (const [clave, valor] of Object.entries(ejecucion.config)) {
    agregar(`config_${clave}`, valor === null ? '' : valor);
  }
  for (const [clave, valor] of Object.entries(ejecucion.metricasTeoricas)) {
    agregar(`teorica_${clave}`, valor === null ? '' : valor);
  }
  for (const [clave, valor] of Object.entries(r)) {
    agregar(clave, valor === null ? '' : valor);
  }
  return filas.join('\n');
}
