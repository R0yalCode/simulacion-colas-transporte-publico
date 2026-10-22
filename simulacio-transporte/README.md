# Simulación Estocástica de Transporte Público

## 1. Descripción

Simulación de eventos discretos (DES) de una parada de transporte público. Modela
la llegada de pasajeros con un proceso de Poisson, los intervalos entre autobuses
con una distribución Gamma y los asientos libres con una distribución Binomial.
Permite estudiar cómo la demanda, la frecuencia y la capacidad afectan a la
formación de colas y al tiempo de espera.

El proyecto es **netamente web**: un motor de simulación en Python expone una API
REST y un dashboard de navegador (HTML/CSS/JavaScript puro, sin frameworks) reproduce
la ejecución con **escena 3D** (Three.js local, sin CDN), gráficos en vivo y
exportación de resultados.

Además del motor, la aplicación incorpora:

- **Clasificador matemático del sistema** según la relación de carga `ρ = λ/μ`
  (estable, alta utilización, crítico, sobrecargado, sin servicio, inactivo).
- **Saturación operativa** con umbral `Qmáx = 150` pasajeros: instante en que la
  cola real alcanza el umbral y minutos acumulados en saturación.
- **Catálogo de escenarios** predefinidos (estable, alta utilización, crítico y
  sobrecarga) con su condición de diseño, aplicables desde el formulario.
- **Representación visual de hasta 150 pasajeros** repartidos en cuatro zonas
  (A–D) con nivel de detalle (LOD): actores detallados para la cabeza de la cola
  y una multitud instanciada para el resto.

## 2. Objetivo académico

Disponer de un modelo matemáticamente correcto, reproducible y visualmente claro
para analizar una parada de autobús: demanda frente a oferta, evolución de la cola,
tiempos de espera y comparación de escenarios, mediante una interfaz web interactiva.

## 3. Arquitectura

- **Modelo** (`models/simulation.py`, `models/saturacion.py`): parámetros,
  entidades, generadores aleatorios, cola FIFO, motor de eventos discretos,
  resultados, métricas, comparación de escenarios y clasificación del sistema
  por carga y saturación operativa. El motor es independiente de la presentación.
- **Servidor** (`server/`): API HTTP con la biblioteca estándar de Python
  (`http.server`), sin dependencias externas. Expone `/api/simular`,
  `/api/replicas` y `/api/escenarios`, valida los parámetros (`schema.py`) y
  sirve los archivos estáticos del dashboard.
- **Dashboard** (`web/`): interfaz de navegador en JavaScript puro (WebGL para la
  escena 3D y canvas 2D para los gráficos), sin frameworks. Three.js se sirve
  **localmente** desde `web/vendor/three` (sin CDN ni conexión a Internet). El
  motor precalcula todos los eventos y el navegador los reproduce con un reloj
  virtual.

**Separación motor vs animación:** el motor calcula toda la ejecución; el
navegador únicamente la reproduce (pausa, velocidad, línea de tiempo). La
velocidad de reproducción nunca altera los resultados.

**Separación clasificación vs presentación:** el estado del sistema y el estado
operativo de la cola los calcula **el servidor** (`models/saturacion.py`) y el
navegador los reproduce; la interfaz no recalcula la teoría, solo la muestra.

## 4. Estructura

