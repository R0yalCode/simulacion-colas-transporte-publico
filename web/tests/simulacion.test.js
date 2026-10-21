/**
 * Pruebas de la capa de reproducción (Ejecucion): reconstrucción de estado,
 * FIFO, indicadores, ventanas visuales del autobús y exportación.
 *
 * Se ejecutan con `node --test web/tests/` (o `npm test` dentro de web/).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Ejecucion, csvEventos, csvResumen, ultimoIndiceMenorOIgual } from '../js/simulacion.js';
import { RelojSimulado } from '../js/reloj.js';

/**
 * Payload sintético que respeta el contrato de `/api/simular`:
 * cola inicial 2 → pasajero #2 (t=1) → bus #0 toma 1 (t=2) →
 * pasajeros #3 y #4 (t=3) → bus #1 toma 3 (t=5) → pasajero #5 (t=7).
 */
function payloadSintetico() {
  const eventos = [
    { tipo: 'pasajero', tiempo: 1.0, pasajero_id: 2, llegados: 1, cola: 3 },
    {
      tipo: 'autobus',
      tiempo: 2.0,
      autobus_id: 0,
      capacidad: 10,
      asientos_libres: 1,
      asientos_ocupados_al_llegar: 9,
      cola_antes: 3,
      abordados: 1,
      pasajeros_abordados_ids: [0],
      transportados: 1,
      cola: 2,
    },
    { tipo: 'pasajero', tiempo: 3.0, pasajero_id: 3, llegados: 2, cola: 3 },
    { tipo: 'pasajero', tiempo: 3.0, pasajero_id: 4, llegados: 3, cola: 4 },
    {
      tipo: 'autobus',
      tiempo: 5.0,
      autobus_id: 1,
      capacidad: 10,
      asientos_libres: 3,
      asientos_ocupados_al_llegar: 7,
      cola_antes: 4,
      abordados: 3,
      pasajeros_abordados_ids: [1, 2, 3],
      transportados: 4,
      cola: 1,
    },
    { tipo: 'pasajero', tiempo: 7.0, pasajero_id: 5, llegados: 4, cola: 2 },
  ];
  return {
    config: {
      lambda_p: 6,
      intervalo_promedio: 5,
      coef_variacion: 0.3,
      capacidad_autobus: 10,
      prob_ocupacion: 0.5,
      duracion: 10,
      cola_inicial: 2,
      semilla: 42,
      num_repeticiones: 5,
    },
    resultados: {
      tiempo_final: 10,
      semilla: 42,
      cola_inicial: 2,
      pasajeros_llegados_total: 4,
      autobuses_llegados_total: 2,
      pasajeros_transportados_total: 4,
      pasajeros_restantes_cola: 2,
      cola_maxima: 4,
      cola_media_temporal: 2.3,
      espera_media_abordados: 3.25,
      espera_mediana_abordados: 3,
      espera_p90: 5,
      espera_p95: 5,
      espera_maxima_abordados: 5,
      asientos_libres_promedio: 2,
      autobuses_sin_asientos_libres: 0,
      autobuses_sin_asientos_libres_pct: 0,
      num_pasajeros_abordados: 4,
      balance_pasajeros: 0,
    },
    metricas_teoricas: { rho_estrella: 5, mu_efectiva: 1.2, asientos_libres_esperados: 5 },
    eventos,
    serie_cola: [
      [0, 2],
      [1, 3],
      [2, 2],
      [3, 4],
      [5, 1],
      [7, 2],
      [10, 2],
    ],
    num_eventos: eventos.length,
    advertencias: [],
  };
}

function ejecucionSintetica() {
  return new Ejecucion(payloadSintetico());
}

test('búsqueda binaria de eventos', () => {
  assert.equal(ultimoIndiceMenorOIgual([1, 2, 3, 3, 5], 0), -1);
  assert.equal(ultimoIndiceMenorOIgual([1, 2, 3, 3, 5], 3), 3);
  assert.equal(ultimoIndiceMenorOIgual([1, 2, 3, 3, 5], 6), 4);
});

