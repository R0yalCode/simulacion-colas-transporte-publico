/**
 * Gráficos en vivo sobre Canvas 2D (sin dependencias externas).
 *
 * Los cuatro gráficos comparten el mismo marco oscuro y se actualizan con el
 * reloj simulado: siempre muestran la información hasta el instante actual,
 * nunca el futuro de la ejecución. Al mover la línea de tiempo se reconstruyen
 * a partir del estado recalculado.
 */

import { clamp, formatearNumero, formatearReloj } from './util.js';

export const PALETA = {
  panel: '#0f1826',
  rejilla: '#1c2939',
  eje: '#2a3a4f',
  texto: '#a5b5c7',
  tenue: '#5f7288',
  claro: '#e7edf7',
  cian: '#43d1d0',
  espera: '#40d7dd',
  verde: '#5ee0a4',
  amarillo: '#ffc368',
  rojo: '#ff8c97',
  ocupado: '#55688a',
};

const FUENTE = "Inter, ui-sans-serif, system-ui, 'Segoe UI', Arial, sans-serif";

const MARGEN = { arriba: 26, derecha: 14, abajo: 26, izquierda: 44 };

function pasoBonito(rango, objetivo = 4) {
  if (!Number.isFinite(rango) || rango <= 0) return 1;
  const crudo = rango / objetivo;
  const magnitud = Math.pow(10, Math.floor(Math.log10(crudo)));
  const normalizado = crudo / magnitud;
  let paso;
  if (normalizado <= 1) paso = 1;
  else if (normalizado <= 2) paso = 2;
  else if (normalizado <= 5) paso = 5;
  else paso = 10;
  return paso * magnitud;
}

