/**
 * Escena animada de la parada de autobuses sobre Canvas 2D.
 *
 * Todo lo que muestra la escena procede del estado reconstruido por
 * `Ejecucion` (cola real, fases reales del autobús, asientos reales). La
 * animación solo interpola posiciones entre fotogramas; nunca inventa
 * llegadas, abordajes ni capacidades.
 */

import { clamp, mezclar, suavizar } from './util.js';
import { MAXIMO_FIGURAS } from './disposicion3d.js';

export const COLORES = {
  fondoEscena: '#0e1727',
  cielo: '#0b1424',
  acera: '#182231',
  aceraBorde: '#263345',
  calzada: '#0b1320',
  linea: '#22304a',
  texto: '#a5b5c7',
  claro: '#e7edf7',
  cian: '#43d1d0',
  espera: '#40d7dd',
  amarillo: '#ffc368',
  verde: '#5ee0a4',
  rojo: '#ff8c97',
  bus: '#2c405e',
  busOscuro: '#16233a',
  ventana: '#0f1c30',
  ocupado: '#55688a',
};

const FUENTE = "Inter, ui-sans-serif, system-ui, 'Segoe UI', Arial, sans-serif";

export class EscenaParada {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._posiciones = new Map();
    this._ultimoTiempoReal = null;
    this._faseAnimacion = 0;
  }

  /**
   * Dibuja el fotograma correspondiente a `vista`.
   * @param {object} vista Estado devuelto por la app (stats + bus + cola).
   * @param {number} ahoraReal performance.now().
   * @param {{snap?: boolean}} opciones snap = colocar figuras sin transición.
   */
  dibujar(vista, ahoraReal, { snap = false } = {}) {
    const { ctx, canvas } = this;
    const dpr = window.devicePixelRatio || 1;
    const ancho = Math.max(1, canvas.clientWidth);
    const alto = Math.max(1, canvas.clientHeight);
    const anchoFisico = Math.round(ancho * dpr);
    const altoFisico = Math.round(alto * dpr);
    if (canvas.width !== anchoFisico || canvas.height !== altoFisico) {
      canvas.width = anchoFisico;
      canvas.height = altoFisico;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._limpiar(ancho, alto);

    let dt = 0;
    if (this._ultimoTiempoReal !== null) {
      dt = clamp((ahoraReal - this._ultimoTiempoReal) / 1000, 0, 0.1);
    }
    this._ultimoTiempoReal = ahoraReal;
    this._faseAnimacion += dt;

    this._dibujarEscenario(ancho, alto, vista, dt, snap);

    if (!vista || vista.sinDatos) {
      this._dibujarMensaje(ancho, alto, 'Sin ejecución cargada', 'Pulse «Iniciar simulación» para calcular y reproducir una ejecución.');
      return;
    }
    if (vista.pausado) {
      this._dibujarMensaje(ancho, alto, 'PAUSADO', 'El reloj simulado está detenido.', true);
    } else if (vista.finalizado) {
      this._dibujarMensaje(ancho, alto, 'SIMULACIÓN FINALIZADA', 'Consulte los resultados finales y las réplicas.');
    }
  }

  _limpiar(ancho, alto) {
    const { ctx } = this;
    const gradiente = ctx.createRadialGradient(ancho * 0.5, alto * 0.1, 40, ancho * 0.5, alto * 0.6, Math.max(ancho, alto));
    gradiente.addColorStop(0, '#101c2f');
    gradiente.addColorStop(1, COLORES.cielo);
    ctx.fillStyle = gradiente;
    ctx.fillRect(0, 0, ancho, alto);
  }

  // ------------------------------------------------------------------
  // Estructuras de la escena
  // ------------------------------------------------------------------

  _disposicion(ancho, alto) {
    const bordeAcera = alto * 0.56;
    const baseAcera = alto * 0.70;
    const techoAutobus = alto * 0.72;
    const altoAutobus = clamp(alto * 0.24, 44, 74);
    const anchoAutobus = clamp(ancho * 0.44, 150, 330);
    const puertaX = ancho * 0.30;
    const paradaX = puertaX - anchoAutobus * 0.3;
    const inicioCola = puertaX + 26;
    const espacioCola = Math.max(60, ancho - inicioCola - 18);
    const columnasPorFila = Math.max(6, Math.floor(espacioCola / 21));
    const maxFiguras = MAXIMO_FIGURAS;
    return {
      bordeAcera,
      baseAcera,
      techoAutobus,
      altoAutobus,
      anchoAutobus,
      puertaX,
      paradaX,
      inicioCola,
      espacioCola,
      maxFiguras,
      columnasPorFila,
      separacion: 21,
    };
  }

  _dibujarEscenario(ancho, alto, vista, dt, snap) {
    const { ctx } = this;
    const L = this._disposicion(ancho, alto);

    ctx.fillStyle = COLORES.acera;
    ctx.fillRect(0, L.bordeAcera, ancho, L.baseAcera - L.bordeAcera);
    ctx.strokeStyle = COLORES.aceraBorde;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, L.bordeAcera + 0.5);
    ctx.lineTo(ancho, L.bordeAcera + 0.5);
    ctx.stroke();

    ctx.fillStyle = COLORES.calzada;
    ctx.fillRect(0, L.baseAcera, ancho, alto - L.baseAcera);
    ctx.strokeStyle = COLORES.linea;
    ctx.setLineDash([14, 12]);
    ctx.beginPath();
    ctx.moveTo(0, (L.baseAcera + alto) / 2 + 6);
    ctx.lineTo(ancho, (L.baseAcera + alto) / 2 + 6);
    ctx.stroke();
    ctx.setLineDash([]);

    this._dibujarMarquesina(ancho, alto, L, vista);
    this._procesarCola(vista, L, dt, snap);
    if (vista.bus) this._dibujarAutobus(L, vista, snap);
    this._dibujarContadores(ancho, alto, vista);
  }

  _dibujarMarquesina(ancho, alto, L, vista) {
    const { ctx } = this;
    const x0 = L.puertaX + 8;
    const anchoMarquesina = L.inicioCola + Math.min(L.maxFiguras, 24) * L.separacion - x0 + 8;
    const techoY = alto * 0.24;
    const cuerpoY = techoY + 10;

    ctx.fillStyle = 'rgba(18, 28, 42, 0.72)';
    ctx.fillRect(x0, cuerpoY, anchoMarquesina, L.baseAcera - cuerpoY - 14);
    ctx.strokeStyle = COLORES.aceraBorde;
    ctx.strokeRect(x0 + 0.5, cuerpoY + 0.5, anchoMarquesina, L.baseAcera - cuerpoY - 14);

    ctx.fillStyle = '#1d2a3d';
    ctx.fillRect(x0 - 6, techoY, anchoMarquesina + 12, 9);
    ctx.fillStyle = COLORES.cian;
    ctx.fillRect(x0 - 6, techoY, anchoMarquesina + 12, 2);

    ctx.fillStyle = '#1d2a3d';
    for (let x = x0 + 4; x <= x0 + anchoMarquesina - 4; x += Math.max(60, anchoMarquesina / 3)) {
      ctx.fillRect(x, cuerpoY, 4, L.baseAcera - cuerpoY - 14);
    }

    const posteX = L.puertaX - 16;
    ctx.fillStyle = '#3a4a63';
    ctx.fillRect(posteX, alto * 0.24, 4, L.baseAcera - alto * 0.24 - 12);
    ctx.fillStyle = COLORES.cian;
    this._rectanguloRedondeado(posteX - 21, alto * 0.24 - 18, 50, 20, 5);
    ctx.fill();
    ctx.fillStyle = '#06121c';
    ctx.font = `600 11px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PARADA', posteX + 4, alto * 0.24 - 7.5);
  }

  /**
   * Estado visual de la escena 2D: figuras dibujadas y límite aplicado.
   * Mantiene la misma forma que el diagnóstico de la escena 3D.
   */
  diagnostico() {
    return {
      es3d: false,
      detailed: this._posiciones.size,
      instanced: 0,
      visible: this._posiciones.size,
      max: MAXIMO_FIGURAS,
      zones: {},
      alert: false,
    };
  }

  _procesarCola(vista, L, dt, snap) {
    const { ctx } = this;
    const cola = vista.cola || [];
    const visibles = Math.min(cola.length, L.maxFiguras);
    const idsPresentes = new Set();
    const escala = clamp(this.canvas.clientHeight / 300, 0.85, 1.4);
    const filas = Math.max(1, Math.ceil(visibles / L.columnasPorFila));

    for (let i = 0; i < visibles; i += 1) {
      const id = cola[i];
      idsPresentes.add(id);
      const fila = Math.floor(i / L.columnasPorFila);
      const columna = i % L.columnasPorFila;
      const objetivo = L.inicioCola + columna * L.separacion;
      let posicion = this._posiciones.get(id);
      if (posicion === undefined) {
        posicion = { x: snap ? objetivo : Math.max(objetivo, this.canvas.clientWidth + 14), fase: Math.random() * Math.PI * 2, fila };
      }
      posicion.x = snap ? objetivo : suavizar(posicion.x, objetivo, dt, 7);
      posicion.fila = fila;
      posicion.fase += dt * 4;
      this._posiciones.set(id, posicion);
    }
    for (const id of Array.from(this._posiciones.keys())) {
      if (!idsPresentes.has(id)) this._posiciones.delete(id);
    }

    for (const id of idsPresentes) {
      const posicion = this._posiciones.get(id);
      const caminando = !snap && posicion.x > L.inicioCola + 1.5;
      const fila = posicion.fila || 0;
      const y = L.baseAcera - 12 - (filas - 1 - fila) * 15;
      this._dibujarFigura(posicion.x, y, escala, COLORES.espera, caminando ? posicion.fase : 0);
    }

    if (cola.length > visibles) {
      const x = L.inicioCola + (visibles % L.columnasPorFila) * L.separacion + 4;
      const fila = Math.floor(visibles / L.columnasPorFila);
      const y = L.baseAcera - 12 - (filas - fila) * 15;
      this._texto(`+${cola.length - visibles}`, x, y - 14, {
        color: COLORES.rojo,
        font: `700 ${12 * escala}px ${FUENTE}`,
      });
    }
  }

  _dibujarAutobus(L, vista, snap) {
    const { ctx, canvas } = this;
    const bus = vista.bus;
    const ancho = canvas.clientWidth;
    const alto = canvas.clientHeight;
    const escala = clamp(canvas.clientHeight / 300, 0.85, 1.4);
    const w = L.anchoAutobus;
    const h = L.altoAutobus;
    const y = L.techoAutobus;

    let x;
    if (bus.fase === 'aproximando') {
      const p = 1 - Math.pow(1 - bus.progreso, 2);
      x = mezclar(ancho + 24, L.paradaX, p);
    } else if (bus.fase === 'saliendo') {
      const p = Math.pow(bus.progreso, 1.4);
      x = mezclar(L.paradaX, -w - 24, p);
    } else {
      x = L.paradaX;
    }
    const abierta = bus.fase === 'detenido' || bus.fase === 'abordando';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + 6, w * 0.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    const gradiente = ctx.createLinearGradient(0, y, 0, y + h);
    gradiente.addColorStop(0, '#35506f');
    gradiente.addColorStop(1, COLORES.bus);
    ctx.fillStyle = gradiente;
    this._rectanguloRedondeado(x, y, w, h, 10);
    ctx.fill();

    ctx.fillStyle = 'rgba(67, 209, 208, 0.55)';
    ctx.fillRect(x + 4, y + 2, w - 8, 2.5);

    ctx.fillStyle = COLORES.ventana;
    this._rectanguloRedondeado(x + 10, y + 9, w - 20, h * 0.32, 4);
    ctx.fill();

    ctx.fillStyle = '#081423';
    this._rectanguloRedondeado(x + w * 0.30 - 1, y + 8, w * 0.17, h * 0.62, 4);
    ctx.fill();
    ctx.strokeStyle = abierta ? COLORES.verde : 'rgba(160, 190, 220, 0.35)';
    ctx.lineWidth = abierta ? 2 : 1;
    ctx.stroke();
    if (abierta) {
      ctx.fillStyle = 'rgba(94, 224, 164, 0.18)';
      ctx.fill();
    }

    ctx.fillStyle = '#0a0f18';
    ctx.beginPath();
    ctx.arc(x + w * 0.22, y + h - 2, h * 0.13, 0, Math.PI * 2);
    ctx.arc(x + w * 0.78, y + h - 2, h * 0.13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#06121c';
    this._rectanguloRedondeado(x + 12, y + h * 0.6, 34, 14, 3);
    ctx.fill();
    ctx.fillStyle = COLORES.cian;
    ctx.font = `700 ${10 * escala}px ${FUENTE}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`L1 · #${bus.id}`, x + 17, y + h * 0.6 + 7.5);

    this._dibujarBarraOcupacion(x, y - 34, w, bus, escala);
    this._dibujarFaseBus(x, y - 48, w, bus, escala);

    if (bus.fase === 'abordando' && bus.mostrados > 0) {
      this._dibujarCaminantes(L, bus, escala);
    }

    if (bus.fase === 'detenido' || bus.fase === 'abordando') {
      this._texto('puerta', x + w * 0.30 + 1, L.baseAcera - 2, {
        color: COLORES.verde,
        font: `600 ${9 * escala}px ${FUENTE}`,
        align: 'center',
      });
    }
  }

  _dibujarCaminantes(L, bus, escala) {
    const { ctx } = this;
    const total = Math.max(1, bus.abordados);
    const progreso = bus.progreso;
    for (let w = 0; w < bus.mostrados; w += 1) {
      const inicio = w / total;
      const local = clamp((progreso - inicio) * total, 0, 1);
      if (local <= 0) continue;
      const inicioX = L.inicioCola + w * L.separacion;
      const destinoX = L.puertaX + 2;
      const x = mezclar(inicioX, destinoX, 1 - Math.pow(1 - local, 2));
      const alfa = 1 - 0.65 * local;
      ctx.save();
      ctx.globalAlpha = Math.max(0.25, alfa);
      this._dibujarFigura(x, L.baseAcera - 12, escala, COLORES.verde, local * Math.PI * 3);
      ctx.restore();
    }
  }

  _dibujarBarraOcupacion(x, y, w, bus, escala) {
    const { ctx } = this;
    const alto = 7;
    const capacidad = Math.max(1, bus.capacidad);
    const ocupado = bus.ocupadosAlLlegar;
    const abordadosFinales = bus.abordados;
    const abordadosVisibles = Math.max(bus.mostrados, bus.fase === 'saliendo' ? abordadosFinales : 0);
    const libreFinal = Math.max(0, capacidad - ocupado - abordadosFinales);

    const anchoOcupado = (ocupado / capacidad) * w;
    const anchoAbordados = (abordadosVisibles / capacidad) * w;
    const anchoLibre = Math.max(0, w - anchoOcupado - anchoAbordados - (libreFinal / capacidad) * w);

    this._rectanguloRedondeado(x, y, w, alto, 3.5);
    ctx.fillStyle = COLORES.busOscuro;
    ctx.fill();
    ctx.fillStyle = COLORES.ocupado;
    ctx.fillRect(x + 1, y + 1, Math.max(0, anchoOcupado - 2), alto - 2);
    if (anchoAbordados > 1) {
      ctx.fillStyle = COLORES.verde;
      ctx.fillRect(x + anchoOcupado + 1, y + 1, anchoAbordados - 1, alto - 2);
    }
    if (anchoLibre > 1 && anchoOcupado + anchoAbordados > 1) {
      ctx.fillStyle = 'rgba(94, 224, 164, 0.10)';
      ctx.fillRect(x + anchoOcupado + anchoAbordados, y + 1, anchoLibre, alto - 2);
    }

    const etiqueta =
      bus.fase === 'aproximando'
        ? `Capacidad: ${capacidad} asientos`
        : `${ocupado}/${capacidad} ocupados al llegar · abordan ${bus.abordados}`;
    this._texto(etiqueta, x, y - 8, {
      color: COLORES.texto,
      font: `500 ${9.5 * escala}px ${FUENTE}`,
    });
  }

  _dibujarFaseBus(x, y, w, bus, escala) {
    const etiquetas = {
      aproximando: 'Aproximándose',
      detenido: 'Detenido · puertas abiertas',
      abordando: `Abordando ${bus.mostrados}/${bus.abordados}`,
      saliendo: 'Saliendo de la parada',
    };
    const colores = {
      aproximando: COLORES.amarillo,
      detenido: COLORES.amarillo,
      abordando: COLORES.amarillo,
      saliendo: COLORES.verde,
    };
    const texto = etiquetas[bus.fase] || '';
    const color = colores[bus.fase] || COLORES.texto;
    const { ctx } = this;
    ctx.font = `600 ${10.5 * escala}px ${FUENTE}`;
    const anchoTexto = ctx.measureText(texto).width + 18;
    ctx.fillStyle = 'rgba(10, 16, 27, 0.85)';
    this._rectanguloRedondeado(x, y, anchoTexto, 17, 8);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 8, y + 8.5, 2.6, 0, Math.PI * 2);
    ctx.fill();
    this._texto(texto, x + 14, y + 8.5, {
      color,
      font: `600 ${10.5 * escala}px ${FUENTE}`,
      baseline: 'middle',
    });
    if (bus.fase !== 'aproximando' && bus.asientosLibres === 0) {
      this._texto('Llegó sin asientos libres', x + anchoTexto + 10, y + 8.5, {
        color: COLORES.rojo,
        font: `600 ${10.5 * escala}px ${FUENTE}`,
        baseline: 'middle',
      });
    }
  }

  _dibujarContadores(ancho, alto, vista) {
    const { ctx } = this;
    const escala = clamp(alto / 300, 0.9, 1.3);
    ctx.font = `600 ${11 * escala}px ${FUENTE}`;
    const items = [
      { texto: `En espera: ${vista.esperando}`, color: COLORES.espera },
      { texto: `Transportados: ${vista.transportados}`, color: COLORES.verde },
      { texto: `Autobuses: ${vista.autobuses}`, color: COLORES.amarillo },
    ];
    if (vista.bus && (vista.bus.fase === 'detenido' || vista.bus.fase === 'abordando')) {
      items.push({ texto: `Abordan ahora: ${vista.bus.mostrados}/${vista.bus.abordados}`, color: COLORES.verde });
    }
    let x = 14;
    const y = 18;
    for (const item of items) {
      const texto = item.texto;
      const anchoTexto = ctx.measureText(texto).width + 16;
      ctx.fillStyle = 'rgba(10, 16, 27, 0.78)';
      this._rectanguloRedondeado(x, y - 11, anchoTexto, 22, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(38, 51, 69, 0.9)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(x + 9, y, 3, 0, Math.PI * 2);
      ctx.fill();
      this._texto(texto, x + 16, y, { color: COLORES.claro, font: `600 ${11 * escala}px ${FUENTE}`, baseline: 'middle' });
      x += anchoTexto + 8;
    }

    const reloj = `t = ${vista.reloj}`;
    ctx.font = `700 ${12.5 * escala}px ${FUENTE}`;
    const anchoReloj = ctx.measureText(reloj).width + 18;
    ctx.fillStyle = 'rgba(10, 16, 27, 0.78)';
    this._rectanguloRedondeado(ancho - anchoReloj - 14, y - 13, anchoReloj, 26, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(67, 209, 208, 0.5)';
    ctx.stroke();
    this._texto(reloj, ancho - anchoReloj / 2 - 14, y, {
      color: COLORES.cian,
      font: `700 ${12.5 * escala}px ${FUENTE}`,
      align: 'center',
      baseline: 'middle',
    });
  }

  // ------------------------------------------------------------------
  // Primitivas
  // ------------------------------------------------------------------

  _dibujarFigura(x, yBase, escala, color, fase = 0) {
    const { ctx } = this;
    const altoCuerpo = 13 * escala;
    const radio = 4 * escala;
    const bob = fase ? Math.sin(fase) * 1.3 * escala : 0;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, yBase - altoCuerpo - radio - bob + 2, radio, 0, Math.PI * 2);
    ctx.fill();
    this._rectanguloRedondeado(x - 4 * escala, yBase - altoCuerpo - bob, 8 * escala, altoCuerpo, 3.5 * escala);
    ctx.fill();
  }

  _rectanguloRedondeado(x, y, w, h, r) {
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

  _texto(texto, x, y, { color = COLORES.texto, font = `500 11px ${FUENTE}`, align = 'left', baseline = 'alphabetic' } = {}) {
    const { ctx } = this;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(texto, x, y);
  }

  _dibujarMensaje(ancho, alto, titulo, detalle, tenue = false) {
    const { ctx } = this;
    ctx.fillStyle = tenue ? 'rgba(10, 16, 27, 0.35)' : 'rgba(10, 16, 27, 0.72)';
    ctx.fillRect(0, 0, ancho, alto);
    this._texto(titulo, ancho / 2, alto / 2 - 8, {
      color: COLORES.claro,
      font: `700 ${Math.max(15, ancho / 42)}px ${FUENTE}`,
      align: 'center',
    });
    this._texto(detalle, ancho / 2, alto / 2 + 18, {
      color: COLORES.texto,
      font: `500 ${Math.max(11, ancho / 70)}px ${FUENTE}`,
      align: 'center',
    });
  }
}
