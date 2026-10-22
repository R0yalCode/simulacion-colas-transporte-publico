"""Pruebas del clasificador matemático de saturación y del catálogo de escenarios.

Casos cubiertos (según la especificación del proyecto):
- A: ρ < 1  → estado estable o de alta utilización.
- B: ρ = 1  → estado crítico.
- C: ρ > 1  → estado sobrecargado.
- D: casos límite (λ = 0, μ = 0, valores no finitos).
- E: comportamiento en el borde de la tolerancia crítica.
- K: cada escenario cumple la condición matemática que declara.
"""

import math
import sys

import pytest

from models.simulation import SimulationConfig, SimulationEngine
from models.saturacion import (
    ESCENARIOS,
    LIMITE_VISUAL_MAX,
    TOLERANCIA_CRITICO,
    UMBRAL_ALTA_UTILIZACION,
    EstadoSistema,
    clasificar_operacion,
    clasificar_sistema,
    comprobar_escenarios,
    escenario_por_id,
    escenarios_publicables,
)


# ---------------------------------------------------------------------------
# Caso A: ρ < 1
# ---------------------------------------------------------------------------


def test_caso_a_rho_inferior_a_uno_es_estable():
    info = clasificar_sistema(0.6, 1.0)
    assert info["estado"] == EstadoSistema.ESTABLE.value
    assert info["rho"] == pytest.approx(0.6)
    assert info["es_sobrecarga_matematica"] is False
    assert info["severidad"] == "ok"


def test_caso_a_rho_alto_pero_inferior_a_uno_es_alta_utilizacion():
    info = clasificar_sistema(0.9, 1.0)
    assert info["estado"] == EstadoSistema.ALTA_UTILIZACION.value
    assert info["es_sobrecarga_matematica"] is False
    assert info["severidad"] == "aviso"


def test_caso_a_el_umbral_de_alta_utilizacion_es_inclusivo():
    justo = clasificar_sistema(UMBRAL_ALTA_UTILIZACION, 1.0)
    assert justo["estado"] == EstadoSistema.ALTA_UTILIZACION.value
    debajo = clasificar_sistema(UMBRAL_ALTA_UTILIZACION - 1e-6, 1.0)
    assert debajo["estado"] == EstadoSistema.ESTABLE.value


# ---------------------------------------------------------------------------
# Caso B: ρ = 1
# ---------------------------------------------------------------------------


def test_caso_b_rho_igual_a_uno_es_critico():
    info = clasificar_sistema(1.0, 1.0)
    assert info["estado"] == EstadoSistema.CRITICO.value
    assert info["es_critico"] is True
    assert info["rho"] == pytest.approx(1.0)


def test_caso_b_un_rio_arbitrario_tambien_se_declara_critico():
    info = clasificar_sistema(2.4, 2.4)
    assert info["estado"] == EstadoSistema.CRITICO.value


# ---------------------------------------------------------------------------
# Caso C: ρ > 1
# ---------------------------------------------------------------------------


def test_caso_c_rho_superior_a_uno_es_sobrecargado():
    info = clasificar_sistema(2.4, 1.0)
    assert info["estado"] == EstadoSistema.SOBRECARGADO.value
    assert info["es_sobrecarga_matematica"] is True
    assert info["severidad"] == "alerta"
    assert info["rho"] == pytest.approx(2.4)


def test_caso_c_la_sobrecarga_no_depende_del_umbral_de_alta_utilizacion():
    info = clasificar_sistema(1.2, 1.0, umbral_alta=0.99)
    assert info["estado"] == EstadoSistema.SOBRECARGADO.value


# ---------------------------------------------------------------------------
# Caso D: casos límite
# ---------------------------------------------------------------------------


def test_caso_d_sin_demanda_ni_capacidad_el_sistema_es_inactivo():
    info = clasificar_sistema(0.0, 0.0)
    assert info["estado"] == EstadoSistema.INACTIVO.value
    assert info["rho"] is None
    assert info["severidad"] == "inactivo"


def test_caso_d_demanda_sin_capacidad_es_sin_servicio():
    info = clasificar_sistema(3.0, 0.0)
    assert info["estado"] == EstadoSistema.SIN_SERVICIO.value
    assert info["rho"] is None
    assert info["es_sobrecarga_matematica"] is False


def test_caso_d_sin_demanda_pero_con_capacidad_es_estable():
    info = clasificar_sistema(0.0, 1.0)
    assert info["estado"] == EstadoSistema.ESTABLE.value
    assert info["rho"] == 0.0


def test_caso_d_las_tasas_negativas_se_rechazan():
    with pytest.raises(ValueError):
        clasificar_sistema(-1.0, 1.0)
    with pytest.raises(ValueError):
        clasificar_sistema(1.0, -1.0)


# ---------------------------------------------------------------------------
# Caso E: borde de la tolerancia crítica
# ---------------------------------------------------------------------------


def test_caso_e_justo_por_debajo_de_uno_no_es_sobrecarga():
    info = clasificar_sistema(1.0, 1.0 + 1e-7)
    assert info["rho"] < 1.0
    assert info["estado"] == EstadoSistema.ALTA_UTILIZACION.value
    assert info["es_sobrecarga_matematica"] is False


def test_caso_e_justo_por_encima_de_uno_es_sobrecarga():
    info = clasificar_sistema(1.0 + 1e-7, 1.0)
    assert info["rho"] > 1.0
    assert info["estado"] == EstadoSistema.SOBRECARGADO.value


