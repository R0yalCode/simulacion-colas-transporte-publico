/**
 * Registro de eventos recientes: ventana acotada derivada de los eventos
 * reales del motor. Solo re-renderiza cuando cambia el índice de eventos.
 */

import { formatearReloj } from './util.js';
import { etiquetaEvento, textoEvento } from './simulacion.js';

export class RegistroEventos {
  constructor(contenedor, { limite = 60 } = {}) {
    this.contenedor = contenedor;
    this.limite = limite;
    this._indice = -1;
  }

  limpiar() {
    this._indice = -1;
    this.contenedor.replaceChildren();
  }

  actualizar(ejecucion, t) {
    const { indice, eventos } = ejecucion.eventosRecientes(t, this.limite);
    if (indice === this._indice) return;
    this._indice = indice;
    const fragmento = document.createDocumentFragment();
    for (let i = eventos.length - 1; i >= 0; i -= 1) {
      fragmento.appendChild(this._fila(eventos[i]));
    }
    this.contenedor.replaceChildren(fragmento);
    this.contenedor.scrollTop = 0;
  }

  _fila(ev) {
    const fila = document.createElement('li');
    fila.className = 'evento';
    const tiempo = document.createElement('span');
    tiempo.className = 'evento__tiempo';
    tiempo.textContent = formatearReloj(ev.tiempo);
    const etiqueta = document.createElement('span');
    etiqueta.className = 'evento__etiqueta';
    const tipo = ev.tipo === 'pasajero' ? 'pasajero' : ev.asientos_libres === 0 ? 'lleno' : 'autobus';
    etiqueta.classList.add(`evento__etiqueta--${tipo}`);
    etiqueta.textContent = etiquetaEvento(ev);
    const detalle = document.createElement('span');
    detalle.className = 'evento__detalle';
    detalle.textContent = textoEvento(ev);
    fila.append(tiempo, etiqueta, detalle);
    return fila;
  }
}
