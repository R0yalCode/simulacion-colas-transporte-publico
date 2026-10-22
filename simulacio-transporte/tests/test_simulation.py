"""Pruebas del modelo: generadores, cola, motor y métricas."""

import numpy as np
import pytest

from models.simulation import (
    EventType,
    Passenger,
    PassengerQueue,
    RandomGenerator,
    SimulationConfig,
    SimulationEngine,
    comparar_escenarios,
    escenarios_predeterminados,
    resumen_metricas,
)


class TestRandomGenerator:
    def test_exponencial_media(self):
        rng = RandomGenerator(semilla=123)
        muestras = rng.exponencial(6.0, size=10000)
        assert abs(float(np.mean(muestras)) - 1.0 / 6.0) < 0.02

    def test_poisson_media(self):
        rng = RandomGenerator(semilla=123)
        muestras = rng.poisson(3.0, size=10000)
        assert abs(float(np.mean(muestras)) - 3.0) < 0.05

    def test_binomial_media_varianza(self):
        rng = RandomGenerator(semilla=123)
        muestras = rng.binomial(40, 0.3, size=10000)
        assert abs(float(np.mean(muestras)) - 12.0) < 0.5
        assert abs(float(np.var(muestras)) - 40 * 0.3 * 0.7) < 1.0

    def test_gamma_media(self):
        rng = RandomGenerator(semilla=123)
        h, c = 10.0, 0.3
        muestras = rng.gamma(1.0 / (c * c), h * c * c, size=10000)
        assert abs(float(np.mean(muestras)) - h) < 0.1

    def test_reproducibilidad(self):
        m1 = RandomGenerator(semilla=42).exponencial(1.0, size=5)
        m2 = RandomGenerator(semilla=42).exponencial(1.0, size=5)
        np.testing.assert_array_almost_equal(m1, m2)


class TestPassengerQueue:
    def test_fifo_order(self):
        cola = PassengerQueue()
        pasajeros = [Passenger(id=i, tiempo_llegada=float(i)) for i in range(3)]
        for pasajero in pasajeros:
            cola.agregar_pasajero(pasajero)
        assert [cola.quitar_pasajero() for _ in range(3)] == pasajeros

    def test_tamano(self):
        cola = PassengerQueue()
        assert cola.esta_vacia()
        cola.agregar_pasajero(Passenger(id=1, tiempo_llegada=0.0))
        assert not cola.esta_vacia()
        assert cola.tamano() == 1


class TestEngine:
    def test_reproducibilidad_semilla(self):
        cfg = SimulationConfig(duracion=10.0, lambda_p=5.0, intervalo_promedio=5.0)
        res1 = SimulationEngine(cfg, semilla=42).ejecutar()
        res2 = SimulationEngine(cfg, semilla=42).ejecutar()
        assert res1.pasajeros_llegados_total == res2.pasajeros_llegados_total
        assert res1.pasajeros_transportados_total == res2.pasajeros_transportados_total
        assert res1.espera_media_abordados == res2.espera_media_abordados

    def test_mismo_motor_reutilizable(self):
        cfg = SimulationConfig(duracion=15.0, lambda_p=4.0, semilla=7)
        engine = SimulationEngine(cfg)
        res1 = engine.ejecutar()
        res2 = engine.ejecutar()
        assert res1.pasajeros_llegados_total == res2.pasajeros_llegados_total
        assert res1.pasajeros_transportados_total == res2.pasajeros_transportados_total

    def test_balance_pasajeros(self):
        cfg = SimulationConfig(duracion=20.0, lambda_p=3.0, intervalo_promedio=5.0)
        res = SimulationEngine(cfg, semilla=123).ejecutar()
        assert res.balance_pasajeros() == 0

    def test_balance_con_cola_inicial(self):
        cfg = SimulationConfig(duracion=20.0, lambda_p=3.0, intervalo_promedio=5.0, cola_inicial=7)
        res = SimulationEngine(cfg, semilla=123).ejecutar()
        assert res.cola_inicial == 7
        assert res.balance_pasajeros() == 0

    def test_horizonte(self):
        cfg = SimulationConfig(duracion=5.0, lambda_p=10.0, intervalo_promedio=10.0)
        res = SimulationEngine(cfg, semilla=123).ejecutar()
        assert all(evento["tiempo"] <= res.tiempo_final + 1e-9 for evento in res.historial_eventos)

    def test_capacidad_limites(self):
        cfg = SimulationConfig(duracion=5.0, capacidad_autobus=10, prob_ocupacion=1.0)
        res = SimulationEngine(cfg, semilla=123).ejecutar()
        assert res.asientos_libres_promedio <= 10.0

    def test_ocupacion_cero(self):
        cfg = SimulationConfig(duracion=10.0, lambda_p=5.0, capacidad_autobus=5, prob_ocupacion=0.0)
        res = SimulationEngine(cfg, semilla=123).ejecutar()
        assert abs(res.asientos_libres_promedio - 5.0) < 1e-6

    def test_ocupacion_uno(self):
        cfg = SimulationConfig(duracion=10.0, lambda_p=2.0, capacidad_autobus=5, prob_ocupacion=1.0)
        res = SimulationEngine(cfg, semilla=123).ejecutar()
        assert abs(res.asientos_libres_promedio) < 1e-6

    def test_metricas_cola_vacia(self):
        cfg = SimulationConfig(duracion=5.0, lambda_p=0.0, intervalo_promedio=1.0)
        res = SimulationEngine(cfg, semilla=123).ejecutar()
        assert res.pasajeros_llegados_total == 0
        assert res.cola_media_temporal >= 0
        assert res.tiempos_espera_abordados == []

    def test_desempate_pasajero_antes_que_autobus(self):
        assert EventType.LLEGADA_PASAJERO.value < EventType.LLEGADA_AUTOBUS.value

    def test_espera_censurada_no_es_completa(self):
        cfg = SimulationConfig(duracion=30.0, lambda_p=20.0, intervalo_promedio=30.0, capacidad_autobus=2, prob_ocupacion=0.5)
        res = SimulationEngine(cfg, semilla=1).ejecutar()
        assert res.pasajeros_restantes_cola > 0
        assert len(res.tiempos_espera_restantes) == res.pasajeros_restantes_cola


class TestMetricas:
    def test_resumen_metricas(self):
        cfg = SimulationConfig(duracion=10.0, lambda_p=2.0, intervalo_promedio=5.0)
        resultados = [SimulationEngine(cfg, semilla=s).ejecutar() for s in (1, 2, 3)]
        resumen = resumen_metricas(resultados)
        assert "espera_media" in resumen
        assert "cola_maxima" in resumen

    def test_comparar_escenarios(self):
        base = SimulationConfig(duracion=10.0, lambda_p=3.0, intervalo_promedio=5.0)
        filas = comparar_escenarios(escenarios_predeterminados(base), num_repeticiones=2)
        assert len(filas) == 5
        assert filas[0]["escenario"] == "Base"
        assert all("espera_media" in fila for fila in filas)


class TestConfig:
    def test_validacion(self):
        with pytest.raises(ValueError):
            SimulationConfig(lambda_p=-1.0).validar()
        with pytest.raises(ValueError):
            SimulationConfig(prob_ocupacion=1.5).validar()

    def test_indicador_carga(self):
        cfg = SimulationConfig()
        assert abs(cfg.mu_efectiva - 1.2) < 1e-9
        assert abs(cfg.rho_estrella - 5.0) < 1e-9
