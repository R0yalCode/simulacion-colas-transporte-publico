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
  COLUMNAS_POR_BLOQUE,
  FILAS_DESBORDAMIENTO,
  FILAS_FRENTE,
  MAXIMO_FIGURAS,
  PASO_COLA,
  PUESTOS_TOTAL,
  ZONAS_COLA,
  busVisible,
  capacidadZonas,
  limitesZona,
  posicionBus,
  posicionCola,
  posicionPuerta,
  progresoCaminante,
  puertasAbiertas,
  rangosZonas,
  zonaDeIndice,
} from '../js/disposicion3d.js';

test('el máximo de figuras permite representar 150 pasajeros', () => {
  assert.equal(MAXIMO_FIGURAS, 150);
  assert.ok(PUESTOS_TOTAL >= MAXIMO_FIGURAS, 'debe haber puestos suficientes para 150');
});

test('la cola se organiza en cuatro zonas de desbordamiento ordenadas', () => {
  assert.equal(ZONAS_COLA.length, 4);
  assert.deepEqual(ZONAS_COLA.map((zona) => zona.id), ['A', 'B', 'C', 'D']);
  const capacidades = capacidadZonas();
  for (const zona of ZONAS_COLA) {
    assert.ok(capacidades[zona.id] > 0, 'cada zona debe tener capacidad');
    assert.ok(zona.etiqueta.length > 0);
    assert.ok(zona.descripcion.length > 0);
  }
  assert.equal(
    Object.values(capacidades).reduce((a, b) => a + b, 0),
    PUESTOS_TOTAL,
  );
});

test('las zonas se llenan en orden: refugio, extensión, desbordamiento y espera', () => {
  const rangos = rangosZonas();
  assert.ok(rangos.A.inicio < rangos.B.inicio);
  assert.ok(rangos.B.inicio < rangos.C.inicio);
  assert.ok(rangos.C.inicio < rangos.D.inicio);
  assert.equal(rangos.A.fin, rangos.B.inicio);
  assert.equal(rangos.B.fin, rangos.C.inicio);
  assert.equal(rangos.C.fin, rangos.D.inicio);
  assert.equal(rangos.D.fin, PUESTOS_TOTAL);
});

test('la zona de un puesto se deduce de su índice', () => {
  assert.equal(zonaDeIndice(0), 'A');
  assert.equal(zonaDeIndice(ZONAS_COLA[0].filas.length * ZONAS_COLA[0].columnas), 'B');
  assert.equal(zonaDeIndice(-1), null);
  assert.equal(zonaDeIndice(PUESTOS_TOTAL), null);
});

test('los puestos de la cola son deterministas y no dependen del tamaño', () => {
  const primero = posicionCola(0);
  const repetido = posicionCola(0);
  assert.deepEqual(primero, repetido);
  assert.equal(primero.zona, 'A');
  assert.ok(primero.x > 0, 'la cola arranca en la acera, junto a la puerta');
  assert.ok(primero.z > 5.2, 'la cola está sobre la acera');
});

test('dentro de una zona los puestos avanzan en X y saltan de fila al terminar', () => {
  const zona = ZONAS_COLA[0];
  const columnas = zona.columnas;
  assert.equal(zona.columnas, COLUMNAS_POR_BLOQUE);
  const primeraFila = [];
  const segundaFila = [];
  for (let i = 0; i < columnas; i += 1) {
    primeraFila.push(posicionCola(i));
    segundaFila.push(posicionCola(columnas + i));
  }
  for (let i = 1; i < primeraFila.length; i += 1) {
    assert.ok(primeraFila[i].x > primeraFila[i - 1].x, 'la fila avanza en X');
    assert.ok(
      Math.abs(primeraFila[i].x - primeraFila[i - 1].x - PASO_COLA) < 1e-9,
      'el paso horizontal es constante',
    );
  }
  assert.ok(segundaFila[0].z > primeraFila[0].z, 'la segunda fila esta mas lejos de la calzada');
  assert.ok(
    Math.abs(segundaFila[0].x - primeraFila[0].x) < 0.1,
    'las filas de una zona arrancan en la misma columna',
  );
});

test('las bandas de profundidad son las de la marquesina y del desbordamiento', () => {
  assert.equal(FILAS_FRENTE.length, 2);
  assert.equal(FILAS_DESBORDAMIENTO.length, 4);
  assert.ok(Math.min(...FILAS_DESBORDAMIENTO) > Math.max(...FILAS_FRENTE));
});

test('los límites de cada zona cubren sus puestos', () => {
  for (const zona of ZONAS_COLA) {
    const limites = limitesZona(zona.id);
    assert.ok(limites, 'la zona debe tener límites');
    assert.ok(limites.xMax > limites.xMin);
    assert.ok(limites.zMax > limites.zMin);
    for (let i = 0; i < PUESTOS_TOTAL; i += 1) {
      if (zonaDeIndice(i) !== zona.id) continue;
      const puesto = posicionCola(i);
      assert.ok(puesto.x >= limites.xMin && puesto.x <= limites.xMax);
      assert.ok(puesto.z >= limites.zMin && puesto.z <= limites.zMax);
    }
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

test('el avance de los caminantes esta acotado y respeta el orden FIFO', () => {
  const n = 8;
  const inicio = Array.from({ length: n }, (_, i) => progresoCaminante(i, n, 0));
  const medio = Array.from({ length: n }, (_, i) => progresoCaminante(i, n, 0.5));
  const fin = Array.from({ length: n }, (_, i) => progresoCaminante(i, n, 1));
  for (const valores of [inicio, medio, fin]) {
    for (const valor of valores) assert.ok(valor >= 0 && valor <= 1);
  }
  assert.deepEqual(inicio, new Array(n).fill(0));
  assert.deepEqual(fin, new Array(n).fill(1));
  for (let i = 1; i < n; i += 1) {
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

test('caso L: 150 puestos sin solapes y repartidos entre las cuatro zonas', () => {
  const vistos = new Map();
  const porZona = {};
  for (let i = 0; i < MAXIMO_FIGURAS; i += 1) {
    const puesto = posicionCola(i);
    const clave = `${puesto.x.toFixed(3)}|${puesto.z.toFixed(3)}`;
    assert.equal(vistos.has(clave), false, `el puesto ${i} coincide con otro`);
    vistos.set(clave, i);
    porZona[puesto.zona] = (porZona[puesto.zona] || 0) + 1;
  }
  assert.equal(Object.keys(porZona).length, 4, 'las 150 figuras ocupan las cuatro zonas');
  for (const zona of ZONAS_COLA) {
    assert.ok(porZona[zona.id] > 0, `la zona ${zona.id} debe estar ocupada`);
    assert.ok(
      porZona[zona.id] <= zona.filas.length * zona.columnas,
      `la zona ${zona.id} no puede superar su capacidad`,
    );
  }
  assert.equal(
    Object.values(porZona).reduce((a, b) => a + b, 0),
    MAXIMO_FIGURAS,
  );
});

test('caso L: la disposicion es estable al recalcularla', () => {
  const primero = posicionCola(77);
  for (let i = 0; i < 5; i += 1) {
    assert.deepEqual(posicionCola(77), primero);
  }
});
