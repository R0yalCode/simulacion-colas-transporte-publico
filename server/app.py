"""Servidor HTTP del simulador: API REST + archivos est\u00e1ticos de `web/`.

Usa \u00fanicamente la biblioteca est\u00e1ndar (http.server) para no a\u00f1adir
dependencias: el motor de eventos discretos ya calcula todos los eventos de una
ejecuci\u00f3n, de modo que una API de petici\u00f3n/respuesta es suficiente y el
navegador reproduce localmente la ejecuci\u00f3n recibida.

Endpoints:
- GET  /api/salud        Comprobaci\u00f3n de vida del servidor.
- GET  /api/parametros   Metadatos del formulario (l\u00edmites, unidades, defectos).
- POST /api/simular      Ejecuta el motor y devuelve eventos, series y resultados.
- POST /api/replicas     Ejecuta N r\u00e9plicas reproducibles (modo acelerado).
- GET  /*                Archivos est\u00e1ticos de web/ (index.html por defecto).
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import secrets
import sys
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional, Type
from urllib.parse import unquote, urlparse

RAIZ_PROYECTO = Path(__file__).resolve().parents[1]
if str(RAIZ_PROYECTO) not in sys.path:
    sys.path.insert(0, str(RAIZ_PROYECTO))

from models.simulation import SimulationEngine

from server.schema import (
    ParametroInvalido,
    config_desde_payload,
    construir_payload,
    payload_parametros,
    payload_replicas,
)

TAMANO_MAXIMO_CUERPO = 1_048_576

for _extension, _tipo in (
    (".js", "text/javascript"),
    (".mjs", "text/javascript"),
    (".css", "text/css"),
    (".html", "text/html"),
    (".json", "application/json"),
    (".svg", "image/svg+xml"),
    (".png", "image/png"),
    (".woff2", "font/woff2"),
):
    mimetypes.add_type(_tipo, _extension)


def _crear_manejador(raiz_web: Path) -> Type[BaseHTTPRequestHandler]:
    class ManejadorSimulacion(BaseHTTPRequestHandler):
        """Enrutador HTTP: API JSON bajo /api y estáticos de web/."""

        server_version = "SimulacionTransporte/3.0"
        protocol_version = "HTTP/1.1"

        # ---------- utilidades de respuesta ----------

        def _enviar(self, codigo: int, cuerpo: bytes, tipo: str) -> None:
            self.send_response(codigo)
            self.send_header("Content-Type", tipo)
            self.send_header("Content-Length", str(len(cuerpo)))
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(cuerpo)

        def _json(self, codigo: int, datos: Dict[str, Any]) -> None:
            cuerpo = json.dumps(datos, ensure_ascii=False).encode("utf-8")
            self._enviar(codigo, cuerpo, "application/json; charset=utf-8")

        def _error(self, codigo: int, mensaje: str) -> None:
            self._json(codigo, {"error": mensaje})

        # ---------- lectura de peticiones ----------

        def _leer_json(self) -> Dict[str, Any]:
            try:
                longitud = int(self.headers.get("Content-Length", "0"))
            except ValueError as exc:
                raise ParametroInvalido("Cabecera Content-Length inv\u00e1lida.") from exc
            if longitud <= 0:
                return {}
            if longitud > TAMANO_MAXIMO_CUERPO:
                raise ParametroInvalido("El cuerpo de la petici\u00f3n es demasiado grande.")
            crudo = self.rfile.read(longitud)
            try:
                datos = json.loads(crudo.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise ParametroInvalido("El cuerpo no es JSON v\u00e1lido.") from exc
            if not isinstance(datos, dict):
                raise ParametroInvalido("El cuerpo de la petici\u00f3n debe ser un objeto JSON.")
            return datos

        # ---------- rutas API ----------

        def _simular(self, datos: Dict[str, Any]) -> None:
            config = config_desde_payload(datos)
            if config.semilla is None:
                config = config.clonar(semilla=secrets.randbelow(2 ** 31))
            resultados = SimulationEngine(config).ejecutar()
            self._json(200, construir_payload(config, resultados))

        def _replicas(self, datos: Dict[str, Any]) -> None:
            config = config_desde_payload(datos)
            self._json(200, payload_replicas(config, config.num_repeticiones))

        # ---------- archivos estáticos ----------

        def _estatico(self, ruta: str) -> None:
            relativa = unquote(ruta).lstrip("/")
            if relativa == "" or relativa.endswith("/"):
                relativa += "index.html"
            destino = (raiz_web / relativa).resolve()
            if not destino.is_relative_to(raiz_web.resolve()):
                self._error(403, "Ruta no permitida.")
                return
            if destino.is_dir():
                destino = destino / "index.html"
            if not destino.is_file():
                self._error(404, "Recurso no encontrado.")
                return
            tipo = mimetypes.guess_type(destino.name)[0] or "application/octet-stream"
            if tipo.startswith("text/") or tipo in ("application/json", "image/svg+xml"):
                tipo += "; charset=utf-8"
            self._enviar(200, destino.read_bytes(), tipo)

        # ---------- despacho ----------

        def do_GET(self) -> None:  # noqa: N802 (API de BaseHTTPRequestHandler)
            ruta = urlparse(self.path).path
            if ruta == "/api/salud":
                self._json(200, {"estado": "ok", "servicio": "simulacion-transporte"})
                return
            if ruta == "/api/parametros":
                self._json(200, payload_parametros())
                return
            if ruta.startswith("/api/"):
                self._error(404, "Endpoint no encontrado.")
                return
            self._estatico(ruta)

        def do_HEAD(self) -> None:  # noqa: N802
            self.do_GET()

        def do_POST(self) -> None:  # noqa: N802
            ruta = urlparse(self.path).path
            try:
                datos = self._leer_json()
                if ruta == "/api/simular":
                    self._simular(datos)
                elif ruta == "/api/replicas":
                    self._replicas(datos)
                else:
                    self._error(404, "Endpoint no encontrado.")
            except ParametroInvalido as exc:
                self._error(400, str(exc))
            except BrokenPipeError:
                pass
            except Exception:
                traceback.print_exc()
                try:
                    self._error(500, "Error interno del motor de simulaci\u00f3n.")
                except BrokenPipeError:
                    pass

        def log_message(self, formato: str, *args: Any) -> None:
            sys.stderr.write(f"[servidor] {self.address_string()} {formato % args}\n")

    return ManejadorSimulacion


def crear_servidor(
    host: str = "127.0.0.1",
    puerto: int = 8000,
    raiz_web: Optional[Path] = None,
) -> ThreadingHTTPServer:
    """Crea el servidor HTTP (útil también para las pruebas de integración)."""
    raiz = Path(raiz_web) if raiz_web is not None else RAIZ_PROYECTO / "web"
    if not raiz.is_dir():
        raise FileNotFoundError(f"No se encontr\u00f3 el directorio web: {raiz}")
    manejador = _crear_manejador(raiz)
    servidor = ThreadingHTTPServer((host, puerto), manejador)
    servidor.daemon_threads = True
    return servidor


def main(argv: Optional[list] = None) -> None:
    """Punto de entrada del servidor web."""
    parser = argparse.ArgumentParser(
        description="Servidor web del simulador de colas de transporte p\u00fablico."
    )
    parser.add_argument("--host", default="127.0.0.1", help="Interfaz de escucha (defecto 127.0.0.1).")
    parser.add_argument("--puerto", type=int, default=8000, help="Puerto de escucha (defecto 8000).")
    parser.add_argument("--sin-navegador", action="store_true", help="No abrir el navegador autom\u00e1ticamente.")
    args = parser.parse_args(argv)

    servidor = crear_servidor(args.host, args.puerto)
    url = f"http://{args.host}:{servidor.server_address[1]}/"
    print("Servidor de simulaci\u00f3n de transporte p\u00fablico")
    print(f"  Interfaz web: {url}")
    print("  Detenga el servidor con Ctrl+C.")
    if not args.sin_navegador:
        try:
            webbrowser.open(url)
        except Exception:
            pass
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
    finally:
        servidor.server_close()


if __name__ == "__main__":
    main()
