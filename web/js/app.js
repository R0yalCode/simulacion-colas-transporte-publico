/**
 * Orquestador del dashboard: formulario, controles de reproducción, reloj
 * virtual, escena, gráficos, indicadores, registro, resultados y exportación.
 *
 * La velocidad (0.5×–2.5×) solo multiplica el ritmo del reloj de la capa de
 * reproducción: jamás regenera ni recalcula la ejecución del motor.
 */

import { api } from './api.js';
import { EscenaParada } from './escena.js';
import { EscenaParada3D } from './escena3d.js';
import { crearGraficos } from './graficos.js';
import { conectarPantallaCompleta } from './pantalla-completa.js';
import {
  GraficoComparacionBoxplot,
  GraficoComparacionCola,
  GraficoComparacionDemanda,
  GraficoComparacionEsperas,
  normalizarComparacion,
  renderizarComparacion,
} from './comparacion.js';
import { RegistroEventos } from './registro.js';
import { RelojSimulado, VELOCIDADES, VELOCIDAD_INICIAL, MINUTOS_POR_SEGUNDO_BASE } from './reloj.js';
import { Ejecucion, estadisticasDeEstado, csvEventos, csvResumen } from './simulacion.js';
import { componerMensaje, estadoOperativo, lineasIndicadores } from './estado.js';
import {
  ESCENARIO_PERSONALIZADO,
  aplicarEscenario,
  buscarEscenario,
  condicionEscenario,
  detectarEscenario,
  normalizarCatalogo,
} from './escenarios.js';
import {
  descargarTexto,
  formatearEntero,
  formatearNumero,
  formatearPorcentaje,
  formatearReloj,
  prefiereMovimientoReducido,
  qs,
  qsa,
  setTexto,
} from './util.js';

const ETIQUETAS_REPLICAS = {
  pasajeros_llegados: 'Pasajeros llegados',
  pasajeros_transportados: 'Pasajeros transportados',
  pasajeros_restantes: 'Pasajeros en cola (final)',
  cola_maxima: 'Cola máxima',
  cola_media_temporal: 'Cola media temporal (pas.)',
  espera_media: 'Espera media (min)',
  espera_p90: 'Espera P90 (min)',
  autobuses_llegados: 'Autobuses llegados',
  asientos_libres_promedio: 'Asientos libres promedio',
};

const estado = {
  parametros: null,
  escenarios: [],
  escenarioInicial: ESCENARIO_PERSONALIZADO,
  escenarioActual: ESCENARIO_PERSONALIZADO,
  ejecucion: null,
  reloj: null,
  velocidad: VELOCIDAD_INICIAL,
  reducido: prefiereMovimientoReducido(),
  cargando: false,
  replicasCargando: false,
  abortador: null,
  replicasAbortador: null,
  ultimoT: -1,
  ultimoGrafico: -1,
  ultimoGraficoReal: -Infinity,
  sucio: true,
  snapPendiente: true,
  arrastrandoLinea: false,
  faseUI: null,
  comparacion: null,
  comparacionCargando: false,
  comparacionAbortador: null,
};

let escena = null;
let graficos = null;
let graficosComparacion = null;
let registro = null;
let ultimoAria = 0;
/** Referencias a las filas dinámicas del panel de indicadores científicos. */
const filasIndicadores = new Map();

// ---------------------------------------------------------------------
// Referencias del DOM
// ---------------------------------------------------------------------

const refs = {};

function obtenerRefs() {
  const ids = [
    'estado-pill',
    'velocidad-chip',
    'panel-controles',
    'btn-toggle-controles',
    'btn-indicadores',
    'modal-indicadores',
    'modal-cerrar',
    'escenario-select',
    'escenario-descripcion',
    'escenario-condicion',
    'estado-sistema',
    'estado-sistema-titulo',
    'estado-sistema-detalle',
    'estado-rho',
    'estado-lambda',
    'estado-mu',
    'estado-cola',
    'indicadores-contenido',
    'form-parametros',
    'campos',
    'error-config',
    'btn-iniciar',
    'btn-pausar',
    'btn-reiniciar',
    'velocidad-segmentada',
    'linea-tiempo',
    'tiempo-actual',
    'tiempo-total',
    'banner-error',
    'banner-error-texto',
    'banner-error-reintentar',
    'banner-error-cerrar',
    'aviso-advertencias',
    'escena',
    'escena-hud',
    'escena-hud-espera',
    'escena-hud-transportados',
    'escena-hud-autobuses',
    'escena-hud-reloj',
    'escena-hud-bus',
    'escena-hud-fase',
    'escena-hud-barra',
    'escena-hud-ocupacion',
    'escena-aviso',
    'escena-alerta',
    'btn-camara-calle',
    'btn-camara-elevada',
    'stat-llegados',
    'stat-esperando',
    'stat-transportados',
    'stat-autobuses',
    'stat-espera-media',
    'stat-cola-media',
    'stat-ocupacion',
    'stat-tiempo',
    'resultados-finales',
    'resultado-semilla',
    'resultado-balance',
    'btn-replicas',
    'replicas-estado',
    'replicas-contenido',
    'registro',
    'btn-csv-eventos',
    'btn-csv-resumen',
    'info-modelo',
    'btn-comparar',
    'comparacion-estado',
    'comparacion-resumen',
    'comparacion-indicadores',
    'comparacion-aviso',
    'comparacion-tabla',
    'comparacion-tabla-nota',
  ];
  for (const id of ids) refs[id] = document.getElementById(id);
}

// ---------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------

async function crearEscena() {
  let escena3d = null;
  try {
    escena3d = new EscenaParada3D(refs['escena'], {
      aviso: refs['escena-aviso'],
      alerta: refs['escena-alerta'],
    });
    await escena3d.cargar();
    refs['escena-hud'].hidden = false;
    publicarEscena(escena3d);
    return escena3d;
  } catch (error) {
    console.warn('No se pudo iniciar la escena 3D; se usará la escena 2D.', error);
    if (escena3d) escena3d.destruir();
    const camaras = qs('.escena__camaras');
    if (camaras) camaras.hidden = true;
    refs['escena-hud'].hidden = true;
    refs['escena-hud-bus'].hidden = true;
    refs['escena-aviso'].hidden = true;
    if (refs['escena-alerta']) refs['escena-alerta'].hidden = true;
    const anterior = refs['escena'];
    const lienzo = anterior.cloneNode(false);
    anterior.replaceWith(lienzo);
    refs['escena'] = lienzo;
    const escena2d = new EscenaParada(lienzo);
    publicarEscena(escena2d);
    return escena2d;
  }
}

/**
 * Publica la escena activa como evento del documento para que otros módulos
 * (o herramientas de verificación) puedan consultar su diagnóstico.
 */
