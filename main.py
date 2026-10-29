"""Punto de entrada de la simulación estocástica de transporte público (web)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from server.app import main


if __name__ == "__main__":
    main()
