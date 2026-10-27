/**
 * Pruebas del reloj simulado de la capa de reproducción.
 *
 * Verifican que la velocidad multiplica el ritmo visual sin tocar los datos,
 * que pausar detiene el reloj y que los saltos de fotograma están acotados.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RelojSimulado, VELOCIDADES, MINUTOS_POR_SEGUNDO_BASE, SALTO_MAXIMO_REAL } from '../js/reloj.js';

const PASO_MS = 200;

test('el reloj no avanza si no está reproduciendo', () => {
  const reloj = new RelojSimulado({ duracion: 100 });
  assert.equal(reloj.avanzar(0), 0);
  assert.equal(reloj.avanzar(5000), 0);
});

test('a 1× avanza al ritmo base', () => {
  const reloj = new RelojSimulado({ duracion: 100, velocidad: 1 });
  reloj.iniciar();
  reloj.avanzar(0);
  reloj.avanzar(PASO_MS);
  const esperado = MINUTOS_POR_SEGUNDO_BASE * (PASO_MS / 1000);
  assert.ok(Math.abs(reloj.tiempo - esperado) < 1e-9, `tiempo ${reloj.tiempo} esperado ${esperado}`);
});

test('cada velocidad multiplica el ritmo visual (misma ejecución)', () => {
  for (const velocidad of VELOCIDADES) {
    const reloj = new RelojSimulado({ duracion: 1000, velocidad });
    reloj.iniciar();
    reloj.avanzar(0);
    reloj.avanzar(PASO_MS);
    const esperado = MINUTOS_POR_SEGUNDO_BASE * velocidad * (PASO_MS / 1000);
    assert.ok(Math.abs(reloj.tiempo - esperado) < 1e-9, `velocidad ${velocidad} → ${reloj.tiempo}`);
  }
});

test('los saltos largos de tiempo real se acotan por fotograma', () => {
  const reloj = new RelojSimulado({ duracion: 1000, velocidad: 1 });
  reloj.iniciar();
  reloj.avanzar(0);
  reloj.avanzar(60000);
  assert.ok(Math.abs(reloj.tiempo - SALTO_MAXIMO_REAL * MINUTOS_POR_SEGUNDO_BASE) < 1e-9);
});

test('pausar detiene el reloj y reanudar continúa desde el mismo instante', () => {
  const reloj = new RelojSimulado({ duracion: 100, velocidad: 1 });
  reloj.iniciar();
  reloj.avanzar(0);
  reloj.avanzar(PASO_MS);
  const antes = reloj.tiempo;
  reloj.pausar();
  reloj.avanzar(30000);
  assert.equal(reloj.tiempo, antes);
  reloj.iniciar();
  reloj.avanzar(30000);
  reloj.avanzar(30000 + PASO_MS);
  const esperado = antes + MINUTOS_POR_SEGUNDO_BASE * (PASO_MS / 1000);
  assert.ok(Math.abs(reloj.tiempo - esperado) < 1e-9);
});

test('cambiar la velocidad no salta en el tiempo ni pierde el instante', () => {
  const reloj = new RelojSimulado({ duracion: 100, velocidad: 1 });
  reloj.iniciar();
  reloj.avanzar(0);
  reloj.avanzar(PASO_MS);
  const antes = reloj.tiempo;
  reloj.cambiarVelocidad(2.5);
  reloj.avanzar(PASO_MS);
  assert.equal(reloj.tiempo, antes, 'el primer fotograma tras el cambio solo reancla la referencia');
  reloj.avanzar(PASO_MS * 2);
  const esperado = antes + MINUTOS_POR_SEGUNDO_BASE * 2.5 * (PASO_MS / 1000);
  assert.ok(Math.abs(reloj.tiempo - esperado) < 1e-9);
});

test('velocidades no permitidas se ignoran', () => {
  const reloj = new RelojSimulado({ duracion: 100 });
  reloj.cambiarVelocidad(7);
  assert.equal(reloj.velocidad, 1);
  reloj.cambiarVelocidad('rápido');
  assert.equal(reloj.velocidad, 1);
});

test('el reloj se detiene al alcanzar la duración y reiniciar vuelve a 0', () => {
  const reloj = new RelojSimulado({ duracion: 5, velocidad: 1 });
  reloj.iniciar();
  let ahora = 0;
  reloj.avanzar(ahora);
  while (reloj.reproduciendo && ahora < 60000) {
    ahora += PASO_MS;
    reloj.avanzar(ahora);
  }
  assert.equal(reloj.tiempo, 5);
  assert.equal(reloj.reproduciendo, false);
  assert.equal(reloj.finalizado, true);
  reloj.iniciar();
  assert.equal(reloj.tiempo, 0);
  assert.equal(reloj.reproduciendo, true);
});

test('irA acota el instante al rango válido', () => {
  const reloj = new RelojSimulado({ duracion: 100 });
  reloj.irA(-5);
  assert.equal(reloj.tiempo, 0);
  reloj.irA(1000);
  assert.equal(reloj.tiempo, 100);
  reloj.irA(42.5);
  assert.equal(reloj.tiempo, 42.5);
});

test('el reloj no conoce ni modifica los datos de la simulación', () => {
  const reloj = new RelojSimulado({ duracion: 100 });
  const claves = Object.keys(reloj);
  assert.ok(!claves.some((clave) => ['eventos', 'estadisticas', 'resultados'].includes(clave)));
});
