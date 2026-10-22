/**
 * Escena 3D semirrealista de la parada de autobuses.
 *
 * Consume exactamente el mismo estado que la escena 2D: la cola FIFO, la fase
 * visual del autobús, los pasajeros que abordan y el reloj proceden de
 * `Ejecucion`. La escena solo interpola posiciones y reproduce animaciones; no
 * crea llegadas, abordajes ni capacidades.
 *
 * Los modelos GLB son obra original del proyecto y se generan con
 * `npm run recursos`. La copia local de Three.js se sirve desde `web/vendor/`.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clone as clonarEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { clamp, mezclar, setTexto, suavizar } from './util.js';
import {
  ACERA_Z,
  CAMARAS,
  CARRIL_Z,
  COLA_Z,
  MAXIMO_FIGURAS,
  ZONAS_COLA,
  busVisible,
  limitesZona,
  posicionBus,
  posicionCola,
  posicionPuerta,
  progresoCaminante,
  puertasAbiertas,
} from './disposicion3d.js';

const ALTURA_ACERA = 0.16;
/**
 * Actors con el modelo GLB completo (con animación). Son los primeros de la
 * cola, los más próximos a la puerta: ahí el detalle se aprecia.
 */
const MAX_ACTORES = 24;
/** Pasajeros que caminan hacia la puerta simultáneamente. */
const MAX_CAMINANTES = 12;
/** Multiplicador de escala al aparecer un pasajero (evita saltos). */
const VELOCIDAD_APARICION = 3.2;
/** Segundos mínimos entre actualizaciones de las etiquetas de zona. */
const INTERVALO_ETIQUETAS = 0.25;
const RADIO_RUEDA = 0.53;

const PALETAS = {
  camisa: ['#3c6f8a', '#8a5a3c', '#6a4a7a', '#3f7a5a', '#a04c4c', '#c8823c', '#4c6a8a', '#5a5a6a', '#d0d6dd', '#2f6f6a'],
  pantalon: ['#2f3a48', '#1e2a35', '#3d3d3d', '#2a3550', '#4a3a2a', '#24303c'],
  piel: ['#c99272', '#a9714f', '#e0b090', '#8a5a3c', '#d8a884', '#b98263'],
  pelo: ['#241b17', '#3a2a1e', '#151515', '#5a4632', '#7a6a58'],
  calzado: ['#1b1e23', '#2a2119', '#141a24', '#33302c'],
  gorra: ['#2b4f6b', '#7a2f2f', '#2f5a3a', '#4a4a4a', '#8a6a2f'],
  mochila: ['#7b3f42', '#2f4f6a', '#3f5a3a', '#5a4a6a', '#6a5a3a'],
};

const ETIQUETAS_FASE = {
  aproximando: 'Aproximándose',
  detenido: 'Detenido · puertas abiertas',
  abordando: 'Abordando',
  saliendo: 'Saliendo de la parada',
};

// ---------------------------------------------------------------------------
// Texturas procedurales (sin recursos externos)
// ---------------------------------------------------------------------------

function crearTextura(ancho, alto, dibujar) {
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  dibujar(lienzo.getContext('2d'), ancho, alto);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.wrapS = THREE.RepeatWrapping;
  textura.wrapT = THREE.RepeatWrapping;
  textura.anisotropy = 4;
  return textura;
}

function generadorAleatorio(semilla) {
  let estado = semilla >>> 0;
  return () => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
    return estado / 4294967296;
  };
}

function texturaAsfalto() {
  const rnd = generadorAleatorio(7);
  return crearTextura(256, 256, (ctx, ancho, alto) => {
    ctx.fillStyle = '#202c3b';
    ctx.fillRect(0, 0, ancho, alto);
    for (let i = 0; i < 1600; i += 1) {
      const gris = 34 + Math.floor(rnd() * 30);
      ctx.fillStyle = `rgba(${gris}, ${gris + 6}, ${gris + 14}, ${0.25 + rnd() * 0.4})`;
      ctx.fillRect(rnd() * ancho, rnd() * alto, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    ctx.strokeStyle = 'rgba(34, 44, 60, 0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(rnd() * ancho, rnd() * alto);
      ctx.lineTo(rnd() * ancho, rnd() * alto);
      ctx.stroke();
    }
  });
}

function texturaAcera() {
  const rnd = generadorAleatorio(19);
  return crearTextura(256, 256, (ctx, ancho, alto) => {
    ctx.fillStyle = '#2b394a';
    ctx.fillRect(0, 0, ancho, alto);
    for (let i = 0; i < 700; i += 1) {
      const gris = 40 + Math.floor(rnd() * 24);
      ctx.fillStyle = `rgba(${gris}, ${gris + 8}, ${gris + 18}, ${0.25 + rnd() * 0.3})`;
      ctx.fillRect(rnd() * ancho, rnd() * alto, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    ctx.strokeStyle = '#223043';
    ctx.lineWidth = 2;
    for (let x = 0; x <= ancho; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, alto);
      ctx.stroke();
    }
    for (let y = 0; y <= alto; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ancho, y);
      ctx.stroke();
    }
  });
}

function texturaVentanas(semilla) {
  const rnd = generadorAleatorio(semilla);
  return crearTextura(128, 256, (ctx, ancho, alto) => {
    ctx.fillStyle = '#0c1420';
    ctx.fillRect(0, 0, ancho, alto);
    for (let fila = 0; fila < 10; fila += 1) {
      for (let columna = 0; columna < 5; columna += 1) {
        const encendida = rnd() < 0.55;
        if (!encendida) continue;
        const calido = rnd() < 0.7;
        ctx.fillStyle = calido ? 'rgba(255, 214, 150, 0.75)' : 'rgba(150, 205, 235, 0.7)';
        ctx.fillRect(12 + columna * 22, 12 + fila * 24, 12, 14);
      }
    }
  });
}

function texturaSombra() {
  return crearTextura(128, 128, (ctx, ancho, alto) => {
    const gradiente = ctx.createRadialGradient(ancho / 2, alto / 2, 2, ancho / 2, alto / 2, ancho / 2);
    gradiente.addColorStop(0, 'rgba(0, 0, 0, 0.62)');
    gradiente.addColorStop(0.55, 'rgba(0, 0, 0, 0.32)');
    gradiente.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradiente;
    ctx.fillRect(0, 0, ancho, alto);
  });
}

function texturaLetrero() {
  return crearTextura(512, 256, (ctx, ancho, alto) => {
    ctx.fillStyle = '#0b1622';
    ctx.fillRect(0, 0, ancho, alto);
    ctx.strokeStyle = '#43d1d0';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, ancho - 20, alto - 20);
    ctx.fillStyle = '#43d1d0';
    ctx.font = '700 84px Inter, Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PARADA', ancho / 2, alto * 0.38);
    ctx.fillStyle = '#e7edf7';
    ctx.font = '600 52px Inter, Segoe UI, Arial, sans-serif';
    ctx.fillText('L1 · CENTRO', ancho / 2, alto * 0.7);
  });
}

