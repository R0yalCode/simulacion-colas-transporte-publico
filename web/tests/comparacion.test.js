/**
 * Pruebas de la lógica pura del apartado «Comparación de los 3 casos base».
 * No requieren DOM: validan normalización, tabla descriptiva e indicadores.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  distribucionEsperas,
  distribucionSerie,
  filasTabla,
  indicadoresComparativos,
  normalizarComparacion,
  renderizarComparacion,
} from '../js/comparacion.js';

/** Construye un payload de `/api/comparar` mínimo pero representativo. */
function payloadDePrueba() {
  const rejilla = [0, 1, 2, 3];
  const casoBase = (id, nombre, clasificacion, cola, resumen) => ({
    id,
    nombre,
    parametros: { lambda_p: 5, intervalo_promedio: 10, duracion: 3 },
    mu: 7,
    rho: 0.71,
    clasificacion,
    duracion: 3,
    rejilla,
    cola_media: cola,
    llegadas_acumuladas: [0, 1, 2, 3],
    transportados_acumulados: [0, 0, 1, 2],
    esperas: { tiempos: [0.5, 1.5, 2.5], valores: [1, 2, 3] },
    resumen,
  });

  return {
    num_repeticiones: 3,
    semilla_base: 12345,
    num_casos: 3,
    casos: [
      casoBase(
        'estable',
        'Estable',
        { etiqueta: 'ESTABLE', severidad: 'ok' },
        [0, 1, 2, 1],
        {
          pasajeros_llegados: 10,
          pasajeros_transportados: 9,
          pasajeros_restantes: 1,
          cola_maxima: 3,
          cola_media_temporal: 1.2,
          espera_media: 4.5,
          espera_mediana: 4,
          espera_p90: 8,
          pct_transportados: 90,
          pct_restantes: 10,
        },
      ),
      casoBase(
        'alta_utilizacion',
        'Alta utilización',
        { etiqueta: 'ALTA UTILIZACIÓN', severidad: 'aviso' },
        [0, 2, 4, 3],
        {
          pasajeros_llegados: 10,
          pasajeros_transportados: 7,
          pasajeros_restantes: 3,
          cola_maxima: 5,
          cola_media_temporal: 2.4,
          espera_media: 6,
          espera_mediana: 5,
          espera_p90: 11,
          pct_transportados: 70,
          pct_restantes: 30,
        },
      ),
      casoBase(
        'critico',
        'Crítico',
        { etiqueta: 'CRÍTICO', severidad: 'alerta' },
        [0, 3, 6, 6],
        {
          pasajeros_llegados: 10,
          pasajeros_transportados: 5,
          pasajeros_restantes: 5,
          cola_maxima: 7,
          cola_media_temporal: 4.1,
          espera_media: 9,
          espera_mediana: 8,
          espera_p90: 15,
          pct_transportados: 50,
          pct_restantes: 50,
        },
      ),
    ],
  };
}

test('la distribución de una serie resume posición y dispersión', () => {
  const dist = distribucionSerie([
    [0, 0],
    [1, 4],
    [2, 2],
    [3, 6],
  ]);
  assert.equal(dist.n, 4);
  assert.equal(dist.minimo, 0);
  assert.equal(dist.maximo, 6);
  assert.equal(dist.mediana, 3);
  assert.ok(dist.p25 <= dist.p75);
});

test('una serie vacía no produce distribución', () => {
  const dist = distribucionSerie([]);
  assert.equal(dist.n, 0);
});

test('la distribución de esperas usa los valores cerrados de los abordados', () => {
  const dist = distribucionEsperas([0.5, 1.5, 2.5], [1, 5, 9]);
  assert.equal(dist.n, 3);
  assert.equal(dist.maximo, 9);
  assert.equal(dist.mediana, 5);
});

test('normalizarComparacion conserva el orden y añade metadatos por caso', () => {
  const datos = normalizarComparacion(payloadDePrueba());
  assert.equal(datos.numRepeticiones, 3);
  assert.equal(datos.semillaBase, 12345);
  assert.deepEqual(
    datos.casos.map((caso) => caso.id),
    ['estable', 'alta_utilizacion', 'critico'],
  );
  assert.notEqual(datos.casos[0].color, datos.casos[1].color);
  assert.equal(datos.casos[0].distribucion_cola.n, 4);
  assert.equal(datos.casos[0].transportados_total, 9);
});

test('la tabla marca «No disponible» en vez de mostrar ceros por datos ausentes', () => {
  const payload = payloadDePrueba();
  delete payload.casos[1].resumen.espera_p90;
  payload.casos[1].resumen.espera_mediana = null;
  const datos = normalizarComparacion(payload);
  const filas = filasTabla(datos);
  const filaP90 = filas.find((fila) => fila.etiqueta === 'Espera P90');
  assert.equal(filaP90.valores[0].disponible, true);
  assert.equal(filaP90.valores[1].disponible, false);
  assert.equal(filaP90.valores[1].texto, 'No disponible');
  assert.equal(filaP90.valores[1].texto === '0.00', false);
});

test('la tabla incluye porcentajes y esperas con sus unidades', () => {
  const datos = normalizarComparacion(payloadDePrueba());
  const filas = filasTabla(datos);
  const etiquetas = filas.map((fila) => fila.etiqueta);
  assert.ok(etiquetas.includes('Porcentaje transportado'));
  assert.ok(etiquetas.includes('Porcentaje pendiente al final'));
  const pct = filas.find((fila) => fila.etiqueta === 'Porcentaje transportado');
  assert.match(pct.valores[0].texto, /^90[.,]0 %$/);
});

test('los indicadores comparativos señalan el mejor sin declarar significación', () => {
  const datos = normalizarComparacion(payloadDePrueba());
  const indicadores = indicadoresComparativos(datos);
  assert.ok(indicadores.length >= 1);
  const menorCola = indicadores.find((i) => i.etiqueta === 'Menor cola media');
  assert.equal(menorCola.caso, 'Estable');
  const mayorTransporte = indicadores.find((i) => i.etiqueta === 'Mayor número transportado');
  assert.equal(mayorTransporte.caso, 'Estable');
});

test('renderizarComparacion reúne resumen, tabla, indicadores y advertencia', () => {
  const datos = normalizarComparacion(payloadDePrueba());
  const vista = renderizarComparacion(datos);
  assert.equal(vista.resumen.length, 3);
  assert.equal(vista.tabla.length >= 8, true);
  assert.ok(vista.indicadores.length >= 1);
  assert.equal(typeof vista.advertencia, 'string');
  assert.ok(vista.advertencia.length > 0);
  assert.equal(vista.resumen[0].estado, 'ESTABLE');
  assert.equal(vista.resumen[2].severidad, 'alerta');
});

test('la advertencia avisa cuando las duraciones difieren', () => {
  const payload = payloadDePrueba();
  payload.casos[2].duracion = 10;
  const vista = renderizarComparacion(normalizarComparacion(payload));
  assert.match(vista.advertencia, /duraciones distintas/i);
});