class GraficoBase {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.datos = null;
    this.cursor = null;
    this._programado = false;
    canvas.addEventListener('mousemove', (evento) => {
      const rect = canvas.getBoundingClientRect();
      this.cursor = { x: evento.clientX - rect.left, y: evento.clientY - rect.top };
      this._programar();
    });
    canvas.addEventListener('mouseleave', () => {
      if (this.cursor) {
        this.cursor = null;
        this._programar();
      }
    });
  }

  fijarDatos(datos) {
    this.datos = datos;
    this._programar();
  }

  _programar() {
    if (this._programado) return;
    this._programado = true;
    requestAnimationFrame(() => {
      this._programado = false;
      this.render();
    });
  }

  render() {
    const dpr = window.devicePixelRatio || 1;
    const ancho = this.canvas.clientWidth;
    const alto = this.canvas.clientHeight;
    if (!ancho || !alto) return;
    if (this.canvas.width !== Math.round(ancho * dpr) || this.canvas.height !== Math.round(alto * dpr)) {
      this.canvas.width = Math.round(ancho * dpr);
      this.canvas.height = Math.round(alto * dpr);
    }
    const { ctx } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, ancho, alto);
    const area = {
      x: MARGEN.izquierda,
      y: MARGEN.arriba,
      ancho: Math.max(10, ancho - MARGEN.izquierda - MARGEN.derecha),
      alto: Math.max(10, alto - MARGEN.arriba - MARGEN.abajo),
    };
    if (!this.datos) {
      this._texto('Sin datos aún', ancho / 2, alto / 2, { align: 'center', color: PALETA.tenue, font: `600 12px ${FUENTE}` });
      return;
    }
    this._dibujarContenido(ctx, area);
  }

  // ---------- primitivas ----------

  _marco(area, { xMax, yMax, etiquetaY, xTick = (v) => formatearReloj(v) }) {
    const { ctx } = this;
    const pasoY = pasoBonito(yMax, 4);
    ctx.strokeStyle = PALETA.rejilla;
    ctx.lineWidth = 1;
    ctx.font = `500 9.5px ${FUENTE}`;
    ctx.fillStyle = PALETA.tenue;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let valor = 0; valor <= yMax + 1e-9; valor += pasoY) {
      const y = area.y + area.alto - (valor / yMax) * area.alto;
      ctx.beginPath();
      ctx.moveTo(area.x, y + 0.5);
      ctx.lineTo(area.x + area.ancho, y + 0.5);
      ctx.stroke();
      ctx.fillText(formatearNumero(valor, valor % 1 === 0 ? 0 : 1), area.x - 6, y);
    }
    ctx.strokeStyle = PALETA.eje;
    ctx.beginPath();
    ctx.moveTo(area.x + 0.5, area.y);
    ctx.lineTo(area.x + 0.5, area.y + area.alto + 0.5);
    ctx.lineTo(area.x + area.ancho, area.y + area.alto + 0.5);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const divisiones = 4;
    for (let i = 0; i <= divisiones; i += 1) {
      const valor = (xMax * i) / divisiones;
      const x = area.x + (i / divisiones) * area.ancho;
      ctx.fillText(xTick(valor), x, area.y + area.alto + 7);
    }
    if (etiquetaY) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = PALETA.tenue;
      ctx.font = `600 9.5px ${FUENTE}`;
      ctx.fillText(etiquetaY, area.x + 2, area.y - 12);
    }
  }

  _aX(area, t, duracion) {
    return area.x + (clamp(t, 0, duracion) / Math.max(duracion, 1e-9)) * area.ancho;
  }

  _aY(area, v, yMax) {
    return area.y + area.alto - (clamp(v, 0, yMax) / Math.max(yMax, 1e-9)) * area.alto;
  }

  _trazoEscalon(area, puntos, duracion, yMax, color, grosor = 1.6) {
    if (puntos.length === 0) return;
    const { ctx } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = grosor;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let previaY = this._aY(area, puntos[0][1], yMax);
    ctx.moveTo(this._aX(area, puntos[0][0], duracion), previaY);
    for (let i = 1; i < puntos.length; i += 1) {
      const x = this._aX(area, puntos[i][0], duracion);
      ctx.lineTo(x, previaY);
      previaY = this._aY(area, puntos[i][1], yMax);
      ctx.lineTo(x, previaY);
    }
    ctx.stroke();
  }

  _marcadorTiempo(area, t, duracion, { color = PALETA.cian, y } = {}) {
    const { ctx } = this;
    const x = this._aX(area, t, duracion);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x + 0.5, area.y);
    ctx.lineTo(x + 0.5, area.y + area.alto);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    if (y !== undefined) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0a101b';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  _leyenda(area, items) {
    const { ctx } = this;
    ctx.font = `600 9.5px ${FUENTE}`;
    let x = area.x + area.ancho;
    const y = area.y - 12;
    ctx.textBaseline = 'alphabetic';
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const item = items[i];
      ctx.textAlign = 'right';
      const anchoTexto = ctx.measureText(item.texto).width;
      ctx.fillStyle = PALETA.texto;
      ctx.fillText(item.texto, x, y);
      x -= anchoTexto + 6;
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(x, y - 3.5, 3, 0, Math.PI * 2);
      ctx.fill();
      x -= 12;
    }
  }

  _tooltip(cursor, lineas, acento = PALETA.cian) {
    if (!cursor || !lineas || lineas.length === 0) return;
    const { ctx } = this;
    const ancho = this.canvas.clientWidth;
    const alto = this.canvas.clientHeight;
    ctx.font = `500 10.5px ${FUENTE}`;
    let anchoCaja = 0;
    for (const linea of lineas) {
      anchoCaja = Math.max(anchoCaja, ctx.measureText(linea).width);
    }
    anchoCaja += 20;
    const altoCaja = lineas.length * 14 + 12;
    let x = cursor.x + 12;
    let y = cursor.y + 12;
    if (x + anchoCaja > ancho - 6) x = cursor.x - anchoCaja - 12;
    if (y + altoCaja > alto - 6) y = cursor.y - altoCaja - 12;
    ctx.fillStyle = 'rgba(9, 15, 26, 0.94)';
    this._rectangulo(x, y, anchoCaja, altoCaja, 7);
    ctx.fill();
    ctx.strokeStyle = acento;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    lineas.forEach((linea, indice) => {
      ctx.fillStyle = indice === 0 ? PALETA.claro : PALETA.texto;
      ctx.fillText(linea, x + 10, y + 12 + indice * 14);
    });
  }

  _texto(texto, x, y, { color = PALETA.texto, font = `500 11px ${FUENTE}`, align = 'left', baseline = 'alphabetic' } = {}) {
    const { ctx } = this;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(texto, x, y);
  }

  _rectangulo(x, y, w, h, r) {
    const { ctx } = this;
    const radio = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radio, y);
    ctx.arcTo(x + w, y, x + w, y + h, radio);
    ctx.arcTo(x + w, y + h, x, y + h, radio);
    ctx.arcTo(x, y + h, x, y, radio);
    ctx.arcTo(x, y, x + w, y, radio);
    ctx.closePath();
  }
}

// --------------------------------------------------------------------
// Gráfico 1: evolución de la cola
// --------------------------------------------------------------------

