"""Pruebas de los eventos enriquecidos que consume la capa de reproducción.

Verifican que cada evento del historial contiene identificadores estables y
los hechos decididos por el motor (quién aborda, capacidad, ocupación), de
forma que el frontend pueda reconstruir el estado sin duplicar la lógica.
"""

import pytest

from models.simulation import SimulationConfig, SimulationEngine


@pytest.fixture()
def resultado():
    cfg = SimulationConfig(
        duracion=30.0, lambda_p=10.0, intervalo_promedio=4.0, capacidad_autobus=15, semilla=2024
    )
    return SimulationEngine(cfg, semilla=2024).ejecutar()


def test_eventos_pasajero_tienen_id_y_contador(resultado):
    pasajeros = [ev for ev in resultado.historial_eventos if ev["tipo"] == "pasajero"]
    assert pasajeros, "Debe haber llegadas de pasajeros"
    ids = [ev["pasajero_id"] for ev in pasajeros]
    assert len(set(ids)) == len(ids), "Los identificadores de pasajero son únicos"
    assert ids == sorted(ids), "Los identificadores crecen con el tiempo"
    for posicion, ev in enumerate(pasajeros, start=1):
        assert ev["llegados"] == posicion


def test_eventos_autobus_tienen_id_y_capacidad(resultado):
    autobuses = [ev for ev in resultado.historial_eventos if ev["tipo"] == "autobus"]
    assert autobuses, "Debe haber llegadas de autobuses"
    ids = [ev["autobus_id"] for ev in autobuses]
    assert len(set(ids)) == len(ids)
    for ev in autobuses:
        assert ev["capacidad"] == 15
        assert 0 <= ev["asientos_libres"] <= ev["capacidad"]
        assert ev["asientos_ocupados_al_llegar"] == ev["capacidad"] - ev["asientos_libres"]
        assert 0 <= ev["abordados"] <= ev["asientos_libres"]
        assert ev["abordados"] <= ev["cola_antes"]
        assert len(ev["pasajeros_abordados_ids"]) == ev["abordados"]


def test_abordados_son_los_primeros_de_la_cola_FIFO(resultado):
    cola = []
    for ev in resultado.historial_eventos:
        if ev["tipo"] == "pasajero":
            cola.append(ev["pasajero_id"])
        else:
            esperados = cola[: ev["abordados"]]
            assert ev["pasajeros_abordados_ids"] == esperados
            cola = cola[ev["abordados"] :]
            assert len(cola) == ev["cola"]


def test_un_pasajero_no_aborda_dos_veces(resultado):
    abordados = []
    for ev in resultado.historial_eventos:
        if ev["tipo"] == "autobus":
            abordados.extend(ev["pasajeros_abordados_ids"])
    assert len(abordados) == len(set(abordados))
    assert len(abordados) == resultado.pasajeros_transportados_total


def test_transportados_acumulado_coincide(resultado):
    total = 0
    for ev in resultado.historial_eventos:
        if ev["tipo"] == "autobus":
            total += ev["abordados"]
            assert ev["transportados"] == total
    assert total == resultado.pasajeros_transportados_total


def test_cola_nunca_negativa_en_eventos(resultado):
    for ev in resultado.historial_eventos:
        assert ev["cola"] >= 0
        if ev["tipo"] == "autobus":
            assert ev["cola_antes"] >= 0


def test_espera_maxima_propiedad(resultado):
    esperas = resultado.tiempos_espera_abordados
    if esperas:
        assert resultado.espera_maxima_abordados == pytest.approx(max(esperas))
    else:
        assert resultado.espera_maxima_abordados == 0.0


def test_eventos_ordenados_en_el_tiempo(resultado):
    tiempos = [ev["tiempo"] for ev in resultado.historial_eventos]
    assert all(a <= b + 1e-9 for a, b in zip(tiempos, tiempos[1:]))


def test_abordaje_parcial_y_total():
    cfg = SimulationConfig(
        duracion=40.0, lambda_p=30.0, intervalo_promedio=20.0, capacidad_autobus=3, prob_ocupacion=0.0, semilla=7
    )
    res = SimulationEngine(cfg, semilla=7).ejecutar()
    autobuses = [ev for ev in res.historial_eventos if ev["tipo"] == "autobus"]
    assert autobuses
    for ev in autobuses:
        assert ev["abordados"] == min(ev["cola_antes"], 3)
    assert res.pasajeros_restantes_cola > 0


def test_autobuses_sin_asientos_libres():
    cfg = SimulationConfig(
        duracion=30.0, lambda_p=5.0, intervalo_promedio=5.0, capacidad_autobus=10, prob_ocupacion=1.0, semilla=3
    )
    res = SimulationEngine(cfg, semilla=3).ejecutar()
    autobuses = [ev for ev in res.historial_eventos if ev["tipo"] == "autobus"]
    assert autobuses
    assert all(ev["asientos_libres"] == 0 for ev in autobuses)
    assert all(ev["abordados"] == 0 for ev in autobuses)
    assert res.autobuses_sin_asientos_libres == len(autobuses)


def test_alta_demanda_mantiene_invariantes():
    cfg = SimulationConfig(
        duracion=60.0, lambda_p=60.0, intervalo_promedio=15.0, capacidad_autobus=40, semilla=11
    )
    res = SimulationEngine(cfg, semilla=11).ejecutar()
    assert res.balance_pasajeros() == 0
    assert res.pasajeros_restantes_cola > 0
    cola = 0
    for ev in res.historial_eventos:
        if ev["tipo"] == "pasajero":
            cola += 1
        else:
            cola -= ev["abordados"]
        assert cola == ev["cola"]
        assert cola >= 0


def test_baja_demanda_sin_cola():
    cfg = SimulationConfig(
        duracion=60.0, lambda_p=0.5, intervalo_promedio=5.0, capacidad_autobus=20, semilla=5
    )
    res = SimulationEngine(cfg, semilla=5).ejecutar()
    assert res.pasajeros_restantes_cola == 0
    assert res.pasajeros_transportados_total == res.pasajeros_llegados_total


def test_reproducibilidad_de_eventos():
    cfg = SimulationConfig(duracion=25.0, lambda_p=8.0, intervalo_promedio=6.0, semilla=99)
    res1 = SimulationEngine(cfg, semilla=99).ejecutar()
    res2 = SimulationEngine(cfg, semilla=99).ejecutar()
    assert res1.historial_eventos == res2.historial_eventos
