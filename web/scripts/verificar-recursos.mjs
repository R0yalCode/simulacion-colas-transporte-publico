/**
 * Comprueba que los GLB generados se pueden cargar y que conservan sus clips.
 * Se ejecuta con `npm run verificar` (sin navegador).
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const modelos = join(aqui, '..', 'assets', 'models');

const esperados = {
  'autobus.glb': ['puertas_abrir', 'puertas_cerrar'],
  'pasajero.glb': ['reposo', 'caminar'],
};

const cargador = new GLTFLoader();

function cargar(ruta) {
  const buffer = readFileSync(ruta);
  const datos = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return new Promise((resolver, rechazar) => {
    cargador.parse(datos, '', (gltf) => resolver(gltf), (error) => rechazar(error));
  });
}

let fallos = 0;
for (const [archivo, clipsEsperados] of Object.entries(esperados)) {
  const ruta = join(modelos, archivo);
  if (!existsSync(ruta)) {
    console.error(`FALTA ${archivo}`);
    fallos += 1;
    continue;
  }
  const gltf = await cargar(ruta);
  const clips = gltf.animations.map((clip) => clip.name);
  const faltan = clipsEsperados.filter((nombre) => !clips.includes(nombre));
  const nodos = [];
  gltf.scene.traverse((objeto) => {
    if (objeto.name) nodos.push(objeto.name);
  });
  if (faltan.length > 0) {
    console.error(`${archivo}: faltan clips ${faltan.join(', ')} (encontrados: ${clips.join(', ')})`);
    fallos += 1;
  } else {
    console.log(`${archivo}: ${nodos.length} nodos, clips ${clips.join(' + ')}`);
  }
}

if (fallos > 0) {
  process.exitCode = 1;
} else {
  console.log('Recursos 3D verificados.');
}
