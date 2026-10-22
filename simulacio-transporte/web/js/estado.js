/**
 * Estado operativo y composición de mensajes del sistema.
 *
 * Separa tres cosas que se confunden con frecuencia:
 *
 * 1. **Estado matemático**: lo decide el servidor a partir de λ, μ y ρ
 *    (`payload.estado`). Aquí solo se presenta.
 * 2. **Estado operativo**: depende de la cola real Q(t) frente al umbral
 *    operativo Qmáx. No implica sobrecarga matemática: con ρ < 1 la cola
 *    también puede alcanzar el umbral por fluctuaciones o por una cola
 *    inicial grande.
 * 3. **Estado visual**: depende de cuántos pasajeros se dibujan (máximo 150).
 *    La cola real nunca se recorta: los pasajeros que no caben se contabilizan
 *    como excedente.
 *
 * Módulo puro (sin DOM): se prueba con `node --test web/tests/`.
 */

/** Máximo de pasajeros individuales que la interfaz puede representar. */
export const LIMITE_VISUAL_MAX = 150;

/** Identificador del estado matemático devuelto por el servidor. */
export const ESTADOS = {
  ESTABLE: 'estable',
  ALTA_UTILIZACION: 'alta_utilizacion',
  CRITICO: 'critico',
  SOBRECARGADO: 'sobrecargado',
  SIN_SERVICIO: 'sin_servicio',
  INACTIVO: 'inactivo',
};

/** Severidades ordenadas de menor a mayor. */
export const SEVERIDADES = ['inactivo', 'ok', 'aviso', 'alerta'];

/**
 * Estado operativo a partir de la cola real y el umbral Qmáx.
 *
 * @param {number} colaReal Tamaño instantáneo de la cola (personas).
 * @param {number} limiteCola Umbral operativo Qmáx.
 */
export function estadoOperativo(colaReal, limiteCola = LIMITE_VISUAL_MAX) {
  const cola = Math.max(0, Math.floor(Number(colaReal) || 0));
  const limite = Math.max(1, Math.floor(Number(limiteCola) || LIMITE_VISUAL_MAX));
  const tope = Math.min(limite, LIMITE_VISUAL_MAX);
  const renderizados = Math.min(cola, tope);
  return {
    colaReal: cola,
    limite,
    renderizados,
    excedente: Math.max(0, cola - renderizados),
    faltantes: Math.max(0, limite - cola),
    saturado: cola >= limite,
    porcentaje: cola / limite,
  };
}

/** Representación textual de ρ (∞ cuando no hay capacidad de servicio). */
export function formatearRho(rho) {
  if (rho === null || rho === undefined || !Number.isFinite(rho)) return '∞';
  return rho.toFixed(3);
}

