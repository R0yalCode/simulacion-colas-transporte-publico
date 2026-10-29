/**
 * Pruebas de la escala vertical adaptativa del gráfico de cola.
 * No requieren DOM ni navegador: validan la función pura de cálculo del eje.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { escalaYAdaptativa, pasoBonito } from '../js/graficos.js';

test('la escala parte de una cola vacía sin fijar 150 pasajeros', () => {
  const escala = escalaYAdaptativa(0);
  assert.equal(escala.maximo, 5);
  assert.equal(escala.paso, 1);
});

test('las colas pequeñas usan una escala proporcional y legible', () => {
  const conUno = escalaYAdaptativa(1);
  const conTres = escalaYAdaptativa(3);
  const conCinco = escalaYAdaptativa(5);

  assert.ok(conUno.maximo >= 1 && conUno.maximo <= 2, `máximo inesperado: ${conUno.maximo}`);
  assert.ok(conTres.maximo >= 3 && conTres.maximo <= 5, `máximo inesperado: ${conTres.maximo}`);
  assert.ok(conCinco.maximo >= 5 && conCinco.maximo <= 10, `máximo inesperado: ${conCinco.maximo}`);
  for (const escala of [conUno, conTres, conCinco]) {
    assert.ok(escala.maximo < 150, 'una cola pequeña no debe heredar el umbral operativo como tope');
    assert.ok(escala.paso > 0);
  }
});

test('la escala se amplía de forma monótona con la cola observada', () => {
  const valores = [1, 5, 20, 50, 100, 150];
  let anterior = 0;
  for (const valor of valores) {
    const escala = escalaYAdaptativa(valor);
    assert.ok(escala.maximo >= valor, `el máximo ${escala.maximo} no cubre ${valor}`);
    assert.ok(escala.maximo >= anterior, 'la escala no debe encogerse al aumentar los datos');
    assert.ok(Number.isFinite(escala.paso) && escala.paso > 0);
    anterior = escala.maximo;
  }
});

test('el paso del eje se redondea a intervalos legibles', () => {
  for (const valor of [1, 5, 20, 50, 100, 150, 1000]) {
    const { paso } = escalaYAdaptativa(valor);
    const normalizado = paso / Math.pow(10, Math.floor(Math.log10(paso)));
    assert.ok([1, 2, 5, 10].some((factor) => Math.abs(normalizado - factor) < 1e-9));
  }
  assert.equal(pasoBonito(100, 5), 20);
});
