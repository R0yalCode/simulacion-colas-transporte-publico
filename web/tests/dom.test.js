/**
 * Pruebas de integración estática entre el HTML y el JavaScript del dashboard.
 *
 * Verifican que cada identificador y selector requerido por los módulos exista
 * realmente en index.html, sin necesidad de un navegador.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

function leer(ruta) {
  return readFileSync(join(raiz, ruta), 'utf8');
}

const html = leer('index.html');
const appJs = leer('js/app.js');
const graficosJs = leer('js/graficos.js');
const registroJs = leer('js/registro.js');
const escenaJs = leer('js/escena.js');

const idsEnHtml = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));

function idsCitados(fuente) {
  const citados = new Set();
  for (const m of fuente.matchAll(/getElementById\((?:\s*)['"]([^'"`]+)['"](?:\s*)\)/g)) {
    citados.add(m[1]);
  }
  const bloque = fuente.match(/const ids = \[([\s\S]*?)\];/);
  if (bloque) {
    for (const m of bloque[1].matchAll(/'([^']+)'/g)) citados.add(m[1]);
  }
  return citados;
}

test('todos los identificadores usados en app.js existen en index.html', () => {
  const faltantes = [...idsCitados(appJs)].filter((id) => !idsEnHtml.has(id));
  assert.deepEqual(faltantes, []);
});

test('todos los identificadores usados en graficos.js existen en index.html', () => {
  const faltantes = [...idsCitados(graficosJs)].filter((id) => !idsEnHtml.has(id));
  assert.deepEqual(faltantes, []);
});

test('los selectores de clase usados por el dashboard existen en index.html', () => {
  assert.match(html, /class="[^"]*velocidad-boton[^"]*"/);
  assert.match(appJs, /\.velocidad-boton/);
});

test('index.html carga la hoja de estilos y el módulo principal', () => {
  assert.match(html, /<link[^>]+href="\/css\/styles\.css"/);
  const modulos = [...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(modulos, ['/js/app.js']);
});

test('los módulos del cliente no usan dependencias externas', () => {
  for (const fuente of [appJs, graficosJs, registroJs, escenaJs]) {
    assert.ok(!/import\s[^;]*from\s+['"](https?:)?\/\//.test(fuente), 'import remoto detectado');
    assert.ok(!/new\s+Worker\(|importScripts\(/.test(fuente), 'trabajador externo detectado');
  }
});

test('el registro de eventos recibe un contenedor de lista del HTML', () => {
  assert.match(html, /<ol id="registro"/);
  assert.match(appJs, /new RegistroEventos\(refs\['registro'\]/);
});

test('los canvas de escena y gráficos son accesibles con rol e imagen', () => {
  for (const id of ['escena', 'grafico-cola', 'grafico-acumulados', 'grafico-esperas', 'grafico-capacidad']) {
    const patron = new RegExp(`<canvas id="${id}"[^>]*role="img"[^>]*aria-label="[^"]+"`);
    assert.match(html, patron, `canvas ${id} sin rol o etiqueta accesible`);
  }
});