/** Representación textual de un valor numérico con separador de millar. */
function numero(valor, decimales = 2) {
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) return '—';
  return Number(valor).toLocaleString('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

/**
 * Compone el mensaje de estado que se muestra en la interfaz.
 *
 * @param {object} clasificacion Bloque `estado` del servidor.
 * @param {object} operativo Estado operativo (salida de `estadoOperativo`).
 */
export function componerMensaje(clasificacion, operativo) {
  const c = clasificacion || {};
  const o = operativo || estadoOperativo(0);
  const rho = c.rho === undefined ? null : c.rho;
  const rhoTexto = formatearRho(rho);
  const lambdaTexto = numero(c.lambda_p, 2);
  const muTexto = numero(c.mu, 2);
  const colaTexto = numero(o.colaReal, 0);
  const limiteTexto = numero(o.limite, 0);
  const excedenteTexto = numero(o.excedente, 0);

  const sobrecarga = c.estado === ESTADOS.SOBRECARGADO || c.es_sobrecarga_matematica === true;

  if (sobrecarga && o.saturado) {
    return {
      titulo: 'SOBRECARGA MATEMÁTICA Y SATURACIÓN OPERATIVA',
      etiqueta: 'SOBRECARGADO',
      severidad: 'alerta',
      esAlerta: true,
      detalle:
        `La demanda media (λ = ${lambdaTexto} pas/min) supera la capacidad media de transporte ` +
        `(μ = ${muTexto} pas/min, ρ = ${rhoTexto}). La cola real alcanzó el umbral operativo ` +
        `Qmáx = ${limiteTexto} pasajeros; ${excedenteTexto} quedan fuera de la representación visual.`,
    };
  }

  if (sobrecarga) {
    return {
      titulo: 'SOBRECARGA MATEMÁTICA',
      etiqueta: 'SOBRECARGADO',
      severidad: 'alerta',
      esAlerta: true,
      detalle:
        `La demanda media (λ = ${lambdaTexto} pas/min) supera la capacidad media de transporte ` +
        `(μ = ${muTexto} pas/min, ρ = ${rhoTexto}). La cola crece de forma sostenida: ` +
        `${colaTexto} de ${limiteTexto} pasajeros hasta el umbral operativo.`,
    };
  }

  if (o.saturado) {
    return {
      titulo: 'SATURACIÓN OPERATIVA',
      etiqueta: 'SATURADO',
      severidad: 'alerta',
      esAlerta: true,
      detalle:
        `La cola real alcanzó el umbral operativo Qmáx = ${limiteTexto} pasajeros ` +
        `(${excedenteTexto} fuera de la representación visual) aunque la relación de carga ` +
        `ρ = ${rhoTexto} no declara sobrecarga matemática: la saturación es operativa, no de capacidad.`,
    };
  }

  const base = c.detalle || 'Estado del sistema de transporte.';
  const extra = o.colaReal > 0
    ? ` Cola actual: ${colaTexto} de ${limiteTexto} pasajeros (${numero(o.porcentaje * 100, 0)} % del umbral).`
    : '';
  return {
    titulo: c.titulo || `ESTADO DEL SISTEMA: ${c.etiqueta || 'DESCONOCIDO'}`,
    etiqueta: c.etiqueta || 'DESCONOCIDO',
    severidad: c.severidad || 'ok',
    esAlerta: false,
    detalle: base + extra,
  };
}

/**
 * Líneas del panel de indicadores científicos.
 *
 * @param {object} clasificacion Bloque `estado` del servidor.
 * @param {object} operativo Estado operativo.
 * @param {object} metricas Bloque `metricas_teoricas` del servidor.
 * @param {object} resultados Bloque `resultados` del servidor.
 */
export function lineasIndicadores(clasificacion, operativo, metricas = {}, resultados = {}) {
  const c = clasificacion || {};
  const o = operativo || estadoOperativo(0);
  const m = metricas || {};
  const r = resultados || {};
  const lineas = [
    {
      clave: 'lambda_p',
      etiqueta: 'λ · Tasa de llegada',
      valor: `${numero(c.lambda_p, 2)} pas/min`,
      ayuda: 'Llegadas de pasajeros según un proceso de Poisson (exponencial entre llegadas).',
    },
    {
      clave: 'mu',
      etiqueta: 'μ · Capacidad efectiva',
      valor: `${numero(c.mu, 2)} pas/min`,
      ayuda: 'μ = Cₑ / h, con Cₑ los asientos libres esperados por autobús.',
    },
    {
      clave: 'rho',
      etiqueta: 'ρ · Relación de carga',
      valor: formatearRho(c.rho),
      ayuda: 'ρ = λ / μ. ρ < 1 estable, ρ = 1 crítico, ρ > 1 sobrecargado.',
    },
    {
      clave: 'capacidad_efectiva',
      etiqueta: 'Cₑ · Capacidad efectiva',
      valor: `${numero(m.capacidad_efectiva ?? m.asientos_libres_esperados, 2)} pasajeros`,
      ayuda: 'Asientos que quedan libres al llegar el autobús: C·(1 − p).',
    },
    {
      clave: 'umbral_alta',
      etiqueta: 'Umbral de alta utilización',
      valor: numero(m.umbral_alta_utilizacion, 2),
      ayuda: 'Desde ρ ≥ este valor y ρ < 1 el sistema se declara de alta utilización.',
    },
    {
      clave: 'tolerancia_critico',
      etiqueta: 'Tolerancia de estado crítico',
      valor: numero(m.tolerancia_critico, 9),
      ayuda: '|ρ − 1| ≤ ε declara el sistema crítico sin depender de la igualdad exacta.',
    },
    {
      clave: 'cola_real',
      etiqueta: 'Q(t) · Cola real',
      valor: `${numero(o.colaReal, 0)} pasajeros`,
      ayuda: 'Tamaño instantáneo de la cola; el motor nunca la recorta.',
    },
    {
      clave: 'limite_cola',
      etiqueta: 'Qmáx · Umbral operativo',
      valor: `${numero(o.limite, 0)} pasajeros`,
      ayuda: 'Umbral de saturación operativa y límite de representación visual.',
    },
    {
      clave: 'excedente',
      etiqueta: 'Excedente sobre el límite visual',
      valor: `${numero(o.excedente, 0)} pasajeros`,
      ayuda: 'Pasajeros que esperan en el modelo y no se dibujan en la escena.',
    },
    {
      clave: 'cola_maxima',
      etiqueta: 'Qmáx alcanzado en la ejecución',
      valor: `${numero(r.cola_maxima, 0)} pasajeros`,
      ayuda: 'Máximo de la serie de cola simulada.',
    },
    {
      clave: 'tiempo_saturacion',
      etiqueta: 'Instante de saturación operativa',
      valor: r.tiempo_saturacion_operativa === null || r.tiempo_saturacion_operativa === undefined
        ? 'No alcanzado'
        : `${numero(r.tiempo_saturacion_operativa, 1)} min`,
      ayuda: 'Primer instante simulado en el que la cola real alcanzó Qmáx.',
    },
    {
      clave: 'minutos_saturacion',
      etiqueta: 'Tiempo en saturación',
      valor: `${numero(r.minutos_en_saturacion, 1)} min`,
      ayuda: 'Minutos simulados con la cola real por encima del umbral operativo.',
    },
  ];
  return lineas;
}