test('estado inicial refleja la cola inicial sin llegadas', () => {
  const eje = ejecucionSintetica();
  const inicial = eje.estadoEn(0);
  assert.equal(inicial.cola.length, 2);
  assert.deepEqual(inicial.cola, [0, 1]);
  assert.equal(inicial.llegados, 0);
  assert.equal(inicial.transportados, 0);
  assert.equal(inicial.autobuses, 0);
  assert.equal(inicial.colaMax, 2);
});

test('contadores y cola en cada marca temporal', () => {
  const eje = ejecucionSintetica();
  assert.equal(eje.estadoEn(1).llegados, 1);
  assert.equal(eje.estadoEn(1).cola.length, 3);
  assert.equal(eje.estadoEn(2).transportados, 1);
  assert.equal(eje.estadoEn(2).cola.length, 2);
  assert.equal(eje.estadoEn(3).cola.length, 4);
  const final = eje.estadoEn(10);
  assert.equal(final.llegados, 4);
  assert.equal(final.transportados, 4);
  assert.equal(final.autobuses, 2);
  assert.equal(final.cola.length, 2);
  assert.equal(final.colaMax, 4);
});

test('la cola mantiene el orden FIFO con identificadores reales', () => {
  const eje = ejecucionSintetica();
  assert.deepEqual(eje.estadoEn(2).cola, [1, 2]);
  assert.deepEqual(eje.estadoEn(5).cola, [4]);
  assert.deepEqual(eje.estadoEn(10).cola, [4, 5]);
});

test('indicadores: esperas, área y ocupación acumulada', () => {
  const eje = ejecucionSintetica();
  const stats = eje.estadisticasEn(10);
  assert.equal(stats.esperando, 2);
  assert.equal(stats.numEsperas, 4);
  assert.ok(Math.abs(stats.esperaMedia - 3.25) < 1e-9, `espera media ${stats.esperaMedia}`);
  assert.ok(Math.abs(stats.esperaMax - 5) < 1e-9);
  assert.ok(Math.abs(stats.colaMediaTemporal - 2.3) < 1e-9, `cola media ${stats.colaMediaTemporal}`);
  assert.ok(Math.abs(stats.ocupacionAcumulada - 1.0) < 1e-9);
});

test('mover la línea de tiempo hacia atrás y volver a avanzar no duplica estado', () => {
  const eje = ejecucionSintetica();
  const referencia = new Ejecucion(payloadSintetico());
  const final1 = eje.estadisticasEn(10);
  eje.estadisticasEn(3);
  eje.estadisticasEn(0);
  const final2 = eje.estadisticasEn(10);
  const esperado = referencia.estadisticasEn(10);
  assert.deepEqual(final1, final2);
  assert.deepEqual(final2, esperado);
});

test('avanzar en pequeños pasos produce el mismo estado que saltar al final', () => {
  const aPasos = ejecucionSintetica();
  for (let t = 0; t <= 10.0001; t += 0.05) aPasos.estadisticasEn(Math.min(t, 10));
  const directo = ejecucionSintetica().estadisticasEn(10);
  assert.deepEqual(aPasos.estadisticasEn(10), directo);
});

test('fases visuales del autobús', () => {
  const eje = ejecucionSintetica();
  // bus #0: t=2, hueco previo 2 → aproximación 0.7; hueco siguiente 3 → abordaje 0.9, salida 0.6
  assert.equal(eje.busVisualEn(1.0), null);
  const aproximando = eje.busVisualEn(1.5);
  assert.equal(aproximando.fase, 'aproximando');
  assert.equal(aproximando.id, 0);
  assert.ok(Math.abs(aproximando.progreso - (1.5 - 1.3) / 0.7) < 1e-9);
  assert.equal(eje.busVisualEn(2.0).fase, 'detenido');
  const abordando = eje.busVisualEn(2.3);
  assert.equal(abordando.fase, 'abordando');
  assert.ok(abordando.progreso > 0 && abordando.progreso < 1);
  const saliendo = eje.busVisualEn(3.2);
  assert.equal(saliendo.fase, 'saliendo');
  assert.ok(Math.abs(saliendo.progreso - 0.5) < 1e-9);
  assert.equal(eje.busVisualEn(3.6), null);
  assert.equal(eje.busVisualEn(4.5).fase, 'aproximando');
});

