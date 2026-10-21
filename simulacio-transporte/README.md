# Simulación Estocástica de Transporte Público

## 1. Descripción

Simulación de eventos discretos (DES) de una parada de transporte público. Modela
la llegada de pasajeros con un proceso de Poisson, los intervalos entre autobuses
con una distribución Gamma y los asientos libres con una distribución Binomial.
Permite estudiar cómo la demanda, la frecuencia y la capacidad afectan a la
formación de colas y al tiempo de espera.

El proyecto es **netamente web**: un motor de simulación en Python expone una API
REST y un dashboard de navegador (HTML/CSS/JavaScript puro, sin frameworks) reproduce
la ejecución con escena animada, gráficos en vivo y exportación de resultados.

## 2. Objetivo académico

Disponer de un modelo matemáticamente correcto, reproducible y visualmente claro
para analizar una parada de autobús: demanda frente a oferta, evolución de la cola,
tiempos de espera y comparación de escenarios, mediante una interfaz web interactiva.

## 3. Arquitectura

- **Modelo** (`models/simulation.py`): parámetros, entidades, generadores
  aleatorios, cola FIFO, motor de eventos discretos, resultados, métricas y
  comparación de escenarios. El motor es independiente de la presentación.
- **Servidor** (`server/`): API HTTP con la biblioteca estándar de Python
  (`http.server`), sin dependencias externas. Expone `/api/simular` y
  `/api/replicas`, valida los parámetros (`schema.py`) y sirve los archivos
  estáticos del dashboard.
- **Dashboard** (`web/`): interfaz de navegador en JavaScript puro (canvas para la
  escena y los gráficos), sin frameworks ni librerías externas. El motor precalcula
  todos los eventos y el navegador los reproduce con un reloj virtual.

**Separación motor vs animación:** el motor calcula toda la ejecución; el
navegador únicamente la reproduce (pausa, velocidad, línea de tiempo). La
velocidad de reproducción nunca altera los resultados.

## 4. Estructura

```
simulacio-transporte/
├── main.py                      # punto de entrada: lanza el servidor web
├── requirements.txt
├── README.md
├── .gitignore
├── models/
│   ├── __init__.py
│   └── simulation.py            # motor DES, entidades, métricas
├── server/                      # API HTTP y archivos estáticos (stdlib)
│   ├── __init__.py
│   ├── __main__.py              # python -m server
│   ├── app.py                   # servidor HTTP
│   └── schema.py                # validación y serialización JSON
├── web/                         # dashboard del navegador (JS sin dependencias)
│   ├── index.html
│   ├── package.json
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── api.js               # cliente HTTP
│   │   ├── app.js               # orquestador del dashboard
│   │   ├── escena.js            # escena canvas de la parada
│   │   ├── graficos.js          # gráficos canvas en vivo
│   │   ├── registro.js          # registro de eventos
│   │   ├── reloj.js             # reloj virtual y velocidades
│   │   ├── simulacion.js        # reproducción de la ejecución
│   │   └── util.js              # utilidades de formato y DOM
│   └── tests/
│       ├── dom.test.js
│       ├── reloj.test.js
│       └── simulacion.test.js
└── tests/
    ├── test_simulation.py       # pruebas del motor y métricas
    ├── test_events.py           # pruebas de los eventos enriquecidos
    └── test_api.py              # pruebas de integración del backend HTTP
```

## 5. Formulación matemática

### 5.1 Llegada de pasajeros (proceso de Poisson homogéneo)

- Tasa de llegada: λ = 6 pasajeros/min (predeterminado).
- Tiempo entre llegadas consecutivas: `T ~ Exponencial(λ)`, media `1/λ`.

### 5.2 Intervalos entre autobuses (distribución Gamma)

- Intervalo medio deseado: h = 10 min.
- Coeficiente de variación: c = 0.30.
- Parametrización: forma `α = 1/c²`, escala `θ = h·c²`.
- Media: `E[H] = αθ = h`; varianza: `Var(H) = αθ² = h²c²`.

### 5.3 Capacidad y asientos libres (distribución Binomial)

- Capacidad total: C = 40 asientos.
- Probabilidad de ocupación por asiento: p_o = 0.70.
- Asientos libres por autobús: `F ~ Binomial(C, 1 − p_o)`, media `C(1 − p_o) = 12`.

### 5.4 Cola FIFO y balance de pasajeros

- Cola única FIFO (`collections.deque`).
- Arribo de autobús: `S = min(Q, F)`, la cola se reduce en `S`.
- Balance: `cola_inicial + llegados = transportados + restantes` (debe ser 0).
- Tiempo de espera individual: `W = t_abordaje − t_llegada ≥ 0`.
- **Política de desempate:** si coinciden una llegada de pasajero y una de
  autobús en el mismo instante, se procesa primero el pasajero.

### 5.5 Indicador de carga

`μ_efectiva = C(1 − p_o)/h` pasajeros/min y `ρ* = λ/μ_efectiva`. Con los valores
predeterminados `μ_efectiva = 1.2` y `ρ* = 5.0`: equilibrio entre demanda y
capacidad media, no la utilización clásica de un M/M/1. La configuración base
representa un sistema fuertemente sobrecargado.

## 6. Parámetros predeterminados

