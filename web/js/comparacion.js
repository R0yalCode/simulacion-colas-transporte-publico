/**
 * Apartado «Comparación de los 3 casos base».
 *
 * Módulo de presentación: recibe el payload real de `/api/comparar` (motor
 * Python + réplicas reproducibles) y dibuja cuatro gráficas comparativas y una
 * tabla estadística. Nunca inventa datos: si un caso no tiene observaciones,
 * lo indica explícitamente en lugar de sustituir por cero.
 *
 * Cada gráfica reutiliza la base canvas de `graficos.js` (marco, escalas
 * adaptativas, tooltips y escala automática) y se integra con el mismo
 * componente de pantalla completa que el resto del dashboard.
 */

import { clamp, formatearEntero, formatearNumero, formatearReloj } from './util.js';
import {
  FUENTE,
  PALETA,
  GraficoBase,
  escalaYAdaptativa,
} from './graficos.js';

/** Colores diferenciados y estables para cada caso base. */
export const COLORES_CASOS = [PALETA.cian, PALETA.amarillo, PALETA.rojo, PALETA.verde];

const DASH_FINA = [5, 4];

function formatoCaso(indice) {
  return `Caso base ${indice + 1}`;
}

/** Máximo real de una serie, sin añadir valores artificiales. */
function maximoSerie(valores) {
  let maximo = 0;
  for (const valor of valores) {
    if (Number.isFinite(valor) && valor > maximo) maximo = valor;
  }
  return maximo;
}

/** Valor escalonado (última observación registrada) en el instante t. */
function valorEn(indice, t, serie) {
  let valor = serie.length > 0 ? serie[0] : 0;
  for (let i = 0; i <= indice && i < serie.length; i += 1) valor = serie[i];
  return valor;
}

/** Índice del último punto de la rejilla ≤ t. */
function indiceRejilla(rejilla, t) {
  let indice = -1;
  for (let i = 0; i < rejilla.length; i += 1) {
    if (rejilla[i] <= t + 1e-9) indice = i;
    else break;
  }
  return indice;
}

/**
 * Dibuja varias series temporales de cola usando el marco del dashboard.
 * Comparte escala Y adaptativa y una leyenda con las series visibles.
 */
class GraficoComparativoBase extends GraficoBase {
  constructor(canvas) {
    super(canvas);
    this._series = [];
    this._visibles = new Set();
    canvas.addEventListener('click', (evento) => {
      const rect = canvas.getBoundingClientRect();
      this.cursor = { x: evento.clientX - rect.left, y: evento.clientY - rect.top };
      const indice = this._indiceLeyendaEn(this.cursor);
      if (indice >= 0) this.alternarSerie(indice);
      this._programar();
    });
  }

  _preparar(casos, visibles) {
    const cambioDataSet = this.datos !== this._datosPrevios;
    this._datosPrevios = this.datos;
    this._series = casos.map((caso, indice) => ({
      caso,
      indice,
      color: COLORES_CASOS[indice % COLORES_CASOS.length],
      etiqueta: caso.nombre || formatoCaso(indice),
    }));
    if (visibles instanceof Set) {
      this._visibles = new Set(visibles);
    } else if (cambioDataSet || this._visibles.size === 0) {
      this._visibles = new Set(this._series.map((s) => s.indice));
    }
  }

  /** Manejador de clic sobre la leyenda para mostrar/ocultar series. */
  alternarSerie(indice) {
    if (this._visibles.has(indice)) this._visibles.delete(indice);
    else this._visibles.add(indice);
    this._programar();
  }

