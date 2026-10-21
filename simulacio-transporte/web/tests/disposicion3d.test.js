/**
 * Pruebas de la geometría pura de la escena 3D (sin navegador ni Three.js).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BUS_X_ENTRADA,
  BUS_X_PARADA,
  BUS_X_SALIDA,
  CAMARAS,
  MAXIMO_FIGURAS,
  SEPARACION_MAX,
  SEPARACION_MIN,
  busVisible,
  posicionBus,
  posicionCola,
  posicionPuerta,
  progresoCaminante,
  puertasAbiertas,
  separacionCola,
} from '../js/disposicion3d.js';

test('la separación de la cola se comprime sin solaparse', () => {
  assert.equal(separacionCola(1), SEPARACION_MAX);
  assert.equal(separacionCola(12), SEPARACION_MAX);
  const valores = [16, 20, 32, 50, 100].map((n) => separacionCola(n));
  for (let i = 1; i < valores.length; i += 1) {
    assert.ok(valores[i] <= valores[i - 1], 'la separación debe ser no creciente');
  }
  for (const valor of valores) {
    assert.ok(valor >= SEPARACION_MIN && valor <= SEPARACION_MAX);
  }
});

test('los puestos de la cola avanzan hacia la puerta sin retroceder', () => {
  const total = 24;
  const separacion = separacionCola(total);
  let anterior = -Infinity;
  for (let i = 0; i < total; i += 1) {
    const posicion = posicionCola(i, total);
    assert.ok(posicion.x > anterior, 'la fila debe avanzar en X');
    assert.ok(Math.abs(posicion.x - anterior - separacion) < 1e-9 || i === 0);
    assert.ok(Math.abs(posicion.z - 6.9) < 0.12, 'la fila debe mantenerse junto a la marquesina');
    anterior = posicion.x;
  }
});

test('el autobús entra, se detiene y sale con la geometría esperada', () => {
  assert.equal(posicionBus('aproximando', 0), BUS_X_ENTRADA);
  assert.equal(posicionBus('aproximando', 1), BUS_X_PARADA);
  assert.equal(posicionBus('detenido', 0.5), BUS_X_PARADA);
  assert.equal(posicionBus('abordando', 1), BUS_X_PARADA);
  assert.equal(posicionBus('saliendo', 0), BUS_X_PARADA);
  assert.equal(posicionBus('saliendo', 1), BUS_X_SALIDA);

  const entrada = [0, 0.25, 0.5, 0.75, 1].map((p) => posicionBus('aproximando', p));
  for (let i = 1; i < entrada.length; i += 1) {
    assert.ok(entrada[i] > entrada[i - 1], 'la aproximación debe ser monótona');
  }
  const salida = [0, 0.25, 0.5, 0.75, 1].map((p) => posicionBus('saliendo', p));
  for (let i = 1; i < salida.length; i += 1) {
    assert.ok(salida[i] > salida[i - 1], 'la salida debe ser monótona');
  }
});

test('fases visibles y puertas abiertas coinciden con el contrato visual', () => {
  for (const fase of ['aproximando', 'detenido', 'abordando', 'saliendo']) {
    assert.equal(busVisible(fase), true);
  }
  assert.equal(busVisible(null), false);
  assert.equal(puertasAbiertas('detenido'), true);
  assert.equal(puertasAbiertas('abordando'), true);
  assert.equal(puertasAbiertas('aproximando'), false);
  assert.equal(puertasAbiertas('saliendo'), false);
});

test('el avance de los caminantes está acotado y respeta el orden FIFO', () => {
  const abordados = 8;
  const inicio = Array.from({ length: abordados }, (_, i) => progresoCaminante(i, abordados, 0));
  const medio = Array.from({ length: abordados }, (_, i) => progresoCaminante(i, abordados, 0.5));
  const fin = Array.from({ length: abordados }, (_, i) => progresoCaminante(i, abordados, 1));
  for (const valores of [inicio, medio, fin]) {
    for (const valor of valores) assert.ok(valor >= 0 && valor <= 1);
  }
  assert.deepEqual(inicio, new Array(abordados).fill(0));
  assert.deepEqual(fin, new Array(abordados).fill(1));
  for (let i = 1; i < abordados; i += 1) {
    assert.ok(medio[i] <= medio[i - 1], 'los primeros de la cola deben ir por delante');
  }
});

test('la puerta de abordaje está en la acera y hay dos cámaras distintas', () => {
  const puerta = posicionPuerta();
  assert.ok(puerta.z > 5 && puerta.z < 6.9, 'la puerta debe quedar entre el bordillo y la cola');
  assert.ok(Math.abs(puerta.x - 3.15) < 1e-9);

  const nombres = Object.keys(CAMARAS);
  assert.deepEqual(nombres.sort(), ['calle', 'elevada']);
  for (const ajuste of Object.values(CAMARAS)) {
    assert.equal(ajuste.posicion.length, 3);
    assert.equal(ajuste.objetivo.length, 3);
    assert.ok(ajuste.fov > 0);
  }
  assert.notDeepEqual(CAMARAS.calle.posicion, CAMARAS.elevada.posicion);
});

test('el número de figuras visibles es positivo y menor que el máximo de actores', () => {
  assert.ok(MAXIMO_FIGURAS > 0);
  assert.ok(MAXIMO_FIGURAS <= 60);
});
