/**
 * Catálogo de escenarios experimentales: aplicación al formulario y detección
 * de configuraciones equivalentes.
 *
 * Los escenarios son *configuraciones experimentales ilustrativas* del modelo
 * (no datos empíricos). Cada uno declara la relación de carga ρ que produce,
 * de modo que su condición sea comprobable sin simular.
 *
 * Módulo puro (sin DOM): se prueba con `node --test web/tests/`.
 */

/** Identificador usado cuando la configuración actual no coincide con ningún escenario. */
export const ESCENARIO_PERSONALIZADO = 'personalizado';

/** Parámetros que un escenario puede fijar (el resto conserva el valor del usuario). */
export const PARAMETROS_DE_ESCENARIO = [
  'lambda_p',
  'intervalo_promedio',
  'coef_variacion',
  'capacidad_autobus',
  'prob_ocupacion',
  'duracion',
  'cola_inicial',
  'semilla',
  'limite_cola',
];

/** Tolerancia para comparar valores numéricos (λ, h, p, duración…). */
const TOLERANCIA = 1e-9;

/** Normaliza el catálogo recibido del servidor a una lista utilizable. */
export function normalizarCatalogo(catalogo) {
  if (!Array.isArray(catalogo)) return [];
  return catalogo
    .filter((escenario) => escenario && escenario.id && escenario.parametros)
    .map((escenario) => ({
      id: String(escenario.id),
      nombre: String(escenario.nombre || escenario.id),
      descripcion: String(escenario.descripcion || ''),
      condicion: String(escenario.condicion || ''),
      parametros: { ...escenario.parametros },
      lambda_p: escenario.lambda_p ?? null,
      mu: escenario.mu ?? null,
      rho: escenario.rho ?? null,
      estado: escenario.estado ?? null,
      etiqueta: escenario.etiqueta ?? null,
      severidad: escenario.severidad ?? null,
    }));
}

/** Busca un escenario por identificador. */
export function buscarEscenario(catalogo, id) {
  const lista = normalizarCatalogo(catalogo);
  return lista.find((escenario) => escenario.id === id) || null;
}

/**
 * Valores del formulario que corresponden a un escenario.
 *
 * Los parámetros que el escenario no define conservan el valor actual del
 * formulario (por ejemplo el número de réplicas o el límite operativo).
 */
export function aplicarEscenario(catalogo, id, valoresActuales = {}) {
  const escenario = buscarEscenario(catalogo, id);
  if (!escenario) return { ...valoresActuales };
  const valores = { ...valoresActuales };
  for (const clave of PARAMETROS_DE_ESCENARIO) {
    if (clave in escenario.parametros) valores[clave] = escenario.parametros[clave];
  }
  return valores;
}

/** Compara dos valores de forma tolerante (números y cadenas). */
function iguales(a, b) {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) <= TOLERANCIA;
  return String(a) === String(b);
}

/** ¿Los valores del formulario coinciden con los de un escenario? */
export function escenarioCoincide(catalogo, id, valores) {
  const escenario = buscarEscenario(catalogo, id);
  if (!escenario || !valores) return false;
  for (const [clave, valor] of Object.entries(escenario.parametros)) {
    if (!(clave in valores)) return false;
    if (!iguales(valores[clave], valor)) return false;
  }
  return true;
}

/**
 * Detecta qué escenario corresponde a la configuración actual.
 * Devuelve `personalizado` si no coincide con ninguno.
 */
export function detectarEscenario(catalogo, valores) {
  const lista = normalizarCatalogo(catalogo);
  for (const escenario of lista) {
    if (escenarioCoincide(lista, escenario.id, valores)) return escenario.id;
  }
  return ESCENARIO_PERSONALIZADO;
}

/** Texto breve con la condición matemática verificada de un escenario. */
export function condicionEscenario(catalogo, id) {
  const escenario = buscarEscenario(catalogo, id);
  if (!escenario) return '';
  if (escenario.condicion) return escenario.condicion;
  if (escenario.rho === null || escenario.rho === undefined) return '';
  return `ρ = ${Number(escenario.rho).toFixed(2)}`;
}