function publicarEscena(escena) {
  document.dispatchEvent(new CustomEvent('simulacion:escena', { detail: { escena } }));
}

async function iniciar() {
  obtenerRefs();
  escena = await crearEscena();
  graficos = crearGraficos();
  graficosComparacion = crearGraficosComparacion();
  conectarPantallaCompleta({ ...graficos, ...graficosComparacion });
  registro = new RegistroEventos(refs['registro'], { limite: 60 });
  conectarControles();
  observarRedimensionado();
  if (estado.reducido !== undefined && window.matchMedia) {
    try {
      window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (evento) => {
        estado.reducido = evento.matches;
        estado.sucio = true;
      });
    } catch {
      /* navegadores sin addEventListener en MediaQueryList */
    }
  }
  actualizarVelocidadUI();
  refrescarControles();
  await cargarParametros();
  requestAnimationFrame(bucle);
}

async function cargarParametros() {
  try {
    const datos = await api.parametros();
    estado.parametros = datos.parametros;
    estado.escenarios = normalizarCatalogo(datos.escenarios);
    estado.escenarioInicial = datos.escenario_inicial || (estado.escenarios[0] && estado.escenarios[0].id) || ESCENARIO_PERSONALIZADO;
    construirFormulario(datos.parametros);
    construirSelectorEscenarios();
    aplicarEscenarioSeleccionado(estado.escenarioInicial);
    setTexto(refs['banner-error-reintentar'], 'Reintentar');
    ocultarBanner();
  } catch (error) {
    mostrarBanner(`No se pudieron cargar los parámetros del modelo: ${error.message}`, true);
  }
}

/** Construye el selector de escenarios a partir del catálogo del servidor. */
function construirSelectorEscenarios() {
  const select = refs['escenario-select'];
  if (!select) return;
  const fragmento = document.createDocumentFragment();
  for (const escenario of estado.escenarios) {
    const opcion = document.createElement('option');
    opcion.value = escenario.id;
    opcion.textContent = escenario.nombre;
    fragmento.appendChild(opcion);
  }
  const personalizado = document.createElement('option');
  personalizado.value = ESCENARIO_PERSONALIZADO;
  personalizado.textContent = 'Personalizado (parámetros editados)';
  fragmento.appendChild(personalizado);
  select.replaceChildren(fragmento);
}

/** Escribe en el formulario los valores de un escenario. */
function escribirValores(valores) {
  for (const [clave, valor] of Object.entries(valores)) {
    const input = document.getElementById(`param-${clave}`);
    if (!input) continue;
    input.value = valor === null || valor === undefined ? '' : String(valor);
  }
}

/** Aplica un escenario al formulario y refleja su descripción. */
function aplicarEscenarioSeleccionado(id) {
  const escenario = buscarEscenario(estado.escenarios, id);
  if (!escenario) {
    estado.escenarioActual = ESCENARIO_PERSONALIZADO;
    if (refs['escenario-select']) refs['escenario-select'].value = ESCENARIO_PERSONALIZADO;
    setTexto(refs['escenario-descripcion'], 'Configuración personalizada: los parámetros se han editado a mano.');
    setTexto(refs['escenario-condicion'], '');
    return;
  }
  const valores = aplicarEscenario(estado.escenarios, id, leerValoresFormulario());
  escribirValores(valores);
  estado.escenarioActual = id;
  if (refs['escenario-select']) refs['escenario-select'].value = id;
  setTexto(refs['escenario-descripcion'], escenario.descripcion);
  setTexto(refs['escenario-condicion'], condicionEscenario(estado.escenarios, id));
  actualizarInfoModelo();
}

/** Valores actuales del formulario (sin validar). */
function leerValoresFormulario() {
  const valores = {};
  if (!estado.parametros) return valores;
  for (const clave of Object.keys(estado.parametros)) {
    const input = document.getElementById(`param-${clave}`);
    if (!input) continue;
    const crudo = input.value.trim();
    if (crudo === '') {
      valores[clave] = clave === 'semilla' ? null : Number.NaN;
      continue;
    }
    valores[clave] = Number(crudo);
  }
  return valores;
}

/** Detecta el escenario equivalente a la configuración actual. */
function sincronizarEscenario() {
  if (!estado.escenarios.length) return;
  const detectado = detectarEscenario(estado.escenarios, leerValoresFormulario());
  if (detectado === estado.escenarioActual) return;
  estado.escenarioActual = detectado;
  if (refs['escenario-select']) refs['escenario-select'].value = detectado;
  if (detectado === ESCENARIO_PERSONALIZADO) {
    setTexto(refs['escenario-descripcion'], 'Configuración personalizada: los parámetros se han editado a mano.');
    setTexto(refs['escenario-condicion'], '');
  } else {
    const escenario = buscarEscenario(estado.escenarios, detectado);
    setTexto(refs['escenario-descripcion'], escenario.descripcion);
    setTexto(refs['escenario-condicion'], condicionEscenario(estado.escenarios, detectado));
  }
  actualizarInfoModelo();
}

/** Línea de resumen del modelo con los valores del formulario. */
function actualizarInfoModelo() {
  const teoricas = estado.ejecucion ? estado.ejecucion.metricasTeoricas : null;
  const valores = leerValoresFormulario();
  const lambda = Number.isFinite(valores.lambda_p) ? valores.lambda_p : null;
  const h = Number.isFinite(valores.intervalo_promedio) ? valores.intervalo_promedio : null;
  const capacidad = Number.isFinite(valores.capacidad_autobus) ? valores.capacidad_autobus : null;
  const p = Number.isFinite(valores.prob_ocupacion) ? valores.prob_ocupacion : null;
  const mu = teoricas && teoricas.mu_efectiva !== undefined
    ? teoricas.mu_efectiva
    : (lambda !== null && h !== null && capacidad !== null && p !== null
        ? (capacidad * (1 - p)) / h
        : null);
  const rho = mu && mu > 0 && lambda !== null ? lambda / mu : (lambda ? Infinity : 0);
  setTexto(
    refs['info-modelo'],
    `λ = ${formatearNumero(lambda, 1)} pas/min · h = ${formatearNumero(h, 1)} min · ` +
      `C = ${formatearEntero(capacidad)} asientos · μ* = ${formatearNumero(mu)} pas/min · ρ* = ` +
      `${rho === Infinity ? '∞' : formatearNumero(rho)}`,
  );
}