```
simulacio-transporte/
├── main.py                      # punto de entrada: lanza el servidor web
├── requirements.txt
├── README.md
├── .gitignore
├── models/
│   ├── __init__.py
│   ├── simulation.py            # motor DES, entidades, métricas
│   └── saturacion.py            # clasificador por ρ, Qmáx y escenarios
├── server/                      # API HTTP y archivos estáticos (stdlib)
│   ├── __init__.py
│   ├── __main__.py              # python -m server
│   ├── app.py                   # servidor HTTP
│   └── schema.py                # validación y serialización JSON
├── web/                         # dashboard del navegador (JS sin dependencias)
│   ├── index.html
│   ├── package.json
│   ├── assets/models/           # recursos GLB generados (autobús, pasajeros)
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── api.js               # cliente HTTP
│   │   ├── app.js               # orquestador del dashboard
│   │   ├── disposicion3d.js     # zonas A–D y puestos de la cola (150)
│   │   ├── escena.js            # escena canvas 2D de respaldo
│   │   ├── escena3d.js          # escena 3D (Three.js) con LOD
│   │   ├── escenarios.js         # catálogo y sincronización de escenarios
│   │   ├── estado.js            # estado operativo e indicadores científicos
│   │   ├── graficos.js          # gráficos canvas en vivo
│   │   ├── registro.js          # registro de eventos
│   │   ├── reloj.js             # reloj virtual y velocidades
│   │   ├── simulacion.js        # reproducción de la ejecución
│   │   └── util.js              # utilidades de formato y DOM
│   ├── scripts/                 # vendorizado de Three.js y recursos GLB
│   ├── tests/
│   │   ├── disposicion3d.test.js
│   │   ├── dom.test.js
│   │   ├── escenarios.test.js
│   │   ├── estado.test.js
│   │   ├── reloj.test.js
│   │   └── simulacion.test.js
│   └── vendor/three/            # Three.js local (sin CDN)
├── docs/capturas-3d/            # capturas de la escena 3D
└── tests/
    ├── test_simulation.py       # pruebas del motor y métricas
    ├── test_events.py           # pruebas de los eventos enriquecidos
    ├── test_saturacion.py       # clasificador ρ, Qmáx y escenarios
    ├── test_limite_cola.py      # umbral operativo y saturación
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

### 5.6 Clasificador del sistema por carga (ρ)

El estado del sistema se calcula en el servidor (`models/saturacion.py`) a partir
de `ρ = λ/μ` y es **independiente de la ejecución simulada**:

| Condición | Estado |
|-----------|--------|
| `μ = 0` y `λ > 0` | `sin_servicio` |
| `μ = 0` y `λ = 0` | `inactivo` |
| `λ = 0` | `estable` |
| `\|ρ − 1\| ≤ ε` (`ε = 1e-9`) | `critico` |
| `ρ < 1` y `ρ ≥ 0.80` | `alta_utilizacion` |
| `ρ < 0.80` | `estable` |
| `ρ > 1` | `sobrecargado` |

La tolerancia `ε` evita depender de la igualdad exacta en coma flotante: el
escenario «crítico» (`ρ = 0,9999999999999998`) se clasifica como crítico.

### 5.7 Saturación operativa (umbral `Qmáx`)

- `Qmáx = 150` pasajeros: umbral operativo **y** límite de representación visual.
- El motor **nunca recorta la cola**: si la cola real supera el umbral, los
  pasajeros sobrantes siguen en el modelo y se contabilizan como `excedente`.
- El motor registra el **instante de saturación** (primer `t` con `Q(t) ≥ Qmáx`)
  y los **minutos acumulados en saturación**.
- Se distinguen dos conceptos: la **sobrecarga matemática** (`ρ > 1`, el
  sistema no puede drenar la cola) y la **saturación operativa** (la cola real
  alcanza el umbral de representación). Un sistema sobrecargado puede no haber
  alcanzado todavía el umbral si la simulación es corta.

### 5.8 Escenarios predefinidos

Todos usan `C = 40`, `p_o = 0.70`, `h = 12` (⇒ `μ = 1,00`pas/min) y la semilla
`20260921`:

| Escenario | `λ` (pas/min) | `ρ` | Estado | Duración |
|-----------|---------------|-----|--------|----------|
| `estable` | 0,6 | 0,60 | Estable | 120 min |
| `alta_utilizacion` | 0,9 | 0,90 | Alta utilización | 120 min |
| `critico` | 1,0 | 1,00 | Crítico | 120 min |
| `sobrecarga` | 2,4 | 2,40 | Sobrecargado | 150 min |

El escenario inicial es `estable`. Al modificar cualquier parámetro, el
formulario pasa automáticamente a «Personalizado» y se muestra la condición
(`ρ = 0,60 < 1`, `ρ = 2,40 > 1`, …).

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
| `limite_cola` | 150 | pasajeros (100–150) |

`limite_cola` es el **umbral operativo `Qmáx`**: define cuándo el sistema se
considera saturado operativamente y hasta dónde se dibuja la cola. No altera la
matemática del modelo (el mismo modelo con distinto umbral produce idénticos
resultados estadísticos); solo cambia la clasificación operativa y el número de
figuras visibles.

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

Para reconstruir los recursos 3D (Three.js local y modelos GLB) se necesita
Node.js:

```bash
cd web
npm install          # descarga Three.js 0.186.1
npm run recursos     # vendoriza Three.js y genera web/assets/models/*.glb
npm run verificar    # comprueba que los recursos están completos
```

`web/vendor/three/` y `web/assets/models/` ya están incluidos, por lo que la
aplicación funciona **sin conexión a Internet** tal como está.

## 8. Ejecución

```bash
python main.py                       # abre http://127.0.0.1:8000
python main.py --puerto 8080         # otro puerto
python -m server                     # equivalente, admite --host y --puerto
```

El servidor no necesita dependencias adicionales: usa únicamente la biblioteca
estándar de Python y sirve el dashboard desde `web/` (incluidos Three.js y los
modelos GLB locales).

## 9. Aplicación web

### 9.1 API HTTP (solo biblioteca estándar)

| Método y ruta | Función |
|---------------|---------|
| `GET /api/salud` | Comprobación de vida del servidor |
| `GET /api/parametros` | Metadatos de los parámetros, catálogo de escenarios y umbrales del clasificador |
| `GET /api/escenarios` | Catálogo de escenarios con su condición de diseño |
| `POST /api/simular` | Ejecuta el motor y devuelve eventos, series, resultados, clasificación y estado operativo |
| `POST /api/replicas` | Promedia N réplicas reproducibles (modo acelerado) |

El cuerpo JSON se valida en el servidor (`server/schema.py`) con los mismos
límites del modelo; los mensajes de error se devuelven con HTTP 400 para que el
formulario señale el campo concreto (el mensaje incluye la clave del parámetro,
p. ej. `limite_cola: …`). El servidor también sirve `web/` como archivos
estáticos (rutas protegidas contra saltos de directorio).

Bloques que devuelve `POST /api/simular`:

| Bloque | Contenido |
|--------|-----------|
| `estado` | Clasificación por `ρ`: estado, `rho`, `lambda_p`, `mu`, `es_sobrecarga_matematica` |
| `estado_operativo` | Cola real frente a `Qmáx`: `saturado`, `excedente`, `limite_cola` |
| `metricas_teoricas` | `capacidad_efectiva`, `umbral_alta_utilizacion`, `tolerancia_critico` |
| `resultados` | Métricas del motor + `limite_cola`, `tiempo_saturacion_operativa`, `minutos_en_saturacion` |
| `config` | Configuración efectiva de la ejecución, incluido `limite_cola` |

### 9.2 Reproducción en el navegador

`POST /api/simular` devuelve la ejecución **precalculada**: el navegador no
vuelve a simular nada, solo reproduce los eventos con un reloj virtual. Por eso
la velocidad de reproducción (0.5×, 1×, 1.5×, 2× y 2.5×; 1× = 2 minutos
simulados por segundo real) cambia únicamente el ritmo visual y jamás los
resultados. Se puede pausar, reanudar, reiniciar y arrastrar la línea de tiempo
hacia cualquier instante sin perder el estado.

El dashboard incluye:

- **Escena 3D de la parada** (Three.js local, WebGL): autobús con abortedero
  animado, abordaje, salida, cámara de calle y elevada, y **cola de hasta 150
  pasajeros** repartida en cuatro zonas (A: 28 puestos, B: 28, C: 56, D: 56)
  con **LOD**: hasta 24 actores detallados para la cabeza de la cola y el resto
  como multitud instanciada en una sola llamada de dibujo. Si el navegador no
  soporta WebGL, se degrada automáticamente a la escena 2D equivalente.
- **Zona de estado del sistema**: clasificación por `ρ` con severidad visual
  (estable, alta utilización, crítico, sobrecarga) y el estado operativo de la
  cola (`Q / Qmáx`).
- **Panel de indicadores científicos**: `λ`, `μ`, `ρ`, capacidad efectiva,
  umbral de alta utilización, tolerancia de estado crítico, cola real, `Qmáx`,
  excedente, cola máxima, instante de saturación y tiempo en saturación.
- **Alerta de saturación** superpuesta a la escena cuando la cola real alcanza
  `Qmáx` o cuando el sistema está matemáticamente sobrecargado.
- **Selector de escenarios** con su condición de diseño y detección automática
  de la condición «Personalizado».
- **Cuatro gráficos en vivo** en canvas: evolución de la cola (con línea de
  referencia `Qmáx`), acumulados de llegadas/abordajes, tiempos de espera y
  capacidad de los últimos autobuses.
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
tests/test_simulation.py   22 passed
tests/test_events.py       13 passed
tests/test_saturacion.py   27 passed
tests/test_limite_cola.py  15 passed
tests/test_api.py          22 passed
-------------------------------------
Total: 99 passed
```