  _dibujarLeyendaInteractiva(area, items) {
    const { ctx } = this;
    ctx.font = `600 10px ${FUENTE}`;
    const y = area.y - 12;
    let x = area.x + 2;
    this._leyendaZonas = [];
    for (const item of items) {
      const anchoTexto = ctx.measureText(item.texto).width;
      const ancho = anchoTexto + 18;
      const zona = { x, y: y - 9, ancho, alto: 13, indice: item.indice };
      this._leyendaZonas.push(zona);
      ctx.globalAlpha = item.activa ? 1 : 0.4;
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(x + 5, y - 3.5, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETA.texto;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(item.texto, x + 12, y);
      ctx.globalAlpha = 1;
      x += ancho + 10;
    }
  }

  _indiceLeyendaEn(cursor) {
    if (!cursor || !this._leyendaZonas) return -1;
    for (const zona of this._leyendaZonas) {
      if (
        cursor.x >= zona.x &&
        cursor.x <= zona.x + zona.ancho &&
        cursor.y >= zona.y &&
        cursor.y <= zona.y + zona.alto
      ) {
        return zona.indice;
      }
    }
    return -1;
  }
}

// --------------------------------------------------------------------
// Gráfica 1: evolución de la cola (rejilla común de tiempo)
// --------------------------------------------------------------------

export class GraficoComparacionCola extends GraficoComparativoBase {
  _dibujarContenido(ctx, area) {
    const { casos, visibles, rejilla, duracion, tiempo } = this.datos;
    this._preparar(casos, visibles);
    const activos = this._series.filter((serie) => this._visibles.has(serie.indice));

    let maximo = 0;
    for (const serie of activos) {
      maximo = Math.max(maximo, maximoSerie(serie.caso.cola_media));
    }
    const escala = escalaYAdaptativa(maximo);
    const yMaximo = escala.maximo;
    const xMax = duracion > 0 ? duracion : Math.max(...rejilla, 1);
    this._marco(area, {
      xMax,
      yMax: yMaximo,
      pasoY: escala.paso,
      etiquetaY: 'cola media (pasajeros)',
    });

    const limite = Math.min(xMax, Number(tiempo) || xMax);
    const xFin = this._aX(area, limite, xMax);

    for (const serie of activos) {
      const valores = serie.caso.cola_media;
      ctx.save();
      ctx.beginPath();
      ctx.rect(area.x, area.y, xFin - area.x, area.alto);
      ctx.clip();
      ctx.strokeStyle = serie.color;
      ctx.lineWidth = 1.7;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      rejilla.forEach((t, i) => {
        const x = this._aX(area, t, xMax);
        const y = this._aY(area, valores[i] || 0, yMaximo);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    this._dibujarLeyendaInteractiva(
      area,
      this._series.map((serie) => ({
        texto: serie.etiqueta,
        color: serie.color,
        indice: serie.indice,
        activa: this._visibles.has(serie.indice),
      })),
    );

    if (activos.length === 0) {
      this._texto('Ninguna serie seleccionada · pulse la leyenda', area.x + area.ancho / 2, area.y + area.alto / 2, {
        align: 'center',
        color: PALETA.tenue,
        font: `600 11px ${FUENTE}`,
      });
      return;
    }

    const seleccion = this._indiceLeyendaEn(this.cursor);
    if (this.cursor && seleccion === -1) {
      const t = clamp(((this.cursor.x - area.x) / area.ancho) * xMax, 0, limite);
      const indice = Math.max(0, indiceRejilla(rejilla, t));
      const lineas = [`Cola media · t = ${formatearReloj(t)}`];
      for (const serie of this._series) {
        if (!this._visibles.has(serie.indice)) continue;
        lineas.push(`${serie.etiqueta}: ${formatearNumero(valorEn(indice, t, serie.caso.cola_media), 1)} pas.`);
      }
      this._tooltip(this.cursor, lineas, activos[0].color);
    }
  }
}

// --------------------------------------------------------------------
// Gráfica 2: distribución de los tamaños de cola por caso base
// --------------------------------------------------------------------

export class GraficoComparacionBoxplot extends GraficoComparativoBase {
  _dibujarContenido(ctx, area) {
    const { casos, visibles } = this.datos;
    this._preparar(casos, visibles);
    const activos = this._series.filter((serie) => this._visibles.has(serie.indice));

    let maximo = 0;
    for (const serie of activos) {
      const stats = serie.caso.distribucion_cola;
      if (stats && Number.isFinite(stats.p95)) maximo = Math.max(maximo, stats.p95);
      if (stats && Number.isFinite(stats.maximo)) maximo = Math.max(maximo, stats.maximo);
    }
    const yMaximo = Math.max(1, Math.ceil(maximo * 1.1));
    this._marco(area, {
      xMax: Math.max(activos.length, 1),
      yMax: yMaximo,
      pasoY: undefined,
      etiquetaY: 'tamaño de cola (pasajeros)',
      xTick: (v) => {
        const serie = activos[Math.round(v) - 1];
        return serie ? `Caso ${serie.indice + 1}` : '';
      },
    });

    if (activos.length === 0) {
      this._texto('Sin series seleccionadas', area.x + area.ancho / 2, area.y + area.alto / 2, {
        align: 'center',
        color: PALETA.tenue,
        font: `600 11px ${FUENTE}`,
      });
      return;
    }

    const anchoCaja = clamp((area.ancho / activos.length) * 0.42, 14, 60);
    const escalaX = area.ancho / activos.length;
    let resaltado = -1;
    if (this.cursor) {
      const indice = Math.floor((this.cursor.x - area.x) / escalaX);
      if (indice >= 0 && indice < activos.length) resaltado = indice;
    }

    activos.forEach((serie, posicion) => {
      const stats = serie.caso.distribucion_cola;
      const centro = area.x + escalaX * (posicion + 0.5);
      const x = centro - anchoCaja / 2;
      ctx.globalAlpha = resaltado === -1 || resaltado === posicion ? 1 : 0.5;
      ctx.fillStyle = serie.color;
      ctx.strokeStyle = serie.color;
      ctx.lineWidth = 1.4;
      if (!stats || stats.n === 0) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = PALETA.tenue;
        ctx.fillRect(x, area.y + area.alto - 2, anchoCaja, 2);
        ctx.globalAlpha = 1;
        return;
      }
      const yMin = this._aY(area, stats.minimo, yMaximo);
      const yMax = this._aY(area, stats.maximo, yMaximo);
      const yQ1 = this._aY(area, stats.p25, yMaximo);
      const yMed = this._aY(area, stats.mediana, yMaximo);
      const yQ3 = this._aY(area, stats.p75, yMaximo);

      ctx.beginPath();
      ctx.moveTo(centro, yMin);
      ctx.lineTo(centro, yMax);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(centro - anchoCaja * 0.25, yMin);
      ctx.lineTo(centro + anchoCaja * 0.25, yMin);
      ctx.moveTo(centro - anchoCaja * 0.25, yMax);
      ctx.lineTo(centro + anchoCaja * 0.25, yMax);
      ctx.stroke();

      ctx.globalAlpha = 0.22;
      ctx.fillRect(x, yQ3, anchoCaja, yQ1 - yQ3);
      ctx.globalAlpha = 1;
      ctx.strokeRect(x, yQ3, anchoCaja, yQ1 - yQ3);

      const ramp = ctx.createLinearGradient(x, yQ1, x + anchoCaja, yQ1);
      ramp.addColorStop(0, serie.color);
      ramp.addColorStop(1, serie.color);
      ctx.fillStyle = ramp;
      ctx.fillRect(x, yQ1, anchoCaja, yQ3 - yQ1);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = serie.color;
      ctx.fillRect(x, yQ1, anchoCaja, yQ3 - yQ1);
      ctx.globalAlpha = 1;

      ctx.fillStyle = PALETA.claro;
      ctx.fillRect(x, yMed - 1.1, anchoCaja, 2.2);
      ctx.globalAlpha = 1;
    });

    if (resaltado >= 0) {
      const serie = activos[resaltado];
      const stats = serie.caso.distribucion_cola;
      const lineas = [`${serie.etiqueta} · distribución de la cola`];
      if (stats && stats.n > 0) {
        lineas.push(`Observaciones: ${formatearEntero(stats.n)}`);
        lineas.push(`Media: ${formatearNumero(stats.media, 1)} · Mediana: ${formatearNumero(stats.mediana, 1)}`);
        lineas.push(`P25–P75: ${formatearNumero(stats.p25, 1)} – ${formatearNumero(stats.p75, 1)}`);
        lineas.push(`P90: ${formatearNumero(stats.p90, 1)} · P95: ${formatearNumero(stats.p95, 1)}`);
        lineas.push(`Máximo: ${formatearNumero(stats.maximo, 1)}`);
      } else {
        lineas.push('Sin observaciones registradas');
      }
      this._tooltip(this.cursor, lineas, serie.color);
    }

    this._leyenda(area, activos.map((serie) => ({ texto: serie.etiqueta, color: serie.color })));
  }
}

// --------------------------------------------------------------------
// Gráfica 3: comparación de los tiempos de espera (boxplot + media temporal)
// --------------------------------------------------------------------

export class GraficoComparacionEsperas extends GraficoComparativoBase {
  _dibujarContenido(ctx, area) {
    const { casos, visibles, rejilla, duracion } = this.datos;
    this._preparar(casos, visibles);
    const activos = this._series.filter((serie) => this._visibles.has(serie.indice));

    let maximo = 0;
    for (const serie of activos) {
      const stats = serie.caso.esperas_resumen;
      if (stats) maximo = Math.max(maximo, stats.p95 || 0, stats.maximo || 0);
    }
    const yMaximo = Math.max(1, Math.ceil(maximo * 1.1));
    this._marco(area, {
      xMax: Math.max(activos.length, 1),
      yMax: yMaximo,
      etiquetaY: 'tiempo de espera (min)',
      xTick: (v) => {
        const serie = activos[Math.round(v) - 1];
        return serie ? `Caso ${serie.indice + 1}` : '';
      },
    });

    if (activos.length === 0) {
      this._texto('Sin datos de espera para los casos seleccionados', area.x + area.ancho / 2, area.y + area.alto / 2, {
        align: 'center',
        color: PALETA.tenue,
        font: `600 11px ${FUENTE}`,
      });
      return;
    }

    const anchoCaja = clamp((area.ancho / activos.length) * 0.42, 14, 60);
    const escalaX = area.ancho / activos.length;
    let resaltado = -1;
    if (this.cursor) {
      const indice = Math.floor((this.cursor.x - area.x) / escalaX);
      if (indice >= 0 && indice < activos.length) resaltado = indice;
    }

    activos.forEach((serie, posicion) => {
      const stats = serie.caso.esperas_resumen;
      const centro = area.x + escalaX * (posicion + 0.5);
      const x = centro - anchoCaja / 2;
      ctx.globalAlpha = resaltado === -1 || resaltado === posicion ? 1 : 0.5;
      if (!stats || stats.n === 0) {
        ctx.fillStyle = PALETA.tenue;
        ctx.fillRect(x, area.y + area.alto - 2, anchoCaja, 2);
        ctx.globalAlpha = 1;
        return;
      }
      const yMin = this._aY(area, 0, yMaximo);
      const yMax = this._aY(area, stats.maximo, yMaximo);
      const yQ1 = this._aY(area, stats.p25, yMaximo);
      const yMed = this._aY(area, stats.mediana, yMaximo);
      const yQ3 = this._aY(area, stats.p75, yMaximo);

      ctx.strokeStyle = serie.color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(centro, yMin);
      ctx.lineTo(centro, yMax);
      ctx.moveTo(centro - anchoCaja * 0.25, yMax);
      ctx.lineTo(centro + anchoCaja * 0.25, yMax);
      ctx.stroke();

      ctx.globalAlpha = 0.28;
      ctx.fillStyle = serie.color;
      ctx.fillRect(x, yQ3, anchoCaja, yQ1 - yQ3);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = serie.color;
      ctx.strokeRect(x, yQ3, anchoCaja, yQ1 - yQ3);
      ctx.fillStyle = PALETA.claro;
      ctx.fillRect(x, yMed - 1.1, anchoCaja, 2.2);

      // Marca de la media (rombo) para comparar con la mediana.
      const yMedia = this._aY(area, stats.media, yMaximo);
      ctx.fillStyle = serie.color;
      ctx.beginPath();
      ctx.moveTo(centro, yMedia - 4);
      ctx.lineTo(centro + 4, yMedia);
      ctx.lineTo(centro, yMedia + 4);
      ctx.lineTo(centro - 4, yMedia);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    if (resaltado >= 0) {
      const serie = activos[resaltado];
      const stats = serie.caso.esperas_resumen;
      const lineas = [`${serie.etiqueta} · tiempos de espera (abordados)`];
      if (stats && stats.n > 0) {
        lineas.push(`Pasajeros abordados: ${formatearEntero(stats.n)}`);
        lineas.push(`Media: ${formatearNumero(stats.media)} min · Mediana: ${formatearNumero(stats.mediana)} min`);
        lineas.push(`P90: ${formatearNumero(stats.p90)} min · P95: ${formatearNumero(stats.p95)} min`);
        lineas.push(`Máximo: ${formatearNumero(stats.maximo)} min`);
      } else {
        lineas.push('Sin tiempos de espera completados');
      }
      this._tooltip(this.cursor, lineas, serie.color);
    }

    this._leyenda(area, [
      ...activos.map((serie) => ({ texto: serie.etiqueta, color: serie.color })),
      { texto: '◈ media · — mediana', color: PALETA.tenue },
    ]);
  }
}

// --------------------------------------------------------------------
// Gráfica 4: llegadas acumuladas frente a transportados acumulados
// --------------------------------------------------------------------

export class GraficoComparacionDemanda extends GraficoComparativoBase {
  _dibujarContenido(ctx, area) {
    const { casos, visibles, rejilla, duracion, tiempo } = this.datos;
    this._preparar(casos, visibles);
    const activos = this._series.filter((serie) => this._visibles.has(serie.indice));

    let maximo = 0;
    for (const serie of activos) {
      maximo = Math.max(
        maximo,
        maximoSerie(serie.caso.llegadas_acumuladas),
        maximoSerie(serie.caso.transportados_acumulados),
      );
    }
    const escala = escalaYAdaptativa(maximo);
    const yMaximo = escala.maximo;
    const xMax = duracion > 0 ? duracion : Math.max(...rejilla, 1);
    this._marco(area, {
      xMax,
      yMax: yMaximo,
      pasoY: escala.paso,
      etiquetaY: 'pasajeros acumulados',
    });

    const limite = Math.min(xMax, Number(tiempo) || xMax);
    const xFin = this._aX(area, limite, xMax);

    for (const serie of activos) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(area.x, area.y, xFin - area.x, area.alto);
      ctx.clip();
      // Llegadas (continua) y transportados (discontinua) del mismo caso.
      ctx.strokeStyle = serie.color;
      ctx.lineWidth = 1.7;
      ctx.setLineDash([]);
      ctx.beginPath();
      rejilla.forEach((t, i) => {
        const x = this._aX(area, t, xMax);
        const y = this._aY(area, serie.caso.llegadas_acumuladas[i] || 0, yMaximo);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash(DASH_FINA);
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      rejilla.forEach((t, i) => {
        const x = this._aX(area, t, xMax);
        const y = this._aY(area, serie.caso.transportados_acumulados[i] || 0, yMaximo);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    if (activos.length === 0) {
      this._texto('Sin series seleccionadas', area.x + area.ancho / 2, area.y + area.alto / 2, {
        align: 'center',
        color: PALETA.tenue,
        font: `600 11px ${FUENTE}`,
      });
      return;
    }

    this._leyenda(area, [
      ...activos.map((serie) => ({ texto: serie.etiqueta, color: serie.color })),
      { texto: '— llegadas · ┄ transportados', color: PALETA.tenue },
    ]);

    const seleccion = this._indiceLeyendaEn(this.cursor);
    if (this.cursor && seleccion === -1) {
      const t = clamp(((this.cursor.x - area.x) / area.ancho) * xMax, 0, limite);
      const indice = Math.max(0, indiceRejilla(rejilla, t));
      const lineas = [`Acumulados medios · t = ${formatearReloj(t)}`];
      for (const serie of this._series) {
        if (!this._visibles.has(serie.indice)) continue;
        const llego = valorEn(indice, t, serie.caso.llegadas_acumuladas);
        const trans = valorEn(indice, t, serie.caso.transportados_acumulados);
        lineas.push(`${serie.etiqueta}: ${formatearNumero(llego, 1)} llegados · ${formatearNumero(trans, 1)} transportados`);
      }
      this._tooltip(this.cursor, lineas, activos[0].color);
    }
  }
}

// --------------------------------------------------------------------
// Normalización de la respuesta del servidor
// --------------------------------------------------------------------

/** Estadísticos de distribución de una serie temporal de cola. */
export function distribucionSerie(serie) {
  const valores = serie.map((p) => p[1]);
  if (valores.length === 0) return { n: 0 };
  const ordenados = [...valores].sort((a, b) => a - b);
  const cuantil = (p) => {
    if (ordenados.length === 1) return ordenados[0];
    const posicion = (ordenados.length - 1) * p;
    const bajo = Math.floor(posicion);
    const alto = Math.min(bajo + 1, ordenados.length - 1);
    const fraccion = posicion - bajo;
    return ordenados[bajo] + (ordenados[alto] - ordenados[bajo]) * fraccion;
  };
  return {
    n: valores.length,
    minimo: ordenados[0],
    maximo: ordenados[ordenados.length - 1],
    media: valores.reduce((a, b) => a + b, 0) / valores.length,
    mediana: cuantil(0.5),
    p25: cuantil(0.25),
    p75: cuantil(0.75),
    p90: cuantil(0.9),
    p95: cuantil(0.95),
  };
}

/** Estadísticos de los tiempos de espera individuales (pasajeros abordados). */
export function distribucionEsperas(tiempos, valores) {
  if (!valores || valores.length === 0) return { n: 0 };
  const ordenados = [...valores].sort((a, b) => a - b);
  const cuantil = (p) => {
    if (ordenados.length === 1) return ordenados[0];
    const posicion = (ordenados.length - 1) * p;
    const bajo = Math.floor(posicion);
    const alto = Math.min(bajo + 1, ordenados.length - 1);
    const fraccion = posicion - bajo;
    return ordenados[bajo] + (ordenados[alto] - ordenados[bajo]) * fraccion;
  };
  return {
    n: valores.length,
    media: valores.reduce((a, b) => a + b, 0) / valores.length,
    mediana: cuantil(0.5),
    p25: cuantil(0.25),
    p75: cuantil(0.75),
    p90: cuantil(0.9),
    p95: cuantil(0.95),
    maximo: ordenados[ordenados.length - 1],
  };
}

/**
 * Normaliza el payload de `/api/comparar` en la estructura que consumen las
 * gráficas. Duraciones distintas: la rejilla común llega del servidor, de modo
 * que nunca se inventan valores para igualar series.
 */
export function normalizarComparacion(payload) {
  const casos = Array.isArray(payload && payload.casos) ? payload.casos : [];
  return {
    numRepeticiones: payload ? payload.num_repeticiones : 0,
    semillaBase: payload ? payload.semilla_base : null,
    casos: casos.map((caso, indice) => {
      const distribucion_cola = distribucionSerie(
        (caso.rejilla || []).map((t, i) => [t, (caso.cola_media || [])[i] || 0]),
      );
      const esperas = caso.esperas || { tiempos: [], valores: [] };
      const esperas_resumen = distribucionEsperas(esperas.tiempos, esperas.valores);
      const resumen = caso.resumen || {};
      return {
        ...caso,
        indice,
        color: COLORES_CASOS[indice % COLORES_CASOS.length],
        etiqueta: caso.nombre || formatoCaso(indice),
        distribucion_cola,
        esperas_resumen,
        resumen,
        llegadas_total: resumen.pasajeros_llegados,
        transportados_total: resumen.pasajeros_transportados,
        restantes_total: resumen.pasajeros_restantes,
        pct_transportados: resumen.pct_transportados,
        pct_restantes: resumen.pct_restantes,
      };
    }),
  };
}

// --------------------------------------------------------------------
// Tabla estadística
// --------------------------------------------------------------------

const DEFINICION_TABLA = [
  {
    clave: 'pasajeros_llegados',
    etiqueta: 'Pasajeros que llegaron',
    unidad: 'pasajeros',
    formato: (valor) => formatearNumero(valor, 1),
  },
  {
    clave: 'pasajeros_transportados',
    etiqueta: 'Pasajeros transportados',
    unidad: 'pasajeros',
    formato: (valor) => formatearNumero(valor, 1),
  },
  {
    clave: 'cola_maxima',
    etiqueta: 'Tamaño máximo de la fila',
    unidad: 'pasajeros',
    formato: (valor) => formatearNumero(valor, 1),
  },
  {
    clave: 'cola_media_temporal',
    etiqueta: 'Tamaño promedio de la fila',
    unidad: 'pasajeros',
    formato: (valor) => formatearNumero(valor, 2),
  },
  {
    clave: 'espera_media',
    etiqueta: 'Tiempo de espera promedio',
    unidad: 'min',
    formato: (valor) => formatearNumero(valor, 2),
  },
  {
    clave: 'espera_mediana',
    etiqueta: 'Tiempo de espera mediano',
    unidad: 'min',
    formato: (valor) => formatearNumero(valor, 2),
  },
  {
    clave: 'espera_p90',
    etiqueta: 'Espera P90',
    unidad: 'min',
    formato: (valor) => formatearNumero(valor, 2),
  },
  {
    clave: 'pasajeros_restantes',
    etiqueta: 'Pasajeros que quedaron esperando',
    unidad: 'pasajeros',
    formato: (valor) => formatearNumero(valor, 1),
  },
  {
    clave: 'pct_transportados',
    etiqueta: 'Porcentaje transportado',
    unidad: '%',
    formato: (valor) => `${formatearNumero(valor, 1)} %`,
  },
  {
    clave: 'pct_restantes',
    etiqueta: 'Porcentaje pendiente al final',
    unidad: '%',
    formato: (valor) => `${formatearNumero(valor, 1)} %`,
  },
];

/** Celdas de la tabla a partir de los casos normalizados. */
export function filasTabla(datos) {
  return DEFINICION_TABLA.map((definicion) => ({
    etiqueta: definicion.etiqueta,
    unidad: definicion.unidad,
    valores: datos.casos.map((caso) => {
      const bruto = caso.resumen ? caso.resumen[definicion.clave] : undefined;
      if (bruto === undefined || bruto === null || !Number.isFinite(Number(bruto))) {
        return { disponible: false, texto: 'No disponible' };
      }
      return { disponible: true, texto: definicion.formato(Number(bruto)) };
    }),
  }));
}

// --------------------------------------------------------------------
// Indicadores comparativos resumidos
// --------------------------------------------------------------------

/**
 * Deriva, de los datos reales, el caso con mejor valor en cada métrica.
 * Devuelve null si no hay datos suficientes; nunca declara un «mejor» absoluto.
 */
export function indicadoresComparativos(datos) {
  const casos = datos.casos.filter((caso) => caso.resumen && caso.distribucion_cola.n > 0);
  if (casos.length === 0) return [];
  const menor = (clave) => {
    let mejor = null;
    for (const caso of casos) {
      const valor = Number(caso.resumen[clave]);
      if (!Number.isFinite(valor)) continue;
      if (mejor === null || valor < mejor.valor) mejor = { caso, valor };
    }
    return mejor;
  };
  const mayor = (clave) => {
    let mejor = null;
    for (const caso of casos) {
      const valor = Number(caso.resumen[clave]);
      if (!Number.isFinite(valor)) continue;
      if (mejor === null || valor > mejor.valor) mejor = { caso, valor };
    }
    return mejor;
  };
  const definiciones = [
    {
      etiqueta: 'Menor cola media',
      obtenido: menor('cola_media_temporal'),
      formato: (v) => `${formatearNumero(v, 2)} pas.`,
    },
    {
      etiqueta: 'Menor espera media',
      obtenido: menor('espera_media'),
      formato: (v) => `${formatearNumero(v, 2)} min`,
    },
    {
      etiqueta: 'Mayor número transportado',
      obtenido: mayor('pasajeros_transportados'),
      formato: (v) => `${formatearNumero(v, 1)} pas.`,
    },
    {
      etiqueta: 'Menor proporción pendiente',
      obtenido: menor('pct_restantes'),
      formato: (v) => `${formatearNumero(v, 1)} %`,
    },
  ];
  return definiciones
    .filter((definicion) => definicion.obtenido !== null)
    .map((definicion) => ({
      etiqueta: definicion.etiqueta,
      caso: definicion.obtenido.caso.etiqueta,
      color: definicion.obtenido.caso.color,
      valor: definicion.formato(definicion.obtenido.valor),
    }));
}

// --------------------------------------------------------------------
// Renderizado de la sección completa
// --------------------------------------------------------------------

/** Formatea la condición de comparabilidad de los escenarios. */
function advertenciaComparabilidad(datos) {
  const duraciones = new Set(datos.casos.map((caso) => Math.round(caso.duracion)));
  if (duraciones.size > 1) {
    return `Atención: los casos tienen duraciones distintas (${[...duraciones]
      .map((d) => formatearReloj(d))
      .join(', ')}). Las series se muestran sobre una rejilla común y cada punto refleja el estado real hasta ese instante.`;
  }
  return 'Los tres casos comparten duración, parámetros de autobús y semilla base, por lo que sus resultados son comparables.';
}

export function renderizarComparacion(datos) {
  return {
    resumen: resumenEscenarios(datos),
    advertencia: advertenciaComparabilidad(datos),
    indicadores: indicadoresComparativos(datos),
    tabla: filasTabla(datos),
  };
}

/** Pequeño resumen descriptivo de cada caso base (parámetros y ρ). */
function resumenEscenarios(datos) {
  return datos.casos.map((caso) => ({
    nombre: caso.etiqueta,
    color: caso.color,
    id: caso.id,
    lambda: caso.parametros ? caso.parametros.lambda_p : null,
    mu: caso.mu,
    rho: caso.rho,
    duracion: caso.duracion,
    estado: caso.clasificacion ? caso.clasificacion.etiqueta : '—',
    severidad: caso.clasificacion ? caso.clasificacion.severidad : 'inactivo',
  }));
}
const formatos = { formatoCaso, advertenciaComparabilidad };