function construirFormulario(parametros) {
  const contenedor = refs['campos'];
  const fragmento = document.createDocumentFragment();
  for (const [clave, meta] of Object.entries(parametros)) {
    const campo = document.createElement('div');
    campo.className = 'campo';

    const etiqueta = document.createElement('label');
    etiqueta.htmlFor = `param-${clave}`;
    etiqueta.className = 'campo__etiqueta';
    etiqueta.textContent = meta.etiqueta;

    const unidad = document.createElement('span');
    unidad.className = 'campo__unidad';
    unidad.textContent = meta.unidad;
    etiqueta.appendChild(unidad);

    const input = document.createElement('input');
    input.type = 'number';
    input.id = `param-${clave}`;
    input.name = clave;
    input.className = 'campo__input';
    input.min = String(meta.min);
    input.max = String(meta.max);
    input.step = String(meta.paso);
    input.value = meta.defecto === null ? '' : String(meta.defecto);
    if (clave === 'semilla') input.placeholder = 'aleatoria';
    input.setAttribute('inputmode', 'decimal');
    input.setAttribute('aria-describedby', `ayuda-${clave}`);

    const ayuda = document.createElement('p');
    ayuda.className = 'campo__ayuda';
    ayuda.id = `ayuda-${clave}`;
    ayuda.textContent = meta.ayuda;

    const error = document.createElement('p');
    error.className = 'campo__error';
    error.id = `error-${clave}`;
    error.hidden = true;
    input.setAttribute('aria-describedby', `ayuda-${clave} error-${clave}`);

    campo.append(etiqueta, input, ayuda, error);
    fragmento.appendChild(campo);
  }
  contenedor.replaceChildren(fragmento);
}

// ---------------------------------------------------------------------
// Validación del formulario
// ---------------------------------------------------------------------

function leerConfiguracion() {
  const valores = {};
  const errores = [];
  for (const [clave, meta] of Object.entries(estado.parametros)) {
    const input = document.getElementById(`param-${clave}`);
    const crudo = input.value.trim();
    if (clave === 'semilla' && crudo === '') {
      valores[clave] = null;
      continue;
    }
    if (crudo === '') {
      errores.push({ clave, mensaje: 'Introduzca un valor.' });
      continue;
    }
    const numero = Number(crudo);
    if (!Number.isFinite(numero)) {
      errores.push({ clave, mensaje: 'El valor debe ser numérico.' });
      continue;
    }
    if (meta.tipo === 'entero' || meta.tipo === 'entero_opcional') {
      if (!Number.isInteger(numero)) {
        errores.push({ clave, mensaje: 'El valor debe ser un número entero.' });
        continue;
      }
    }
    if (numero < meta.min || numero > meta.max) {
      errores.push({
        clave,
        mensaje: `Debe estar entre ${formatearNumero(meta.min, 0)} y ${formatearNumero(meta.max, 0)} ${meta.unidad}.`,
      });
      continue;
    }
    valores[clave] = numero;
  }
  return { valores, errores };
}

function mostrarErroresConfig(errores) {
  for (const meta of Object.values(document.querySelectorAll('.campo__error'))) {
    meta.hidden = true;
    meta.textContent = '';
  }
  for (const input of Object.values(document.querySelectorAll('.campo__input'))) {
    input.removeAttribute('aria-invalid');
  }
  for (const { clave, mensaje } of errores) {
    const errorEl = document.getElementById(`error-${clave}`);
    const input = document.getElementById(`param-${clave}`);
    if (errorEl) {
      errorEl.textContent = mensaje;
      errorEl.hidden = false;
    }
    if (input) input.setAttribute('aria-invalid', 'true');
  }
  const resumen = refs['error-config'];
  if (errores.length > 0) {
    resumen.textContent = errores.length === 1 ? 'Revise el campo marcado antes de simular.' : `Revise los ${errores.length} campos marcados antes de simular.`;
    resumen.hidden = false;
    const primero = document.getElementById(`param-${errores[0].clave}`);
    if (primero) primero.focus();
  } else {
    resumen.hidden = true;
  }
}

// ---------------------------------------------------------------------
// Simulación
// ---------------------------------------------------------------------

async function iniciarSimulacion() {
  if (estado.cargando || !estado.parametros) return;
  const { valores, errores } = leerConfiguracion();
  mostrarErroresConfig(errores);
  if (errores.length > 0) return;
  ocultarBanner();

  if (estado.abortador) estado.abortador.abort();
  const abortador = new AbortController();
  estado.abortador = abortador;
  estado.cargando = true;
  refrescarControles();

  try {
    const payload = await api.simular(valores, abortador.signal);
    if (abortador.signal.aborted) return;
    cargarEjecucion(payload);
    estado.reloj.iniciar();
    estado.sucio = true;
  } catch (error) {
    if (error.name === 'AbortError') return;
    mostrarBanner(`No se pudo completar la simulación: ${error.message}`);
  } finally {
    if (estado.abortador === abortador) estado.abortador = null;
    estado.cargando = false;
    refrescarControles();
  }
}

function cargarEjecucion(payload) {
  estado.ejecucion = new Ejecucion(payload);
  estado.reloj = new RelojSimulado({ duracion: estado.ejecucion.duracion, velocidad: estado.velocidad });
  estado.ultimoT = -1;
  estado.ultimoGrafico = -1;
  estado.ultimoGraficoReal = -Infinity;
  if (graficos && graficos.cola) graficos.cola.reiniciarEscala();
  estado.snapPendiente = true;
  estado.sucio = true;
  estado.arrastrandoLinea = false;

  refs['linea-tiempo'].value = '0';
  setTexto(refs['tiempo-actual'], formatearReloj(0));
  setTexto(
    refs['tiempo-total'],
    `${formatearReloj(estado.ejecucion.duracion)} · ${formatearNumero(estado.ejecucion.duracion, 1)} min`,
  );

  renderAdvertencias(estado.ejecucion.advertencias);
  renderResultados(estado.ejecucion);
  renderIndicadores(estado.ejecucion);
  limpiarReplicas();
  registro.limpiar();
  refrescarControles();
  actualizarVista(0, performance.now(), { snap: true, forzarGraficos: true });
}

// ---------------------------------------------------------------------
// Bucle de reproducción
// ---------------------------------------------------------------------

function bucle(ahora) {
  requestAnimationFrame(bucle);
  if (!estado.ejecucion) {
    if (estado.sucio) {
      escena.dibujar({ sinDatos: true }, ahora, { snap: true });
      if (escena.es3d) {
        refs['escena-hud'].hidden = true;
        refs['escena-hud-bus'].hidden = true;
      }
      estado.sucio = false;
    }
    refrescarControles();
    return;
  }
  const t = estado.reloj.avanzar(ahora);
  if (t !== estado.ultimoT || estado.sucio) {
    actualizarVista(t, ahora, { snap: estado.snapPendiente });
    estado.snapPendiente = false;
    estado.sucio = false;
    estado.ultimoT = t;
  }
  refrescarControles();
}

