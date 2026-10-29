/**
 * Copia los archivos de Three.js necesarios desde node_modules a web/vendor/.
 *
 * El servidor solo publica el contenido de web/, por lo que la aplicación no
 * depende de node_modules en tiempo de ejecución. El mapa de importaciones de
 * index.html apunta a esta copia local.
 */

import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..');
const origen = join(raiz, 'node_modules', 'three');
const destino = join(raiz, 'vendor', 'three');

const archivos = [
  ['build/three.module.js', 'three.module.js'],
  ['build/three.core.js', 'three.core.js'],
  ['examples/jsm/loaders/GLTFLoader.js', 'addons/loaders/GLTFLoader.js'],
  ['examples/jsm/utils/BufferGeometryUtils.js', 'addons/utils/BufferGeometryUtils.js'],
  ['examples/jsm/utils/SkeletonUtils.js', 'addons/utils/SkeletonUtils.js'],
  ['examples/jsm/controls/OrbitControls.js', 'addons/controls/OrbitControls.js'],
];

for (const [desde, hasta] of archivos) {
  const salida = join(destino, hasta);
  mkdirSync(dirname(salida), { recursive: true });
  copyFileSync(join(origen, desde), salida);
  console.log(`vendor/three/${hasta}`);
}

console.log('Three.js copiado a web/vendor/three/.');
