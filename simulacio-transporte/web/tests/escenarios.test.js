/**
 * Pruebas del catálogo de escenarios experimentales (módulo puro, sin DOM).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ESCENARIO_PERSONALIZADO,
  aplicarEscenario,
  buscarEscenario,
  condicionEscenario,
  detectarEscenario,
  normalizarCatalogo,
} from '../js/escenarios.js';

const CATALOGO = [
  {
    id: 'estable',
    nombre: 'Escenario 1 · Estable',
    descripcion: 'La demanda es inferior a la capacidad.',
    condicion: 'ρ = 0.60 < 1',
    parametros: { lambda_p: 0.6, intervalo_promedio: 12, capacidad_autobus: 40 },
    rho: 0.6,
  },
  {
    id: 'sobrecarga',
    nombre: 'Escenario 4 · Sobrecarga',
    descripcion: 'La demanda supera la capacidad.',
    condicion: 'ρ = 2.40 > 1',
    parametros: { lambda_p: 2.4, intervalo_promedio: 12, capacidad_autobus: 40 },
    rho: 2.4,
  },
];

test('el catalogo se normaliza y descarta entradas invalidas', () => {
  const lista = normalizarCatalogo([...CATALOGO, null, { id: 'sin-parametros' }, 'texto']);
  assert.equal(lista.length, 2);
  assert.equal(lista[0].id, 'estable');
  assert.equal(lista[0].nombre, 'Escenario 1 · Estable');
});

test('un catalogo ausente o invalido produce una lista vacia', () => {
  assert.deepEqual(normalizarCatalogo(null), []);
  assert.deepEqual(normalizarCatalogo(undefined), []);
  assert.deepEqual(normalizarCatalogo('no es un catalogo'), []);
});

test('se busca un escenario por identificador', () => {
  assert.ok(buscarEscenario(CATALOGO, 'estable'));
  assert.equal(buscarEscenario(CATALOGO, 'inexistente'), null);
});

test('aplicar un escenario escribe sus parametros y conserva el resto', () => {
  const valores = aplicarEscenario(CATALOGO, 'estable', { num_repeticiones: 30, limite_cola: 150 });
  assert.equal(valores.lambda_p, 0.6);
  assert.equal(valores.intervalo_promedio, 12);
  assert.equal(valores.capacidad_autobus, 40);
  assert.equal(valores.num_repeticiones, 30);
  assert.equal(valores.limite_cola, 150);
});

test('aplicar un escenario inexistente no modifica los valores', () => {
  const actuales = { lambda_p: 1 };
  const valores = aplicarEscenario(CATALOGO, 'no-existe', actuales);
  assert.deepEqual(valores, actuales);
});

test('se detecta el escenario equivalente a la configuracion actual', () => {
  const valores = { lambda_p: 0.6, intervalo_promedio: 12, capacidad_autobus: 40, num_repeticiones: 30 };
  assert.equal(detectarEscenario(CATALOGO, valores), 'estable');
});

test('una configuracion editada se declara personalizada', () => {
  const valores = { lambda_p: 0.75, intervalo_promedio: 12, capacidad_autobus: 40 };
  assert.equal(detectarEscenario(CATALOGO, valores), ESCENARIO_PERSONALIZADO);
});

test('la comparacion numerica tolera el error de coma flotante', () => {
  const valores = { lambda_p: 0.6 + 1e-15, intervalo_promedio: 12, capacidad_autobus: 40 };
  assert.equal(detectarEscenario(CATALOGO, valores), 'estable');
});

test('la condicion de un escenario se muestra como texto', () => {
  assert.equal(condicionEscenario(CATALOGO, 'estable'), 'ρ = 0.60 < 1');
  assert.equal(condicionEscenario(CATALOGO, 'inexistente'), '');
});