function actualizarVista(t, ahora, { snap = false, forzarGraficos = false } = {}) {
  const eje = estado.ejecucion;
  const material = eje.estadoEn(t);
  const stats = estadisticasDeEstado(eje, material);
  const bus = eje.busVisualEn(t, { reducido: estado.reducido });
  const operativo = estadoOperativo(stats.esperando, eje.limiteCola);
  const mensaje = componerMensaje(eje.estado, operativo);
  const vista = {
    sinDatos: false,
    pausado: !estado.reloj.reproduciendo && !estado.reloj.finalizado,
    finalizado: estado.reloj.finalizado,
    cola: material.cola,
    esperando: material.cola.length,
    transportados: material.transportados,
    autobuses: material.autobuses,
    bus,
    reloj: formatearReloj(t),
    reducido: estado.reducido,
    alerta: {
      activa: operativo.saturado,
      titulo: mensaje.titulo,
      detalle: mensaje.detalle,
      severidad: mensaje.severidad,
    },
  };
  escena.dibujar(vista, ahora, { snap });
  actualizarHudEscena(vista);
  actualizarTarjetas(stats);
  actualizarEstadoSistema(mensaje, operativo, eje);
  actualizarIndicadoresVivos(operativo);
  if (!estado.arrastrandoLinea && eje.duracion > 0) {
    refs['linea-tiempo'].value = String(Math.round((t / eje.duracion) * 1000));
  }
  setTexto(refs['tiempo-actual'], formatearReloj(t));
  registro.actualizar(eje, t);
  const retrocesoGrafico = t < estado.ultimoGrafico - 1e-9;
  const intervaloGrafico = t - estado.ultimoGrafico >= 0.1;
  const finalGrafico = eje.duracion > 0 && t >= eje.duracion - 1e-9 && t > estado.ultimoGrafico + 1e-9;
  if (
    forzarGraficos ||
    retrocesoGrafico ||
    ((intervaloGrafico || finalGrafico) && ahora - estado.ultimoGraficoReal >= 50)
  ) {
    actualizarGraficos(t, eje, stats);
    estado.ultimoGrafico = t;
    estado.ultimoGraficoReal = ahora;
  }
  if (ahora - ultimoAria > 1000) {
    actualizarAria(stats, bus);
    ultimoAria = ahora;
  }
}

/** Zona de estado: clasificación matemática + estado operativo de la cola. */
function actualizarEstadoSistema(mensaje, operativo, eje) {
  const clasificacion = eje.estado || {};
  const contenedor = refs['estado-sistema'];
  if (contenedor) {
    const severidad = mensaje.severidad || 'inactivo';
    if (contenedor.dataset.severidad !== severidad) contenedor.dataset.severidad = severidad;
  }
  setTexto(refs['estado-sistema-titulo'], mensaje.titulo);
  setTexto(refs['estado-sistema-detalle'], mensaje.detalle);
  setTexto(refs['estado-rho'], clasificacion.rho === null || clasificacion.rho === undefined
    ? '∞'
    : formatearNumero(clasificacion.rho, 3));
  setTexto(refs['estado-lambda'], formatearNumero(clasificacion.lambda_p, 2));
  setTexto(refs['estado-mu'], formatearNumero(clasificacion.mu, 2));
  setTexto(
    refs['estado-cola'],
    `${formatearEntero(operativo.colaReal)} / ${formatearEntero(operativo.limite)}`,
  );
}

/** Construye el panel de indicadores científicos al cargar una ejecución. */
function renderIndicadores(eje) {
  const contenedor = refs['indicadores-contenido'];
  if (!contenedor) return;
  filasIndicadores.clear();
  const lineas = lineasIndicadores(eje.estado, estadoOperativo(0, eje.limiteCola), eje.metricasTeoricas, eje.resultados);
  const fragmento = document.createDocumentFragment();
  for (const linea of lineas) {
    const articulo = document.createElement('article');
    articulo.className = 'indicador';
    articulo.dataset.clave = linea.clave;
    const titulo = document.createElement('h3');
    titulo.className = 'indicador__titulo';
    titulo.textContent = linea.etiqueta;
    const valor = document.createElement('p');
    valor.className = 'indicador__valor';
    valor.textContent = linea.valor;
    const ayuda = document.createElement('p');
    ayuda.className = 'indicador__ayuda';
    ayuda.textContent = linea.ayuda;
    articulo.append(titulo, valor, ayuda);
    fragmento.appendChild(articulo);
    filasIndicadores.set(linea.clave, { articulo, valor });
  }
  contenedor.replaceChildren(fragmento);
}

/** Actualiza los indicadores que dependen del instante actual. */
function actualizarIndicadoresVivos(operativo) {
  const filaCola = filasIndicadores.get('cola_real');
  if (filaCola) filaCola.valor.textContent = `${formatearEntero(operativo.colaReal)} pasajeros`;
  const filaExcedente = filasIndicadores.get('excedente');
  if (filaExcedente) filaExcedente.valor.textContent = `${formatearEntero(operativo.excedente)} pasajeros`;
  const filaLimite = filasIndicadores.get('limite_cola');
  if (filaLimite) filaLimite.valor.textContent = `${formatearEntero(operativo.limite)} pasajeros`;
}

function actualizarTarjetas(stats) {
  setTexto(refs['stat-llegados'], formatearEntero(stats.llegados));
  setTexto(refs['stat-esperando'], formatearEntero(stats.esperando));
  setTexto(refs['stat-transportados'], formatearEntero(stats.transportados));
  setTexto(refs['stat-autobuses'], formatearEntero(stats.autobuses));
  setTexto(refs['stat-espera-media'], `${formatearNumero(stats.esperaMedia)} min`);
  setTexto(refs['stat-cola-media'], `${formatearNumero(stats.colaMediaTemporal)} pas.`);
  setTexto(refs['stat-ocupacion'], formatearPorcentaje(stats.ocupacionAcumulada));
  setTexto(refs['stat-tiempo'], `${formatearReloj(stats.tiempo)} / ${formatearReloj(stats.duracion)}`);
}

function actualizarGraficos(t, eje, stats) {
  graficos.cola.fijarDatos({
    serie: eje.serieColaHasta(t),
    tiempo: t,
    duracion: eje.duracion,
    colaActual: stats.esperando,
    limiteCola: eje.limiteCola,
  });
  graficos.acumulados.fijarDatos({
    acumulado: eje.serieAcumuladaHasta(t),
    tiempo: t,
    duracion: eje.duracion,
    actual: {
      llegados: stats.llegados,
      transportados: stats.transportados,
      pendientes: stats.llegados + eje.colaInicial - stats.transportados,
      pendientesInicial: eje.colaInicial,
    },
  });
  graficos.esperas.fijarDatos({
    esperas: eje.esperasHasta(t),
    tiempo: t,
    duracion: eje.duracion,
  });
  graficos.capacidad.fijarDatos({
    buses: eje.busesHasta(t, 14),
    capacidad: eje.config.capacidad_autobus || 1,
  });
}

