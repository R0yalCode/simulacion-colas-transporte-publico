"""Modelo matemático de la simulación estocástica de una parada de transporte público.

Reúne los parámetros, las entidades, los generadores aleatorios, la cola FIFO,
el motor de eventos discretos, los resultados y las funciones de análisis.
Todo el cálculo es independiente de la presentación (vista).
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field, replace
from enum import Enum
from typing import Deque, Dict, List, Optional, Tuple

import heapq
import statistics

import numpy as np


@dataclass(slots=True)
class SimulationConfig:
    """Parámetros configurables de la simulación."""

    lambda_p: float = 6.0
    intervalo_promedio: float = 10.0
    coef_variacion: float = 0.30
    capacidad_autobus: int = 40
    prob_ocupacion: float = 0.70
    duracion: float = 120.0
    semilla: Optional[int] = None
    cola_inicial: int = 0
    primer_autobus_aleatorio: bool = True
    num_repeticiones: int = 30

    def validar(self) -> None:
        """Valida los parámetros de configuración."""
        if self.lambda_p < 0:
            raise ValueError("La tasa de llegada (lambda_p) no puede ser negativa.")
        if self.intervalo_promedio <= 0:
            raise ValueError("El intervalo promedio entre autobuses debe ser positivo.")
        if self.coef_variacion <= 0:
            raise ValueError("El coeficiente de variación debe ser positivo.")
        if self.capacidad_autobus <= 0:
            raise ValueError("La capacidad del autobús debe ser positiva.")
        if not 0.0 <= self.prob_ocupacion <= 1.0:
            raise ValueError("La probabilidad de ocupación debe estar entre 0 y 1.")
        if self.duracion <= 0:
            raise ValueError("La duración de la simulación debe ser positiva.")
        if self.cola_inicial < 0:
            raise ValueError("La cola inicial no puede ser negativa.")
        if self.num_repeticiones <= 0:
            raise ValueError("El número de repeticiones debe ser positivo.")

    @property
    def alpha_gamma(self) -> float:
        """Parámetro de forma Gamma (α = 1/c²)."""
        if self.coef_variacion <= 0:
            return float("inf")
        return 1.0 / (self.coef_variacion ** 2)

    @property
    def theta_gamma(self) -> float:
        """Parámetro de escala Gamma (θ = h·c²)."""
        return self.intervalo_promedio * (self.coef_variacion ** 2)

    @property
    def asientos_libres_esperados(self) -> float:
        """Asientos libres esperados por autobús."""
        return self.capacidad_autobus * (1.0 - self.prob_ocupacion)

    @property
    def mu_efectiva(self) -> float:
        """Capacidad media de transporte por minuto (pasajeros/minuto)."""
        if self.intervalo_promedio <= 0:
            return 0.0
        return self.asientos_libres_esperados / self.intervalo_promedio

    @property
    def rho_estrella(self) -> float:
        """Indicador aproximado de carga ρ* = λ / μ_efectiva."""
        mu = self.mu_efectiva
        if mu <= 0:
            return float("inf") if self.lambda_p > 0 else 0.0
        return self.lambda_p / mu

    def clonar(self, **cambios) -> "SimulationConfig":
        """Devuelve una copia de la configuración con los cambios indicados."""
        return replace(self, **cambios)


@dataclass(slots=True)
class Passenger:
    """Pasajero que llega a la parada."""

    id: int
    tiempo_llegada: float
    tiempo_abordaje: Optional[float] = None
    abordo: bool = False

    @property
    def tiempo_espera(self) -> Optional[float]:
        """Tiempo de espera si el pasajero ya abordó; None si sigue esperando."""
        if self.abordo and self.tiempo_abordaje is not None:
            return max(0.0, self.tiempo_abordaje - self.tiempo_llegada)
        return None


@dataclass(slots=True)
class Bus:
    """Autobús que llega a la parada."""

    id: int
    tiempo_llegada: float
    capacidad_total: int
    asientos_libres: int
    pasajeros_abordados: int = 0

    @property
    def completo(self) -> bool:
        """Indica si el autobús quedó sin asientos libres (todos ocupados)."""
        return self.asientos_libres <= 0 or self.pasajeros_abordados >= self.asientos_libres


class PassengerQueue:
    """Cola FIFO de pasajeros basada en collections.deque."""

    def __init__(self) -> None:
        self._queue: Deque[Passenger] = deque()

    def agregar_pasajero(self, pasajero: Passenger) -> None:
        """Agrega un pasajero al final de la cola."""
        self._queue.append(pasajero)

    def quitar_pasajero(self) -> Optional[Passenger]:
        """Extrae y devuelve el pasajero al frente de la cola."""
        if self._queue:
            return self._queue.popleft()
        return None

    def esta_vacia(self) -> bool:
        """Indica si la cola está vacía."""
        return not self._queue

    def tamano(self) -> int:
        """Número de pasajeros en cola."""
        return len(self._queue)

    def listar_pasajeros(self) -> List[Passenger]:
        """Copia de los pasajeros en cola, en orden FIFO."""
        return list(self._queue)

    def __len__(self) -> int:
        return len(self._queue)


class RandomGenerator:
    """Generador de números aleatorios reproducible (numpy.random.Generator)."""

    def __init__(self, semilla: Optional[int] = None) -> None:
        self.semilla = semilla
        self.rng = np.random.default_rng(semilla)

    def exponencial(self, tasa: float, size: int = 1) -> np.ndarray:
        """Muestras Exponencial con media 1/tasa."""
        if tasa <= 0:
            raise ValueError("La tasa debe ser positiva.")
        return self.rng.exponential(scale=1.0 / tasa, size=size)

    def gamma(self, shape: float, scale: float, size: int = 1) -> np.ndarray:
        """Muestras Gamma con parametrización forma/escala."""
        if shape <= 0 or scale <= 0:
            raise ValueError("Shape y scale deben ser positivos.")
        return self.rng.gamma(shape=shape, scale=scale, size=size)

    def poisson(self, lam: float, size: int = 1) -> np.ndarray:
        """Muestras Poisson de media lam."""
        if lam < 0:
            raise ValueError("Lambda no puede ser negativo.")
        return self.rng.poisson(lam=lam, size=size)

    def binomial(self, n: int, p: float, size: int = 1) -> np.ndarray:
        """Muestras Binomial(n, p)."""
        if n < 0:
            raise ValueError("n no puede ser negativo.")
        if not 0.0 <= p <= 1.0:
            raise ValueError("p debe estar entre 0 y 1.")
        return self.rng.binomial(n=n, p=p, size=size)


class EventType(Enum):
    """Tipos de evento. El valor define la prioridad de desempate."""

    LLEGADA_PASAJERO = 0
    LLEGADA_AUTOBUS = 1


@dataclass
class SimulationResults:
    """Resultados de una ejecución de la simulación."""

    parametros: Dict[str, float] = field(default_factory=dict)
    semilla: Optional[int] = None
    cola_inicial: int = 0
    pasajeros_llegados_total: int = 0
    autobuses_llegados_total: int = 0
    pasajeros_transportados_total: int = 0
    pasajeros_restantes_cola: int = 0
    cola_maxima: int = 0
    cola_media_temporal: float = 0.0
    autobuses_sin_asientos_libres: int = 0
    suma_asientos_libres: int = 0
    num_autobuses_registrados: int = 0
    tiempos_espera_abordados: List[float] = field(default_factory=list)
    tiempos_espera_restantes: List[float] = field(default_factory=list)
    serie_tiempo_cola: List[Tuple[float, int]] = field(default_factory=list)
    historial_eventos: List[Dict] = field(default_factory=list)
    tiempo_final: float = 0.0

    @property
    def espera_media_abordados(self) -> float:
        if not self.tiempos_espera_abordados:
            return 0.0
        return float(np.mean(self.tiempos_espera_abordados))

    @property
    def espera_mediana_abordados(self) -> float:
        if not self.tiempos_espera_abordados:
            return 0.0
        return float(statistics.median(self.tiempos_espera_abordados))

    @property
    def espera_p90(self) -> float:
        if not self.tiempos_espera_abordados:
            return 0.0
        return float(np.percentile(self.tiempos_espera_abordados, 90))

    @property
    def espera_p95(self) -> float:
        if not self.tiempos_espera_abordados:
            return 0.0
        return float(np.percentile(self.tiempos_espera_abordados, 95))

    @property
    def espera_maxima_abordados(self) -> float:
        """Espera máxima observada entre los pasajeros que abordaron."""
        if not self.tiempos_espera_abordados:
            return 0.0
        return float(max(self.tiempos_espera_abordados))

    @property
    def asientos_libres_promedio(self) -> float:
        if self.num_autobuses_registrados == 0:
            return 0.0
        return self.suma_asientos_libres / self.num_autobuses_registrados

    @property
    def autobuses_sin_asientos_libres_pct(self) -> float:
        if self.num_autobuses_registrados == 0:
            return 0.0
        return 100.0 * self.autobuses_sin_asientos_libres / self.num_autobuses_registrados

    def balance_pasajeros(self) -> int:
        """Diferencia del balance: debe ser 0.

        llegados + cola_inicial = transportados + restantes.
        """
        return (
            self.pasajeros_llegados_total
            + self.cola_inicial
            - self.pasajeros_transportados_total
            - self.pasajeros_restantes_cola
        )


class SimulationEngine:
    """Motor de simulación de eventos discretos.

    El mismo motor se usa para el modo animado y el modo acelerado; la
    presentación se realiza posteriormente a partir de los resultados.
    """

    def __init__(self, config: SimulationConfig, semilla: Optional[int] = None) -> None:
        config.validar()
        self.config = config
        self.semilla = config.semilla if semilla is None else semilla

    def _programar(self, tiempo: float, tipo: EventType) -> None:
        self._secuencia += 1
        heapq.heappush(self._heap, (tiempo, tipo.value, self._secuencia, tipo))

    def _programar_llegada_pasajero(self, desde: float) -> None:
        if self.config.lambda_p <= 0:
            return
        dt = float(self._rng.exponencial(self.config.lambda_p, 1)[0])
        tiempo = desde + max(0.0, dt)
        if tiempo <= self.config.duracion + 1e-9:
            self._programar(tiempo, EventType.LLEGADA_PASAJERO)

    def _programar_llegada_autobus(self, desde: float) -> None:
        if self.config.intervalo_promedio <= 0:
            return
        alpha, theta = self.config.alpha_gamma, self.config.theta_gamma
        if alpha > 0 and theta > 0:
            dt = float(self._rng.gamma(alpha, theta, 1)[0])
        else:
            dt = self.config.intervalo_promedio
        tiempo = desde + max(0.0, dt)
        if tiempo <= self.config.duracion + 1e-9:
            self._programar(tiempo, EventType.LLEGADA_AUTOBUS)

    def _registrar(self, tiempo: float, tamano: int) -> None:
        dt = tiempo - self._ultimo_tiempo
        if dt > 0:
            self._area_cola += self._ultima_cola * dt
            self._ultimo_tiempo = tiempo
        self._ultima_cola = tamano
        self._res.serie_tiempo_cola.append((tiempo, tamano))
        if tamano > self._res.cola_maxima:
            self._res.cola_maxima = tamano

    def _procesar_llegada_pasajero(self, tiempo: float) -> None:
        pasajero = Passenger(id=self._id_pasajero, tiempo_llegada=tiempo)
        self._id_pasajero += 1
        self._cola.agregar_pasajero(pasajero)
        self._res.pasajeros_llegados_total += 1
        self._registrar(tiempo, self._cola.tamano())
        self._res.historial_eventos.append(
            {
                "tipo": "pasajero",
                "tiempo": tiempo,
                "pasajero_id": pasajero.id,
                "llegados": self._res.pasajeros_llegados_total,
                "cola": self._cola.tamano(),
            }
        )
        self._programar_llegada_pasajero(tiempo)

    def _procesar_llegada_autobus(self, tiempo: float) -> None:
        c = self.config.capacidad_autobus
        p_libre = 1.0 - self.config.prob_ocupacion
        asientos_libres = int(self._rng.binomial(c, p_libre, 1)[0])
        asientos_libres = max(0, min(c, asientos_libres))
        cola_antes = self._cola.tamano()
        abordados = min(cola_antes, asientos_libres)
        ids_abordados: List[int] = []
        for _ in range(abordados):
            pasajero = self._cola.quitar_pasajero()
            pasajero.abordo = True
            pasajero.tiempo_abordaje = tiempo
            ids_abordados.append(pasajero.id)
            self._res.tiempos_espera_abordados.append(max(0.0, tiempo - pasajero.tiempo_llegada))
        self._res.pasajeros_transportados_total += abordados
        self._res.autobuses_llegados_total += 1
        self._res.num_autobuses_registrados += 1
        self._res.suma_asientos_libres += asientos_libres
        if asientos_libres == 0:
            self._res.autobuses_sin_asientos_libres += 1
        self._registrar(tiempo, self._cola.tamano())
        self._res.historial_eventos.append(
            {
                "tipo": "autobus",
                "tiempo": tiempo,
                "autobus_id": self._id_autobus,
                "capacidad": c,
                "asientos_libres": asientos_libres,
                "asientos_ocupados_al_llegar": c - asientos_libres,
                "cola_antes": cola_antes,
                "abordados": abordados,
                "pasajeros_abordados_ids": ids_abordados,
                "transportados": self._res.pasajeros_transportados_total,
                "cola": self._cola.tamano(),
            }
        )
        self._id_autobus += 1
        self._programar_llegada_autobus(tiempo)

    def ejecutar(self) -> SimulationResults:
        """Ejecuta la simulación completa hasta la duración configurada."""
        cfg = self.config
        cfg.validar()
        self._rng = RandomGenerator(self.semilla)
        self._cola = PassengerQueue()
        self._heap: List[Tuple[float, int, int, EventType]] = []
        self._secuencia = 0
        self._id_pasajero = 0
        self._id_autobus = 0
        self._area_cola = 0.0
        self._ultimo_tiempo = 0.0
        self._ultima_cola = 0
        self._res = SimulationResults(
            parametros={
                "lambda_p": cfg.lambda_p,
                "intervalo_promedio": cfg.intervalo_promedio,
                "coef_variacion": cfg.coef_variacion,
                "capacidad_autobus": cfg.capacidad_autobus,
                "prob_ocupacion": cfg.prob_ocupacion,
                "duracion": cfg.duracion,
                "cola_inicial": cfg.cola_inicial,
            },
            semilla=self.semilla,
            cola_inicial=cfg.cola_inicial,
        )

        for _ in range(cfg.cola_inicial):
            self._cola.agregar_pasajero(Passenger(id=self._id_pasajero, tiempo_llegada=0.0))
            self._id_pasajero += 1
        self._ultima_cola = self._cola.tamano()
        self._registrar(0.0, self._ultima_cola)

        self._programar_llegada_pasajero(0.0)
        if cfg.primer_autobus_aleatorio:
            self._programar_llegada_autobus(0.0)
        elif cfg.intervalo_promedio <= cfg.duracion + 1e-9:
            self._programar(cfg.intervalo_promedio, EventType.LLEGADA_AUTOBUS)

        duracion = cfg.duracion
        while self._heap:
            tiempo, _, _, tipo = heapq.heappop(self._heap)
            if tiempo > duracion + 1e-9:
                break
            if tipo is EventType.LLEGADA_PASAJERO:
                self._procesar_llegada_pasajero(tiempo)
            else:
                self._procesar_llegada_autobus(tiempo)

        res = self._res
        self._registrar(duracion, self._cola.tamano())
        res.tiempo_final = duracion
        res.pasajeros_restantes_cola = self._cola.tamano()
        for pasajero in self._cola.listar_pasajeros():
            res.tiempos_espera_restantes.append(max(0.0, duracion - pasajero.tiempo_llegada))
        res.cola_media_temporal = self._area_cola / duracion if duracion > 0 else 0.0
        return res


def ejecutar_repeticiones(config: SimulationConfig, num_repeticiones: int, semilla_base: int = 12345) -> List[SimulationResults]:
    """Ejecuta varias repeticiones reproducibles de una configuración."""
    return [
        SimulationEngine(config, semilla=semilla_base + i).ejecutar()
        for i in range(num_repeticiones)
    ]


def resumen_metricas(resultados: List[SimulationResults]) -> Dict[str, float]:
    """Calcula medias de las métricas principales sobre varias repeticiones."""
    if not resultados:
        return {}
    campos = {
        "pasajeros_llegados": lambda r: r.pasajeros_llegados_total,
        "pasajeros_transportados": lambda r: r.pasajeros_transportados_total,
        "pasajeros_restantes": lambda r: r.pasajeros_restantes_cola,
        "cola_maxima": lambda r: r.cola_maxima,
        "cola_media_temporal": lambda r: r.cola_media_temporal,
        "espera_media": lambda r: r.espera_media_abordados,
        "espera_p90": lambda r: r.espera_p90,
        "autobuses_llegados": lambda r: r.autobuses_llegados_total,
        "asientos_libres_promedio": lambda r: r.asientos_libres_promedio,
    }
    resumen: Dict[str, float] = {}
    for clave, extractor in campos.items():
        valores = [float(extractor(r)) for r in resultados]
        resumen[clave] = float(np.mean(valores))
        resumen[f"{clave}_std"] = float(np.std(valores, ddof=1)) if len(valores) > 1 else 0.0
    return resumen


def escenarios_predeterminados(base: SimulationConfig) -> List[Tuple[str, SimulationConfig]]:
    """Escenarios comparables construidos a partir de la configuración base."""
    return [
        ("Base", base),
        ("Mayor frecuencia", base.clonar(intervalo_promedio=6.0)),
        ("Mayor capacidad", base.clonar(capacidad_autobus=60)),
        ("Menor ocupación", base.clonar(prob_ocupacion=0.50)),
        ("Menor demanda", base.clonar(lambda_p=3.0)),
    ]


def comparar_escenarios(
    escenarios: List[Tuple[str, SimulationConfig]],
    num_repeticiones: int,
    semilla_base: int = 12345,
) -> List[Dict[str, float]]:
    """Compara escenarios y devuelve una fila de métricas medias por escenario."""
    filas: List[Dict[str, float]] = []
    for nombre, config in escenarios:
        resultados = ejecutar_repeticiones(config, num_repeticiones, semilla_base)
        fila: Dict[str, float] = {"escenario": nombre}
        fila.update(resumen_metricas(resultados))
        filas.append(fila)
    return filas