export class GraficoCola extends GraficoBase {
  _dibujarContenido(ctx, area) {
    const { serie, tiempo, duracion, colaActual } = this.datos;
    let colaMax = 1;
    for (const [, q] of serie) if (q > colaMax) colaMax = q;
    const yMax = Math.max(1, Math.ceil((colaMax * 1.15) / 5) * 5);
    this._marco(area, { xMax: duracion, yMax, etiquetaY: 'pasajeros en cola (pas.)' });
    if (serie.length === 0) return;

    const x0 = this._aX(area, serie[0][0], duracion);
    ctx.beginPath();
    ctx.moveTo(x0, area.y + area.alto);
    for (const [t, q] of serie) ctx.lineTo(this._aX(area, t, duracion), this._aY(area, q, yMax));
    ctx.lineTo(this._aX(area, serie[serie.length - 1][0], duracion), area.y + area.alto);
    ctx.closePath();
    const gradiente = ctx.createLinearGradient(0, area.y, 0, area.y + area.alto);
    gradiente.addColorStop(0, 'rgba(67, 209, 208, 0.22)');
    gradiente.addColorStop(1, 'rgba(67, 209, 208, 0.02)');
    ctx.fillStyle = gradiente;
    ctx.fill();

    this._trazoEscalon(area, serie, duracion, yMax, PALETA.cian, 1.7);
    this._marcadorTiempo(area, tiempo, duracion, {
      color: PALETA.cian,
      y: this._aY(area, colaActual, yMax),
    });

    if (this.cursor) {
      const t = clamp(((this.cursor.x - area.x) / area.ancho) * duracion, 0, duracion);
      let valor = 0;
      for (const [ti, q] of serie) {
        if (ti <= t + 1e-9) valor = q;
        else break;
      }
      this._tooltip(this.cursor, [`Cola · t = ${formatearReloj(t)}`, `${formatearNumero(valor, 0)} pasajeros en espera`]);
    }
  }
}

// --------------------------------------------------------------------
// Gráfico 2: llegadas y abordajes acumulados
// --------------------------------------------------------------------

export class GraficoAcumulados extends GraficoBase {
  _dibujarContenido(ctx, area) {
    const { acumulado, tiempo, duracion, actual } = this.datos;
    const maximo = Math.max(5, actual.llegados + actual.pendientesInicial, actual.pendientes, actual.transportados);
    const yMax = Math.max(5, Math.ceil((maximo * 1.12) / 10) * 10);
    this._marco(area, { xMax: duracion, yMax, etiquetaY: 'pasajeros acumulados' });

    const aPuntos = (valores) => acumulado.tiempos.map((t, i) => [t, valores[i]]);
    this._trazoEscalon(area, aPuntos(acumulado.llegados), duracion, yMax, PALETA.cian, 1.6);
    this._trazoEscalon(area, aPuntos(acumulado.transportados), duracion, yMax, PALETA.verde, 1.6);
    this._trazoEscalon(area, aPuntos(acumulado.pendientes), duracion, yMax, PALETA.amarillo, 1.4);
    this._marcadorTiempo(area, tiempo, duracion, { color: PALETA.cian });

    this._leyenda(area, [
      { texto: 'Llegados', color: PALETA.cian },
      { texto: 'Transportados', color: PALETA.verde },
      { texto: 'Pendientes', color: PALETA.amarillo },
    ]);

    if (this.cursor) {
      const t = clamp(((this.cursor.x - area.x) / area.ancho) * duracion, 0, duracion);
      let indice = -1;
      for (let i = 0; i < acumulado.tiempos.length; i += 1) {
        if (acumulado.tiempos[i] <= t + 1e-9) indice = i;
        else break;
      }
      const llegados = indice >= 0 ? acumulado.llegados[indice] : 0;
      const transportados = indice >= 0 ? acumulado.transportados[indice] : 0;
      const pendientes = indice >= 0 ? acumulado.pendientes[indice] : 0;
      this._tooltip(this.cursor, [
        `Acumulados · t = ${formatearReloj(t)}`,
        `Llegados: ${llegados}`,
        `Transportados: ${transportados}`,
        `Pendientes: ${pendientes}`,
      ]);
    }
  }
}

// --------------------------------------------------------------------
// Gráfico 3: tiempos de espera
// --------------------------------------------------------------------

