/**
 * Pruebas del estado operativo, la composición de mensajes y los indicadores
 * científicos (módulo puro, sin DOM).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ESTADOS,
  LIMITE_VISUAL_MAX,
  componerMensaje,
  estadoOperativo,
  formatearRho,
  lineasIndicadores,
} from '../js/estado.js';

const CLASIFICACION_ESTABLE = {
  estado: ESTADOS.ESTABLE,
  etiqueta: 'ESTABLE',
  titulo: 'ESTADO DEL SISTEMA: ESTABLE',
  detalle: 'Capacidad de transporte suficiente para la demanda media.',
  severidad: 'ok',
  es_sobrecarga_matematica: false,
  lambda_p: 0.6,
  mu: 1,
  rho: 0.6,
};

const CLASIFICACION_SOBRECARGA = {
  estado: ESTADOS.SOBRECARGADO,
  etiqueta: 'SOBRECARGADO',
  titulo: 'ESTADO DEL SISTEMA: SOBRECARGADO',
  detalle: 'La demanda media supera la capacidad media de transporte.',
  severidad: 'alerta',
  es_sobrecarga_matematica: true,
  lambda_p: 2.4,
  mu: 1,
  rho: 2.4,
};

test('el limite visual por defecto es de 150 pasajeros', () => {
  assert.equal(LIMITE_VISUAL_MAX, 150);
});

test('el estado operativo distingue cola, saturacion y excedente', () => {
  const vacio = estadoOperativo(0, 150);
  assert.equal(vacio.colaReal, 0);
  assert.equal(vacio.saturado, false);
  assert.equal(vacio.excedente, 0);
  assert.equal(vacio.faltantes, 150);

  const parcial = estadoOperativo(42, 150);
  assert.equal(parcial.renderizados, 42);
  assert.equal(parcial.saturado, false);
  assert.equal(parcial.excedente, 0);
  assert.ok(parcial.porcentaje > 0.27 && parcial.porcentaje < 0.29);

  const justo = estadoOperativo(150, 150);
  assert.equal(justo.saturado, true);
  assert.equal(justo.excedente, 0);
  assert.equal(justo.renderizados, 150);

  const excedido = estadoOperativo(187, 150);
  assert.equal(excedido.saturado, true);
  assert.equal(excedido.excedente, 37);
  assert.equal(excedido.renderizados, 150);
});

test('la cola real nunca se recorta: el excedente se contabiliza aparte', () => {
  const estado = estadoOperativo(500, 150);
  assert.equal(estado.colaReal, 500);
  assert.equal(estado.renderizados, 150);
  assert.equal(estado.excedente, 350);
});

test('el mensaje combina sobrecarga matematica y saturacion operativa', () => {
  const mensaje = componerMensaje(CLASIFICACION_SOBRECARGA, estadoOperativo(180, 150));
  assert.equal(mensaje.titulo, 'SOBRECARGA MATEMÁTICA Y SATURACIÓN OPERATIVA');
  assert.equal(mensaje.severidad, 'alerta');
  assert.equal(mensaje.esAlerta, true);
  assert.ok(mensaje.detalle.includes('2,40'));
  assert.ok(mensaje.detalle.includes('150'));
});

test('la sobrecarga matematica se avisa aunque la cola aun no se sature', () => {
  const mensaje = componerMensaje(CLASIFICACION_SOBRECARGA, estadoOperativo(30, 150));
  assert.equal(mensaje.titulo, 'SOBRECARGA MATEMÁTICA');
  assert.equal(mensaje.severidad, 'alerta');
});

test('la saturacion operativa se distingue de la sobrecarga matematica', () => {
  const mensaje = componerMensaje(CLASIFICACION_ESTABLE, estadoOperativo(150, 150));
  assert.equal(mensaje.titulo, 'SATURACIÓN OPERATIVA');
  assert.equal(mensaje.severidad, 'alerta');
  assert.ok(mensaje.detalle.includes('no declara sobrecarga matemática'));
});

test('sin anomalias el mensaje refleja la clasificacion del servidor', () => {
  const mensaje = componerMensaje(CLASIFICACION_ESTABLE, estadoOperativo(12, 150));
  assert.equal(mensaje.titulo, 'ESTADO DEL SISTEMA: ESTABLE');
  assert.equal(mensaje.severidad, 'ok');
  assert.equal(mensaje.esAlerta, false);
});

test('el estado sin datos no rompe la composicion del mensaje', () => {
  const mensaje = componerMensaje(null, null);
  assert.ok(mensaje.titulo.length > 0);
  assert.ok(mensaje.detalle.length > 0);
  assert.equal(mensaje.severidad, 'ok');
});

test('rho se representa de forma explicita', () => {
  assert.equal(formatearRho(0.6), '0.600');
  assert.equal(formatearRho(null), '∞');
  assert.equal(formatearRho(Infinity), '∞');
  assert.equal(formatearRho(undefined), '∞');
});

test('los indicadores científicos incluyen los valores clave del modelo', () => {
  const lineas = lineasIndicadores(
    CLASIFICACION_ESTABLE,
    estadoOperativo(80, 150),
    { capacidad_efectiva: 12, umbral_alta_utilizacion: 0.8, tolerancia_critico: 1e-9 },
    { cola_maxima: 92, tiempo_saturacion_operativa: null, minutos_en_saturacion: 0 },
  );
  const claves = lineas.map((linea) => linea.clave);
  for (const clave of ['lambda_p', 'mu', 'rho', 'capacidad_efectiva', 'limite_cola', 'excedente']) {
    assert.ok(claves.includes(clave), `falta el indicador ${clave}`);
  }
  for (const linea of lineas) {
    assert.ok(linea.etiqueta.length > 0);
    assert.ok(linea.valor.length > 0);
    assert.ok(linea.ayuda.length > 0);
  }
  const cola = lineas.find((linea) => linea.clave === 'cola_real');
  assert.equal(cola.valor, '80 pasajeros');
});
