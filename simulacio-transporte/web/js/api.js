/**
 * Cliente HTTP del backend. Maneja errores del servidor, cancelación de
 * peticiones obsoletas (AbortController) y respuestas incompletas.
 */

async function solicitar(ruta, { metodo = 'GET', cuerpo, senal } = {}) {
  const opciones = { method: metodo, signal: senal };
  if (cuerpo !== undefined) {
    opciones.headers = { 'Content-Type': 'application/json' };
    opciones.body = JSON.stringify(cuerpo);
  }
  let respuesta;
  try {
    respuesta = await fetch(ruta, opciones);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('No se pudo contactar con el servidor de simulación. ¿Sigue en ejecución?');
  }
  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }
  if (!respuesta.ok) {
    const mensaje = datos && datos.error ? datos.error : `El servidor respondió con el código ${respuesta.status}.`;
    throw new Error(mensaje);
  }
  if (!datos || typeof datos !== 'object') {
    throw new Error('El servidor devolvió una respuesta inválida.');
  }
  return datos;
}

export const api = {
  parametros: () => solicitar('/api/parametros'),
  simular: (config, senal) => solicitar('/api/simular', { metodo: 'POST', cuerpo: config, senal }),
  replicas: (config, senal) => solicitar('/api/replicas', { metodo: 'POST', cuerpo: config, senal }),
};
