"""Clasificación matemática del sistema y catálogo de escenarios experimentales.

Este módulo es la fuente de verdad de la clasificación de carga. Separate del
estado *operativo* (cola real) y del estado *visual* (personajes dibujados):

- **Estado matemático**: depende solo de los parámetros del modelo
  (λₚ frente a μ = Cₑ/h). Es el que se calcula aquí.
- **Estado operativo**: depende de la cola real Q(t) frente al umbral Qmáx.
  Lo calcula el motor de eventos discretos (`models.simulation`).
- **Estado visual**: depende del número de personajes renderizados. Lo
  decide la capa de reproducción del navegador.

La clasificación matemática NO usa una igualdad de punto flotante como única
condición: se declara crítica la relación ρ cuando |ρ − 1| ≤ tolerancia, y se
conserva la comparación directa ρ < 1 / ρ > 1 para distinguir el sentido del
desvío.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Constantes de la clasificación
# ---------------------------------------------------------------------------

#: Tolerancia numérica para declarar el estado crítico (ρ = 1).
#: Escala relativa: 1e-9 está muy por encima del epsilon del doble (≈2.2e-16)
#: y por debajo de cualquier variación appreciable de los parámetros del
#: modelo. Evita depender de una igualdad exacta de punto flotante.
TOLERANCIA_CRITICO = 1e-9

#: Umbral configurable a partir del cual el sistema se considera de alta
#: utilización (ρ ≥ 0.80 y ρ < 1).
UMBRAL_ALTA_UTILIZACION = 0.80

#: Límite máximo de personajes individuales que la interfaz puede representar.
LIMITE_VISUAL_MAX = 150


class EstadoSistema(Enum):
    """Clasificación matemática del sistema de transporte."""

    ESTABLE = "estable"
    ALTA_UTILIZACION = "alta_utilizacion"
    CRITICO = "critico"
    SOBRECARGADO = "sobrecargado"
    SIN_SERVICIO = "sin_servicio"
    INACTIVO = "inactivo"

    @property
    def etiqueta(self) -> str:
        return _METADATOS[self]["etiqueta"]

    @property
    def titulo(self) -> str:
        return f"ESTADO DEL SISTEMA: {self.etiqueta}"

    @property
    def detalle(self) -> str:
        return _METADATOS[self]["detalle"]

    @property
    def severidad(self) -> str:
        """Severidad para la presentación: ok | aviso | alerta | inactivo."""
        return _METADATOS[self]["severidad"]

    @property
    def es_sobrecarga_matematica(self) -> bool:
        """Verdadero solo si la demanda media supera la capacidad media."""
        return self is EstadoSistema.SOBRECARGADO


_METADATOS: Dict[EstadoSistema, Dict[str, str]] = {
    EstadoSistema.ESTABLE: {
        "etiqueta": "ESTABLE",
        "detalle": "Capacidad de transporte suficiente para la demanda media.",
        "severidad": "ok",
    },
    EstadoSistema.ALTA_UTILIZACION: {
        "etiqueta": "ALTA UTILIZACIÓN",
        "detalle": "La demanda se aproxima a la capacidad de transporte.",
        "severidad": "aviso",
    },
    EstadoSistema.CRITICO: {
        "etiqueta": "CRÍTICO",
        "detalle": "La demanda media es igual a la capacidad media de servicio.",
        "severidad": "aviso",
    },
    EstadoSistema.SOBRECARGADO: {
        "etiqueta": "SOBRECARGADO",
        "detalle": "La demanda media supera la capacidad media de transporte.",
        "severidad": "alerta",
    },
    EstadoSistema.SIN_SERVICIO: {
        "etiqueta": "SIN SERVICIO",
        "detalle": "No hay capacidad efectiva de transporte (μ = 0) para una demanda positiva.",
        "severidad": "alerta",
    },
    EstadoSistema.INACTIVO: {
        "etiqueta": "INACTIVO",
        "detalle": "No hay demanda ni capacidad de servicio configuradas.",
        "severidad": "inactivo",
    },
}


# ---------------------------------------------------------------------------
# Clasificador
# ---------------------------------------------------------------------------


def clasificar_sistema(
    lambda_p: float,
    mu: float,
    *,
    umbral_alta: float = UMBRAL_ALTA_UTILIZACION,
    tolerancia_critico: float = TOLERANCIA_CRITICO,
) -> Dict[str, Any]:
    """Clasifica el sistema según la relación entre demanda y capacidad.

    Parámetros
    ----------
    lambda_p:
        Tasa media de llegada de pasajeros (pasajeros/minuto).
    mu:
        Tasa efectiva de transporte (pasajeros/minuto), es decir Cₑ/h.
    umbral_alta:
        Desde qué valor de ρ (por debajo de 1) el sistema se considera de
        alta utilización.
    tolerancia_critico:
        Tolerancia explícita para declarar ρ = 1 (estado crítico).

    Devuelve un diccionario con la clasificación, la relación ρ calculada y
    los datos intermedios (λₚ, μ) para que la interfaz pueda mostrarlos sin
    recalcular nada.
    """
    lambda_p = float(lambda_p)
    mu = float(mu)
    if lambda_p < 0:
        raise ValueError("La tasa de llegada no puede ser negativa.")
    if mu < 0:
        raise ValueError("La tasa efectiva de servicio no puede ser negativa.")

    rho: Optional[float]
    if mu <= 0.0:
        rho = None  # ρ indefinido (demanda positiva sin capacidad o inactividad)
        if lambda_p > 0.0:
            estado = EstadoSistema.SIN_SERVICIO
        else:
            estado = EstadoSistema.INACTIVO
    elif lambda_p == 0.0:
        rho = 0.0
        estado = EstadoSistema.ESTABLE
    else:
        rho = lambda_p / mu
        if abs(rho - 1.0) <= tolerancia_critico:
            estado = EstadoSistema.CRITICO
        elif rho < 1.0:
            # Comparación directa: por debajo de uno nunca es sobrecarga.
            estado = (
                EstadoSistema.ALTA_UTILIZACION
                if rho >= umbral_alta
                else EstadoSistema.ESTABLE
            )
        else:
            estado = EstadoSistema.SOBRECARGADO

    return {
        "estado": estado.value,
        "etiqueta": estado.etiqueta,
        "titulo": estado.titulo,
        "detalle": estado.detalle,
        "severidad": estado.severidad,
        "es_sobrecarga_matematica": estado.es_sobrecarga_matematica,
        "es_critico": estado is EstadoSistema.CRITICO,
        "lambda_p": lambda_p,
        "mu": mu,
        "rho": rho,
        "umbral_alta": float(umbral_alta),
        "tolerancia_critico": float(tolerancia_critico),
    }


def clasificar_operacion(cola: int, limite_cola: int) -> Dict[str, Any]:
    """Clasifica el estado *operativo* a partir de la cola real y Qmáx.

    Es independiente de la clasificación matemática: una cola puede alcanzar
    el umbral operativo con ρ < 1 (fluctuaciones, cola inicial) y una
    sobrecarga matemática no implica por sí sola saturación operativa.
    """
    cola = max(0, int(cola))
    limite = max(1, int(limite_cola))
    return {
        "cola": cola,
        "limite_cola": limite,
        "saturado": cola >= limite,
        "excedente": max(0, cola - limite),
    }


# ---------------------------------------------------------------------------
# Catálogo de escenarios experimentales
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Escenario:
    """Escenario experimental: parámetros del modelo y verificación esperada.

    Los valores son *configuraciones experimentales ilustrativas* construidas
    sobre los parámetros del modelo (no datos empíricos de ninguna ciudad).
    Cada escenario declara la Utilización ρ que produce, de modo que la
    condición verificable del escenario sea comprobable sin simular.
    """

    id: str
    nombre: str
    descripcion: str
    parametros: Dict[str, Any] = field(default_factory=dict)
    condicion: str = ""

    def config(self, base=None) -> Any:
        """Construye una `SimulationConfig` con los parámetros del escenario."""
        from models.simulation import SimulationConfig  # import local: evita ciclo

        valores = dict(self.parametros)
        if base is not None:
            for clave in ("coef_variacion", "cola_inicial", "num_repeticiones"):
                valores.setdefault(clave, getattr(base, clave))
        return SimulationConfig(**valores)

    def utilizacion(self) -> Dict[str, Any]:
        """Devuelve μ, ρ y la clasificación que produce el escenario."""
        from models.simulation import SimulationConfig  # import local: evita ciclo

        config = self.config()
        return clasificar_sistema(config.lambda_p, config.mu_efectiva)


#: Escenarios experimentales ilustrativos.
#:
#: Todos comparten C = 40 asientos y p = 0.70 (Cₑ = 12 asientos libres de
#: media) con h = 12 min, de modo que μ = Cₑ/h = 1.0 pas/min y la utilización
#: ρ = λₚ/μ coincide directamente con la tasa de llegada.
ESCENARIOS: Tuple[Escenario, ...] = (
    Escenario(
        id="estable",
        nombre="Escenario 1 · Estable",
        descripcion=(
            "La demanda media es claramente inferior a la capacidad media de "
            "transporte: el servicio drena la cola con holgura."
        ),
        parametros={
            "lambda_p": 0.6,
            "intervalo_promedio": 12.0,
            "capacidad_autobus": 40,
            "prob_ocupacion": 0.70,
            "duracion": 120.0,
            "cola_inicial": 0,
            "semilla": 20260921,
        },
        condicion="ρ = 0.60 < 1 y la cola no suele alcanzar el límite operativo.",
    ),
    Escenario(
        id="alta_utilizacion",
        nombre="Escenario 2 · Alta utilización",
        descripcion=(
            "La demanda se aproxima a la capacidad de transporte: el margen de "
            "recuperación es pequeño y la cola fluctúa con presión sobre el servicio."
        ),
        parametros={
            "lambda_p": 0.9,
            "intervalo_promedio": 12.0,
            "capacidad_autobus": 40,
            "prob_ocupacion": 0.70,
            "duracion": 120.0,
            "cola_inicial": 0,
            "semilla": 20260921,
        },
        condicion="ρ = 0.90 < 1 pero muy cerca del límite de capacidad.",
    ),
    Escenario(
        id="critico",
        nombre="Escenario 3 · Capacidad crítica",
        descripcion=(
            "La demanda media iguala a la capacidad media de servicio: el "
            "sistema no tiene margen estructural."
        ),
        parametros={
            "lambda_p": 1.0,
            "intervalo_promedio": 12.0,
            "capacidad_autobus": 40,
            "prob_ocupacion": 0.70,
            "duracion": 120.0,
            "cola_inicial": 0,
            "semilla": 20260921,
        },
        condicion="ρ = 1.00: la demanda media iguala la capacidad media.",
    ),
    Escenario(
        id="sobrecarga",
        nombre="Escenario 4 · Sobrecarga",
        descripcion=(
            "La demanda media supera la capacidad media de transporte: la cola "
            "crece de forma sostenida hasta alcanzar el límite operativo."
        ),
        parametros={
            "lambda_p": 2.4,
            "intervalo_promedio": 12.0,
            "capacidad_autobus": 40,
            "prob_ocupacion": 0.70,
            "duracion": 150.0,
            "cola_inicial": 0,
            "semilla": 20260921,
        },
        condicion="ρ = 2.40 > 1: la demanda media supera la capacidad media.",
    ),
)

#: Identificador del escenario que se preselecciona en la interfaz.
ESCENARIO_INICIAL = "estable"


def escenario_por_id(identificador: str) -> Optional[Escenario]:
    """Devuelve el escenario con ese identificador, o None si no existe."""
    for escenario in ESCENARIOS:
        if escenario.id == identificador:
            return escenario
    return None


def escenarios_publicables() -> List[Dict[str, Any]]:
    """Catálogo de escenarios en formato JSON para la interfaz."""
    catalogo: List[Dict[str, Any]] = []
    for escenario in ESCENARIOS:
        info = escenario.utilizacion()
        catalogo.append(
            {
                "id": escenario.id,
                "nombre": escenario.nombre,
                "descripcion": escenario.descripcion,
                "condicion": escenario.condicion,
                "parametros": dict(escenario.parametros),
                "lambda_p": info["lambda_p"],
                "mu": info["mu"],
                "rho": info["rho"],
                "estado": info["estado"],
                "etiqueta": info["etiqueta"],
                "severidad": info["severidad"],
            }
        )
    return catalogo


def comprobar_escenarios() -> None:
    """Verifica que cada escenario cumple la condición matemática declarada.

    Se usa en las pruebas: un escenario mal definido (p. ej. el de sobrecarga
    con ρ < 1) es un error de configuración, no un resultado de simulación.
    """
    for escenario in ESCENARIOS:
        info = escenario.utilizacion()
        rho = info["rho"]
        estado = info["estado"]
        if escenario.id == "estable" and not (rho is not None and rho < 1.0):
            raise ValueError(f"El escenario estable no cumple ρ < 1 (ρ = {rho}).")
        if escenario.id == "alta_utilizacion":
            if rho is None or not (0.0 < rho < 1.0):
                raise ValueError(f"El escenario de alta utilización no cumple ρ < 1 (ρ = {rho}).")
            if estado != EstadoSistema.ALTA_UTILIZACION.value:
                raise ValueError(
                    f"El escenario de alta utilización se clasifica como {estado}."
                )
        if escenario.id == "critico" and estado != EstadoSistema.CRITICO.value:
            raise ValueError(f"El escenario crítico se clasifica como {estado}.")
        if escenario.id == "sobrecarga" and estado != EstadoSistema.SOBRECARGADO.value:
            raise ValueError(f"El escenario de sobrecarga se clasifica como {estado}.")


def formato_rho(rho: Optional[float]) -> str:
    """Representación textual de ρ (∞ cuando no hay capacidad de servicio)."""
    if rho is None:
        return "∞"
    if math.isinf(rho):
        return "∞"
    return f"{rho:.3f}"
