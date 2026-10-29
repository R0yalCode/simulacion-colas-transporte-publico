/**
 * Utilidades compartidas: formato numérico, DOM y descargas.
 *
 * Los formateadores y helpers sin DOM pueden importarse desde Node para las
 * pruebas de la capa de reproducción.
 */

export function clamp(valor, minimo, maximo) {
  if (Number.isNaN(valor)) return minimo;
  return Math.min(maximo, Math.max(minimo, valor));
}

const formatoDecimal = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatoEntero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });

export function formatearNumero(valor, decimales = 2) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  if (decimales === 0) return formatoEntero.format(valor);
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor);
}

export function formatearEntero(valor) {
  return formatearNumero(valor, 0);
}

/** Reloj simulado en formato MM:SS a partir de minutos simulados. */
export function formatearReloj(minutos) {
  const total = Math.max(0, Math.round(minutos * 60));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function formatearPorcentaje(fraccion, decimales = 1) {
  if (!Number.isFinite(fraccion)) return '—';
  return `${formatearNumero(fraccion * 100, decimales)} %`;
}

export function qs(selector, raiz = document) {
  return raiz.querySelector(selector);
}

export function qsa(selector, raiz = document) {
  return Array.from(raiz.querySelectorAll(selector));
}

/** Actualiza el texto de un elemento solo si cambió (evita reflows inútiles). */
export function setTexto(elemento, texto) {
  if (elemento && elemento.textContent !== texto) {
    elemento.textContent = texto;
  }
}

export function descargarTexto(nombre, contenido, tipo = 'text/csv;charset=utf-8') {
  const blob = new Blob(['\ufeff' + contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

export function prefiereMovimientoReducido() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Interpolación exponencial estable ante cambios de dt. */
export function suavizar(actual, objetivo, dt, rapidez = 6) {
  const factor = 1 - Math.exp(-Math.max(0, dt) * rapidez);
  return actual + (objetivo - actual) * factor;
}

export function mezclar(a, b, t) {
  return a + (b - a) * t;
}