const ETIQUETAS_FASE_BUS = {
  aproximando: 'Aproximándose',
  detenido: 'Detenido · puertas abiertas',
  abordando: 'Abordando',
  saliendo: 'Saliendo de la parada',
};

function actualizarHudEscena(vista) {
  if (!escena || !escena.es3d) return;
  refs['escena-hud'].hidden = false;
  setTexto(refs['escena-hud-espera'], formatearEntero(vista.esperando));
  setTexto(refs['escena-hud-transportados'], formatearEntero(vista.transportados));
  setTexto(refs['escena-hud-autobuses'], formatearEntero(vista.autobuses));
  setTexto(refs['escena-hud-reloj'], vista.reloj);

  const bus = vista.bus;
  if (!bus) {
    refs['escena-hud-bus'].hidden = true;
    return;
  }
  refs['escena-hud-bus'].hidden = false;
  setTexto(
    refs['escena-hud-fase'],
    bus.fase === 'abordando'
      ? `${ETIQUETAS_FASE_BUS.abordando} ${bus.mostrados}/${bus.abordados}`
      : ETIQUETAS_FASE_BUS[bus.fase] || '',
  );
  const ocupados = Math.min(bus.capacidad, bus.ocupadosAlLlegar + Math.max(0, bus.mostrados || 0));
  const fraccion = bus.capacidad > 0 ? ocupados / bus.capacidad : 0;
  if (refs['escena-hud-barra']) {
    refs['escena-hud-barra'].style.width = `${Math.round(fraccion * 100)}%`;
  }
  setTexto(
    refs['escena-hud-ocupacion'],
    `${formatearEntero(ocupados)}/${formatearEntero(bus.capacidad)} asientos · abordan ${bus.mostrados}/${bus.abordados}`,
  );
}

function actualizarAria(stats, bus) {
  const partes = [
    `Parada de autobuses en el minuto ${formatearReloj(stats.tiempo)}.`,
    `${stats.esperando} pasajeros en espera.`,
    `${stats.transportados} transportados, ${stats.autobuses} autobuses llegados.`,
  ];
  if (bus) {
    const fases = {
      aproximando: 'Un autobús se aproxima a la parada.',
      detenido: 'Un autobús está detenido con las puertas abiertas.',
      abordando: `Un autobús está abordando: ${bus.mostrados} de ${bus.abordados} pasajeros.`,
      saliendo: 'El autobús está saliendo de la parada.',
    };
    partes.push(fases[bus.fase] || '');
  }
  refs['escena'].setAttribute('aria-label', partes.join(' '));
}

// ---------------------------------------------------------------------
// Controles
// ---------------------------------------------------------------------

function conectarControles() {
  refs['btn-iniciar'].addEventListener('click', () => iniciarSimulacion());
  refs['form-parametros'].addEventListener('submit', (evento) => {
    evento.preventDefault();
    iniciarSimulacion();
  });

  if (refs['escenario-select']) {
    refs['escenario-select'].addEventListener('change', (evento) => {
      const id = evento.target.value;
      if (id === ESCENARIO_PERSONALIZADO) {
        estado.escenarioActual = ESCENARIO_PERSONALIZADO;
        setTexto(refs['escenario-descripcion'], 'Configuración personalizada: los parámetros se han editado a mano.');
        setTexto(refs['escenario-condicion'], '');
        return;
      }
      aplicarEscenarioSeleccionado(id);
    });
  }

  refs['campos'].addEventListener('input', () => {
    sincronizarEscenario();
  });
  refs['campos'].addEventListener('change', () => {
    sincronizarEscenario();
  });

  refs['btn-pausar'].addEventListener('click', () => {
    if (!estado.reloj) return;
    if (estado.reloj.reproduciendo) {
      estado.reloj.pausar();
    } else {
      estado.reloj.iniciar();
    }
    estado.sucio = true;
    refrescarControles();
  });

  refs['btn-reiniciar'].addEventListener('click', () => {
    if (!estado.reloj) return;
    estado.reloj.irA(0);
    estado.reloj.iniciar();
    estado.snapPendiente = true;
    estado.sucio = true;
    estado.ultimoT = -1;
    estado.ultimoGrafico = -1;
    refrescarControles();
  });

  for (const [nombre, id] of [['calle', 'btn-camara-calle'], ['elevada', 'btn-camara-elevada']]) {
    refs[id].addEventListener('click', () => {
      if (!escena || !escena.cambiarCamara) return;
      escena.cambiarCamara(nombre);
      for (const [otroNombre, otroId] of [['calle', 'btn-camara-calle'], ['elevada', 'btn-camara-elevada']]) {
        const activo = otroNombre === nombre;
        refs[otroId].classList.toggle('activo', activo);
        refs[otroId].setAttribute('aria-pressed', activo ? 'true' : 'false');
      }
    });
  }

  for (const boton of qsa('.velocidad-boton', refs['velocidad-segmentada'])) {
    boton.addEventListener('click', () => {
      const velocidad = Number(boton.dataset.velocidad);
      if (!VELOCIDADES.includes(velocidad)) return;
      estado.velocidad = velocidad;
      if (estado.reloj) estado.reloj.cambiarVelocidad(velocidad);
      actualizarVelocidadUI();
    });
  }

  const linea = refs['linea-tiempo'];
  linea.addEventListener('pointerdown', () => {
    estado.arrastrandoLinea = true;
  });
  const terminarArrastre = () => {
    estado.arrastrandoLinea = false;
  };
  linea.addEventListener('pointerup', terminarArrastre);
  linea.addEventListener('pointercancel', terminarArrastre);
  linea.addEventListener('input', () => {
    if (!estado.ejecucion) return;
    estado.reloj.pausar();
    const fraccion = Number(linea.value) / 1000;
    const t = fraccion * estado.ejecucion.duracion;
    estado.reloj.irA(t);
    estado.snapPendiente = true;
    estado.sucio = true;
    estado.ultimoT = -1;
    estado.ultimoGrafico = -1;
    refrescarControles();
  });

  refs['btn-csv-eventos'].addEventListener('click', () => {
    if (!estado.ejecucion) return;
    const semilla = estado.ejecucion.config.semilla ?? 'aleatoria';
    descargarTexto(`simulacion_eventos_semilla_${semilla}.csv`, csvEventos(estado.ejecucion));
  });
  refs['btn-csv-resumen'].addEventListener('click', () => {
    if (!estado.ejecucion) return;
    const semilla = estado.ejecucion.config.semilla ?? 'aleatoria';
    descargarTexto(`simulacion_resumen_semilla_${semilla}.csv`, csvResumen(estado.ejecucion));
  });

  refs['btn-replicas'].addEventListener('click', () => ejecutarReplicas());

  if (refs['btn-comparar']) {
    refs['btn-comparar'].addEventListener('click', () => ejecutarComparacion());
  }

  refs['banner-error-cerrar'].addEventListener('click', () => ocultarBanner());

  conectarModalIndicadores();
  conectarPanelControles();
}

