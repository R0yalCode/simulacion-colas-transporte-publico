"""Backend HTTP de la simulación de transporte público.

Expone el motor de eventos discretos de `models.simulation` mediante una API
REST mínima basada únicamente en la biblioteca estándar y sirve la interfaz
web estática de `web/`. No duplica lógica de simulación: valida la petición,
invoca el motor y serializa sus resultados.
"""

from server.app import crear_servidor, main

__all__ = ["crear_servidor", "main"]