- `test_simulation.py`: generadores aleatorios, cola FIFO, motor, balance,
  reproducibilidad y métricas.
- `test_events.py`: identificadores estables, coherencia de eventos y balance.
- `test_saturacion.py`: clasificador por `ρ` (casos límite y tolerancia),
  escenarios que cumplen su condición, reproducibilidad y balance.
- `test_limite_cola.py`: `limite_cola` como parámetro validado, saturación
  operativa (instante y minutos), cola no recortada y exposición por la API.
- `test_api.py`: validación HTTP 400, reproducibilidad, réplicas, estáticos y
  rechazo de saltos de directorio.

### 10.2 JavaScript del dashboard

Con [Node.js](https://nodejs.org) (probado con v24):

```bash
cd web
npm test          # equivale a: node --test
```

Resultado real: **69 passed**.

- `simulacion.test.js` (17): reconstrucción temporal, cola FIFO, inmutabilidad
  al retroceder, fases visuales, gráficos, registro, CSV y validación.
- `reloj.test.js` (10): ritmo por velocidad, pausa/reanudación, acotado de
  fotogramas y finalización.
- `dom.test.js` (9): identificadores del HTML, sin dependencias externas y
  accesibilidad de los canvas.
- `disposicion3d.test.js` (14): zonas A–D, 150 puestos sin solapes, estabilidad
  de la disposición y cámara.
- `estado.test.js` (10): estado operativo frente a `Qmáx`, severidades y
  redacción de mensajes.
- `escenarios.test.js` (9): catálogo, aplicación, detección de la condición
  «Personalizado».

## 11. Limitaciones del modelo

- Una sola parada; sin rutas ni transferencias.
- Cola FIFO sin prioridades, reintentos ni abandono.
- Llegadas homogéneas (Poisson estacionario).
- Primer autobús tras un intervalo aleatorio Gamma.
- Abordaje instantáneo al llegar el autobús.
- Los pasajeros restantes al final tienen tiempo de espera censurado.
- `ρ*` es un indicador de equilibrio, no la utilización de un M/M/1.
- Por encima de `Qmáx = 150` la cola se sigue simulando, pero la escena solo
  dibuja 150 figuras: el excedente se informa en el panel de indicadores y en la
  alerta.
- La aplicación web mantiene toda la ejecución en memoria del navegador; se
  recomienda reducir la duración o la tasa de llegada si se superan ~20 000
  eventos (el servidor avisa cuando ocurre).

## 12. Autor y versión

**Proyecto:** Simulación Estocástica de Transporte Público
**Versión:** 5.0 (escena 3D, clasificación por ρ y saturación operativa)
**Tecnologías:** Python 3, NumPy, Pytest, HTML5, CSS3, JavaScript (WebGL/Three.js local, canvas 2D, ES modules)
**Arquitectura:** Motor DES + API REST (stdlib) + dashboard web sin frameworks

Proyecto con fines académicos y educativos. Los cálculos son coherentes con las
distribuciones especificadas y los resultados son reproducibles.