/**
 * Modal accesible de indicadores científicos: abrirlo o cerrarlo no reinicia
 * la simulación ni toca el estado del motor; solo muestra u oculta la capa.
 */
function conectarModalIndicadores() {
  const dialogo = refs['modal-indicadores'];
  if (!dialogo) return;

  const abrir = () => {
    try {
      if (typeof dialogo.showModal === 'function') dialogo.showModal();
      else dialogo.classList.add('modal--abierto');
    } catch {
      dialogo.classList.add('modal--abierto');
    }
  };

  const cerrar = () => {
    if (typeof dialogo.close === 'function' && dialogo.open) dialogo.close();
    dialogo.classList.remove('modal--abierto');
  };

  if (refs['btn-indicadores']) {
    refs['btn-indicadores'].addEventListener('click', abrir);
  }
  if (refs['modal-cerrar']) {
    refs['modal-cerrar'].addEventListener('click', cerrar);
  }
  dialogo.addEventListener('click', (evento) => {
    if (evento.target === dialogo) cerrar();
  });
}

/** En pantallas estrechas el panel de control se pliega mediante toggle. */
function conectarPanelControles() {
  const boton = refs['btn-toggle-controles'];
  const panel = refs['panel-controles'];
  if (!boton || !panel) return;
  boton.addEventListener('click', () => {
    const abierto = panel.classList.toggle('controles-abierto');
    boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
  });
}

/** Crea las cuatro gráficas comparativas del apartado de casos base. */
function crearGraficosComparacion() {
  return {
    comparacionCola: new GraficoComparacionCola(document.getElementById('comparacion-cola')),
    comparacionBoxplot: new GraficoComparacionBoxplot(document.getElementById('comparacion-boxplot')),
    comparacionEsperas: new GraficoComparacionEsperas(document.getElementById('comparacion-esperas')),
    comparacionDemanda: new GraficoComparacionDemanda(document.getElementById('comparacion-demanda')),
  };
}

function actualizarVelocidadUI() {
  for (const boton of qsa('.velocidad-boton', refs['velocidad-segmentada'])) {
    const activo = Number(boton.dataset.velocidad) === estado.velocidad;
    boton.classList.toggle('activo', activo);
    boton.setAttribute('aria-pressed', activo ? 'true' : 'false');
  }
  setTexto(
    refs['velocidad-chip'],
    `${formatearNumero(estado.velocidad, estado.velocidad % 1 === 0 ? 0 : 1)}× · ${formatearNumero(MINUTOS_POR_SEGUNDO_BASE * estado.velocidad, 1)} min/s`,
  );
}

function faseActual() {
  if (estado.cargando) return 'cargando';
  if (!estado.ejecucion) return 'sin_datos';
  if (estado.reloj.reproduciendo) return 'reproduciendo';
  if (estado.reloj.finalizado) return 'finalizado';
  return 'pausado';
}

const TEXTOS_FASE = {
  cargando: 'Calculando ejecución…',
  sin_datos: 'Sin ejecución',
  reproduciendo: 'Reproduciendo',
  pausado: 'Pausado',
  finalizado: 'Finalizado',
};

function refrescarControles() {
  const fase = faseActual();
  if (fase !== estado.faseUI) {
    estado.faseUI = fase;
    setTexto(refs['estado-pill'], TEXTOS_FASE[fase]);
    refs['estado-pill'].dataset.fase = fase;
  }
  const hay = !!estado.ejecucion;
  refs['btn-iniciar'].disabled = estado.cargando || !estado.parametros;
  refs['btn-iniciar'].classList.toggle('cargando', estado.cargando);
  setTexto(refs['btn-iniciar'], estado.cargando ? 'Simulando…' : 'Iniciar simulación');
  refs['btn-pausar'].disabled = !hay;
  setTexto(
    refs['btn-pausar'],
    hay && estado.reloj.reproduciendo ? 'Pausar' : hay && estado.reloj.finalizado ? 'Volver a reproducir' : 'Reanudar',
  );
  refs['btn-reiniciar'].disabled = !hay;
  refs['linea-tiempo'].disabled = !hay;
  refs['btn-csv-eventos'].disabled = !hay;
  refs['btn-csv-resumen'].disabled = !hay;
  refs['btn-replicas'].disabled = !hay || estado.replicasCargando;
  setTexto(refs['btn-replicas'], estado.replicasCargando ? 'Calculando réplicas…' : 'Ejecutar réplicas (modo acelerado)');
  if (refs['btn-comparar']) {
    refs['btn-comparar'].disabled = !estado.parametros || estado.comparacionCargando;
    setTexto(
      refs['btn-comparar'],
      estado.comparacionCargando ? 'Ejecutando réplicas…' : 'Comparar los 3 casos base',
    );
  }
}

// ---------------------------------------------------------------------
// Resultados, réplicas y avisos
// ---------------------------------------------------------------------