function texturaCielo() {
  return crearTextura(32, 512, (ctx, ancho, alto) => {
    const gradiente = ctx.createLinearGradient(0, 0, 0, alto);
    gradiente.addColorStop(0, '#040a14');
    gradiente.addColorStop(0.42, '#0a1626');
    gradiente.addColorStop(0.7, '#152a3e');
    gradiente.addColorStop(0.88, '#2c4256');
    gradiente.addColorStop(0.97, '#4c4c4c');
    gradiente.addColorStop(1, '#6a5340');
    ctx.fillStyle = gradiente;
    ctx.fillRect(0, 0, ancho, alto);
  });
}

function texturaPanelCola() {
  return crearTextura(256, 128, (ctx, ancho, alto) => {
    ctx.fillStyle = 'rgba(10, 16, 27, 0.88)';
    ctx.fillRect(0, 0, ancho, alto);
    ctx.strokeStyle = 'rgba(255, 140, 151, 0.9)';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, ancho - 12, alto - 12);
    ctx.fillStyle = '#ff8c97';
    ctx.font = '700 54px Inter, Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  });
}

// ---------------------------------------------------------------------------
// Utilidades de instancia
// ---------------------------------------------------------------------------

function semillaDe(clave) {
  const texto = String(clave);
  let h = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function numeroAleatorio(semilla, sal) {
  let h = (semilla ^ Math.imul(sal + 1, 2246822519)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2654435761) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) / 4294967295;
}

function elegir(lista, valor) {
  return lista[Math.min(lista.length - 1, Math.floor(valor * lista.length))];
}

// ---------------------------------------------------------------------------
// Geometría de la multitud (LOD)
// ---------------------------------------------------------------------------

/** Color base de un material del modelo de pasajero. */
function colorDeMaterial(material) {
  if (!material) return new THREE.Color(0x8f9bab);
  if (Array.isArray(material)) return colorDeMaterial(material[0]);
  if (material.color) return material.color.clone();
  return new THREE.Color(0x8f9bab);
}

/**
 * Fusiona el modelo de pasajero en una única geometría con colores por
 * vértice, apta para dibujarse con `InstancedMesh`.
 *
 * La fusión conserva la silueta del personaje original, pero elimina la
 * animación por nodos: a esa distancia la multitud se representa con
 * figuras instanciadas (una sola llamada de dibujo) mientras que la cabeza de
 * la cola usa actores completos y animados.
 */
function geometriaMultitud(plantilla) {
  plantilla.updateMatrixWorld(true);
  const inversa = new THREE.Matrix4().copy(plantilla.matrixWorld).invert();
  const geometrias = [];
  plantilla.traverse((objeto) => {
    if (!objeto.isMesh || !objeto.geometry || !objeto.geometry.attributes.position) return;
    const geometria = objeto.geometry.clone();
    const simple = geometria.index ? geometria.toNonIndexed() : geometria;
    if (simple !== geometria) geometria.dispose();
    const matriz = new THREE.Matrix4().multiplyMatrices(inversa, objeto.matrixWorld);
    simple.applyMatrix4(matriz);
    if (!simple.attributes.normal) simple.computeVertexNormals();
    const cantidad = simple.attributes.position.count;
    if (!simple.attributes.uv) {
      simple.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cantidad * 2), 2));
    }
    const color = colorDeMaterial(objeto.material);
    const colores = new Float32Array(cantidad * 3);
    for (let i = 0; i < cantidad; i += 1) {
      colores[i * 3] = color.r;
      colores[i * 3 + 1] = color.g;
      colores[i * 3 + 2] = color.b;
    }
    simple.setAttribute('color', new THREE.BufferAttribute(colores, 3));
    for (const nombre of Object.keys(simple.attributes)) {
      if (nombre !== 'position' && nombre !== 'normal' && nombre !== 'uv' && nombre !== 'color') {
        simple.deleteAttribute(nombre);
      }
    }
    simple.clearGroups();
    geometrias.push(simple);
  });

  if (geometrias.length === 0) return null;
  const fusionada = mergeGeometries(geometrias, false);
  for (const geometria of geometrias) geometria.dispose();
  if (!fusionada) return null;
  fusionada.computeBoundingSphere();
  return fusionada;
}

/** Figura sencilla de respaldo si la fusión del modelo no es posible. */
function geometriaFiguraSimple() {
  const torso = new THREE.CylinderGeometry(0.19, 0.24, 0.95, 8, 1);
  torso.translate(0, 0.48, 0);
  const cabeza = new THREE.SphereGeometry(0.16, 10, 8);
  cabeza.translate(0, 1.12, 0);
  const fusionada = mergeGeometries([torso, cabeza], false);
  torso.dispose();
  cabeza.dispose();
  if (!fusionada) return null;
  const cantidad = fusionada.attributes.position.count;
  const colores = new Float32Array(cantidad * 3);
  for (let i = 0; i < cantidad; i += 1) {
    const torsoOscuro = fusionada.attributes.position.getY(i) < 0.9;
    colores[i * 3] = torsoOscuro ? 0.24 : 0.72;
    colores[i * 3 + 1] = torsoOscuro ? 0.3 : 0.58;
    colores[i * 3 + 2] = torsoOscuro ? 0.42 : 0.5;
  }
  fusionada.setAttribute('color', new THREE.BufferAttribute(colores, 3));
  fusionada.computeBoundingSphere();
  return fusionada;
}

/** Tinte estable por pasajero (multiplica el color por vértice horneado). */
function tinteDePasajero(id) {
  const h = semillaDe(String(id));
  const t = 0.78 + (h % 1000) / 1000 * 0.34;
  return new THREE.Color(t, t, t);
}

