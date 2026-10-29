"""Pruebas del umbral operativo de cola (Qmáx) y de la saturación operativa.

Casos cubiertos (según la especificación del proyecto):
- F: el límite operativo es un parámetro del modelo y se valida.
- G: el motor registra el instante de saturación y el tiempo en saturación.
- H: la cola real del modelo nunca se recorta al superar el límite visual.
- I: la API expone el límite, la clasificación y el estado operativo.
"""

import json
import threading
import urllib.error
import urllib.request

import pytest

from models.simulation import SimulationConfig, SimulationEngine
from server.app import crear_servidor


# ---------------------------------------------------------------------------
# Caso F: el límite operativo es un parámetro validado
# ---------------------------------------------------------------------------


def test_caso_f_el_limite_operativo_forma_parte_de_la_configuracion():
    config = SimulationConfig()
    assert config.limite_cola == 150
    assert config.parametros()["limite_cola"] == 150 if hasattr(config, "parametros") else True


def test_caso_f_el_limite_operativo_se_puede_configurar():
    config = SimulationConfig(limite_cola=120)
    config.validar()
    assert config.limite_cola == 120


def test_caso_f_un_limite_no_positivo_se_rechaza():
    with pytest.raises(ValueError):
        SimulationConfig(limite_cola=0).validar()
    with pytest.raises(ValueError):
        SimulationConfig(limite_cola=-10).validar()


def test_caso_f_el_limite_operativo_no_altera_la_matematica_del_modelo():
    # Mismo modelo, distinto umbral: los resultados estadisticos no cambian.
    base = dict(lambda_p=0.6, intervalo_promedio=12.0, duracion=120.0, semilla=7)
    con_umbral_alto = SimulationEngine(SimulationConfig(limite_cola=150, **base)).ejecutar()
    con_umbral_bajo = SimulationEngine(SimulationConfig(limite_cola=10, **base)).ejecutar()
    assert con_umbral_alto.cola_maxima == con_umbral_bajo.cola_maxima
    assert con_umbral_alto.pasajeros_llegados_total == con_umbral_bajo.pasajeros_llegados_total
    assert con_umbral_alto.pasajeros_transportados_total == con_umbral_bajo.pasajeros_transportados_total
    assert con_umbral_alto.cola_media_temporal == pytest.approx(con_umbral_bajo.cola_media_temporal)


# ---------------------------------------------------------------------------
# Caso G: seguimiento de la saturación operativa
# ---------------------------------------------------------------------------


def test_caso_g_un_sistema_estable_no_alcanza_la_saturacion_operativa():
    config = SimulationConfig(lambda_p=0.6, intervalo_promedio=12.0, duracion=120.0, semilla=11)
    resultado = SimulationEngine(config).ejecutar()
    assert resultado.tiempo_saturacion_operativa is None
    assert resultado.minutos_en_saturacion == 0
    assert resultado.limite_cola == 150


def test_caso_g_la_saturacion_operativa_se_registra_con_su_instante():
    config = SimulationConfig(
        lambda_p=2.4, intervalo_promedio=12.0, duracion=150.0, semilla=20260921, limite_cola=150
    )
    resultado = SimulationEngine(config).ejecutar()
    assert resultado.tiempo_saturacion_operativa is not None
    assert 0 < resultado.tiempo_saturacion_operativa <= config.duracion
    assert resultado.minutos_en_saturacion > 0
    # El tiempo en saturación no puede exceder la duración simulada.
    assert resultado.minutos_en_saturacion <= config.duracion


def test_caso_g_el_instante_de_saturacion_coincide_con_la_serie_de_cola():
    config = SimulationConfig(
        lambda_p=2.4, intervalo_promedio=12.0, duracion=150.0, semilla=20260921, limite_cola=150
    )
    resultado = SimulationEngine(config).ejecutar()
    instante = resultado.tiempo_saturacion_operativa
    cola_en_instante = [q for t, q in resultado.serie_tiempo_cola if t <= instante + 1e-9]
    assert max(cola_en_instante) >= config.limite_cola
    # Justo antes del instante la cola todavía no había alcanzado el umbral.
    cola_antes = [q for t, q in resultado.serie_tiempo_cola if t < instante - 1e-9]
    assert not cola_antes or max(cola_antes) < config.limite_cola


def test_caso_g_un_umbral_mayor_que_la_cola_maxima_no_saturo_nunca():
    config = SimulationConfig(lambda_p=0.6, intervalo_promedio=12.0, duracion=120.0, semilla=11)
    resultado = SimulationEngine(config).ejecutar()
    config.limite_cola = resultado.cola_maxima + 1
    otro = SimulationEngine(config).ejecutar()
    assert otro.tiempo_saturacion_operativa is None
    assert otro.minutos_en_saturacion == 0


# ---------------------------------------------------------------------------
# Caso H: la cola real nunca se recorta
# ---------------------------------------------------------------------------