function renderResultados(eje) {
  const r = eje.resultados;
  const config = eje.config;
  const teoricas = eje.metricasTeoricas;
  const ocupacionMedia =
    r.autobuses_llegados_total > 0 && config.capacidad_autobus > 0
      ? 1 - r.asientos_libres_promedio / config.capacidad_autobus
      : null;
  const filas = [
    ['Duración simulada', `${formatearReloj(r.tiempo_final)} (${formatearNumero(r.tiempo_final, 1)} min)`],
    ['Pasajeros llegados', formatearEntero(r.pasajeros_llegados_total)],
    ['Pasajeros transportados', formatearEntero(r.pasajeros_transportados_total)],
    ['Pasajeros que siguen en cola', formatearEntero(r.pasajeros_restantes_cola)],
    ['Autobuses llegados', formatearEntero(r.autobuses_llegados_total)],
    ['Espera media (abordados)', `${formatearNumero(r.espera_media_abordados)} min`],
    ['Espera mediana', `${formatearNumero(r.espera_mediana_abordados)} min`],
    ['Espera P90', `${formatearNumero(r.espera_p90)} min`],
    ['Espera P95', `${formatearNumero(r.espera_p95)} min`],
    ['Espera máxima', `${formatearNumero(r.espera_maxima_abordados)} min`],
    ['Cola máxima', formatearEntero(r.cola_maxima)],
    ['Cola media temporal', `${formatearNumero(r.cola_media_temporal)} pasajeros`],
    ['Límite operativo (Qmáx)', formatearEntero(r.limite_cola)],
    [
      'Saturación operativa',
      r.tiempo_saturacion_operativa === null || r.tiempo_saturacion_operativa === undefined
        ? 'No alcanzada'
        : `Alcanzada en t = ${formatearNumero(r.tiempo_saturacion_operativa, 1)} min`,
    ],
    ['Tiempo en saturación', `${formatearNumero(r.minutos_en_saturacion, 1)} min`],
    ['Ocupación media de autobuses', ocupacionMedia === null ? '—' : formatearPorcentaje(ocupacionMedia)],
    [
      'Autobuses sin asientos al llegar',
      `${formatearEntero(r.autobuses_sin_asientos_libres)} (${formatearPorcentaje(r.autobuses_sin_asientos_libres_pct / 100)})`,
    ],
    ['Asientos libres promedio', formatearNumero(r.asientos_libres_promedio)],
    ['Pasajeros abordados contabilizados', formatearEntero(r.num_pasajeros_abordados)],
  ];
  const dl = document.createElement('dl');
  dl.className = 'resultados-grid';
  for (const [etiqueta, valor] of filas) {
    const dt = document.createElement('dt');
    dt.textContent = etiqueta;
    const dd = document.createElement('dd');
    dd.textContent = valor;
    dl.append(dt, dd);
  }
  refs['resultados-finales'].replaceChildren(dl);

  const balanceOk = r.balance_pasajeros === 0;
  refs['resultado-balance'].textContent = balanceOk
    ? 'Balance verificado: cola inicial + llegados = transportados + restantes.'
    : `Descuadre detectado en el balance de pasajeros: ${r.balance_pasajeros}.`;
  refs['resultado-balance'].classList.toggle('aviso--error', !balanceOk);

  refs['resultado-semilla'].textContent =
    `Semilla usada: ${r.semilla === null ? 'no registrada' : r.semilla} (repita esta configuración con la misma semilla para reproducir la ejecución).`;

  actualizarInfoModelo();
}

function renderAdvertencias(advertencias) {
  if (!advertencias || advertencias.length === 0) {
    refs['aviso-advertencias'].hidden = true;
    refs['aviso-advertencias'].textContent = '';
    return;
  }
  refs['aviso-advertencias'].textContent = advertencias.join(' ');
  refs['aviso-advertencias'].hidden = false;
}

async function ejecutarReplicas() {
  if (!estado.ejecucion || estado.replicasCargando) return;
  if (estado.replicasAbortador) estado.replicasAbortador.abort();
  const abortador = new AbortController();
  estado.replicasAbortador = abortador;
  estado.replicasCargando = true;
  refrescarControles();
  setTexto(refs['replicas-estado'], 'Ejecutando réplicas con distintas semillas…');
  try {
    const datos = await api.replicas(estado.ejecucion.config, abortador.signal);
    if (abortador.signal.aborted) return;
    renderReplicas(datos);
  } catch (error) {
    if (error.name === 'AbortError') return;
    setTexto(refs['replicas-estado'], `No se pudieron calcular las réplicas: ${error.message}`);
  } finally {
    if (estado.replicasAbortador === abortador) estado.replicasAbortador = null;
    estado.replicasCargando = false;
    refrescarControles();
  }
}

function renderReplicas(datos) {
  setTexto(
    refs['replicas-estado'],
    `Modo acelerado: ${datos.num_repeticiones} repeticiones con semillas ${datos.semilla_base}…${datos.semilla_base + datos.num_repeticiones - 1}. Se muestra media ± desviación típica.`,
  );
  const tabla = document.createElement('table');
  tabla.className = 'replicas-tabla';
  const thead = document.createElement('thead');
  const filaCabecera = document.createElement('tr');
  for (const texto of ['Métrica', 'Media', 'Desviación']) {
    const th = document.createElement('th');
    th.textContent = texto;
    filaCabecera.appendChild(th);
  }
  thead.appendChild(filaCabecera);
  const tbody = document.createElement('tbody');
  for (const [clave, etiqueta] of Object.entries(ETIQUETAS_REPLICAS)) {
    if (!(clave in datos.metricas)) continue;
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = etiqueta;
    const tdMedia = document.createElement('td');
    tdMedia.textContent = formatearNumero(datos.metricas[clave]);
    const tdStd = document.createElement('td');
    tdStd.textContent = formatearNumero(datos.metricas[`${clave}_std`] ?? 0);
    tr.append(th, tdMedia, tdStd);
    tbody.appendChild(tr);
  }
  tabla.append(thead, tbody);
  refs['replicas-contenido'].replaceChildren(tabla);
}

function limpiarReplicas() {
  refs['replicas-contenido'].replaceChildren();
  setTexto(
    refs['replicas-estado'],
    'Pendiente. Las réplicas promedian varias semillas sin animación (modo acelerado) y no alteran la ejecución en curso.',
  );
}

// ---------------------------------------------------------------------
// Comparación de los 3 casos base
// ---------------------------------------------------------------------

async function ejecutarComparacion() {
  if (estado.comparacionCargando) return;
  if (estado.comparacionAbortador) estado.comparacionAbortador.abort();
  const abortador = new AbortController();
  estado.comparacionAbortador = abortador;
  estado.comparacionCargando = true;
  refrescarControles();
  setTexto(refs['comparacion-estado'], 'Ejecutando réplicas de los tres casos base…');
  try {
    const payload = await api.comparar({ num_repeticiones: 20 }, abortador.signal);
    if (abortador.signal.aborted) return;
    aplicarComparacion(normalizarComparacion(payload));
  } catch (error) {
    if (error.name === 'AbortError') return;
    setTexto(refs['comparacion-estado'], `No se pudo completar la comparación: ${error.message}`);
  } finally {
    if (estado.comparacionAbortador === abortador) estado.comparacionAbortador = null;
    estado.comparacionCargando = false;
    refrescarControles();
  }
}

