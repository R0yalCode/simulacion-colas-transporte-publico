/**
 * Ampliación reutilizable de las gráficas.
 *
 * Usa la Fullscreen API cuando está disponible y, si no, una vista superpuesta
 * (modal) que ocupa casi toda la ventana. El canvas es siempre el mismo nodo:
 * no se clona ni se recrea, por lo que los datos y el estado de la simulación
 * se conservan al entrar y salir.
 */

const SVG_AMPLIAR = `
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
    <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5" fill="none"
          stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

const SVG_CONTRAER = `
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
    <path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5" fill="none"
          stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

const TIEMPO_REDIBUJADO = 180;

export class PantallaCompletaGraficos {
  constructor(graficos) {
    this.graficos = graficos;
    this.paneles = new Map();
    this.modalClave = null;
    this.overlay = null;

    this._alCambiarPantalla = () => this._sincronizar();
    this._alTeclear = (evento) => {
      if (evento.key === 'Escape' && this.modalClave !== null) {
        evento.preventDefault();
        this.cerrar();
      }
    };
    document.addEventListener('fullscreenchange', this._alCambiarPantalla);
    document.addEventListener('keydown', this._alTeclear);

    for (const panel of document.querySelectorAll('.grafico-panel[data-grafico]')) {
      const clave = panel.dataset.grafico;
      const grafico = graficos[clave];
      const boton = panel.querySelector('[data-ampliar]');
      if (!grafico || !boton) continue;
      boton.addEventListener('click', () => this.alternar(clave));
      this.paneles.set(clave, { panel, grafico, boton });
    }
  }

  /** Clave del gráfico que está ampliado (fullscreen o modal), o null. */
  _claveActiva() {
    if (document.fullscreenElement) {
      for (const [clave, ref] of this.paneles) {
        if (ref.panel === document.fullscreenElement) return clave;
      }
    }
    return this.modalClave;
  }

  _sincronizar() {
    const activa = this._claveActiva();
    for (const [clave, ref] of this.paneles) {
      const ampliado = clave === activa;
      ref.boton.innerHTML = ampliado ? SVG_CONTRAER : SVG_AMPLIAR;
      ref.boton.title = ampliado ? 'Salir de pantalla completa' : 'Ver en pantalla completa';
      ref.boton.setAttribute('aria-label', ampliado ? 'Salir de pantalla completa' : `Ver ${this._titulo(ref)} en pantalla completa`);
      ref.boton.setAttribute('aria-pressed', ampliado ? 'true' : 'false');
      ref.panel.classList.toggle('grafico-panel--modal', ampliado && this.modalClave === clave);
      if (ampliado) this._redibujar(ref);
    }
    document.body.classList.toggle('sin-scroll', activa !== null);
  }

  _titulo(ref) {
    const h2 = ref.panel.querySelector('h2');
    return h2 ? h2.textContent.trim() : 'la gráfica';
  }

  _redibujar(ref) {
    requestAnimationFrame(() => ref.grafico.redibujar());
    window.setTimeout(() => ref.grafico.redibujar(), TIEMPO_REDIBUJADO);
  }

  alternar(clave) {
    const ref = this.paneles.get(clave);
    if (!ref) return;

    if (this.modalClave !== null) {
      const misma = this.modalClave === clave;
      this._cerrarModal();
      if (misma) {
        this._sincronizar();
        return;
      }
    }

    if (document.fullscreenElement === ref.panel) {
      this._salirPantallaCompleta();
      return;
    }
    if (document.fullscreenElement) {
      this._salirPantallaCompleta();
    }

    if (typeof ref.panel.requestFullscreen === 'function' && document.fullscreenEnabled) {
      try {
        const solicitud = ref.panel.requestFullscreen();
        if (solicitud && typeof solicitud.catch === 'function') {
          solicitud.catch(() => this._abrirModal(clave));
        }
      } catch {
        this._abrirModal(clave);
      }
    } else {
      this._abrirModal(clave);
    }
  }

  _abrirModal(clave) {
    const ref = this.paneles.get(clave);
    if (!ref) return;
    this._cerrarModal();
    this.modalClave = clave;
    this.overlay = document.createElement('div');
    this.overlay.className = 'grafico-overlay';
    this.overlay.addEventListener('click', () => this.cerrar());
    document.body.appendChild(this.overlay);
    this._sincronizar();
  }

  _cerrarModal() {
    this.modalClave = null;
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  _salirPantallaCompleta() {
    if (typeof document.exitFullscreen !== 'function') return;
    const salida = document.exitFullscreen();
    if (salida && typeof salida.catch === 'function') salida.catch(() => {});
  }

  cerrar() {
    this._cerrarModal();
    if (document.fullscreenElement) this._salirPantallaCompleta();
    this._sincronizar();
  }

  destruir() {
    document.removeEventListener('fullscreenchange', this._alCambiarPantalla);
    document.removeEventListener('keydown', this._alTeclear);
    this._cerrarModal();
    document.body.classList.remove('sin-scroll');
  }
}

export function conectarPantallaCompleta(graficos) {
  return new PantallaCompletaGraficos(graficos);
}
