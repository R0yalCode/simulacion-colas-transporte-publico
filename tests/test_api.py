"""Pruebas de integración del backend HTTP (`server/`)."""

import json
import threading
import urllib.error
import urllib.request

import pytest

from server.app import crear_servidor


@pytest.fixture(scope="module")
def base_url():
    servidor = crear_servidor("127.0.0.1", 0)
    hilo = threading.Thread(target=servidor.serve_forever, daemon=True)
    hilo.start()
    try:
        yield f"http://127.0.0.1:{servidor.server_address[1]}"
    finally:
        servidor.shutdown()
        servidor.server_close()


def _get(url):
    with urllib.request.urlopen(url, timeout=30) as resp:
        return resp.status, resp.headers, resp.read()


def _post(base_url, ruta, cuerpo):
    datos = json.dumps(cuerpo).encode("utf-8")
    peticion = urllib.request.Request(
        base_url + ruta, data=datos, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(peticion, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read().decode("utf-8"))


def _post_crudo(base_url, ruta, crudo):
    peticion = urllib.request.Request(
        base_url + ruta, data=crudo, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(peticion, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read().decode("utf-8"))


CONFIG_VALIDA = {
    "lambda_p": 6.0,
    "intervalo_promedio": 10.0,
    "coef_variacion": 0.3,
    "capacidad_autobus": 40,
    "prob_ocupacion": 0.7,
    "duracion": 30.0,
    "cola_inicial": 0,
    "semilla": 123,
    "num_repeticiones": 5,
}


class TestEndpointsBasicos:
    def test_salud(self, base_url):
        estado, _, cuerpo = _get(base_url + "/api/salud")
        assert estado == 200
        assert json.loads(cuerpo)["estado"] == "ok"

    def test_parametros(self, base_url):
        estado, _, cuerpo = _get(base_url + "/api/parametros")
        assert estado == 200
        datos = json.loads(cuerpo)
        parametros = datos["parametros"]
        for clave in (
            "lambda_p",
            "intervalo_promedio",
            "coef_variacion",
            "capacidad_autobus",
            "prob_ocupacion",
            "duracion",
            "cola_inicial",
            "semilla",
            "num_repeticiones",
        ):
            assert clave in parametros
            assert "etiqueta" in parametros[clave]
            assert "unidad" in parametros[clave]
            assert "min" in parametros[clave] and "max" in parametros[clave]
        assert parametros["lambda_p"]["defecto"] == 6.0

    def test_index_estatico(self, base_url):
        estado, cabeceras, cuerpo = _get(base_url + "/")
        assert estado == 200
        assert "text/html" in cabeceras["Content-Type"]
        assert "Simulaci" in cuerpo.decode("utf-8")

    def test_js_estatico(self, base_url):
        estado, cabeceras, cuerpo = _get(base_url + "/js/app.js")
        assert estado == 200
        assert "javascript" in cabeceras["Content-Type"]
        assert cuerpo

    def test_404_api_desconocida(self, base_url):
        with pytest.raises(urllib.error.HTTPError) as excinfo:
            _get(base_url + "/api/no-existe")
        assert excinfo.value.code == 404

    def test_404_estatico_desconocido(self, base_url):
        with pytest.raises(urllib.error.HTTPError) as excinfo:
            _get(base_url + "/js/inventado.js")
        assert excinfo.value.code == 404

    def test_traversal_bloqueado(self, base_url):
        with pytest.raises(urllib.error.HTTPError) as excinfo:
            _get(base_url + "/..%2fREADME.md")
        assert excinfo.value.code in (403, 404)


class TestSimular:
    def test_payload_completo(self, base_url):
        estado, datos = _post(base_url, "/api/simular", CONFIG_VALIDA)
        assert estado == 200
        assert set(datos) >= {
            "config",
            "resultados",
            "metricas_teoricas",
            "eventos",
            "serie_cola",
            "num_eventos",
            "advertencias",
        }
        assert datos["num_eventos"] == len(datos["eventos"])
        assert datos["resultados"]["balance_pasajeros"] == 0
        assert datos["config"]["semilla"] == 123

    def test_eventos_tipados(self, base_url):
        estado, datos = _post(base_url, "/api/simular", CONFIG_VALIDA)
        assert estado == 200
        tipos = {ev["tipo"] for ev in datos["eventos"]}
        assert tipos <= {"pasajero", "autobus"}
        for ev in datos["eventos"]:
            assert isinstance(ev["tiempo"], float)
            assert isinstance(ev["cola"], int)
            if ev["tipo"] == "pasajero":
                assert isinstance(ev["pasajero_id"], int)
            else:
                assert isinstance(ev["autobus_id"], int)
                assert all(isinstance(i, int) for i in ev["pasajeros_abordados_ids"])
                assert len(ev["pasajeros_abordados_ids"]) == ev["abordados"]

    def test_reproducibilidad_misma_semilla(self, base_url):
        _, uno = _post(base_url, "/api/simular", CONFIG_VALIDA)
        _, dos = _post(base_url, "/api/simular", CONFIG_VALIDA)
        assert uno["eventos"] == dos["eventos"]
        assert uno["resultados"] == dos["resultados"]

    def test_semilla_aleatoria_se_devuelve(self, base_url):
        config = dict(CONFIG_VALIDA, semilla=None)
        _, datos = _post(base_url, "/api/simular", config)
        semilla = datos["config"]["semilla"]
        assert isinstance(semilla, int)
        _, repetido = _post(base_url, "/api/simular", dict(config, semilla=semilla))
        assert repetido["eventos"] == datos["eventos"]

    def test_parametro_fuera_de_rango(self, base_url):
        estado, datos = _post(base_url, "/api/simular", dict(CONFIG_VALIDA, prob_ocupacion=1.5))
        assert estado == 400
        assert "error" in datos

    def test_parametro_desconocido(self, base_url):
        estado, datos = _post(base_url, "/api/simular", dict(CONFIG_VALIDA, inventado=1))
        assert estado == 400
        assert "desconocidos" in datos["error"]

    def test_tipo_incorrecto(self, base_url):
        estado, datos = _post(base_url, "/api/simular", dict(CONFIG_VALIDA, capacidad_autobus="muchos"))
        assert estado == 400
        assert "error" in datos

    def test_json_invalido(self, base_url):
        estado, datos = _post_crudo(base_url, "/api/simular", b"{no es json")
        assert estado == 400
        assert "JSON" in datos["error"]

    def test_cuerpo_no_objeto(self, base_url):
        estado, datos = _post_crudo(base_url, "/api/simular", b"[1, 2, 3]")
        assert estado == 400

    def test_semilla_invalida(self, base_url):
        estado, datos = _post(base_url, "/api/simular", dict(CONFIG_VALIDA, semilla="abc"))
        assert estado == 400

    def test_series_completas(self, base_url):
        _, datos = _post(base_url, "/api/simular", CONFIG_VALIDA)
        serie = datos["serie_cola"]
        assert serie[0] == [0.0, 0]
        assert serie[-1][0] == pytest.approx(30.0)
        assert all(t >= 0 and q >= 0 for t, q in serie)
        tiempos = [p[0] for p in serie]
        assert all(a <= b + 1e-9 for a, b in zip(tiempos, tiempos[1:]))


class TestReplicas:
    def test_resumen_replicas(self, base_url):
        estado, datos = _post(base_url, "/api/replicas", CONFIG_VALIDA)
        assert estado == 200
        assert datos["num_repeticiones"] == 5
        metricas = datos["metricas"]
        assert "espera_media" in metricas
        assert "espera_media_std" in metricas
        assert metricas["pasajeros_llegados"] > 0

    def test_replicas_reproducibles(self, base_url):
        _, uno = _post(base_url, "/api/replicas", CONFIG_VALIDA)
        _, dos = _post(base_url, "/api/replicas", CONFIG_VALIDA)
        assert uno == dos

    def test_replicas_limite(self, base_url):
        estado, datos = _post(base_url, "/api/replicas", dict(CONFIG_VALIDA, num_repeticiones=1000))
        assert estado == 400

    def test_replicas_rango(self, base_url):
        estado, datos = _post(base_url, "/api/replicas", dict(CONFIG_VALIDA, num_repeticiones=3))
        assert estado == 200
        assert datos["num_repeticiones"] == 3


class TestComparar:
    def test_payload_comparacion(self, base_url):
        estado, datos = _post(base_url, "/api/comparar", {"num_repeticiones": 2})
        assert estado == 200
        assert set(datos) >= {
            "num_repeticiones",
            "semilla_base",
            "num_casos",
            "rejilla_pasos",
            "casos",
            "catalogo",
        }
        assert datos["num_repeticiones"] == 2
        assert datos["num_casos"] == 3
        assert datos["rejilla_pasos"] == 100
        ids = [caso["id"] for caso in datos["casos"]]
        assert ids == ["estable", "alta_utilizacion", "critico"]
        for caso in datos["casos"]:
            assert len(caso["semillas"]) == 2
            assert caso["semillas"] == [datos["semilla_base"], datos["semilla_base"] + 1]
            assert len(caso["rejilla"]) == 101
            assert len(caso["cola_media"]) == 101
            assert len(caso["llegadas_acumuladas"]) == 101
            assert len(caso["transportados_acumulados"]) == 101
            assert all(a <= b + 1e-9 for a, b in zip(caso["rejilla"], caso["rejilla"][1:]))

    def test_resumen_metricas(self, base_url):
        _, datos = _post(base_url, "/api/comparar", {"num_repeticiones": 2})
        for caso in datos["casos"]:
            resumen = caso["resumen"]
            assert resumen["pasajeros_llegados"] >= 0
            assert resumen["pasajeros_transportados"] <= resumen["pasajeros_llegados"]
            assert resumen["espera_mediana"] <= resumen["espera_p90"] + 1e-9
            assert resumen["espera_p90"] <= resumen["espera_maxima"] + 1e-9
            assert resumen["pct_transportados"] + resumen["pct_restantes"] == pytest.approx(100.0, abs=0.01)

    def test_reproducible(self, base_url):
        _, uno = _post(base_url, "/api/comparar", {"num_repeticiones": 2})
        _, dos = _post(base_url, "/api/comparar", {"num_repeticiones": 2})
        assert uno == dos

    def test_limite_repeticiones(self, base_url):
        estado, _ = _post(base_url, "/api/comparar", {"num_repeticiones": 1000})
        assert estado == 400

    def test_casos_invalidos(self, base_url):
        estado, _ = _post(base_url, "/api/comparar", {"num_repeticiones": 2, "casos": ["no_existe"]})
        assert estado == 400

    def test_repeticiones_invalidas(self, base_url):
        estado, _ = _post(base_url, "/api/comparar", {"num_repeticiones": 0})
        assert estado == 400