/** Vuelca el resultado normalizado en gráficas, tarjetas y tabla. */
function aplicarComparacion(datos) {
  estado.comparacion = datos;
  const vista = renderizarComparacion(datos);
  setTexto(
    refs['comparacion-estado'],
    `Modo acelerado: ${datos.numRepeticiones} réplicas por caso con semillas ${datos.semillaBase}…` +
      `${datos.semillaBase + datos.numRepeticiones - 1}. Cada serie es la media de las réplicas y no altera ninguna ejecución en curso.`,
  );

  const tiempoMax = Math.max(...datos.casos.map((caso) => caso.duracion), 0);
  const comun = {
    casos: datos.casos,
    rejilla: datos.casos[0] ? datos.casos[0].rejilla : [],
    duracion: tiempoMax,
    tiempo: tiempoMax,
    visibles: null,
  };
  graficosComparacion.comparacionCola.fijarDatos(comun);
  graficosComparacion.comparacionBoxplot.fijarDatos(comun);
  graficosComparacion.comparacionEsperas.fijarDatos(comun);
  graficosComparacion.comparacionDemanda.fijarDatos(comun);

  renderResumenComparacion(vista.resumen, vista.indicadores);

  const aviso = refs['comparacion-aviso'];
  if (aviso) {
    aviso.textContent = vista.advertencia;
    aviso.hidden = false;
  }

  renderTablaComparacion(vista.tabla, datos);
  estado.sucio = true;
}

/** Tarjetas de resumen por escenario + indicadores comparativos. */
function renderResumenComparacion(resumen, indicadores) {
  const contenedor = refs['comparacion-resumen'];
  if (contenedor) {
    const fragmento = document.createDocumentFragment();
    for (const caso of resumen) {
      const articulo = document.createElement('article');
      articulo.className = 'caso-resumen';
      articulo.style.borderLeftColor = caso.color;
      const cabecera = document.createElement('div');
      cabecera.className = 'caso-resumen__cabecera';
      const punto = document.createElement('span');
      punto.className = 'caso-resumen__punto';
      punto.style.background = caso.color;
      const nombre = document.createElement('span');
      nombre.className = 'caso-resumen__nombre';
      nombre.textContent = caso.nombre;
      const estadoPill = document.createElement('span');
      estadoPill.className = 'caso-resumen__estado';
      estadoPill.dataset.severidad = caso.severidad || 'inactivo';
      estadoPill.textContent = caso.estado || '—';
      cabecera.append(punto, nombre, estadoPill);
      const cifras = document.createElement('dl');
      cifras.className = 'caso-resumen__cifras';
      const filas = [
        ['λ', `${formatearNumero(caso.lambda, 2)} pas/min`],
        ['ρ', caso.rho === null ? '∞' : formatearNumero(caso.rho, 2)],
        ['Duración', formatearReloj(caso.duracion)],
      ];
      for (const [etiqueta, valor] of filas) {
        const dt = document.createElement('dt');
        dt.textContent = etiqueta;
        const dd = document.createElement('dd');
        dd.textContent = valor;
        cifras.append(dt, dd);
      }
      articulo.append(cabecera, cifras);
      fragmento.appendChild(articulo);
    }
    contenedor.replaceChildren(fragmento);
  }

  const contenedorInd = refs['comparacion-indicadores'];
  if (contenedorInd) {
    const fragmento = document.createDocumentFragment();
    for (const indicador of indicadores) {
      const articulo = document.createElement('article');
      articulo.className = 'tarjeta';
      articulo.style.borderLeftColor = indicador.color;
      const titulo = document.createElement('h3');
      titulo.textContent = indicador.etiqueta;
      const valor = document.createElement('p');
      valor.className = 'tarjeta__valor';
      valor.style.fontSize = '17px';
      valor.textContent = indicador.valor;
      const pie = document.createElement('p');
      pie.className = 'tarjeta__pie';
      pie.textContent = indicador.caso;
      articulo.append(titulo, valor, pie);
      fragmento.appendChild(articulo);
    }
    contenedorInd.replaceChildren(fragmento);
  }
}

/** Tabla 4 con los indicadores válidos de cada caso base. */
function renderTablaComparacion(filas, datos) {
  const contenedor = refs['comparacion-tabla'];
  if (!contenedor) return;
  const tabla = document.createElement('table');
  tabla.className = 'comparacion-tabla';
  const thead = document.createElement('thead');
  const filaCabecera = document.createElement('tr');
  const thIndicador = document.createElement('th');
  thIndicador.scope = 'col';
  thIndicador.textContent = 'Indicador';
  filaCabecera.appendChild(thIndicador);
  for (const caso of datos.casos) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = caso.etiqueta;
    filaCabecera.appendChild(th);
  }
  thead.appendChild(filaCabecera);

  const tbody = document.createElement('tbody');
  for (const linea of filas) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = linea.etiqueta;
    const unidad = document.createElement('span');
    unidad.textContent = linea.unidad;
    th.appendChild(unidad);
    tr.appendChild(th);
    for (const celda of linea.valores) {
      const td = document.createElement('td');
      td.dataset.disponible = celda.disponible ? 'true' : 'false';
      td.textContent = celda.texto;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  tabla.append(thead, tbody);
  contenedor.replaceChildren(tabla);
  const nota = refs['comparacion-tabla-nota'];
  if (nota) {
    nota.textContent =
      `Valores medios de ${datos.numRepeticiones} réplicas por caso (semilla base ${datos.semillaBase}). ` +
      'El porcentaje transportado se calcula como transportados/llegados; el pendiente, como restantes/(transportados+restantes). ' +
      'No se calcula significación estadística: es una comparación descriptiva.';
  }
}

/**
 * Muestra el banner de error solo cuando existe un mensaje real que
 * comunicar. Con estado nulo, vacío o de solo espacios no se renderiza el
 * contenedor (ni reserva espacio ni deja fondo residuo).
 */
function mostrarBanner(mensaje, permitirReintento = false) {
  const texto = (mensaje ?? '').trim();
  if (!texto) {
    ocultarBanner();
    return;
  }
  setTexto(refs['banner-error-texto'], texto);
  refs['banner-error'].hidden = false;
  refs['banner-error-reintentar'].hidden = !permitirReintento;
  if (!permitirReintento) return;
  refs['banner-error-reintentar'].onclick = () => {
    ocultarBanner();
    cargarParametros();
  };
}

/** Retira el banner y limpia su mensaje para no dejar estado obsoleto. */
function ocultarBanner() {
  refs['banner-error'].hidden = true;
  setTexto(refs['banner-error-texto'], '');
}

// ---------------------------------------------------------------------
// Redimensionado
// ---------------------------------------------------------------------

function observarRedimensionado() {
  const observador = new ResizeObserver(() => {
    estado.sucio = true;
    if (graficos) {
      for (const grafico of Object.values(graficos)) grafico._programar();
    }
  });
  observador.observe(refs['escena']);
  for (const grafico of Object.values(graficos)) observador.observe(grafico.canvas);
}

document.addEventListener('DOMContentLoaded', iniciar);
