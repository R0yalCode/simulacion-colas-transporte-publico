"""Esquema de parámetros, validación y serialización JSON de la API.

Es la única fuente de verdad sobre los parámetros configurables del motor:
el frontend construye su formulario a partir de `/api/parametros` y el
servidor vuelve a validar cada petición antes de invocar `SimulationEngine`.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List

from models.simulation import (
    SimulationConfig,
    SimulationResults,
    ejecutar_repeticiones,
    resumen_metricas,
)

SEMILLA_BASE_REPLICAS = 12345
MAX_REPETICIONES = 100
MAX_EVENTOS_ADVERTENCIA = 20000


class ParametroInvalido(ValueError):
    """Error de validación de la petición (HTTP 400)."""


PARAMETROS: Dict[str, Dict[str, Any]] = {
    "lambda_p": {
        "etiqueta": "Tasa de llegada de pasajeros (\u03bb)",
        "unidad": "pasajeros/min",
        "tipo": "numero",
        "min": 0.0,
        "max": 60.0,
        "defecto": 6.0,
        "paso": 0.5,
        "ayuda": "Llegadas según un proceso de Poisson con esta tasa media.",
    },
    "intervalo_promedio": {
        "etiqueta": "Intervalo medio entre autobuses (h)",
        "unidad": "min",
        "tipo": "numero",
        "min": 0.5,
        "max": 60.0,
        "defecto": 10.0,
        "paso": 0.5,
        "ayuda": "Media de la distribuci\u00f3n Gamma de los intervalos entre autobuses.",
    },
    "coef_variacion": {
        "etiqueta": "Coeficiente de variaci\u00f3n (c)",
        "unidad": "adimensional",
        "tipo": "numero",
        "min": 0.05,
        "max": 1.5,
        "defecto": 0.30,
        "paso": 0.05,
        "ayuda": "Variabilidad de los intervalos: forma \u03b1 = 1/c\u00b2, escala \u03b8 = h\u00b7c\u00b2.",
    },
    "capacidad_autobus": {
        "etiqueta": "Capacidad del autob\u00fas (C)",
        "unidad": "asientos",
        "tipo": "entero",
        "min": 1,
        "max": 500,
        "defecto": 40,
        "paso": 1,
        "ayuda": "N\u00famero total de asientos de cada autob\u00fas.",
    },
    "prob_ocupacion": {
        "etiqueta": "Probabilidad de ocupaci\u00f3n (p)",
        "unidad": "0\u20131",
        "tipo": "numero",
        "min": 0.0,
        "max": 1.0,
        "defecto": 0.70,
        "paso": 0.05,
        "ayuda": "Asientos libres al llegar: F ~ Binomial(C, 1 \u2212 p).",
    },
    "duracion": {
        "etiqueta": "Duraci\u00f3n del experimento",
        "unidad": "min",
        "tipo": "numero",
        "min": 1.0,
        "max": 600.0,
        "defecto": 120.0,
        "paso": 10.0,
        "ayuda": "Horizonte temporal simulado.",
    },
    "cola_inicial": {
        "etiqueta": "Cola inicial",
        "unidad": "pasajeros",
        "tipo": "entero",
        "min": 0,
        "max": 5000,
        "defecto": 0,
        "paso": 1,
        "ayuda": "Pasajeros ya presentes en la parada en el instante t = 0.",
    },
    "semilla": {
        "etiqueta": "Semilla aleatoria",
        "unidad": "entero o vac\u00edo",
        "tipo": "entero_opcional",
        "min": 0,
        "max": 2147483647,
        "defecto": None,
        "paso": 1,
        "ayuda": "Vac\u00edo = aleatoria. Si se fija, la ejecuci\u00f3n es reproducible.",
    },
    "num_repeticiones": {
        "etiqueta": "Repeticiones (modo acelerado)",
        "unidad": "ejecuciones",
        "tipo": "entero",
        "min": 1,
        "max": MAX_REPETICIONES,
        "defecto": 30,
        "paso": 1,
        "ayuda": "N\u00famero de r\u00e9plicas independientes al promediar resultados.",
    },
}


def _a_numero(valor: Any, nombre: str) -> float:
    if isinstance(valor, bool):
        raise ParametroInvalido(f"{nombre}: se esperaba un valor num\u00e9rico.")
    if isinstance(valor, (int, float)):
        return float(valor)
    if isinstance(valor, str):
        texto = valor.strip().replace(",", ".")
        if texto == "":
            raise ParametroInvalido(f"{nombre}: el valor no puede estar vac\u00edo.")
        try:
            return float(texto)
        except ValueError as exc:
            raise ParametroInvalido(f"{nombre}: '{valor}' no es un n\u00famero v\u00e1lido.") from exc
    raise ParametroInvalido(f"{nombre}: se esperaba un valor num\u00e9rico.")


def _a_entero(valor: Any, nombre: str) -> int:
    numero = _a_numero(valor, nombre)
    if abs(numero - round(numero)) > 1e-9:
        raise ParametroInvalido(f"{nombre}: se esperaba un n\u00famero entero.")
    return int(round(numero))


def _validar_rango(valor: float, meta: Dict[str, Any]) -> None:
    if valor < meta["min"] or valor > meta["max"]:
        raise ParametroInvalido(
            f"{meta['etiqueta']}: debe estar entre {meta['min']} y {meta['max']} {meta['unidad']}."
        )


def config_desde_payload(datos: Any) -> SimulationConfig:
    """Valida un cuerpo JSON y construye la configuración del motor."""
    if not isinstance(datos, dict):
        raise ParametroInvalido("El cuerpo de la petici\u00f3n debe ser un objeto JSON.")
    desconocidos = sorted(set(datos) - set(PARAMETROS))
    if desconocidos:
        raise ParametroInvalido(f"Par\u00e1metros desconocidos: {', '.join(desconocidos)}.")
    valores: Dict[str, Any] = {}
    for nombre, meta in PARAMETROS.items():
        if nombre not in datos:
            valores[nombre] = meta["defecto"]
            continue
        valor = datos[nombre]
        if meta["tipo"] == "entero_opcional":
            if valor is None or valor == "":
                valores[nombre] = None
                continue
            entero = _a_entero(valor, nombre)
            _validar_rango(float(entero), meta)
            valores[nombre] = entero
        elif meta["tipo"] == "entero":
            entero = _a_entero(valor, nombre)
            _validar_rango(float(entero), meta)
            valores[nombre] = entero
        else:
            numero = _a_numero(valor, nombre)
            _validar_rango(numero, meta)
            valores[nombre] = numero
    config = SimulationConfig(**valores)
    config.validar()
    return config


def payload_parametros() -> Dict[str, Any]:
    """Metadatos de los parámetros para construir el formulario web."""
    return {
        "parametros": PARAMETROS,
        "semilla_base_replicas": SEMILLA_BASE_REPLICAS,
        "max_eventos_advertencia": MAX_EVENTOS_ADVERTENCIA,
    }


def _serializar_evento(evento: Dict[str, Any]) -> Dict[str, Any]:
    salida: Dict[str, Any] = {
        "tipo": evento["tipo"],
        "tiempo": float(evento["tiempo"]),
        "cola": int(evento["cola"]),
    }
    if evento["tipo"] == "pasajero":
        salida["pasajero_id"] = int(evento["pasajero_id"])
        salida["llegados"] = int(evento["llegados"])
    else:
        salida["autobus_id"] = int(evento["autobus_id"])
        salida["capacidad"] = int(evento["capacidad"])
        salida["asientos_libres"] = int(evento["asientos_libres"])
        salida["asientos_ocupados_al_llegar"] = int(evento["asientos_ocupados_al_llegar"])
        salida["cola_antes"] = int(evento["cola_antes"])
        salida["abordados"] = int(evento["abordados"])
        salida["pasajeros_abordados_ids"] = [int(i) for i in evento["pasajeros_abordados_ids"]]
        salida["transportados"] = int(evento["transportados"])
    return salida


def _numero_finito(valor: float) -> Any:
    if math.isinf(valor) or math.isnan(valor):
        return None
    return float(valor)


def construir_payload(config: SimulationConfig, res: SimulationResults) -> Dict[str, Any]:
    """Serializa configuración, eventos, series y resultados a JSON puro."""
    eventos: List[Dict[str, Any]] = [_serializar_evento(ev) for ev in res.historial_eventos]
    advertencias: List[str] = []
    if len(eventos) > MAX_EVENTOS_ADVERTENCIA:
        advertencias.append(
            f"La ejecuci\u00f3n gener\u00f3 {len(eventos)} eventos; la reproducci\u00f3n en el "
            "navegador puede volverse lenta. Considere reducir la duraci\u00f3n o la tasa de llegada."
        )
    resultados = {
        "tiempo_final": float(res.tiempo_final),
        "semilla": res.semilla,
        "cola_inicial": int(res.cola_inicial),
        "pasajeros_llegados_total": int(res.pasajeros_llegados_total),
        "autobuses_llegados_total": int(res.autobuses_llegados_total),
        "pasajeros_transportados_total": int(res.pasajeros_transportados_total),
        "pasajeros_restantes_cola": int(res.pasajeros_restantes_cola),
        "cola_maxima": int(res.cola_maxima),
        "cola_media_temporal": float(res.cola_media_temporal),
        "espera_media_abordados": float(res.espera_media_abordados),
        "espera_mediana_abordados": float(res.espera_mediana_abordados),
        "espera_p90": float(res.espera_p90),
        "espera_p95": float(res.espera_p95),
        "espera_maxima_abordados": float(res.espera_maxima_abordados),
        "asientos_libres_promedio": float(res.asientos_libres_promedio),
        "autobuses_sin_asientos_libres": int(res.autobuses_sin_asientos_libres),
        "autobuses_sin_asientos_libres_pct": float(res.autobuses_sin_asientos_libres_pct),
        "num_pasajeros_abordados": len(res.tiempos_espera_abordados),
        "balance_pasajeros": int(res.balance_pasajeros()),
    }
    metricas_teoricas = {
        "rho_estrella": _numero_finito(config.rho_estrella),
        "mu_efectiva": float(config.mu_efectiva),
        "asientos_libres_esperados": float(config.asientos_libres_esperados),
        "alpha_gamma": _numero_finito(config.alpha_gamma),
        "theta_gamma": float(config.theta_gamma),
    }
    config_json = {
        "lambda_p": float(config.lambda_p),
        "intervalo_promedio": float(config.intervalo_promedio),
        "coef_variacion": float(config.coef_variacion),
        "capacidad_autobus": int(config.capacidad_autobus),
        "prob_ocupacion": float(config.prob_ocupacion),
        "duracion": float(config.duracion),
        "cola_inicial": int(config.cola_inicial),
        "semilla": res.semilla,
        "num_repeticiones": int(config.num_repeticiones),
    }
    return {
        "config": config_json,
        "resultados": resultados,
        "metricas_teoricas": metricas_teoricas,
        "eventos": eventos,
        "serie_cola": [[float(t), int(q)] for t, q in res.serie_tiempo_cola],
        "num_eventos": len(eventos),
        "advertencias": advertencias,
    }


def payload_replicas(config: SimulationConfig, num_repeticiones: int) -> Dict[str, Any]:
    """Resumen de varias repeticiones reproducibles (modo acelerado)."""
    resultados = ejecutar_repeticiones(config, num_repeticiones, SEMILLA_BASE_REPLICAS)
    resumen = resumen_metricas(resultados)
    return {
        "num_repeticiones": int(num_repeticiones),
        "semilla_base": SEMILLA_BASE_REPLICAS,
        "metricas": {clave: float(valor) for clave, valor in resumen.items()},
    }