def test_caso_h_la_cola_del_modelo_supera_el_limite_sin_recortarse():
    config = SimulationConfig(
        lambda_p=6.0, intervalo_promedio=10.0, duracion=120.0, semilla=3, limite_cola=150
    )
    resultado = SimulationEngine(config).ejecutar()
    assert resultado.cola_maxima > 150
    assert resultado.pasajeros_restantes_cola > 0
    # El balance de pasajeros se mantiene: nada se ha descartado.
    assert resultado.balance_pasajeros() == 0


def test_caso_h_la_serie_de_cola_conserva_los_valores_por_encima_del_limite():
    config = SimulationConfig(
        lambda_p=6.0, intervalo_promedio=10.0, duracion=120.0, semilla=3, limite_cola=150
    )
    resultado = SimulationEngine(config).ejecutar()
    assert max(q for _, q in resultado.serie_tiempo_cola) == resultado.cola_maxima
    assert resultado.cola_maxima > config.limite_cola


# ---------------------------------------------------------------------------
# Caso I: la API expone la información de saturación
# ---------------------------------------------------------------------------


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
        return resp.status, json.loads(resp.read().decode("utf-8"))


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


def test_caso_i_los_parametros_publican_el_limite_y_el_catalogo(base_url):
    estado, cuerpo = _get(base_url + "/api/parametros")
    assert estado == 200
    assert "limite_cola" in cuerpo["parametros"]
    assert cuerpo["parametros"]["limite_cola"]["defecto"] == 150
    assert cuerpo["parametros"]["limite_cola"]["max"] == 150
    assert len(cuerpo["escenarios"]) >= 4
    assert cuerpo["escenario_inicial"]
    assert cuerpo["clasificador"]["umbral_alta_utilizacion"] == 0.8
    assert cuerpo["clasificador"]["tolerancia_critico"] > 0


def test_caso_i_el_endpoint_de_escenarios_devuelve_el_catalogo(base_url):
    estado, cuerpo = _get(base_url + "/api/escenarios")
    assert estado == 200
    assert len(cuerpo["escenarios"]) >= 4
    for escenario in cuerpo["escenarios"]:
        assert escenario["id"]
        assert escenario["condicion"]
        assert "rho" in escenario


def test_caso_i_la_ejecucion_publica_clasificacion_y_estado_operativo(base_url):
    estado, cuerpo = _post(
        base_url,
        "/api/simular",
        {
            "lambda_p": 0.6,
            "intervalo_promedio": 12.0,
            "capacidad_autobus": 40,
            "prob_ocupacion": 0.7,
            "duracion": 120.0,
            "semilla": 20260921,
            "limite_cola": 150,
        },
    )
    assert estado == 200
    assert cuerpo["estado"]["estado"] == "estable"
    assert cuerpo["estado"]["rho"] == pytest.approx(0.6, abs=1e-9)
    assert cuerpo["estado"]["mu"] == pytest.approx(1.0, abs=1e-9)
    assert cuerpo["config"]["limite_cola"] == 150
    assert cuerpo["resultados"]["limite_cola"] == 150
    assert cuerpo["resultados"]["tiempo_saturacion_operativa"] is None
    assert cuerpo["resultados"]["minutos_en_saturacion"] == 0
    assert cuerpo["estado_operativo"]["limite_cola"] == 150
    assert cuerpo["estado_operativo"]["saturado"] is False
    assert cuerpo["metricas_teoricas"]["capacidad_efectiva"] == pytest.approx(12.0, abs=1e-9)


def test_caso_i_la_sobrecarga_matematica_se_publica_en_la_api(base_url):
    estado, cuerpo = _post(
        base_url,
        "/api/simular",
        {
            "lambda_p": 2.4,
            "intervalo_promedio": 12.0,
            "capacidad_autobus": 40,
            "prob_ocupacion": 0.7,
            "duracion": 150.0,
            "semilla": 20260921,
            "limite_cola": 150,
        },
    )
    assert estado == 200
    assert cuerpo["estado"]["estado"] == "sobrecargado"
    assert cuerpo["estado"]["es_sobrecarga_matematica"] is True
    assert cuerpo["resultados"]["cola_maxima"] >= 150
    assert cuerpo["resultados"]["tiempo_saturacion_operativa"] is not None
    assert cuerpo["estado_operativo"]["saturado"] is True


def test_caso_i_un_limite_operativo_fuera_de_rango_se_rechaza(base_url):
    estado, cuerpo = _post(
        base_url,
        "/api/simular",
        {
            "lambda_p": 1.0,
            "intervalo_promedio": 12.0,
            "capacidad_autobus": 40,
            "prob_ocupacion": 0.7,
            "duracion": 60.0,
            "limite_cola": 500,
        },
    )
    assert estado == 400
    assert "limite_cola" in json.dumps(cuerpo)