export class GraficoEsperas extends GraficoBase {
  _dibujarContenido(ctx, area) {
    const { esperas, tiempo, duracion } = this.datos;
    const yMax = Math.max(5, Math.ceil((esperas.maximo * 1.15) / 5) * 5);
    this._marco(area, { xMax: duracion, yMax, etiquetaY: 'espera por pasajero (min)' });

    ctx.fillStyle = 'rgba(64, 215, 221, 0.85)';
    for (const punto of esperas.puntos) {
      const x = this._aX(area, punto.t, duracion);
      const y = this._aY(area, punto.w, yMax);
      ctx.fillRect(x - 1.4, y - 1.4, 2.8, 2.8);
    }
    if (esperas.mediaAcumulada.length > 0) {
      ctx.strokeStyle = PALETA.verde;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      esperas.mediaAcumulada.forEach((punto, indice) => {
        const x = this._aX(area, punto.t, duracion);
        const y = this._aY(area, punto.media, yMax);
        if (indice === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    this._marcadorTiempo(area, tiempo, duracion, {
      color: PALETA.cian,
      y: esperas.total > 0 ? this._aY(area, esperas.media, yMax) : undefined,
    });
    this._leyenda(area, [
      { texto: `Abordados: ${esperas.total}`, color: PALETA.espera },
      { texto: 'Media acumulada', color: PALETA.verde },
    ]);
    if (esperas.total === 0) {
      this._texto('Aún no ha abordado ningún pasajero', area.x + area.ancho / 2, area.y + area.alto / 2, {
        align: 'center',
        color: PALETA.tenue,
        font: `600 11px ${FUENTE}`,
      });
    }

    if (this.cursor && esperas.total > 0) {
      this._tooltip(this.cursor, [
        `Esperas · solo pasajeros abordados`,
        `Registradas: ${esperas.total}`,
        `Media acumulada: ${formatearNumero(esperas.media)} min`,
        `Máxima: ${formatearNumero(esperas.maximo)} min`,
        esperas.muestreado ? 'Puntos muestreados por rendimiento' : `Puntos mostrados: ${esperas.puntos.length}`,
      ]);
    }
  }
}

// --------------------------------------------------------------------
// Gráfico 4: capacidad y ocupación por autobús
// --------------------------------------------------------------------

export class GraficoCapacidad extends GraficoBase {
  _dibujarContenido(ctx, area) {
    const { buses, capacidad } = this.datos;
    const yMax = Math.max(1, capacidad);
    this._marco(area, {
      xMax: Math.max(buses.length, 1),
      yMax,
      etiquetaY: 'asientos por autobús',
      xTick: (v) => {
        const indice = Math.round(v) - 1;
        if (indice < 0 || indice >= buses.length) return '';
        return `#${buses[indice].autobus_id}`;
      },
    });
    if (buses.length === 0) {
      this._texto('Todavía no ha llegado ningún autobús', area.x + area.ancho / 2, area.y + area.alto / 2, {
        align: 'center',
        color: PALETA.tenue,
        font: `600 11px ${FUENTE}`,
      });
      return;
    }
    const anchoBarra = clamp((area.ancho / buses.length) * 0.5, 8, 30);
    const escalaX = area.ancho / buses.length;
    let resaltado = -1;
    if (this.cursor) {
      const indice = Math.floor((this.cursor.x - area.x) / escalaX);
      if (indice >= 0 && indice < buses.length) resaltado = indice;
    }
    buses.forEach((bus, indice) => {
      const centro = area.x + escalaX * (indice + 0.5);
      const x = centro - anchoBarra / 2;
      const altoOcupado = (bus.ocupadosAlLlegar / yMax) * area.alto;
      const altoAbordados = (bus.abordados / yMax) * area.alto;
      const altoLibre = (bus.libresAlSalir / yMax) * area.alto;
      const base = area.y + area.alto;
      ctx.globalAlpha = resaltado === -1 || resaltado === indice ? 1 : 0.45;
      ctx.fillStyle = PALETA.ocupado;
      ctx.fillRect(x, base - altoOcupado, anchoBarra, altoOcupado);
      ctx.fillStyle = PALETA.verde;
      ctx.fillRect(x, base - altoOcupado - altoAbordados, anchoBarra, altoAbordados);
      ctx.fillStyle = 'rgba(67, 209, 208, 0.16)';
      ctx.fillRect(x, base - altoOcupado - altoAbordados - altoLibre, anchoBarra, altoLibre);
      ctx.globalAlpha = 1;
    });
    this._leyenda(area, [
      { texto: 'Ocupados al llegar', color: PALETA.ocupado },
      { texto: 'Abordan aquí', color: PALETA.verde },
      { texto: 'Libres al salir', color: PALETA.cian },
    ]);
    if (resaltado >= 0) {
      const bus = buses[resaltado];
      this._tooltip(
        this.cursor,
        [
          `Autobús #${bus.autobus_id} · t = ${formatearReloj(bus.tiempo)}`,
          `Ocupados al llegar: ${bus.ocupadosAlLlegar}/${bus.capacidad}`,
          `Asientos libres al llegar: ${bus.asientos_libres}`,
          `Abordan en esta parada: ${bus.abordados}`,
          `Libres al salir: ${bus.libresAlSalir}`,
          `Cola antes/después: ${bus.cola_antes} → ${bus.cola}`,
        ],
        PALETA.verde,
      );
    }
  }
}

export function crearGraficos() {
  return {
    cola: new GraficoCola(document.getElementById('grafico-cola')),
    acumulados: new GraficoAcumulados(document.getElementById('grafico-acumulados')),
    esperas: new GraficoEsperas(document.getElementById('grafico-esperas')),
    capacidad: new GraficoCapacidad(document.getElementById('grafico-capacidad')),
  };
}
