/**
 * Generador local de los modelos glTF binarios (GLB) del simulador.
 *
 * Los dos modelos son obra original del proyecto: no se descargan recursos de
 * terceros ni se depende de servicios externos en tiempo de ejecución. El
 * script se ejecuta con `npm run recursos` y escribe en `web/assets/models/`.
 *
 * Los clips de animación se exportan dentro del GLB y se reproducen en el
 * navegador con `GLTFLoader` + `AnimationMixer`.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// El exportador usa FileReader para volcar el buffer binario; Node no lo trae.
globalThis.FileReader = class FileReaderPolyfill {
  constructor() {
    this.result = null;
    this.onloadend = null;
  }
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      if (typeof this.onloadend === 'function') this.onloadend();
    });
  }
};

const aqui = dirname(fileURLToPath(import.meta.url));
const destino = join(aqui, '..', 'assets', 'models');
mkdirSync(destino, { recursive: true });

// ---------------------------------------------------------------------------
// Utilidades de construcción
// ---------------------------------------------------------------------------

function material(nombre, color, { roughness = 0.72, metalness = 0.05, emissive = 0, emissiveIntensity = 0 } = {}) {
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
  });
  m.name = nombre;
  return m;
}

function agregarMalla(padre, nombre, geometria, mat, posicion = [0, 0, 0], rotacion = [0, 0, 0], escala = [1, 1, 1]) {
  const malla = new THREE.Mesh(geometria, mat);
  malla.name = nombre;
  malla.position.set(...posicion);
  malla.rotation.set(...rotacion);
  malla.scale.set(...escala);
  malla.castShadow = true;
  malla.receiveShadow = true;
  padre.add(malla);
  return malla;
}

function caja(padre, nombre, tamano, posicion, mat, { rotacion, radio = 0, segmentos = 2 } = {}) {
  const geometria = radio > 0
    ? new RoundedBoxGeometry(tamano[0], tamano[1], tamano[2], segmentos, radio)
    : new THREE.BoxGeometry(tamano[0], tamano[1], tamano[2]);
  return agregarMalla(padre, nombre, geometria, mat, posicion, rotacion || [0, 0, 0]);
}

function capsula(padre, nombre, radio, largo, posicion, mat, { rotacion, escala } = {}) {
  const geometria = new THREE.CapsuleGeometry(radio, largo, 4, 10);
  return agregarMalla(padre, nombre, geometria, mat, posicion, rotacion || [0, 0, 0], escala || [1, 1, 1]);
}

function cilindro(padre, nombre, radioSup, radioInf, alto, posicion, mat, { rotacion, segmentos = 14 } = {}) {
  const geometria = new THREE.CylinderGeometry(radioSup, radioInf, alto, segmentos);
  return agregarMalla(padre, nombre, geometria, mat, posicion, rotacion || [0, 0, 0]);
}

function grupo(padre, nombre, posicion = [0, 0, 0]) {
  const g = new THREE.Group();
  g.name = nombre;
  g.position.set(...posicion);
  padre.add(g);
  return g;
}

// ---------------------------------------------------------------------------
// Animación: pistas de quaternion/posición generadas a partir de funciones
// ---------------------------------------------------------------------------

function pistaQuaternion(nombre, tiempos, funcionEuler) {
  const auxiliar = new THREE.Object3D();
  const valores = [];
  for (const t of tiempos) {
    const [x, y, z] = funcionEuler(t);
    auxiliar.rotation.set(x, y, z);
    auxiliar.quaternion.normalize();
    valores.push(auxiliar.quaternion.x, auxiliar.quaternion.y, auxiliar.quaternion.z, auxiliar.quaternion.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${nombre}.quaternion`, tiempos, valores);
}

function pistaPosicion(nombre, tiempos, funcionVector) {
  const valores = [];
  for (const t of tiempos) valores.push(...funcionVector(t));
  return new THREE.VectorKeyframeTrack(`${nombre}.position`, tiempos, valores);
}

// ---------------------------------------------------------------------------
// Autobús urbano
// ---------------------------------------------------------------------------

function construirAutobus() {
  const bus = new THREE.Group();
  bus.name = 'autobus';

  const pintura = material('pintura_autobus', 0x245a72, { roughness: 0.52, metalness: 0.18 });
  const pinturaBaja = material('pintura_baja', 0x173f52, { roughness: 0.62, metalness: 0.12 });
  const franja = material('franja', 0xd7e4e6, { roughness: 0.45, metalness: 0.1 });
  const vidrio = material('vidrio_autobus', 0x0b1a27, { roughness: 0.12, metalness: 0.55 });
  const vidrioSuave = material('vidrio_suave', 0x142b3a, { roughness: 0.2, metalness: 0.35 });
  const metal = material('metal', 0x8b9aa5, { roughness: 0.35, metalness: 0.8 });
  const oscuro = material('oscuro', 0x0a1118, { roughness: 0.8, metalness: 0.1 });
  const goma = material('goma', 0x121418, { roughness: 0.95, metalness: 0.02 });
  const asiento = material('asiento', 0x2d6a7a, { roughness: 0.85, metalness: 0.02 });
  const asientoClaro = material('asiento_claro', 0x3d8796, { roughness: 0.85, metalness: 0.02 });
  const luz = material('luz_interior', 0xffe6b8, { roughness: 0.5, emissive: 0xffdca8, emissiveIntensity: 2.2 });
  const faro = material('faro', 0xfff3cd, { roughness: 0.2, emissive: 0xffe9b0, emissiveIntensity: 3.0 });
  const piloto = material('piloto', 0xd83c3c, { roughness: 0.3, emissive: 0xb21f1f, emissiveIntensity: 2.0 });
  const matricula = material('matricula', 0xe8eef1, { roughness: 0.6 });
  const rotulo = material('rotulo', 0x1a1d20, { roughness: 0.4, emissive: 0xe59a2a, emissiveIntensity: 0.9 });

  // Carrocería principal redondeada.
  const carroceria = new RoundedBoxGeometry(11.7, 2.32, 2.5, 4, 0.16);
  agregarMalla(bus, 'carroceria', carroceria, pintura, [0, 1.72, 0]);
  caja(bus, 'faldon', [11.7, 0.62, 2.48], [0, 0.7, 0], pinturaBaja, { radio: 0.1 });
  caja(bus, 'franja_lateral', [11.5, 0.14, 0.02], [0, 1.16, 1.257], franja);
  caja(bus, 'franja_lateral_trasera', [11.5, 0.14, 0.02], [0, 1.16, -1.257], franja);
  caja(bus, 'techo', [11.3, 0.12, 2.3], [0, 2.9, 0], pintura);
  caja(bus, 'techo_claro', [10.6, 0.05, 1.9], [0, 2.97, 0], franja);
  caja(bus, 'aire_acondicionado', [2.1, 0.26, 1.45], [-1.2, 3.08, 0], material('climatizador', 0xd5dde0, { roughness: 0.5, metalness: 0.3 }), { radio: 0.07 });
  caja(bus, 'defensa_delantera', [0.28, 0.42, 2.3], [5.77, 0.71, 0], oscuro, { radio: 0.08 });
  caja(bus, 'defensa_trasera', [0.24, 0.42, 2.3], [-5.77, 0.71, 0], oscuro, { radio: 0.08 });
  caja(bus, 'parachoques_delantero', [0.34, 0.2, 2.42], [5.82, 0.55, 0], metal, { radio: 0.06 });
  caja(bus, 'parachoques_trasero', [0.34, 0.2, 2.42], [-5.82, 0.55, 0], metal, { radio: 0.06 });

  // Ventanas laterales continuas con montantes.
  caja(bus, 'ventanal_lado_derecho', [10.55, 0.94, 0.035], [-0.15, 2.35, 1.258], vidrio);
  caja(bus, 'ventanal_lado_izquierdo', [10.55, 0.94, 0.035], [-0.15, 2.35, -1.258], vidrio);
  for (const x of [-5.2, -3.7, -2.2, -0.7, 0.8, 2.3, 3.9, 5.2]) {
    caja(bus, `montante_${x}`, [0.12, 1.06, 0.06], [x, 2.35, 1.27], pinturaBaja);
    caja(bus, `montante_trasero_${x}`, [0.12, 1.06, 0.06], [x, 2.35, -1.27], pinturaBaja);
  }
  caja(bus, 'parabrisas', [0.04, 1.2, 2.2], [5.86, 2.26, 0], vidrioSuave, { rotacion: [0, 0, -0.04] });
  caja(bus, 'luneta', [0.04, 0.98, 2.05], [-5.85, 2.3, 0], vidrioSuave);

  // Rótulo de línea (panel ámbar; el texto se añade en la escena).
  caja(bus, 'rotulo_linea', [0.05, 0.27, 1.5], [5.88, 2.78, 0], rotulo);
  caja(bus, 'matricula_delantera', [0.04, 0.16, 0.46], [5.9, 0.78, 0], matricula);

  // Faros y pilotos.
  for (const z of [-0.82, 0.82]) {
    caja(bus, `faro_${z}`, [0.06, 0.18, 0.34], [5.885, 1.02, z], faro, { radio: 0.04 });
    caja(bus, `piloto_${z}`, [0.06, 0.16, 0.26], [-5.885, 1.08, z], piloto, { radio: 0.04 });
  }
  for (const z of [-1.29, 1.29]) {
    caja(bus, `intermitente_${z}`, [0.16, 0.08, 0.04], [5.86, 1.38, z], material('intermitente', 0xf0a52c, { emissive: 0xe08b14, emissiveIntensity: 1.4 }));
  }

  // Retrovisores.
  for (const z of [-1.42, 1.42]) {
    caja(bus, `espejo_${z}`, [0.1, 0.24, 0.16], [5.42, 2.56, z], oscuro, { radio: 0.03 });
    caja(bus, `brazo_espejo_${z}`, [0.34, 0.04, 0.04], [5.64, 2.53, z], metal);
  }

  // Ruedas (grupos animables en la escena).
  const ruedas = [];
  for (const [nombre, x, z] of [
    ['rueda_delantera_derecha', 3.95, 1.1],
    ['rueda_trasera_derecha', -3.85, 1.1],
    ['rueda_delantera_izquierda', 3.95, -1.1],
    ['rueda_trasera_izquierda', -3.85, -1.1],
  ]) {
    const rueda = grupo(bus, nombre, [x, 0.56, z]);
    cilindro(rueda, `${nombre}_neumatico`, 0.53, 0.53, 0.29, [0, 0, 0], goma, { rotacion: [Math.PI / 2, 0, 0], segmentos: 22 });
    cilindro(rueda, `${nombre}_llanta`, 0.26, 0.26, 0.305, [0, 0, 0], metal, { rotacion: [Math.PI / 2, 0, 0], segmentos: 16 });
    cilindro(rueda, `${nombre}_buje`, 0.09, 0.09, 0.32, [0, 0, 0], oscuro, { rotacion: [Math.PI / 2, 0, 0], segmentos: 12 });
    ruedas.push(rueda);
  }

  // Puertas correderas del lado de la acera (z positivo).
  const puertas = [];
  const puertasDef = [
    { centro: 3.15, prefijo: 'puerta_delantera' },
    { centro: -2.45, prefijo: 'puerta_trasera' },
  ];
  for (const { centro, prefijo } of puertasDef) {
    caja(bus, `${prefijo}_hueco`, [1.2, 2.06, 0.05], [centro, 1.7, 1.255], oscuro);
    caja(bus, `${prefijo}_marco_sup`, [1.34, 0.08, 0.09], [centro, 2.76, 1.27], metal);
    for (const [sufijo, desplazamiento] of [['a', -0.29], ['b', 0.29]]) {
      const hoja = grupo(bus, `${prefijo}_${sufijo}`, [centro + desplazamiento, 1.68, 1.28]);
      caja(hoja, `${prefijo}_${sufijo}_panel`, [0.55, 0.9, 0.045], [0, -0.55, 0], pinturaBaja, { radio: 0.03 });
      caja(hoja, `${prefijo}_${sufijo}_vidrio`, [0.51, 1.0, 0.035], [0, 0.32, 0.005], vidrio, { radio: 0.02 });
      caja(hoja, `${prefijo}_${sufijo}_barra`, [0.04, 1.9, 0.06], [desplazamiento < 0 ? -0.25 : 0.25, -0.05, 0.05], metal);
      puertas.push({ hoja, xCerrada: centro + desplazamiento, xAbierta: centro + desplazamiento * 3.0 });
    }
    // Peldaño exterior.
    caja(bus, `${prefijo}_peldaño`, [1.05, 0.16, 0.42], [centro, 0.33, 1.43], metal, { radio: 0.03 });
  }

  // Interior visible a través de las ventanas.
  caja(bus, 'piso_interior', [10.7, 0.08, 2.26], [-0.1, 0.83, 0], material('piso_interior', 0x20333d, { roughness: 0.9 }));
  caja(bus, 'techo_interior', [10.7, 0.05, 2.2], [-0.1, 2.8, 0], material('techo_interior', 0x5d747d, { roughness: 0.9 }));
  caja(bus, 'separador_conductor', [0.08, 1.9, 1.0], [4.85, 1.78, 0.55], vidrioSuave);
  for (const x of [-4.6, -2.9, -1.2, 0.5, 2.2]) {
    for (const z of [-0.66, 0.66]) {
      const base = caja(bus, `asiento_${x}_${z}_base`, [0.82, 0.16, 0.42], [x, 1.03, z], z > 0 ? asiento : asientoClaro, { radio: 0.04 });
      base.castShadow = false;
      const respaldo = caja(bus, `asiento_${x}_${z}_respaldo`, [0.82, 0.48, 0.12], [x, 1.3, z + (z > 0 ? 0.16 : -0.16)], z > 0 ? asiento : asientoClaro, { radio: 0.04 });
      respaldo.castShadow = false;
    }
  }
  for (const x of [-4.0, -1.0, 2.0]) {
    for (const z of [-0.55, 0.55]) {
      cilindro(bus, `barra_${x}_${z}`, 0.022, 0.022, 1.85, [x, 1.82, z], metal, { segmentos: 8 });
    }
  }
  for (const x of [-3.0, 0.0, 2.7]) {
    caja(bus, `luz_techo_${x}`, [1.4, 0.04, 0.1], [x, 2.78, 0], luz);
  }

  const abrir = (desplazamiento) => {
    const pistas = [];
    for (const { hoja, xCerrada, xAbierta } of puertas) {
      const destinoX = desplazamiento > 0 ? xAbierta : xCerrada;
      const origenX = desplazamiento > 0 ? xCerrada : xAbierta;
      pistas.push(
        pistaPosicion(hoja.name, [0, 0.9], (t) => {
          const f = t / 0.9;
          const suave = f * f * (3 - 2 * f);
          return [origenX + (destinoX - origenX) * suave, 1.68, 1.28];
        }),
      );
    }
    return pistas;
  };

  const clips = [
    new THREE.AnimationClip('puertas_abrir', 0.9, abrir(1)),
    new THREE.AnimationClip('puertas_cerrar', 0.9, abrir(-1)),
  ];

  return { raiz: bus, clips, ruedas };
}

// ---------------------------------------------------------------------------
// Pasajero humano articulado
// ---------------------------------------------------------------------------

function construirPasajero() {
  const raiz = new THREE.Group();
  raiz.name = 'pasajero';

  const piel = material('piel', 0xc99272, { roughness: 0.78 });
  const camisa = material('camisa', 0x3c6f8a, { roughness: 0.86 });
  const pantalon = material('pantalon', 0x2f3a48, { roughness: 0.9 });
  const zapato = material('zapato', 0x1b1e23, { roughness: 0.65 });
  const pelo = material('pelo', 0x241b17, { roughness: 0.9 });
  const ojo = material('ojo', 0x14171a, { roughness: 0.4 });
  const mochilaMat = material('mochila', 0x7b3f42, { roughness: 0.9 });
  const gorraMat = material('gorra', 0x2b4f6b, { roughness: 0.85 });

  const cadera = grupo(raiz, 'cadera', [0, 0.92, 0]);
  agregarMalla(cadera, 'pelvis', new THREE.CapsuleGeometry(0.17, 0.16, 4, 10), pantalon, [0, 0.02, 0], [0, 0, 0], [1.06, 1, 0.72]);

  const torso = grupo(cadera, 'torso', [0, 0.06, 0]);
  agregarMalla(torso, 'torso_bajo', new THREE.CylinderGeometry(0.2, 0.22, 0.34, 12), camisa, [0, 0.17, 0], [0, 0, 0], [1.06, 1, 0.7]);
  agregarMalla(torso, 'pecho', new THREE.CapsuleGeometry(0.205, 0.18, 5, 12), camisa, [0, 0.4, 0], [0, 0, 0], [1.08, 1, 0.68]);
  agregarMalla(torso, 'cuello', new THREE.CylinderGeometry(0.055, 0.06, 0.1, 10), piel, [0, 0.57, 0]);
  agregarMalla(torso, 'cuello_camisa', new THREE.CylinderGeometry(0.085, 0.1, 0.07, 10), camisa, [0, 0.53, 0]);

  const cabezaPivote = grupo(torso, 'cabeza_pivote', [0, 0.6, 0]);
  agregarMalla(cabezaPivote, 'cabeza', new THREE.SphereGeometry(0.112, 18, 14), piel, [0, 0.12, 0], [0, 0, 0], [1, 1.13, 0.96]);
  agregarMalla(cabezaPivote, 'nariz', new THREE.SphereGeometry(0.022, 8, 6), piel, [0, 0.115, 0.105], [0, 0, 0], [0.8, 1.1, 1.1]);
  for (const x of [-0.042, 0.042]) {
    agregarMalla(cabezaPivote, `ojo_${x}`, new THREE.SphereGeometry(0.013, 8, 6), ojo, [x, 0.148, 0.1]);
  }
  agregarMalla(cabezaPivote, 'boca', new THREE.BoxGeometry(0.045, 0.009, 0.012), material('boca', 0x8b5b52, { roughness: 0.8 }), [0, 0.078, 0.103]);
  agregarMalla(cabezaPivote, 'pelo', new THREE.SphereGeometry(0.118, 16, 9, 0, Math.PI * 2, 0, Math.PI * 0.55), pelo, [0, 0.135, -0.005], [0, 0, 0], [1.02, 1.1, 1]);
  agregarMalla(cabezaPivote, 'pelo_nuca', new THREE.BoxGeometry(0.19, 0.13, 0.1), pelo, [0, 0.07, -0.065]);
  for (const x of [-0.11, 0.11]) {
    agregarMalla(cabezaPivote, `oreja_${x}`, new THREE.SphereGeometry(0.023, 8, 6), piel, [x, 0.115, 0], [0, 0, 0], [0.5, 1, 0.8]);
  }

  const gorra = grupo(cabezaPivote, 'gorra', [0, 0.19, 0]);
  agregarMalla(gorra, 'gorra_copa', new THREE.SphereGeometry(0.122, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), gorraMat, [0, 0, 0], [0, 0, 0], [1.02, 0.9, 1]);
  agregarMalla(gorra, 'gorra_visera', new THREE.BoxGeometry(0.2, 0.022, 0.13), gorraMat, [0, -0.005, 0.09], [0.08, 0, 0]);

  // Brazos: hombro -> codo. Manga corta (antebrazo de piel).
  const brazos = {};
  for (const [lado, signo] of [['izq', -1], ['der', 1]]) {
    const hombro = grupo(torso, `hombro_${lado}`, [signo * 0.24, 0.43, 0]);
    agregarMalla(hombro, `hombro_malla_${lado}`, new THREE.SphereGeometry(0.075, 10, 8), camisa, [0, 0, 0], [0, 0, 0], [1, 0.9, 0.9]);
    agregarMalla(hombro, `brazo_${lado}`, new THREE.CapsuleGeometry(0.056, 0.19, 4, 9), camisa, [0, -0.15, 0]);
    const codo = grupo(hombro, `codo_${lado}`, [0, -0.3, 0]);
    agregarMalla(codo, `antebrazo_${lado}`, new THREE.CapsuleGeometry(0.049, 0.2, 4, 9), piel, [0, -0.13, 0]);
    agregarMalla(codo, `mano_${lado}`, new THREE.SphereGeometry(0.055, 10, 8), piel, [0, -0.27, 0], [0, 0, 0], [0.85, 1.05, 0.7]);
    brazos[lado] = { hombro, codo };
  }

  // Piernas: cadera -> rodilla -> pie.
  const piernas = {};
  for (const [lado, signo] of [['izq', -1], ['der', 1]]) {
    const pierna = grupo(cadera, `pierna_${lado}`, [signo * 0.1, -0.02, 0]);
    agregarMalla(pierna, `muslo_${lado}`, new THREE.CapsuleGeometry(0.078, 0.29, 4, 10), pantalon, [0, -0.19, 0], [0, 0, 0], [1, 1, 1.02]);
    const rodilla = grupo(pierna, `rodilla_${lado}`, [0, -0.44, 0]);
    agregarMalla(rodilla, `pantorrilla_${lado}`, new THREE.CapsuleGeometry(0.061, 0.29, 4, 10), pantalon, [0, -0.18, 0]);
    agregarMalla(rodilla, `pie_${lado}`, new THREE.BoxGeometry(0.11, 0.075, 0.26), zapato, [0, -0.385, 0.055], [0, 0, 0], [1, 1, 1]);
    piernas[lado] = { pierna, rodilla };
  }

  const mochila = grupo(torso, 'mochila', [0, 0.32, -0.185]);
  agregarMalla(mochila, 'mochila_cuerpo', new THREE.BoxGeometry(0.3, 0.38, 0.16), mochilaMat, [0, 0, 0], [0, 0, 0], [1, 1, 1]);
  agregarMalla(mochila, 'mochila_correa_izq', new THREE.BoxGeometry(0.035, 0.42, 0.035), mochilaMat, [-0.14, 0.02, 0.19]);
  agregarMalla(mochila, 'mochila_correa_der', new THREE.BoxGeometry(0.035, 0.42, 0.035), mochilaMat, [0.14, 0.02, 0.19]);

  // Clip de reposo: respiración y micro-movimientos.
  const tReposo = Array.from({ length: 9 }, (_, i) => (i / 8) * 4);
  const reposo = new THREE.AnimationClip('reposo', 4, [
    pistaQuaternion('torso', tReposo, (t) => {
      const p = (t / 4) * Math.PI * 2;
      return [0.012 + 0.009 * Math.sin(p), 0.03 * Math.sin(p * 0.5), 0.006 * Math.sin(p)];
    }),
    pistaQuaternion('cabeza_pivote', tReposo, (t) => {
      const p = (t / 4) * Math.PI * 2;
      return [0.02 * Math.sin(p + 0.4), 0.13 * Math.sin(p * 0.5 + 0.3), 0];
    }),
    pistaQuaternion('hombro_izq', tReposo, (t) => {
      const p = (t / 4) * Math.PI * 2;
      return [0.03 * Math.sin(p), 0, -0.05 - 0.02 * Math.sin(p)];
    }),
    pistaQuaternion('hombro_der', tReposo, (t) => {
      const p = (t / 4) * Math.PI * 2;
      return [0.03 * Math.sin(p + 0.5), 0, 0.05 + 0.02 * Math.sin(p)];
    }),
    pistaQuaternion('codo_izq', tReposo, () => [-0.12, 0, 0]),
    pistaQuaternion('codo_der', tReposo, () => [-0.12, 0, 0]),
    pistaPosicion('cadera', tReposo, (t) => {
      const p = (t / 4) * Math.PI * 2;
      return [0, 0.92 + 0.004 * Math.sin(p), 0];
    }),
  ]);

  // Clip de caminata: zancada, brazos opuestos, rodillas y balanceo.
  const duracionPaso = 0.92;
  const tCaminar = Array.from({ length: 17 }, (_, i) => (i / 16) * duracionPaso);
  const caminar = new THREE.AnimationClip('caminar', duracionPaso, [
    pistaQuaternion('pierna_izq', tCaminar, (t) => {
      const p = (t / duracionPaso) * Math.PI * 2;
      return [0.52 * Math.sin(p), 0, 0];
    }),
    pistaQuaternion('pierna_der', tCaminar, (t) => {
      const p = (t / duracionPaso) * Math.PI * 2;
      return [-0.52 * Math.sin(p), 0, 0];
    }),
    pistaQuaternion('rodilla_izq', tCaminar, (t) => {
      const p = (t / duracionPaso) * Math.PI * 2;
      return [0.22 + 0.55 * Math.max(0, Math.sin(p + 2.0)), 0, 0];
    }),
    pistaQuaternion('rodilla_der', tCaminar, (t) => {
      const p = (t / duracionPaso) * Math.PI * 2;
      return [0.22 + 0.55 * Math.max(0, Math.sin(p + 2.0 + Math.PI)), 0, 0];
    }),
    pistaQuaternion('hombro_izq', tCaminar, (t) => {
      const p = (t / duracionPaso) * Math.PI * 2;
      return [-0.42 * Math.sin(p), 0, -0.05];
    }),
    pistaQuaternion('hombro_der', tCaminar, (t) => {
      const p = (t / duracionPaso) * Math.PI * 2;
      return [0.42 * Math.sin(p), 0, 0.05];
    }),
    pistaQuaternion('codo_izq', tCaminar, (t) => {
      const p = (t / duracionPaso) * Math.PI * 2;
      return [-0.35 - 0.18 * Math.max(0, Math.sin(p)), 0, 0];
    }),
    pistaQuaternion('codo_der', tCaminar, (t) => {
      const p = (t / duracionPaso) * Math.PI * 2;
      return [-0.35 - 0.18 * Math.max(0, Math.sin(p + Math.PI)), 0, 0];
    }),
    pistaQuaternion('torso', tCaminar, (t) => {
      const p = (t / duracionPaso) * Math.PI * 2;
      return [0.05, 0.055 * Math.sin(p), 0.018 * Math.sin(p)];
    }),
    pistaQuaternion('cabeza_pivote', tCaminar, (t) => {
      const p = (t / duracionPaso) * Math.PI * 2;
      return [0, -0.035 * Math.sin(p), 0];
    }),
    pistaPosicion('cadera', tCaminar, (t) => {
      const p = (t / duracionPaso) * Math.PI * 2;
      return [0, 0.92 + 0.026 * Math.abs(Math.sin(p)), 0];
    }),
  ]);

  return { raiz, clips: [reposo, caminar], partes: { mochila, gorra } };
}

// ---------------------------------------------------------------------------
// Exportación
// ---------------------------------------------------------------------------

async function exportarGLB(nombre, raiz, clips) {
  const escena = new THREE.Scene();
  escena.name = nombre;
  escena.add(raiz);
  const exportador = new GLTFExporter();
  const datos = await new Promise((resolver, rechazar) => {
    exportador.parse(
      escena,
      (resultado) => resolver(resultado),
      (error) => rechazar(error),
      { binary: true, animations: clips, trs: true, onlyVisible: true },
    );
  });
  const ruta = join(destino, `${nombre}.glb`);
  writeFileSync(ruta, Buffer.from(datos));
  console.log(`  ${nombre}.glb  ${(datos.byteLength / 1024).toFixed(1)} KB  (${clips.length} clips)`);
  return `${nombre}.glb`;
}

async function main() {
  console.log('Generando recursos 3D originales…');
  const autobus = construirAutobus();
  const pasajero = construirPasajero();

  const archivos = [];
  archivos.push(await exportarGLB('autobus', autobus.raiz, autobus.clips));
  archivos.push(await exportarGLB('pasajero', pasajero.raiz, pasajero.clips));

  const manifiesto = {
    generado_por: 'web/scripts/generar-recursos.mjs',
    licencia: 'Obra original del proyecto (uso académico y educativo)',
    modelos: [
      { archivo: archivos[0], clips: autobus.clips.map((c) => c.name), descripcion: 'Autobús urbano articulado con puertas correderas.' },
      { archivo: archivos[1], clips: pasajero.clips.map((c) => c.name), descripcion: 'Pasajero humano articulado con variantes de color y proporción.' },
    ],
  };
  writeFileSync(join(destino, 'manifiesto.json'), `${JSON.stringify(manifiesto, null, 2)}\n`);
  console.log('Recursos escritos en web/assets/models/.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
