"""Modelo matemático de la simulación estocástica de una parada de transporte público.

Reúne los parámetros, las entidades, los generadores aleatorios, la cola FIFO,
el motor de eventos discretos, los resultados y las funciones de análisis.
Todo el cálculo es independiente de la presentación (vista).
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field, replace
from enum import Enum
from typing import Any, Deque, Dict, List, Optional, Tuple

import heapq
import statistics

import numpy as np

from models.saturacion import clasificar_sistema


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
    limite_cola: int = 150

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
        if self.limite_cola <= 0:
            raise ValueError("El límite operativo de la cola debe ser positivo.")

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
        """Asientos libres esperados por autobús (capacidad efectiva Cₑ)."""
        return self.capacidad_autobus * (1.0 - self.prob_ocupacion)

    @property
    def capacidad_efectiva(self) -> float:
        """Cₑ: capacidad efectiva media para recoger pasajeros en la parada.

        Es el número de asientos que quedan libres al llegar, porque el resto
        ya lo ocupan pasajeros que vienen de paradas anteriores.
        """
        return self.asientos_libres_esperados

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

    def clasificar(self) -> Dict[str, Any]:
        """Clasificación matemática del sistema para esta configuración.

        Delega en `models.saturacion`, que es la fuente de verdad del
        clasificador (tolerancia crítica y umbral de alta utilización).
        """
        return clasificar_sistema(self.lambda_p, self.mu_efectiva)

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
    limite_cola: int = 150
    tiempo_saturacion_operativa: Optional[float] = None
    minutos_en_saturacion: float = 0.0

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
            if self._ultima_cola >= self._limite_cola:
                # Duración acumulada en estado de saturación operativa.
                self._minutos_saturacion += dt
            self._ultimo_tiempo = tiempo
        self._ultima_cola = tamano
        self._res.serie_tiempo_cola.append((tiempo, tamano))
        if tamano > self._res.cola_maxima:
            self._res.cola_maxima = tamano
        if tamano >= self._limite_cola and self._tiempo_saturacion is None:
            # Instante simulado en el que la cola real alcanzó el umbral Qmáx.
            self._tiempo_saturacion = tiempo

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
        esperas_abordados: List[Dict[str, float]] = []
        for _ in range(abordados):
            pasajero = self._cola.quitar_pasajero()
            pasajero.abordo = True
            pasajero.tiempo_abordaje = tiempo
            ids_abordados.append(pasajero.id)
            espera = max(0.0, tiempo - pasajero.tiempo_llegada)
            self._res.tiempos_espera_abordados.append(espera)
            esperas_abordados.append({"tiempo": float(tiempo), "espera": float(espera)})
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
                "esperas_abordados": esperas_abordados,
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
        self._limite_cola = cfg.limite_cola
        self._minutos_saturacion = 0.0
        self._tiempo_saturacion: Optional[float] = None
        self._res = SimulationResults(
            parametros={
                "lambda_p": cfg.lambda_p,
                "intervalo_promedio": cfg.intervalo_promedio,
                "coef_variacion": cfg.coef_variacion,
                "capacidad_autobus": cfg.capacidad_autobus,
                "prob_ocupacion": cfg.prob_ocupacion,
                "duracion": cfg.duracion,
                "cola_inicial": cfg.cola_inicial,
                "limite_cola": cfg.limite_cola,
            },
            semilla=self.semilla,
            cola_inicial=cfg.cola_inicial,
            limite_cola=cfg.limite_cola,
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
        res.tiempo_saturacion_operativa = self._tiempo_saturacion
        res.minutos_en_saturacion = self._minutos_saturacion
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


# ---------------------------------------------------------------------------
# Comparación de los tres casos base
# ---------------------------------------------------------------------------

#: Número de escenarios base que compara el apartado de la interfaz.
NUM_CASOS_BASE = 3

#: Semilla base de las réplicas de comparación: la misma para los tres casos
#: mantiene las condiciones experimentales comparables entre escenarios.
SEMILLA_COMPARACION = 12345


def promedio_series_cola(
    resultados: List[SimulationResults], rejilla: List[float]
) -> List[float]:
    """Cola media de varias réplicas evaluada en los instantes de `rejilla`.

    Usa interpolación escalonada *hacia atrás*: el valor en cada instante es el
    último tamaño de cola registrado (el estado material del sistema). No genera
    valores intermedios ni suaviza artificialmente las series.
    """
    if not resultados or not rejilla:
        return [0.0 for _ in rejilla]
    series = [r.serie_tiempo_cola for r in resultados]
    acumulado = [0.0 for _ in rejilla]
    for serie in series:
        if not serie:
            continue
        cursor = 0
        ultimo = serie[0][1]
        for i, t in enumerate(rejilla):
            while cursor < len(serie) and serie[cursor][0] <= t + 1e-9:
                ultimo = serie[cursor][1]
                cursor += 1
            acumulado[i] += ultimo
    n = float(len(series))
    return [valor / n for valor in acumulado]


def puntos_espera(resultados: List[SimulationResults]) -> List[Tuple[float, float]]:
    """Esperas individuales (tiempo, espera_min) de los pasajeros abordados.

    No incluye a los pasajeros que siguen esperando al final de la ejecución:
    su tiempo de espera no está cerrado y no debe tratarse como definitivo.
    """
    puntos: List[Tuple[float, float]] = []
    for r in resultados:
        for bus in r.historial_eventos:
            if bus.get("tipo") != "autobus":
                continue
            for espera in bus.get("esperas_abordados", []):
                puntos.append((float(espera["tiempo"]), float(espera["espera"])))
    puntos.sort(key=lambda p: p[0])
    return puntos


def espera_percentil(valores: List[float], p: float) -> float:
    """Percentil con interpolación lineal; 0.0 si no hay observaciones."""
    if not valores:
        return 0.0
    return float(np.percentile(valores, p))


def resumen_comparacion(resultados: List[SimulationResults]) -> Dict[str, float]:
    """Métricas medias y agregadas de un escenario sobre varias réplicas."""
    if not resultados:
        return {}
    resumen = resumen_metricas(resultados)
    esperas = [w for r in resultados for w in r.tiempos_espera_abordados]
    resumen["espera_mediana"] = (
        float(statistics.median(esperas)) if esperas else 0.0
    )
    resumen["espera_p90"] = espera_percentil(esperas, 90)
    resumen["espera_p95"] = espera_percentil(esperas, 95)
    resumen["espera_maxima"] = float(max(esperas)) if esperas else 0.0
    resumen["num_pasajeros_abordados"] = float(len(esperas))
    llegadas = float(resumen.get("pasajeros_llegados", 0.0))
    transportados = float(resumen.get("pasajeros_transportados", 0.0))
    resumen["pct_transportados"] = (
        100.0 * transportados / llegadas if llegadas > 0 else 0.0
    )
    # Desviaciones típicas de los percentiles de espera (para la tabla).
    for nombre, funcion in (
        ("espera_mediana", lambda r: r.espera_mediana_abordados),
        ("espera_p90", lambda r: r.espera_p90),
        ("espera_p95", lambda r: r.espera_p95),
        ("espera_maxima", lambda r: r.espera_maxima_abordados),
    ):
        valores = [float(funcion(r)) for r in resultados]
        resumen[f"{nombre}_std"] = (
            float(np.std(valores, ddof=1)) if len(valores) > 1 else 0.0
        )
    restantes = float(resumen.get("pasajeros_restantes", 0.0))
    total = transportados + restantes
    resumen["pct_restantes"] = 100.0 * restantes / total if total > 0 else 0.0
    return resumen


def comparar_casos_base(
    escenarios: List[Tuple[str, str, SimulationConfig]],
    num_repeticiones: int,
    semilla_base: int = SEMILLA_COMPARACION,
) -> List[Dict[str, Any]]:
    """Compara los casos base sobre réplicas reproducibles con semilla común.

    Devuelve, por escenario, sus parámetros, semillas usadas, las series medias
    (rejilla común de tiempo, cola media, acumulados) y los puntos de espera
    individuales de los pasajeros abordados. No mezcla datos entre escenarios.
    """
    if not escenarios:
        return []
    semillas = [semilla_base + i for i in range(num_repeticiones)]
    duracion = max(float(config.duracion) for _, _, config in escenarios)
    rejilla = [round(duracion * k / 100.0, 6) for k in range(101)]

    casos: List[Dict[str, Any]] = []
    for id_, nombre, config in escenarios:
        resultados = ejecutar_repeticiones(config, num_repeticiones, semilla_base)
        cola_media = promedio_series_cola(resultados, rejilla)

        # Acumulados medios (llegadas y transportados) evaluados en la rejilla.
        llegadas_rejilla = [0.0 for _ in rejilla]
        transportados_rejilla = [0.0 for _ in rejilla]
        for r in resultados:
            eventos = r.historial_eventos
            llegados = 0
            transportados = 0
            idx = 0
            for i, t in enumerate(rejilla):
                while idx < len(eventos) and eventos[idx]["tiempo"] <= t + 1e-9:
                    ev = eventos[idx]
                    if ev["tipo"] == "pasajero":
                        llegados += 1
                    else:
                        transportados += int(ev.get("abordados", 0))
                    idx += 1
                llegadas_rejilla[i] += llegados
                transportados_rejilla[i] += transportados
        n = float(len(resultados)) or 1.0
        llegadas_rejilla = [v / n for v in llegadas_rejilla]
        transportados_rejilla = [v / n for v in transportados_rejilla]

        esperas = puntos_espera(resultados)
        fechas = [p[0] for p in esperas]
        valores = [p[1] for p in esperas]
        esperas_media = [0.0 for _ in rejilla]
        acum = 0.0
        idx_w = 0
        for i, t in enumerate(rejilla):
            while idx_w < len(esperas) and esperas[idx_w][0] <= t + 1e-9:
                acum += esperas[idx_w][1]
                idx_w += 1
            esperas_media[i] = acum / idx_w if idx_w > 0 else 0.0

        casos.append(
            {
                "id": id_,
                "nombre": nombre,
                "parametros": {
                    "lambda_p": float(config.lambda_p),
                    "intervalo_promedio": float(config.intervalo_promedio),
                    "coef_variacion": float(config.coef_variacion),
                    "capacidad_autobus": int(config.capacidad_autobus),
                    "prob_ocupacion": float(config.prob_ocupacion),
                    "duracion": float(config.duracion),
                    "cola_inicial": int(config.cola_inicial),
                    "limite_cola": int(config.limite_cola),
                },
                "mu": float(config.mu_efectiva),
                "rho": float(config.rho_estrella) if np.isfinite(config.rho_estrella) else None,
                "clasificacion": clasificar_sistema(config.lambda_p, config.mu_efectiva),
                "semillas": semillas,
                "num_repeticiones": int(num_repeticiones),
                "duracion": float(config.duracion),
                "rejilla": rejilla,
                "cola_media": cola_media,
                "llegadas_acumuladas": llegadas_rejilla,
                "transportados_acumulados": transportados_rejilla,
                "esperas": {"tiempos": fechas, "valores": valores},
                "espera_media_temporal": esperas_media,
                "resumen": resumen_comparacion(resultados),
                "serie_original": [
                    {
                        "semilla": r.semilla,
                        "serie": [[float(t), int(q)] for t, q in r.serie_tiempo_cola],
                    }
                    for r in resultados
                ],
            }
        )
    return casos