| Parámetro | Valor | Unidades |
|-----------|-------|----------|
| `lambda_p` | 6.0 | pasajeros/min |
| `intervalo_promedio` | 10.0 | minutos |
| `coef_variacion` | 0.30 | adimensional |
| `capacidad_autobus` | 40 | asientos |
| `prob_ocupacion` | 0.70 | 0–1 |
| `duracion` | 120.0 | minutos |
| `cola_inicial` | 0 | pasajeros |
| `semilla` | None | — |
| `primer_autobus_aleatorio` | True | — |

## 7. Instalación

Requiere Python 3.11 o superior.

```bash
python -m venv .venv
# Windows PowerShell:  .\.venv\Scripts\Activate.ps1
# Linux/macOS:         source .venv/bin/activate
pip install -r requirements.txt
```

Dependencias: `numpy`, `pytest`. El calendario de eventos, la cola y todos los
cálculos usan la biblioteca estándar; el servidor HTTP también.

## 8. Ejecución

```bash
python main.py                       # abre http://127.0.0.1:8000
python main.py --puerto 8080         # otro puerto
python -m server                     # equivalente, admite --host y --puerto
```

El servidor no necesita dependencias adicionales: usa únicamente la biblioteca
estándar de Python y sirve el dashboard desde `web/`.

## 9. Aplicación web

### 9.1 API HTTP (solo biblioteca estándar)

| Método y ruta | Función |
|---------------|---------|
| `GET /api/salud` | Comprobación de vida del servidor |
| `GET /api/parametros` | Metadatos de los parámetros para construir el formulario |
| `POST /api/simular` | Ejecuta el motor y devuelve eventos, series y resultados |
| `POST /api/replicas` | Promedia N réplicas reproducibles (modo acelerado) |

El cuerpo JSON se valida en el servidor (`server/schema.py`) con los mismos
límites del modelo; los mensajes de error se devuelven con HTTP 400 para que el
formulario señale el campo concreto. El servidor también sirve `web/` como
archivos estáticos (rutas protegidas contra saltos de directorio).

### 9.2 Reproducción en el navegador

`POST /api/simular` devuelve la ejecución **precalculada**: el navegador no
vuelve a simular nada, solo reproduce los eventos con un reloj virtual. Por eso
la velocidad de reproducción (0.5×, 1×, 1.5×, 2× y 2.5×; 1× = 2 minutos
simulados por segundo real) cambia únicamente el ritmo visual y jamás los
resultados. Se puede pausar, reanudar, reiniciar y arrastrar la línea de tiempo
hacia cualquier instante sin perder el estado.

El dashboard incluye:

- **Escena de la parada** en canvas: fila FIFO, aproximación del autobús,
  abordaje animado, salida y alertas (sin asientos libres o cola oculta).
- **Cuatro gráficos en vivo** en canvas: evolución de la cola, acumulados de
  llegadas/abordajes, tiempos de espera y capacidad de los últimos autobuses.
- **Ocho indicadores** del instante actual, con esperas censuradas correctamente.
- **Registro de eventos** reciente, **resultados finales** del motor y
  **exportación CSV** de eventos y resumen.
- **Modo acelerado por réplicas**: promedia varias semillas y muestra un resumen.
- Respeto de `prefers-reduced-motion` y de la accesibilidad básica (roles,
  etiquetas y estados de los controles).

## 10. Pruebas

### 10.1 Python

```bash
python -m pytest -v
```

Resultado real:

```
tests/test_simulation.py  22 passed
tests/test_events.py      13 passed
tests/test_api.py         22 passed
--------------------------
Total: 57 passed
```

- `test_simulation.py`: generadores aleatorios, cola FIFO, motor, balance,
  reproducibilidad y métricas.
- `test_events.py`: identificadores estables, coherencia de eventos y balance.
- `test_api.py`: validación HTTP 400, reproducibilidad, réplicas, estáticos y
  rechazo de saltos de directorio.

### 10.2 JavaScript del dashboard

Con [Node.js](https://nodejs.org) (probado con v24):

```bash
cd web
npm test          # equivale a: node --test
```

Resultado real: **34 passed**.

- `simulacion.test.js` (17): reconstrucción temporal, cola FIFO, inmutabilidad
  al retroceder, fases visuales, gráficos, registro, CSV y validación.
- `reloj.test.js` (10): ritmo por velocidad, pausa/reanudación, acotado de
  fotogramas y finalización.
- `dom.test.js` (7): identificadores del HTML, sin dependencias externas y
  accesibilidad de los canvas.

## 11. Limitaciones del modelo

- Una sola parada; sin rutas ni transferencias.
- Cola FIFO sin prioridades, reintentos ni abandono.
- Llegadas homogéneas (Poisson estacionario).
- Primer autobús tras un intervalo aleatorio Gamma.
- Abordaje instantáneo al llegar el autobús.
- Los pasajeros restantes al final tienen tiempo de espera censurado.
- `ρ*` es un indicador de equilibrio, no la utilización de un M/M/1.
- La aplicación web mantiene toda la ejecución en memoria del navegador; se
  recomienda reducir la duración o la tasa de llegada si se superan ~20 000
  eventos (el servidor avisa cuando ocurre).

## 12. Autor y versión

**Proyecto:** Simulación Estocástica de Transporte Público
**Versión:** 4.0 (100% web)
**Tecnologías:** Python 3, NumPy, Pytest, HTML5, CSS3, JavaScript (canvas, ES modules)
**Arquitectura:** Motor DES + API REST (stdlib) + dashboard web sin frameworks

Proyecto con fines académicos y educativos. Los cálculos son coherentes con las
distribuciones especificadas y los resultados son reproducibles.