def test_caso_e_la_tolerancia_declara_critico_un_rho_deliberadamente_cercano():
    info = clasificar_sistema(1.0 + TOLERANCIA_CRITICO / 2, 1.0)
    assert info["estado"] == EstadoSistema.CRITICO.value
    assert info["tolerancia_critico"] == TOLERANCIA_CRITICO


def test_caso_e_la_tolerancia_supera_el_epsilon_del_doble_pero_es_negligible():
    # La tolerancia debe ser deliberadamente mayor que el epsilon del doble
    # (para no depender de la igualdad exacta) y a la vez despreciable frente
    # a cualquier variación apreciable de los parámetros del modelo.
    assert TOLERANCIA_CRITICO > sys.float_info.epsilon
    assert TOLERANCIA_CRITICO < 1e-6


# ---------------------------------------------------------------------------
# Estado operativo (cola real frente a Qmáx)
# ---------------------------------------------------------------------------


def test_el_estado_operativo_es_independiente_de_la_clasificacion_matematica():
    saturado = clasificar_operacion(150, 150)
    assert saturado["saturado"] is True
    assert saturado["excedente"] == 0

    excedido = clasificar_operacion(187, 150)
    assert excedido["saturado"] is True
    assert excedido["excedente"] == 37
    assert excedido["cola"] == 187


def test_el_estado_operativo_con_cola_vacia_no_esta_saturado():
    vacio = clasificar_operacion(0, 150)
    assert vacio["saturado"] is False
    assert vacio["excedente"] == 0


# ---------------------------------------------------------------------------
# Caso K: los escenarios cumplen su condición declarada
# ---------------------------------------------------------------------------


def test_caso_k_el_catalogo_de_escenarios_es_coherente():
    comprobar_escenarios()


def test_caso_k_cada_escenario_declara_su_condicion_y_su_rho():
    for escenario in ESCENARIOS:
        info = escenario.utilizacion()
        assert info["rho"] is not None
        assert escenario.condicion, f"{escenario.id} debe declarar su condición"
        assert escenario.descripcion
        assert escenario.parametros["semilla"] is not None, "los escenarios son reproducibles"


def test_caso_k_los_escenarios_de_claves_producen_los_estados_esperados():
    esperados = {
        "estable": EstadoSistema.ESTABLE.value,
        "alta_utilizacion": EstadoSistema.ALTA_UTILIZACION.value,
        "critico": EstadoSistema.CRITICO.value,
        "sobrecarga": EstadoSistema.SOBRECARGADO.value,
    }
    for escenario in ESCENARIOS:
        assert escenario.utilizacion()["estado"] == esperados[escenario.id]


def test_caso_k_el_escenario_de_sobrecarga_alcanza_el_umbral_operativo():
    escenario = escenario_por_id("sobrecarga")
    config = escenario.config()
    config.duracion = 150.0
    resultado = SimulationEngine(config).ejecutar()
    assert resultado.cola_maxima >= config.limite_cola
    assert resultado.tiempo_saturacion_operativa is not None
    assert resultado.minutos_en_saturacion > 0


def test_caso_k_el_escenario_estable_no_alcanza_el_umbral_operativo():
    escenario = escenario_por_id("estable")
    resultado = SimulationEngine(escenario.config()).ejecutar()
    assert resultado.cola_maxima < resultado.limite_cola
    assert resultado.tiempo_saturacion_operativa is None
    assert resultado.minutos_en_saturacion == 0


def test_caso_k_el_catalogo_publicable_esta_completo():
    catalogo = escenarios_publicables()
    assert len(catalogo) == len(ESCENARIOS)
    for entrada in catalogo:
        assert entrada["id"]
        assert entrada["nombre"]
        assert entrada["estado"] in {estado.value for estado in EstadoSistema}
        assert math.isfinite(entrada["mu"])


def test_el_limite_visual_maximo_es_150():
    assert LIMITE_VISUAL_MAX == 150


# ---------------------------------------------------------------------------
# Caso J: reproducibilidad y balance de pasajeros
# ---------------------------------------------------------------------------


def test_caso_j_la_misma_semilla_reproduce_la_misma_ejecucion():
    config = SimulationConfig(lambda_p=2.4, intervalo_promedio=12.0, duracion=90.0, semilla=20260921)
    primero = SimulationEngine(config).ejecutar()
    segundo = SimulationEngine(config).ejecutar()
    assert primero.cola_maxima == segundo.cola_maxima
    assert primero.pasajeros_llegados_total == segundo.pasajeros_llegados_total
    assert primero.pasajeros_transportados_total == segundo.pasajeros_transportados_total
    assert primero.tiempo_saturacion_operativa == segundo.tiempo_saturacion_operativa


def test_caso_j_el_balance_de_pasajeros_se_conserva():
    for lambda_p in (0.6, 1.0, 2.4, 6.0):
        config = SimulationConfig(
            lambda_p=lambda_p, intervalo_promedio=12.0, duracion=90.0, semilla=5, limite_cola=150
        )
        resultado = SimulationEngine(config).ejecutar()
        assert resultado.balance_pasajeros() == 0, f"descuadre con λ = {lambda_p}"


def test_caso_j_el_clasificador_no_altera_la_ejecucion():
    config = SimulationConfig(lambda_p=2.4, intervalo_promedio=12.0, duracion=90.0, semilla=5)
    resultado = SimulationEngine(config).ejecutar()
    clasificacion = clasificar_sistema(config.lambda_p, config.mu_efectiva)
    assert clasificacion["estado"] == EstadoSistema.SOBRECARGADO.value
    # La clasificación describe la ejecución, no la modifica.
    assert resultado.cola_maxima > 0