test('las ventanas visuales de buses consecutivos nunca se solapan', () => {
  const eje = ejecucionSintetica();
  const buses = [2.0, 5.0];
  for (let i = 0; i < buses.length - 1; i += 1) {
    const t = buses[i];
    const huecoSiguiente = buses[i + 1] - t;
    const fin = t + Math.min(1.0, 0.3 * huecoSiguiente) + Math.min(0.75, 0.2 * huecoSiguiente);
    const huecoPrevio = buses[i + 1] - t;
    const inicioAprox = buses[i + 1] - Math.min(2.0, 0.35 * huecoPrevio);
    assert.ok(fin <= inicioAprox + 1e-9, `fin ${fin} vs inicio ${inicioAprox}`);
  }
});

test('movimiento reducido muestra el abordaje completo sin aproximación', () => {
  const eje = ejecucionSintetica();
  const abordando = eje.busVisualEn(2.2, { reducido: true });
  assert.equal(abordando.fase, 'abordando');
  assert.equal(abordando.mostrados, 1);
  assert.equal(eje.busVisualEn(4.5, { reducido: true }), null);
});

test('datos por autobús para el gráfico de capacidad', () => {
  const eje = ejecucionSintetica();
  const buses = eje.busesHasta(10, 14);
  assert.equal(buses.length, 2);
  assert.equal(buses[0].ocupadosAlLlegar, 9);
  assert.equal(buses[0].libresAlSalir, 0);
  assert.equal(buses[1].libresAlSalir, 0);
});

test('series acumuladas hasta t respetan el instante', () => {
  const eje = ejecucionSintetica();
  const acum = eje.serieAcumuladaHasta(3);
  assert.deepEqual(acum.tiempos, [1, 2, 3, 3]);
  assert.deepEqual(acum.llegados, [1, 1, 2, 3]);
  assert.deepEqual(acum.transportados, [0, 1, 1, 1]);
  assert.deepEqual(acum.pendientes, [3, 2, 3, 4]);
});

test('esperas hasta t solo incluyen pasajeros ya abordados', () => {
  const eje = ejecucionSintetica();
  const esperas = eje.esperasHasta(2);
  assert.equal(esperas.total, 1);
  assert.ok(Math.abs(esperas.media - 2) < 1e-9);
  assert.equal(esperas.puntos[0].id, 0);
});

test('la velocidad del reloj no altera la reconstrucción ni las métricas', () => {
  const eje = ejecucionSintetica();
  const resultados = [];
  for (const velocidad of [0.5, 1, 1.5, 2, 2.5]) {
    const reloj = new RelojSimulado({ duracion: eje.duracion, velocidad });
    reloj.iniciar();
    let ahora = 0;
    reloj.avanzar(ahora);
    while (reloj.reproduciendo) {
      ahora += 100;
      reloj.avanzar(ahora);
    }
    assert.equal(reloj.tiempo, eje.duracion);
    resultados.push(eje.estadisticasEn(reloj.tiempo));
  }
  for (const stats of resultados.slice(1)) {
    assert.deepEqual(stats, resultados[0]);
  }
});

test('registro de eventos recientes acotado', () => {
  const eje = ejecucionSintetica();
  const { indice, eventos } = eje.eventosRecientes(10, 4);
  assert.equal(indice, 6);
  assert.equal(eventos.length, 4);
  assert.equal(eventos[eventos.length - 1].tiempo, 7);
});

test('exportación CSV de eventos y resumen', () => {
  const eje = ejecucionSintetica();
  const csv = csvEventos(eje);
  const lineas = csv.split('\n');
  assert.equal(lineas.length, 7);
  assert.ok(lineas[0].startsWith('tiempo_min,tipo,id_pasajero'));
  assert.ok(lineas[1].includes('pasajero,2'));
  assert.ok(lineas[2].includes('autobus,,0,10,1,9,3,1,2'));
  const resumen = csvResumen(eje);
  assert.ok(resumen.includes('pasajeros_llegados_total,4'));
  assert.ok(resumen.includes('config_duracion,10'));
  assert.ok(resumen.includes('teorica_rho_estrella,5'));
});

test('payload inválido lanza error', () => {
  assert.throws(() => new Ejecucion(null), /inválida/);
  assert.throws(() => new Ejecucion({}), /inválida/);
});
