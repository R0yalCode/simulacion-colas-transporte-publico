/**
 * Reloj simulado de la capa de reproducción.
 *
 * Traduce tiempo real transcurrido a tiempo simulado multiplicando por la
 * velocidad elegida. Nunca participa en el cálculo del motor: los eventos ya
 * están precalculados y este reloj solo decide qué instante se muestra.
 */

import { clamp } from './util.js';

export const VELOCIDADES = [0.5, 1, 1.5, 2, 2.5];
export const VELOCIDAD_INICIAL = 1;
/** Ritmo base a 1×: minutos simulados por segundo real. */
export const MINUTOS_POR_SEGUNDO_BASE = 2.0;
/** Salto máximo de tiempo real (s) aceptado entre fotogramas. */
export const SALTO_MAXIMO_REAL = 0.25;

export class RelojSimulado {
  constructor({ duracion, velocidad = VELOCIDAD_INICIAL, base = MINUTOS_POR_SEGUNDO_BASE } = {}) {
    this.duracion = Math.max(0, duracion || 0);
    this.velocidad = VELOCIDADES.includes(velocidad) ? velocidad : VELOCIDAD_INICIAL;
    this.base = base;
    this.tiempo = 0;
    this.reproduciendo = false;
    this._referenciaReal = null;
  }

  minutosPorSegundo() {
    return this.base * this.velocidad;
  }

  iniciar() {
    if (this.reproduciendo) return;
    if (this.tiempo >= this.duracion) this.tiempo = 0;
    this.reproduciendo = true;
    this._referenciaReal = null;
  }

  pausar() {
    this.reproduciendo = false;
    this._referenciaReal = null;
  }

  /** Salta a un instante concreto sin alterar velocidad ni datos. */
  irA(tiempo) {
    this.tiempo = clamp(Number(tiempo) || 0, 0, this.duracion);
    this._referenciaReal = null;
  }

  /** Cambia la velocidad de reproducción reanclando la referencia temporal. */
  cambiarVelocidad(velocidad) {
    if (!VELOCIDADES.includes(velocidad)) return;
    this.velocidad = velocidad;
    this._referenciaReal = null;
  }

  /**
   * Avanza el reloj hasta `ahoraReal` (ms de performance.now()).
   * Devuelve el tiempo simulado resultante.
   */
  avanzar(ahoraReal) {
    if (!this.reproduciendo) return this.tiempo;
    if (this._referenciaReal === null) {
      this._referenciaReal = ahoraReal;
      return this.tiempo;
    }
    let dt = (ahoraReal - this._referenciaReal) / 1000;
    this._referenciaReal = ahoraReal;
    if (dt < 0) dt = 0;
    if (dt > SALTO_MAXIMO_REAL) dt = SALTO_MAXIMO_REAL;
    this.tiempo = Math.min(this.duracion, this.tiempo + dt * this.minutosPorSegundo());
    if (this.tiempo >= this.duracion) this.reproduciendo = false;
    return this.tiempo;
  }

  get finalizado() {
    return this.duracion > 0 && this.tiempo >= this.duracion;
  }
}