export class EscenaParada3D {
  constructor(canvas, { aviso = null, alerta = null } = {}) {
    this.canvas = canvas;
    this.es3d = true;
    this.aviso = aviso;
    this.avisoTitulo = aviso ? aviso.querySelector('.escena__aviso-titulo') : null;
    this.avisoDetalle = aviso ? aviso.querySelector('.escena__aviso-detalle') : null;
    this.alerta = alerta;
    this.alertaTitulo = alerta ? alerta.querySelector('.escena__alerta-titulo') : null;
    this.alertaDetalle = alerta ? alerta.querySelector('.escena__alerta-detalle') : null;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.32;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.escena = new THREE.Scene();
    this.escena.background = new THREE.Color(0x0d1826);
    this.escena.fog = new THREE.Fog(0x162536, 58, 150);

    this.camaras = {};
    this.camaraActiva = 'calle';
    this._crearCamaras();

    this._ancho = 0;
    this._alto = 0;
    this._dpr = 0;
    this._ultimoTiempoReal = null;

    this._actores = [];
    this._libres = [];
    this._cola = new Map();
    this._caminantes = new Map();
    this._multitud = null;
    this._marcasZona = [];
    this._ultimoTextoZonas = 0;

    this._cargado = false;
    this._errorCarga = null;
    this._busXAnterior = null;
    this._estadoPuertas = false;

    this.texturaSombra = texturaSombra();
    this.materialSombra = new THREE.MeshBasicMaterial({
      map: this.texturaSombra,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });

    this._construirEntorno();
    this._crearEtiquetaCola();
    this._crearMarcasZona();
  }

  // ------------------------------------------------------------------
  // Cámaras y tamaño
  // ------------------------------------------------------------------

  _crearCamaras() {
    for (const [nombre, ajuste] of Object.entries(CAMARAS)) {
      const camara = new THREE.PerspectiveCamera(ajuste.fov, 1, 0.1, 260);
      camara.position.fromArray(ajuste.posicion);
      camara.lookAt(new THREE.Vector3().fromArray(ajuste.objetivo));
      this.camaras[nombre] = camara;
    }
    this.camara = this.camaras[this.camaraActiva];
    this.controles = null;
    this._aplicarCamara();
  }

  _aplicarCamara() {
    const ajuste = CAMARAS[this.camaraActiva];
    const camara = this.camaras[this.camaraActiva];
    camara.fov = ajuste.fov;
    camara.position.fromArray(ajuste.posicion);
    camara.updateProjectionMatrix();
    if (this.controles) this.controles.dispose();
    this.controles = new OrbitControls(camara, this.canvas);
    this.controles.target.fromArray(ajuste.objetivo);
    this.controles.enableDamping = true;
    this.controles.dampingFactor = 0.075;
    this.controles.minDistance = 6;
    this.controles.maxDistance = 75;
    this.controles.minPolarAngle = 0.18;
    this.controles.maxPolarAngle = Math.PI * 0.49;
    this.controles.enablePan = true;
    this.controles.update();
    this.camara = camara;
  }

  cambiarCamara(nombre) {
    if (!CAMARAS[nombre] || nombre === this.camaraActiva) return;
    this.camaraActiva = nombre;
    this._aplicarCamara();
    this._redimensionar();
  }

