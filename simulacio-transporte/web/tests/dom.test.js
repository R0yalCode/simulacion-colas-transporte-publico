/**
 * Pruebas de integración estática entre el HTML y el JavaScript del dashboard.
 *
 * Verifican que cada identificador y selector requerido por los módulos exista
 * realmente en index.html, sin necesidad de un navegador.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
const escena3dJs = leer('js/escena3d.js');
const disposicion3dJs = leer('js/disposicion3d.js');

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
  for (const fuente of [appJs, graficosJs, registroJs, escenaJs, escena3dJs, disposicion3dJs]) {
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

test('index.html declara el mapa de importaciones local de Three.js', () => {
  assert.match(html, /<script type="importmap">/);
  assert.match(html, /"three"\s*:\s*"\/vendor\/three\/three\.module\.js"/);
  assert.match(html, /"three\/addons\/"\s*:\s*"\/vendor\/three\/addons\/"/);
});

test('los modelos 3D y la copia local de Three.js existen', () => {
  const requeridos = [
    'vendor/three/three.module.js',
    'vendor/three/three.core.js',
    'vendor/three/addons/loaders/GLTFLoader.js',
    'vendor/three/addons/controls/OrbitControls.js',
    'assets/models/autobus.glb',
    'assets/models/pasajero.glb',
    'assets/models/manifiesto.json',
  ];
  for (const ruta of requeridos) {
    assert.ok(existsSync(join(raiz, ruta)), `falta ${ruta}`);
  }
});

test('cada gráfica incluye su propio botón de pantalla completa', () => {
  for (const clave of ['cola', 'acumulados', 'esperas', 'capacidad']) {
    const bloque = html.split(`data-grafico="${clave}"`)[1];
    assert.ok(bloque, `falta el panel del gráfico ${clave}`);
    const articulo = bloque.split('</article>')[0];
    assert.match(articulo, /data-ampliar/, `el gráfico ${clave} no tiene botón de ampliación`);
    assert.match(articulo, new RegExp(`id="grafico-${clave}"`), `el botón no corresponde al canvas ${clave}`);
  }
  assert.equal([...html.matchAll(/data-ampliar/g)].length, 8);
  assert.match(appJs, /conectarPantallaCompleta\(\{ \.\.\.graficos, \.\.\.graficosComparacion \}\)/);
});

test('los cuatro gráficos comparativos tienen panel y botón de ampliación', () => {
  for (const clave of ['comparacionCola', 'comparacionBoxplot', 'comparacionEsperas', 'comparacionDemanda']) {
    const bloque = html.split(`data-grafico="${clave}"`)[1];
    assert.ok(bloque, `falta el panel del gráfico comparativo ${clave}`);
    const articulo = bloque.split('</article>')[0];
    assert.match(articulo, /data-ampliar/, `el gráfico ${clave} no tiene botón de ampliación`);
  }
});

const css = leer('css/styles.css');

test('el banner de error sin mensaje declara hidden inicial y el CSS no lo desbloquea', () => {
  // Causa del recuadro rojo vacío: display:flex del autor anulaba la regla
  // UA [hidden]{display:none}. El banner arranca oculto y así debe seguirse
  // mostrando (Caso 1: servidor disponible, sin alerta alguna).
  assert.match(html, /<div id="banner-error"[^>]*hidden[^>]*>/);
  assert.match(css, /\.banner\[hidden\]\s*\{[^}]*display:\s*none/);
});

test('mostrarBanner no renderiza el contenedor con mensajes vacíos o en blanco', () => {
  // El mensaje solo se pinta si existe texto real; con '' o '   ' debe
  // ocultarse, no quedar un contenedor rojo sin contenido.
  const cuerpoMostrar = appJs.match(/function mostrarBanner\(mensaje[\s\S]*?\n\}/)[0];
  const cuerpoOcultar = appJs.match(/function ocultarBanner\(\)[\s\S]*?\n\}/)[0];
  assert.match(cuerpoMostrar, /trim\(\)/, 'mostrarBanner debe recortar el mensaje entrante');
  assert.match(cuerpoMostrar, /if\s*\(!texto\)\s*\{\s*ocultarBanner\(\);?\s*return;?/, 'con mensaje vacío debe ocultarse y no renderizar');
  assert.match(cuerpoOcultar, /hidden = true/, 'ocultarBanner retira el contenedor con hidden');
  assert.match(cuerpoOcultar, /setTexto\(refs\['banner-error-texto'\], ''\)/, 'ocultarBanner limpia el texto para no dejar estado obsoleto');
});