  _redimensionar() {
    const ancho = Math.max(1, this.canvas.clientWidth);
    const alto = Math.max(1, this.canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (ancho === this._ancho && alto === this._alto && dpr === this._dpr) return;
    this._ancho = ancho;
    this._alto = alto;
    this._dpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(ancho, alto, false);
    for (const camara of Object.values(this.camaras)) {
      camara.aspect = ancho / alto;
      camara.updateProjectionMatrix();
    }
  }

  // ------------------------------------------------------------------
  // Entorno fijo
  // ------------------------------------------------------------------

  _caja(ancho, alto, fondo, material, x, y, z, { rotacion = [0, 0, 0], proyecta = false } = {}) {
    const malla = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), material);
    malla.position.set(x, y, z);
    malla.rotation.set(...rotacion);
    malla.castShadow = proyecta;
    malla.receiveShadow = true;
    this.escena.add(malla);
    return malla;
  }

  _cilindro(radio, alto, material, x, y, z, { segmentos = 16, rotacion = [0, 0, 0] } = {}) {
    const malla = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, alto, segmentos), material);
    malla.position.set(x, y, z);
    malla.rotation.set(...rotacion);
    malla.castShadow = false;
    malla.receiveShadow = true;
    this.escena.add(malla);
    return malla;
  }

  _construirEntorno() {
    const escena = this.escena;

    // Cúpula de cielo con degradado nocturno y resplandor cálido en el horizonte.
    const cielo = new THREE.Mesh(
      new THREE.SphereGeometry(155, 32, 20),
      new THREE.MeshBasicMaterial({
        map: texturaCielo(),
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    cielo.name = 'cielo';
    cielo.renderOrder = -1;
    escena.add(cielo);

    // Luces generales.
    escena.add(new THREE.HemisphereLight(0x9dc3ee, 0x1f2a3a, 1.95));
    escena.add(new THREE.AmbientLight(0x7186a4, 0.62));

    const luna = new THREE.DirectionalLight(0xd6e6ff, 2.7);
    luna.position.set(-26, 44, 30);
    luna.target.position.set(5, 0, 5);
    luna.castShadow = true;
    luna.shadow.mapSize.set(2048, 2048);
    luna.shadow.camera.left = -42;
    luna.shadow.camera.right = 42;
    luna.shadow.camera.top = 32;
    luna.shadow.camera.bottom = -28;
    luna.shadow.camera.near = 1;
    luna.shadow.camera.far = 130;
    luna.shadow.bias = -0.0006;
    escena.add(luna, luna.target);

    const relleno = new THREE.DirectionalLight(0xa9c8e8, 0.9);
    relleno.position.set(24, 16, 30);
    relleno.target.position.set(4, 1, 6);
    escena.add(relleno, relleno.target);

    const materialSuelo = new THREE.MeshStandardMaterial({ color: 0x101a26, roughness: 1, metalness: 0 });
    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), materialSuelo);
    suelo.rotation.x = -Math.PI / 2;
    suelo.position.y = -0.03;
    suelo.receiveShadow = true;
    escena.add(suelo);

    // Calzada.
    const asfalto = texturaAsfalto();
    asfalto.repeat.set(34, 4);
    const calzada = new THREE.Mesh(
      new THREE.PlaneGeometry(184, 7.2),
      new THREE.MeshStandardMaterial({ map: asfalto, color: 0xd8e2ee, roughness: 0.9, metalness: 0.05 }),
    );
    calzada.rotation.x = -Math.PI / 2;
    calzada.position.set(0, 0.01, (ACERA_Z + -2) / 2);
    calzada.receiveShadow = true;
    escena.add(calzada);

    const materialLinea = new THREE.MeshStandardMaterial({
      color: 0x7f8da4,
      emissive: 0x2f3a4c,
      emissiveIntensity: 0.4,
      roughness: 0.8,
    });
    for (let x = -88; x <= 88; x += 6) {
      this._caja(2.4, 0.02, 0.12, materialLinea, x, 0.025, 0.9);
    }
    this._caja(184, 0.02, 0.1, materialLinea, 0, 0.026, ACERA_Z - 0.55);

    // Bordillo y acera.
    this._caja(184, 0.2, 0.3, new THREE.MeshStandardMaterial({ color: 0x3a4a5e, roughness: 0.8 }), 0, 0.1, ACERA_Z);
    const aceraTex = texturaAcera();
    aceraTex.repeat.set(56, 4);
    this._caja(
      184,
      ALTURA_ACERA,
      10.8,
      new THREE.MeshStandardMaterial({ map: aceraTex, color: 0xe8f0f8, roughness: 0.88 }),
      0,
      ALTURA_ACERA / 2,
      ACERA_Z + 5.4,
    );

    // Marquesina.
    const metal = new THREE.MeshStandardMaterial({ color: 0x40546b, roughness: 0.42, metalness: 0.6 });
    const metalOscuro = new THREE.MeshStandardMaterial({ color: 0x263646, roughness: 0.68, metalness: 0.35 });
    const cian = new THREE.MeshStandardMaterial({
      color: 0x43d1d0,
      emissive: 0x2f9b9a,
      emissiveIntensity: 1.4,
      roughness: 0.4,
    });
    for (const x of [1.7, 11.5]) {
      for (const z of [6.9, 9.9]) {
        this._cilindro(0.09, 3.1, metal, x, 1.55, z, { segmentos: 12 });
      }
    }
    this._caja(10.6, 0.18, 3.5, metalOscuro, 6.6, 3.18, 8.4, { proyecta: true });
    this._caja(10.4, 0.06, 0.09, cian, 6.6, 3.08, 6.68);
    this._caja(10.4, 2.5, 0.06, new THREE.MeshStandardMaterial({
      color: 0x8fc9d8,
      transparent: true,
      opacity: 0.17,
      roughness: 0.18,
      metalness: 0.25,
      depthWrite: false,
    }), 6.6, 1.55, 9.98);
    this._caja(0.06, 2.5, 3.0, new THREE.MeshStandardMaterial({
      color: 0x8fc9d8,
      transparent: true,
      opacity: 0.14,
      roughness: 0.2,
      metalness: 0.2,
      depthWrite: false,
    }), 11.5, 1.55, 8.45);

    // Banco.
    const madera = new THREE.MeshStandardMaterial({ color: 0x7a5f42, roughness: 0.8 });
    this._caja(6.2, 0.12, 0.56, madera, 7.0, 0.72, 9.2, { proyecta: true });
    this._caja(6.2, 0.5, 0.1, madera, 7.0, 1.0, 9.48, { proyecta: true });
    for (const x of [4.2, 9.8]) {
      this._caja(0.1, 0.62, 0.46, metal, x, 0.33, 9.2);
    }

    // Papelera.
    this._cilindro(0.3, 0.68, new THREE.MeshStandardMaterial({ color: 0x24313f, roughness: 0.7, metalness: 0.4 }), 12.6, 0.5, 7.1, { segmentos: 18 });

    // Poste y letrero de parada.
    this._cilindro(0.06, 3.0, metal, 2.1, 1.66, 6.05, { segmentos: 10 });
    const letrero = texturaLetrero();
    const panelMaterial = new THREE.MeshStandardMaterial({
      map: letrero,
      emissiveMap: letrero,
      emissive: 0xffffff,
      emissiveIntensity: 0.55,
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), panelMaterial);
    panel.position.set(2.1, 2.62, 6.05);
    escena.add(panel);
    const panelReves = panel.clone();
    panelReves.rotation.y = Math.PI;
    panelReves.position.z = 6.06;
    escena.add(panelReves);

    // Farolas.
    for (const x of [-15, 22]) {
      this._cilindro(0.08, 6.2, metal, x, 3.1, 5.8, { segmentos: 12 });
      this._caja(0.08, 0.08, 2.3, metal, x, 6.15, 4.75);
      this._caja(0.34, 0.14, 0.62, new THREE.MeshStandardMaterial({
        color: 0xffe6b8,
        emissive: 0xffcf8a,
        emissiveIntensity: 2.6,
        roughness: 0.4,
      }), x, 6.08, 3.65, { proyecta: false });
      const luz = new THREE.PointLight(0xffd7a0, 115, 32, 2);
      luz.position.set(x, 5.9, 3.8);
      escena.add(luz);
    }

    const luzMarquesina = new THREE.PointLight(0xffdcae, 85, 24, 2);
    luzMarquesina.position.set(6.6, 2.95, 8.2);
    escena.add(luzMarquesina);

    // Edificios del fondo con ventanas encendidas.
    const edificios = [
      [-58, -20, 20, 24, 9, 3],
      [-34, -23, 17, 20, 8, 7],
      [-12, -19, 15, 16, 7, 11],
      [12, -24, 22, 27, 10, 17],
      [40, -20, 18, 19, 9, 23],
      [66, -23, 20, 23, 8, 29],
      [-44, 27, 18, 15, 8, 31],
      [-16, 30, 22, 19, 9, 37],
      [16, 31, 20, 17, 8, 41],
      [48, 28, 18, 21, 9, 43],
    ];
    for (const [x, z, ancho, alto, fondo, semilla] of edificios) {
      const ventanas = texturaVentanas(semilla);
      ventanas.repeat.set(Math.max(1, Math.round(ancho / 9)), Math.max(1, Math.round(alto / 12)));
      const material = new THREE.MeshStandardMaterial({
        map: ventanas,
        emissiveMap: ventanas,
        emissive: 0xffffff,
        emissiveIntensity: 1.1,
        color: 0x465a70,
        roughness: 0.9,
        metalness: 0.05,
      });
      this._caja(ancho, alto, fondo, material, x, alto / 2, z, { proyecta: false });
      this._caja(ancho + 0.6, 0.5, fondo + 0.6, metalOscuro, x, alto + 0.2, z);
    }

    // Árboles sencillos.
    for (const [x, z, escala] of [[-25, 10.5, 1.2], [30, 11, 1], [-4, 12.5, 0.85], [17, 13, 0.95]]) {
      const tronco = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11 * escala, 0.16 * escala, 2.4 * escala, 8),
        new THREE.MeshStandardMaterial({ color: 0x3b2c22, roughness: 0.95 }),
      );
      tronco.position.set(x, ALTURA_ACERA + 1.2 * escala, z);
      escena.add(tronco);
      const copa = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.1 * escala, 1),
        new THREE.MeshStandardMaterial({ color: 0x2c523c, roughness: 0.95 }),
      );
      copa.position.set(x, ALTURA_ACERA + 2.7 * escala, z);
      copa.scale.set(1, 1.25, 1);
      escena.add(copa);
    }

    // Estrellas tenues.
    const cantidad = 420;
    const posiciones = new Float32Array(cantidad * 3);
    const rnd = generadorAleatorio(3);
    for (let i = 0; i < cantidad; i += 1) {
      const angulo = rnd() * Math.PI * 2;
      const radio = 60 + rnd() * 70;
      posiciones[i * 3] = Math.cos(angulo) * radio;
      posiciones[i * 3 + 1] = 20 + rnd() * 60;
      posiciones[i * 3 + 2] = Math.sin(angulo) * radio;
    }
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
    const estrellas = new THREE.Points(
      geometria,
      new THREE.PointsMaterial({ color: 0x9fc6e8, size: 0.45, transparent: true, opacity: 0.7, depthWrite: false, sizeAttenuation: true }),
    );
    escena.add(estrellas);
  }

  _crearEtiquetaCola() {
    this.texturaEtiqueta = texturaPanelCola();
    this.materialEtiqueta = new THREE.SpriteMaterial({
      map: this.texturaEtiqueta,
      transparent: true,
      depthWrite: false,
    });
    this.etiquetaCola = new THREE.Sprite(this.materialEtiqueta);
    this.etiquetaCola.scale.set(2.6, 1.3, 1);
    this.etiquetaCola.visible = false;
    this.escena.add(this.etiquetaCola);
    this._textoEtiqueta = '';
  }

  // ------------------------------------------------------------------
  // Carga de modelos
  // ------------------------------------------------------------------

  async cargar() {
    if (this._cargado) return;
    try {
      const cargador = new GLTFLoader();
      const base = new URL('../assets/models/', import.meta.url);
      const [gltfBus, gltfPasajero] = await Promise.all([
        cargador.loadAsync(new URL('autobus.glb', base).href),
        cargador.loadAsync(new URL('pasajero.glb', base).href),
      ]);

      const bus = gltfBus.scene;
      bus.name = 'autobus';
      bus.traverse((objeto) => {
        if (!objeto.isMesh) return;
        objeto.castShadow = true;
        objeto.receiveShadow = true;
        if (objeto.material && 'envMapIntensity' in objeto.material) {
          objeto.material.envMapIntensity = 0.75;
        }
      });
      bus.visible = false;
      this.escena.add(bus);
      this.bus = bus;
      this.mixerBus = new THREE.AnimationMixer(bus);
      const clipsBus = new Map(gltfBus.animations.map((clip) => [clip.name, clip]));
      this.accionAbrir = clipsBus.has('puertas_abrir') ? this.mixerBus.clipAction(clipsBus.get('puertas_abrir')) : null;
      this.accionCerrar = clipsBus.has('puertas_cerrar') ? this.mixerBus.clipAction(clipsBus.get('puertas_cerrar')) : null;
      this.ruedas = [];
      bus.traverse((objeto) => {
        if (/^rueda_(delantera|trasera)_(derecha|izquierda)$/.test(objeto.name)) {
          this.ruedas.push(objeto);
        }
      });
      this._fijarPuertas(false, true);

      this.pasajeroPlantilla = gltfPasajero.scene;
      const clipsPasajero = new Map(gltfPasajero.animations.map((clip) => [clip.name, clip]));
      this.clipReposo = clipsPasajero.get('reposo');
      this.clipCaminar = clipsPasajero.get('caminar');
      if (!this.clipReposo || !this.clipCaminar) {
        throw new Error('El modelo de pasajero no contiene los clips esperados.');
      }

      this._cargado = true;
      this._errorCarga = null;
      this._prepararMultitud();
    } catch (error) {
      this._errorCarga = error;
      throw error;
    }
  }

  /**
   * Prepara la multitud instanciada: una única llamada de dibujo para todos
   * los pasajeros que no caben en el grupo de actores detallados.
   */
  _prepararMultitud() {
    const geometria = geometriaMultitud(this.pasajeroPlantilla) || geometriaFiguraSimple();
    if (!geometria) return;
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.86,
      metalness: 0.02,
    });
    const multitud = new THREE.InstancedMesh(geometria, material, MAXIMO_FIGURAS);
    multitud.name = 'cola_multitud';
    multitud.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    multitud.castShadow = false;
    multitud.receiveShadow = true;
    multitud.frustumCulled = false;
    multitud.count = 0;
    this.escena.add(multitud);
    this._multitud = multitud;
  }

  /**
   * Marcas de zona: banda de suelo y etiqueta con la ocupación de cada
   * zona de la cola (refugio, extensión, desbordamiento y espera adicional).
   */
  _crearMarcasZona() {
    for (const zona of ZONAS_COLA) {
      const limites = limitesZona(zona.id);
      if (!limites) continue;
      const material = new THREE.MeshBasicMaterial({
        color: 0x43d1d0,
        transparent: true,
        opacity: 0.05,
        depthWrite: false,
      });
      const banda = new THREE.Mesh(
        new THREE.PlaneGeometry(limites.xMax - limites.xMin, limites.zMax - limites.zMin),
        material,
      );
      banda.rotation.x = -Math.PI / 2;
      banda.position.set(limites.centroX, ALTURA_ACERA + 0.006, limites.centroZ);
      banda.renderOrder = 1;
      this.escena.add(banda);

      const lienzo = document.createElement('canvas');
      lienzo.width = 256;
      lienzo.height = 64;
      const textura = new THREE.CanvasTexture(lienzo);
      textura.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: textura, transparent: true, depthWrite: false }),
      );
      sprite.scale.set(2.2, 0.55, 1);
      sprite.position.set(limites.centroX, ALTURA_ACERA + 1.9, limites.centroZ);
      sprite.visible = false;
      this.escena.add(sprite);

      this._marcasZona.push({
        zona,
        banda,
        material,
        lienzo,
        textura,
        sprite,
        capacidad: zona.filas.length * zona.columnas,
        ocupacion: 0,
        texto: '',
      });
    }
  }

  /** Pinta el texto de ocupación de una zona (solo si cambió). */
  _pintarZona(marca) {
    const texto = `${marca.zona.id} · ${marca.zona.etiqueta} · ${marca.ocupacion}/${marca.capacidad}`;
    if (texto === marca.texto) return;
    marca.texto = texto;
    const ctx = marca.lienzo.getContext('2d');
    ctx.clearRect(0, 0, marca.lienzo.width, marca.lienzo.height);
    ctx.fillStyle = 'rgba(10, 16, 27, 0.82)';
    ctx.fillRect(0, 0, marca.lienzo.width, marca.lienzo.height);
    ctx.strokeStyle = 'rgba(67, 209, 208, 0.85)';
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, marca.lienzo.width - 6, marca.lienzo.height - 6);
    ctx.fillStyle = '#9fe8e6';
    ctx.font = '600 26px Inter, Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, marca.lienzo.width / 2, marca.lienzo.height / 2);
    marca.textura.needsUpdate = true;
  }

  destruir() {
    if (this.controles) this.controles.dispose();
    this.renderer.dispose();
  }

  // ------------------------------------------------------------------
  // Actores (pasajeros)
  // ------------------------------------------------------------------

  _crearActor() {
    const root = clonarEsqueleto(this.pasajeroPlantilla);
    root.name = 'pasajero_instancia';
    root.visible = false;
    root.traverse((objeto) => {
      if (!objeto.isMesh) return;
      objeto.material = Array.isArray(objeto.material)
        ? objeto.material.map((material) => material.clone())
        : objeto.material.clone();
      objeto.castShadow = false;
      objeto.receiveShadow = false;
    });

    const sombra = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.56), this.materialSombra);
    sombra.name = 'sombra';
    sombra.rotation.x = -Math.PI / 2;
    sombra.position.y = 0.012;
    root.add(sombra);

    const mixer = new THREE.AnimationMixer(root);
    const reposo = mixer.clipAction(this.clipReposo);
    const caminar = mixer.clipAction(this.clipCaminar);
    reposo.play();
    caminar.play();
    reposo.setEffectiveWeight(1);
    caminar.setEffectiveWeight(0);

    this.escena.add(root);
    const actor = {
      root,
      mixer,
      reposo,
      caminar,
      pesoCaminar: 0,
      clave: null,
      escalaBase: { x: 1, y: 1, z: 1 },
      aparecer: 1,
    };
    this._actores.push(actor);
    return actor;
  }

  _obtenerActor() {
    const libre = this._libres.pop();
    if (libre) {
      libre.root.visible = true;
      return libre;
    }
    if (this._actores.length >= MAX_ACTORES) return null;
    return this._crearActor();
  }

  _liberarActor(actor) {
    if (!actor) return;
    actor.root.visible = false;
    actor.clave = null;
    actor.pesoCaminar = 0;
    actor.reposo.setEffectiveWeight(1);
    actor.caminar.setEffectiveWeight(0);
    if (!this._libres.includes(actor)) this._libres.push(actor);
  }

  _asignarActor(actor, clave) {
    if (actor.clave === clave) return;
    actor.clave = clave;
    this._aplicarVariante(actor, semillaDe(clave));
  }

  _aplicarVariante(actor, semilla) {
    const rnd = (sal) => numeroAleatorio(semilla, sal);
    const colorCamisa = elegir(PALETAS.camisa, rnd(1));
    const colorPantalon = elegir(PALETAS.pantalon, rnd(2));
    const colorPiel = elegir(PALETAS.piel, rnd(3));
    const colorPelo = elegir(PALETAS.pelo, rnd(4));
    const colorCalzado = elegir(PALETAS.calzado, rnd(5));
    const colorGorra = elegir(PALETAS.gorra, rnd(6));
    const colorMochila = elegir(PALETAS.mochila, rnd(7));
    const sinGorra = rnd(8) < 0.38;
    const conMochila = rnd(9) < 0.5;
    const escala = 0.93 + rnd(10) * 0.13;
    actor.escalaBase = { x: escala * (0.98 + rnd(11) * 0.04), y: escala, z: escala * (0.98 + rnd(12) * 0.04) };
    actor.root.scale.set(actor.escalaBase.x, actor.escalaBase.y, actor.escalaBase.z);

    actor.root.traverse((objeto) => {
      if (objeto.name === 'gorra') objeto.visible = !sinGorra;
      if (objeto.name === 'mochila') objeto.visible = conMochila;
      if (!objeto.isMesh || !objeto.material || !objeto.material.color) return;
      const nombre = objeto.name;
      if (nombre === 'sombra') return;
      if (nombre.includes('camisa') || nombre.startsWith('torso') || nombre === 'pecho'
        || nombre.startsWith('brazo_') || nombre.startsWith('hombro_malla')) {
        objeto.material.color.set(colorCamisa);
      } else if (nombre === 'pelvis' || nombre.startsWith('muslo') || nombre.startsWith('pantorrilla')) {
        objeto.material.color.set(colorPantalon);
      } else if (nombre === 'piel' || nombre === 'cuello' || nombre === 'cabeza' || nombre === 'nariz'
        || nombre.startsWith('oreja') || nombre.startsWith('mano') || nombre.startsWith('antebrazo')) {
        objeto.material.color.set(colorPiel);
      } else if (nombre.startsWith('pie')) {
        objeto.material.color.set(colorCalzado);
      } else if (nombre === 'pelo' || nombre === 'pelo_nuca') {
        objeto.material.color.set(colorPelo);
      } else if (nombre.startsWith('gorra')) {
        objeto.material.color.set(colorGorra);
        objeto.visible = !sinGorra;
      } else if (nombre.startsWith('mochila')) {
        objeto.material.color.set(colorMochila);
        objeto.visible = conMochila;
      }
    });
  }

  _animarActor(actor, nombre, dt, instantaneo) {
    const objetivo = nombre === 'caminar' ? 1 : 0;
    actor.pesoCaminar = instantaneo ? objetivo : suavizar(actor.pesoCaminar, objetivo, dt, 9);
    actor.caminar.setEffectiveWeight(actor.pesoCaminar);
    actor.reposo.setEffectiveWeight(1 - actor.pesoCaminar);
    if (nombre === 'caminar') actor.caminar.setEffectiveTimeScale(1.05);
  }

  // ------------------------------------------------------------------
  // Actualización de la cola y del abordaje
  // ------------------------------------------------------------------

  _actualizarCola(vista, dt, snap, reducido) {
    const cola = vista && !vista.sinDatos ? vista.cola || [] : [];
    const visibles = Math.min(cola.length, MAXIMO_FIGURAS);
    const vigentes = new Set();
    const multitud = [];

    for (let i = 0; i < visibles; i += 1) {
      const id = cola[i];
      vigentes.add(id);
      let actor = this._cola.get(id);
      if (actor) {
        this._colocarActor(actor, i, dt, snap, reducido);
        continue;
      }
      // La cabeza de la cola usa actores detallados y animados.
      if (i < MAX_ACTORES) {
        actor = this._obtenerActor();
        if (actor) {
          this._cola.set(id, actor);
          this._asignarActor(actor, id);
          actor.aparecer = 0;
          const destino = posicionCola(i);
          const desde = snap || reducido
            ? destino
            : { x: destino.x + 5.5, y: 0, z: destino.z + 0.4 };
          actor.root.position.set(desde.x, ALTURA_ACERA, desde.z);
          actor.root.rotation.y = -Math.PI / 2;
          actor.pesoCaminar = snap || reducido ? 0 : 1;
          actor.reposo.setEffectiveWeight(actor.pesoCaminar === 1 ? 0 : 1);
          actor.caminar.setEffectiveWeight(actor.pesoCaminar);
          this._colocarActor(actor, i, dt, snap, reducido);
          continue;
        }
      }
      // El resto se representa con la multitud instanciada.
      multitud.push({ id, indice: i });
    }

    for (const [id, actor] of this._cola) {
      if (!vigentes.has(id)) {
        this._liberarActor(actor);
        this._cola.delete(id);
      }
    }

    this._actualizarMultitud(multitud, snap);
    this._actualizarZonas(cola, visibles);
    this._actualizarEtiquetaCola(cola.length, visibles);
  }

  /** Coloca y anima un actor detallado en su puesto de la cola. */
  _colocarActor(actor, indice, dt, snap, reducido) {
    const destino = posicionCola(indice);
    const posicion = actor.root.position;
    if (snap || reducido) {
      posicion.x = destino.x;
      posicion.z = destino.z;
    } else {
      posicion.x = suavizar(posicion.x, destino.x, dt, 6);
      posicion.z = suavizar(posicion.z, destino.z, dt, 6);
    }
    posicion.y = ALTURA_ACERA;

    actor.aparecer = snap || reducido
      ? 1
      : Math.min(1, (actor.aparecer ?? 0) + dt * VELOCIDAD_APARICION);
    const escala = actor.escalaBase || { x: 1, y: 1, z: 1 };
    actor.root.scale.set(escala.x * actor.aparecer, escala.y * actor.aparecer, escala.z * actor.aparecer);

    const caminando = !reducido && Math.abs(destino.x - posicion.x) > 0.06;
    this._animarActor(actor, caminando ? 'caminar' : 'reposo', dt, snap || reducido);
    const giro = -Math.PI / 2 + (((actor.clave * 53) % 5) - 2) * 0.05;
    actor.root.rotation.y = snap || reducido ? giro : suavizar(actor.root.rotation.y, giro, dt, 5);
    actor.root.visible = true;
    actor.mixer.update(snap ? 0 : dt);
  }

  /** Dibuja la multitud instanciada (una sola llamada de dibujo). */
  _actualizarMultitud(multitud, snap) {
    if (!this._multitud) return;
    const matriz = new THREE.Matrix4();
    const posicion = new THREE.Vector3();
    const rotacion = new THREE.Quaternion();
    const escala = new THREE.Vector3(1, 1, 1);
    const ejeY = new THREE.Vector3(0, 1, 0);
    const angulo = -Math.PI / 2;
    for (let i = 0; i < multitud.length; i += 1) {
      const pasajero = multitud[i];
      const puesto = posicionCola(pasajero.indice);
      posicion.set(puesto.x, ALTURA_ACERA, puesto.z);
      rotacion.setFromAxisAngle(ejeY, angulo + (((pasajero.id * 53) % 5) - 2) * 0.05);
      matriz.compose(posicion, rotacion, escala);
      this._multitud.setMatrixAt(i, matriz);
      this._multitud.setColorAt(i, tinteDePasajero(pasajero.id));
    }
    this._multitud.count = multitud.length;
    this._multitud.instanceMatrix.needsUpdate = true;
    if (this._multitud.instanceColor) this._multitud.instanceColor.needsUpdate = true;
  }

  /** Actualiza las marcas de zona (ocupación y opacidad de la banda). */
  _actualizarZonas(cola, visibles) {
    const ocupaciones = {};
    for (let i = 0; i < visibles; i += 1) {
      const zona = posicionCola(i).zona;
      ocupaciones[zona] = (ocupaciones[zona] || 0) + 1;
    }
    const ahora = performance.now();
    const refrescarEtiquetas = ahora - this._ultimoTextoZonas > INTERVALO_ETIQUETAS * 1000;
    if (refrescarEtiquetas) this._ultimoTextoZonas = ahora;
    for (const marca of this._marcasZona) {
      const ocupacion = ocupaciones[marca.zona.id] || 0;
      marca.ocupacion = ocupacion;
      const proporcion = ocupacion / marca.capacidad;
      marca.material.opacity = 0.04 + proporcion * 0.12;
      marca.material.color.setHex(proporcion >= 1 ? 0xff8c97 : 0x43d1d0);
      marca.sprite.visible = ocupacion > 0;
      if (ocupacion > 0 && refrescarEtiquetas) this._pintarZona(marca);
    }
  }


  _actualizarEtiquetaCola(total, visibles) {
    if (!this.etiquetaCola) return;
    const sobrantes = Math.max(0, total - visibles);
    if (sobrantes === 0) {
      this.etiquetaCola.visible = false;
      return;
    }
    const ultimo = posicionCola(Math.max(0, visibles - 1));
    this.etiquetaCola.position.set(ultimo.x + 1.1, ALTURA_ACERA + 2.5, COLA_Z);
    this.etiquetaCola.visible = true;
    const texto = `+${sobrantes}`;
    if (texto === this._textoEtiqueta) return;
    this._textoEtiqueta = texto;
    const lienzo = this.texturaEtiqueta.image;
    const ctx = lienzo.getContext('2d');
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    ctx.fillStyle = 'rgba(10, 16, 27, 0.88)';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.strokeStyle = 'rgba(255, 140, 151, 0.9)';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, lienzo.width - 12, lienzo.height - 12);
    ctx.fillStyle = '#ff8c97';
    ctx.font = '700 58px Inter, Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, lienzo.width / 2, lienzo.height / 2);
    this.texturaEtiqueta.needsUpdate = true;
  }

  _actualizarCaminantes(vista, dt, snap, reducido) {
    const bus = vista && !vista.sinDatos ? vista.bus : null;
    const activos = bus && bus.fase === 'abordando' ? Math.min(bus.mostrados, MAX_CAMINANTES) : 0;
    const vigentes = new Set();
    const destino = posicionPuerta();
    const busX = bus ? posicionBus(bus.fase, bus.progreso) : 0;

    for (let i = 0; i < activos; i += 1) {
      vigentes.add(i);
      let actor = this._caminantes.get(i);
      if (!actor) {
        actor = this._obtenerActor();
        if (!actor) break;
        this._caminantes.set(i, actor);
        this._asignarActor(actor, `cam-${i}`);
        const origen = posicionCola(i);
        actor.root.position.set(origen.x, ALTURA_ACERA, origen.z);
        actor.root.rotation.y = -Math.PI / 2;
        actor.pesoCaminar = 1;
        actor.reposo.setEffectiveWeight(0);
        actor.caminar.setEffectiveWeight(1);
      }
      const local = reducido ? 1 : progresoCaminante(i, bus.abordados, bus.progreso);
      const origen = posicionCola(i);
      actor.root.position.set(
        mezclar(origen.x, destino.x + busX, local),
        ALTURA_ACERA,
        mezclar(origen.z, destino.z, local),
      );
      actor.root.visible = local < 0.985;
      this._animarActor(actor, 'caminar', dt, snap || reducido);
      actor.mixer.update(snap ? 0 : dt);
    }

    for (const [i, actor] of this._caminantes) {
      if (!vigentes.has(i)) {
        this._liberarActor(actor);
        this._caminantes.delete(i);
      }
    }
  }

  // ------------------------------------------------------------------
  // Autobús
  // ------------------------------------------------------------------

  _fijarPuertas(abiertas, snap) {
    if (!this.mixerBus || !this.accionAbrir || !this.accionCerrar) return;
    if (snap) {
      this._estadoPuertas = abiertas;
      this.accionAbrir.stop();
      this.accionCerrar.stop();
      const accion = abiertas ? this.accionAbrir : this.accionCerrar;
      accion.reset();
      accion.setLoop(THREE.LoopOnce, 1);
      accion.clampWhenFinished = true;
      accion.play();
      accion.paused = true;
      accion.time = accion.getClip().duration;
      this.mixerBus.update(0);
      return;
    }
    if (this._estadoPuertas === abiertas) return;
    this._estadoPuertas = abiertas;
    const accion = abiertas ? this.accionAbrir : this.accionCerrar;
    const otra = abiertas ? this.accionCerrar : this.accionAbrir;
    otra.stop();
    accion.reset();
    accion.setLoop(THREE.LoopOnce, 1);
    accion.clampWhenFinished = true;
    accion.play();
  }

  _actualizarBus(vista, dt, snap) {
    if (!this.bus) return;
    const busVista = vista && !vista.sinDatos ? vista.bus : null;
    if (!busVista || !busVisible(busVista.fase)) {
      this.bus.visible = false;
      this._busXAnterior = null;
      this._fijarPuertas(false, true);
      this.mixerBus.update(snap ? 0 : dt);
      return;
    }

    this.bus.visible = true;
    const x = posicionBus(busVista.fase, busVista.progreso);
    this.bus.position.set(x, 0, CARRIL_Z);
    if (this._busXAnterior !== null && !snap) {
      const delta = x - this._busXAnterior;
      for (const rueda of this.ruedas) rueda.rotation.z -= delta / RADIO_RUEDA;
    }
    this._busXAnterior = x;
    this._fijarPuertas(puertasAbiertas(busVista.fase), snap);
    this.mixerBus.update(snap ? 0 : dt);
  }

  // ------------------------------------------------------------------
  // Aviso superpuesto
  // ------------------------------------------------------------------

  /** Alerta de saturación superpuesta a la escena. */
  _actualizarAlerta(vista) {
    if (!this.alerta) return;
    const alerta = vista && vista.alerta ? vista.alerta : null;
    const activa = !!(alerta && alerta.activa);
    if (!activa) {
      if (!this.alerta.hidden) this.alerta.hidden = true;
      return;
    }
    this.alerta.hidden = false;
    if (this.alerta.dataset.estado !== (alerta.severidad || 'alerta')) {
      this.alerta.dataset.estado = alerta.severidad || 'alerta';
    }
    setTexto(this.alertaTitulo, alerta.titulo || '');
    setTexto(this.alertaDetalle, alerta.detalle || '');
  }

  _actualizarAviso(vista) {
    if (!this.aviso) return;
    let estado = 'oculto';
    let titulo = '';
    let detalle = '';

    if (!this._cargado) {
      estado = 'cargando';
      titulo = 'Preparando la escena 3D';
      detalle = 'Cargando los modelos locales de autobús y pasajeros.';
    } else if (!vista || vista.sinDatos) {
      estado = 'vacio';
      titulo = 'Sin ejecución cargada';
      detalle = 'Pulse «Iniciar simulación» para calcular y reproducir una ejecución.';
    } else if (vista.pausado) {
      estado = 'pausa';
      titulo = 'PAUSADO';
      detalle = 'El reloj simulado está detenido.';
    } else if (vista.finalizado) {
      estado = 'final';
      titulo = 'SIMULACIÓN FINALIZADA';
      detalle = 'Consulte los resultados finales y las réplicas.';
    }

    if (estado === 'oculto') {
      if (!this.aviso.hidden) this.aviso.hidden = true;
      return;
    }
    this.aviso.hidden = false;
    if (this.aviso.dataset.estado !== estado) this.aviso.dataset.estado = estado;
    setTexto(this.avisoTitulo, titulo);
    setTexto(this.avisoDetalle, detalle);
  }

  // ------------------------------------------------------------------
  // Diagnóstico
  // ------------------------------------------------------------------

  /**
   * Estado visual de la escena: figuras dibujadas, reparto por zonas y
   * activación de la alerta. Permite verificar en caliente que la cola se
   * representa completa hasta el límite visual (150 figuras).
   */
  diagnostico() {
    const ocupaciones = {};
    for (const marca of this._marcasZona) {
      ocupaciones[marca.zona.id] = marca.ocupacion || 0;
    }
    return {
      es3d: true,
      detailed: this._cola.size,
      instanced: this._multitud ? this._multitud.count : 0,
      visible: this._cola.size + (this._multitud ? this._multitud.count : 0),
      max: MAXIMO_FIGURAS,
      zones: ocupaciones,
      alert: this.alerta ? !this.alerta.hidden : false,
    };
  }

  // ------------------------------------------------------------------
  // Fotograma
  // ------------------------------------------------------------------

  dibujar(vista, ahoraReal, { snap = false } = {}) {
    this._redimensionar();
    let dt = 0;
    if (this._ultimoTiempoReal !== null) {
      dt = clamp((ahoraReal - this._ultimoTiempoReal) / 1000, 0, 0.1);
    }
    this._ultimoTiempoReal = ahoraReal;

    this._actualizarAviso(vista);
    this._actualizarAlerta(vista);
    if (this._cargado) {
      const inmovil = !vista || vista.pausado || vista.finalizado;
      const dtAnimacion = inmovil ? 0 : dt;
      const reducido = !!(vista && vista.reducido);
      this._actualizarCola(vista, dtAnimacion, snap, reducido);
      this._actualizarCaminantes(vista, dtAnimacion, snap, reducido);
      this._actualizarBus(vista, dtAnimacion, snap);
    }
    if (this.controles) this.controles.update();
    this.renderer.render(this.escena, this.camara);
  }
}
