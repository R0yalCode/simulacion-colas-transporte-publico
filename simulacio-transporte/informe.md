# SIMULACIÓN DE EVENTOS DISCRETOS PARA EL ANÁLISIS DE COLAS EN UNA PARADA DE TRANSPORTE PÚBLICO

## 1. Tema

Simulación de eventos discretos estocástica para el análisis de la formación de colas y tiempos de espera en una parada de autobuses, considerando llegadas de pasajeros con proceso de Poisson, intervalos entre autobuses con distribución Gamma, disponibilidad estocástica de asientos (binomial) y proceso de abordaje FIFO, implementado en Python.

## 2. Resumen

El presente trabajo aborda el problema de congestión en paradas de transporte público cuando la demanda de pasajeros supera, o se aproxima a, la capacidad efectiva de transporte de los autobuses. Se desarrolló un modelo de simulación de eventos discretos estocástico en Python que representa las llegadas de pasajeros mediante un proceso de Poisson, los intervalos entre autobuses mediante una distribución Gamma (parametrizada por intervalo medio $h$ y coeficiente de variación $cv$), la disponibilidad de asientos al arribo del autobús mediante una distribución Binomial $F \sim \operatorname{Binomial}(C, 1-p_o)$, y el proceso de abordaje bajo política FIFO con $S = \min(Q,F)$.

La implementación integra un motor de eventos discretos basado en cola de prioridad (`heapq`), gestión de cola FIFO de pasajeros, generadores aleatorios reproducibles con `numpy.random.Generator`, indicadores de desempeño (pasajeros llegados/transportados/restantes, longitud máxima/media temporal de cola, tiempos de espera de pasajeros abordados y censurados), y mecanismos de clasificación matemática de carga ($\rho^* = \lambda_p / \mu_{efectiva}$) con umbrales operativos. Se dispone de escenarios predefinidos para análisis comparativo y pruebas automatizadas que verifican reproducibilidad, balance de pasajeros, orden de eventos y comportamiento en casos límite.

Los resultados experimentales detallados dependen de las ejecuciones configuradas; el presente informe documenta el modelo implementado, sus ecuaciones verificadas contra el código fuente, la arquitectura computacional y los indicadores reales calculados, dejando explícitamente identificados los apartados que requieren incorporación de datos de ejecución verificados.

**Palabras clave:** *Simulación de eventos discretos, Teoría de colas, Proceso de Poisson, Distribución Gamma, Transporte público, Python, Modelos estocásticos*.

## 3. Introducción

El transporte público constituye un componente fundamental de la movilidad urbana, ya que permite el desplazamiento de un gran número de personas mediante recursos compartidos como autobuses y paradas. Cuando la demanda supera la capacidad de atención o los intervalos entre vehículos son irregulares, se forman colas, aumentan los tiempos de espera y parte de la demanda puede no lograr abordar en el vehículo que arriba [1], [2].

Diversas investigaciones han abordado este fenómeno mediante simulación y modelos estocásticos. Fernández [1] desarrolló un enfoque de simulación microscópica para modelar operaciones en paradas considerando llegadas de pasajeros, intervalos vehiculares, tiempos de permanencia y capacidad. Wang et al. [2] propusieron modelos estocásticos basados en teoría de colas para estimar capacidad de paradas y retrasos utilizando datos observados. Delgado, Muñoz y Giesen [3] analizaron estrategias de control (retención y limitación de abordaje) para mitigar el *bus bunching* y los tiempos de espera. Kieu y Cai [4] estudiaron el proceso estocástico de llegada de pasajeros destacando la importancia de representar adecuadamente sus patrones para estimar demanda y tiempos de espera. Lindberg, Johansson, Peterson y Tapani [5] presentaron un modelo de simulación de eventos discretos para terminales de autobuses con enfoque modular y alta resolución espacial.

Estos antecedentes coinciden en que la frecuencia/variabilidad, la demanda, las restricciones de capacidad y el proceso de abordaje son determinantes del desempeño. No obstante, es necesario integrar estas variables en un modelo controlado que permita observar acumulación de pasajeros y atención de la demanda bajo distintos escenarios. El presente informe documenta un modelo de simulación estocástica de eventos discretos implementado en Python para analizar el efecto de la frecuencia (intervalos) y la capacidad efectiva sobre colas y tiempos de espera en una parada, con énfasis en lo que **realmente** implementa el código fuente.

## 4. Objetivos

### 4.1. Objetivo general

Desarrollar e implementar un modelo de simulación de eventos discretos estocástico en Python para representar las llegadas de pasajeros y autobuses, la disponibilidad estocástica de asientos, la formación y evolución de la cola FIFO y el proceso de abordaje en una parada de transporte público, con el fin de analizar tiempos de espera y la atención de la demanda mediante indicadores verificables.

### 4.2. Objetivos específicos

1) **Implementar el motor de simulación** que represente: proceso de llegadas de pasajeros (Poisson/exponencial), llegadas de autobuses con intervalos Gamma, disponibilidad de asientos Binomial($C,1-p_o$), abordaje $S=\min(Q,F)$ con política FIFO, actualización de cola, registro de tiempos de espera y balance de pasajeros.
2) **Evaluar el comportamiento del sistema** mediante la configuración de escenarios y la ejecución de repeticiones reproducibles, analizando indicadores (cola máxima/media, pasajeros transportados/restantes, tiempos de espera de abordados y censurados) y la clasificación de carga ($\rho^*=\lambda_p/\mu_{efectiva}$).

## 5. Metodología

### 5.1. Enfoque

Cuantitativo. Se utilizan variables numéricas, distribuciones de probabilidad, generación de números aleatorios, ecuaciones matemáticas y métricas estadísticas para obtener resultados numéricos analizables.

### 5.2. Tipo de estudio

Aplicado, descriptivo y comparativo. Es aplicado porque resuelve un problema operativo de transporte público mediante simulación; descriptivo porque caracteriza el comportamiento del sistema bajo distintos parámetros; comparativo porque permite contrastar escenarios predefinidos/modificables mediante indicadores.

### 5.3. Herramientas y recursos

| Recurso | Uso verificable en el proyecto |
|---|---|
| **Python** | Implementación del motor, modelos, servidor/API y lógica. |
| **NumPy** | Generación de números aleatorios (`numpy.random.Generator`), cálculos numéricos y estadísticas. |
| **pytest** | Suite de pruebas automatizadas (`tests/test_simulation.py`, `tests/test_events.py`, `tests/test_saturacion.py`, `tests/test_limite_cola.py`, `tests/test_api.py`). |
| **Heapq / collections.deque** | Cola de prioridad para eventos discretos y cola FIFO de pasajeros. |
| **FastAPI/Uvicorn (server)** | Servidor web/API para interacción con la simulación. |
| **Three.js/React Three Fiber (web)** | Visualización tridimensional (documentada en código de interfaz; ver sección 9). |
| **Git/GitHub** | Control de versiones (presente en el repositorio). |

### 5.4. Procedimiento

Las etapas verificadas en el código son las siguientes:

1. **Identificación y análisis del problema** — Formación de colas en parada con demanda estocástica, intervalos variables y capacidad limitada.
2. **Revisión de literatura científica** — Antecedentes [1]-[5] (verificados en formato IEEE en el borrador).
3. **Selección del modelo** — Simulación de eventos discretos con eventos `LLEGADA_PASAJERO` y `LLEGADA_AUTOBUS`, ordenados por tiempo y con desempate: pasajero tiene mayor prioridad si tiempos iguales (`EventType.LLEGADA_PASAJERO.value < EventType.LLEGADA_AUTOBUS.value`).
4. **Definición de variables y parámetros** — Ver sección 6.
5. **Formulación matemática** — Ver sección 7.
6. **Implementación computacional** — Motor en `models/simulation.py`, clasificación en `models/saturacion.py`, API/servidor en `server/`, interfaz web en `web/`.
7. **Ejecución de experimentos** — Soportada vía `SimulationEngine.ejecutar()`, `ejecutar_repeticiones()`, `comparar_escenarios()`, y escenarios predefinidos en `models/saturacion.py`.
8. **Recolección de resultados** — `SimulationResults` almacena totales, cola máxima/media, tiempos de espera (abordados y restantes/censurados), serie temporal de cola, historial de eventos, saturación operativa.
9. **Representación gráfica** — Soportada por la aplicación (ver sección 9); los resultados numéricos son los del motor.
10. **Comparación y análisis** — Mediante `resumen_metricas()` y comparación entre escenarios.

### 5.5. Evaluación

Las métricas efectivamente calculadas son: pasajeros llegados/transportados/restantes, autobuses llegados, cola máxima, cola media temporal ($\bar{Q}=\frac{1}{T}\int_0^T Q(t)dt$ aproximada por sumas ponderadas), tiempos de espera de abordados ($\bar{W}_a, mediana, p90, p95, W_{max}$), tiempos de espera de restantes/censurados ($W_i = T - t_{i,llegada}$ al finalizar simulación), asientos libres promedio, porcentaje de autobuses sin asientos libres, balance de pasajeros ($N_{llegados}+Q_0 - N_{transportados} - Q_{restante}=0$), tiempo/minutos en saturación operativa ($Q(t)\ge Q_{max,op}$), y clasificación matemática $\rho^*=\lambda_p/\mu_{efectiva}$.

## 6. Variables, parámetros y valores

### 6.1. Parámetros configurables (`SimulationConfig`)

| Símbolo | Descripción | Unidad | Valor por defecto | Notas |
|---|---|---|---|---|
| $\lambda_p$ | Tasa media de llegada de pasajeros | pasajeros/min | 6.0 | Usada en exponencial($\lambda_p$) para $T_p \sim \operatorname{Exp}(\lambda_p)$, media $E[T_p]=1/\lambda_p$. |
| $h$ (`intervalo_promedio`) | Intervalo medio entre autobuses | min | 10.0 | Media de $T_b \sim \operatorname{Gamma}(\alpha,\theta)$. |
| $cv$ (`coef_variacion`) | Coeficiente de variación de intervalos entre autobuses | adimensional | 0.30 | $\alpha = 1/cv^2, \theta = h\,cv^2$. |
| $C$ (`capacidad_autobus`) | Capacidad total del autobús | asientos | 40 | Parámetro de Binomial. |
| $p_o$ (`prob_ocupacion`) | Probabilidad de que un asiento esté ocupado al llegar el autobús | adimensional (0-1) | 0.70 | Usado como $p$ en $\operatorname{Binomial}(C, p)$ para asientos ocupados; asientos libres $F \sim \operatorname{Binomial}(C, 1-p_o)$. |
| $H$ (`duracion`) | Horizonte de simulación | min | 120.0 | Límite para procesar eventos ($t \le H + \epsilon$). |
| $s$ (`semilla`) | Semilla para generador aleatorio | - | None | Reproducible con `numpy.random.Generator`. |
| $Q_0$ (`cola_inicial`) | Pasajeros iniciales en cola al tiempo 0 | pasajeros | 0 | Añadidos con $t_{llegada}=0.0$. |
| `primer_autobus_aleatorio` | Genera primer autobús aleatoriamente desde $t=0$ | bool | True | Si False, programa primer autobús en $t=h$. |
| `num_repeticiones` | Número de repeticiones por configuración | entero | 30 | Usado en `ejecutar_repeticiones()`. |
| $Q_{max,op}$ (`limite_cola`) | Umbral operativo para saturación | pasajeros | 150 | Usado en `clasificar_operacion()` y seguimiento de saturación. |

### 6.2. Variables derivadas

| Símbolo | Fórmula (implementada) | Unidad |
|---|---|---|
| $\alpha$ | $\alpha = 1/cv^2$ | adimensional |
| $\theta$ | $\theta = h\,cv^2$ | min |
| $C_e = E[F]$ | $C_e = C (1 - p_o)$ | asientos/pasajeros (esperado) |
| $\mu_{efectiva}$ | $\mu_{efectiva} = C_e / h$ | pasajeros/min |
| $\rho^*$ | $\rho^* = \lambda_p / \mu_{efectiva}$ (si $\mu_{efectiva}>0$) | adimensional |

### 6.3. Escenario base verificado (del borrador)

Según lo documentado en el borrador: $\lambda_p=6$ pasajeros/min, $h=10$ min, $cv=0.30$, $C=40$, $p_o=0.70$, $H=120$ min. Con estos valores: $E[T_p]=1/6 \approx 0.1667$ min ($10$ s), $E[N_p(10)]=60$, $\alpha \approx 11.111$, $\theta=0.9$ min, $C_e=12$, $E[F]=12$, $\mu_{efectiva}=1.2$ pasajeros/min, $\rho^*=5.0$ (sobrecarga teórica según esa parametrización). Estos son valores teóricos de referencia; el código permite usar distintos valores.

Los escenarios predefinidos en `models/saturacion.py` usan $C=40, p_o=0.70, C_e=12, h=12, \mu=1.0$ para que $\rho=\lambda_p/\mu$ coincida directamente con $\lambda_p$ (0.6, 0.9, 1.0, 2.4).

## 7. Formulación matemática y correspondencia con la implementación

### 7.1. Llegadas de pasajeros

**Modelo implementado:** Proceso de Poisson homogéneo con tasa $\lambda_p$ (pasajeros/min). Los tiempos entre llegadas se generan como $T_p \sim \operatorname{Exponencial}(\lambda_p)$ con función de densidad $f(t)=\lambda_p e^{-\lambda_p t}, t\ge0$, media $E[T_p]=1/\lambda_p$. El número en intervalo $\Delta t$ sigue $N_p(\Delta t)\sim \operatorname{Poisson}(\lambda_p \Delta t)$.

**Implementación:** `RandomGenerator.exponencial(tasa, size)` usa `rng.exponential(scale=1.0/tasa, ...)`. `SimulationEngine._programar_llegada_pasajero()` genera $dt = exponencial(\lambda_p)$, programa evento en $t + dt$ mientras $t \le H$. Cada evento `LLEGADA_PASAJERO` crea un `Passenger` (FIFO), incrementa contador, registra en cola/serie temporal e historia, y reprograma siguiente llegada. El motor también soporta `poisson()` en `RandomGenerator` (presente aunque el mecanismo principal de eventos usa exponencial; esto es consistente con el proceso de Poisson).

### 7.2. Llegadas de autobuses

**Modelo implementado:** Intervalos entre autobuses $T_b \sim \operatorname{Gamma}(\alpha, \theta)$ con parametrización **forma/escala** ($shape=\alpha, scale=\theta$) tal como usa NumPy. 

Parametrización verificada:
$$
\alpha = \frac{1}{cv^2}, \quad \theta = h\,cv^2, \qquad E[T_b]=\alpha\theta = h, \qquad \operatorname{Var}(T_b)=\alpha\theta^2 = h^2 cv^2.
$$

**Implementación:** `SimulationConfig.alpha_gamma` retorna $1/cv^2$, `theta_gamma` retorna $h*cv^2$. `RandomGenerator.gamma(shape, scale, size)` llama `rng.gamma(shape=shape, scale=scale)`. `SimulationEngine._programar_llegada_autobus()` usa `alpha,theta = config.alpha_gamma, config.theta_gamma` y genera $dt \sim Gamma(\alpha,\theta)$. Primer autobús configurable (`primer_autobus_aleatorio` o fijo en $t=h$).

### 7.3. Disponibilidad de asientos

**Modelo implementado:** Cada asiento ocupado con probabilidad $p_o$ independientemente (implícito) al llegar el autobús. Asientos libres $F \sim \operatorname{Binomial}(C, 1-p_o)$, asientos ocupados $O = C - F \sim \operatorname{Binomial}(C, p_o)$.

$$
P(F = k) = \binom{C}{k} (1-p_o)^k (p_o)^{C-k}, \quad E[F] = C (1-p_o).
$$

**Implementación:** `SimulationEngine._procesar_llegada_autobus()` hace `asientos_libres = int(self._rng.binomial(c, p_libre, 1)[0])` donde `p_libre = 1.0 - self.config.prob_ocupacion`, luego acota a $[0,C]$. Se registran `capacidad`, `asientos_libres`, `asientos_ocupados_al_llegar`, y se acumulan promedios/contadores. $C_e = C(1-p_o)$ está disponible en `SimulationConfig.capacidad_efectiva`/`asientos_libres_esperados`.

### 7.4. Proceso de abordaje

**Modelo implementado:** Abordaje FIFO. Pasajeros en cola antes de abordar: $Q_{antes}$. Asientos libres disponibles: $F$. Pasajeros que suben:

$$
S = \min(Q_{antes}, F).
$$

**Implementación:** `abordados = min(cola_antes, asientos_libres)`. Se extraen `abordados` pasajeros del frente de la cola (`quitar_pasajero()` FIFO), se marcan `abordo=True`, se asigna `tiempo_abordaje = tiempo`, se registra $W_i = t_{abordaje}-t_{llegada}$ en `tiempos_espera_abordados`, se actualizan contadores. No hay tiempos de servicio de abordaje modelados explícitamente (el abordaje ocurre en el instante del evento de llegada del autobús). No se observa lógica de prioridades distinta a FIFO.

### 7.5. Evolución de la cola

**Orden de eventos:** Cuando ocurren eventos simultáneos, el heap desempata por `tipo.value` donde `LLEGADA_PASAJERO = 0 < LLEGADA_AUTOBUS = 1`, por lo que las llegadas de pasajeros se procesan antes que la llegada de un autobús en el mismo instante. Esto coincide con lo indicado en el borrador.

**Actualización:** 
- Al llegar pasajero: se agrega a cola, `$Q \leftarrow Q + 1$`, se registra, se programa siguiente llegada.
- Al llegar autobús: se calcula $F$, se extraen $S=\min(Q,F)$ del frente (marcándolos como abordados), `$Q \leftarrow Q - S$`, se registra, se programa siguiente autobús.

**Registro temporal:** `SimulationEngine._registrar(tiempo, tamano)` integra área de cola para $\bar{Q}_{temporal} = \frac{1}{H}\sum \Delta t_i Q_i$ y detecta saturación operativa cuando $Q \ge Q_{max,op}$.

### 7.6. Tiempos de espera

**Para pasajeros abordados:** $W_i = t_{i,abordaje} - t_{i,llegada}$ calculado y almacenado en `tiempos_espera_abordados`. Estadísticos: media, mediana, percentiles p90/p95, máximo (solo sobre abordados).

**Para pasajeros restantes al final:** Se almacenan $W_i^{(cens)} = H - t_{i,llegada}$ en `tiempos_espera_restantes` (longitud = `pasajeros_restantes_cola`). Estos **no** se incluyen en los promedios de espera de abordados — el código distingue explícitamente entre ambos conjuntos.

### 7.7. Indicadores de desempeño (implementados)

| Indicador | Fuente en código | Significado |
|---|---|---|
| `pasajeros_llegados_total` | Contador incrementado en llegada pasajero | Total de pasajeros generados que entraron al sistema. |
| `autobuses_llegados_total` | Incrementado en llegada autobús | Total de autobuses procesados. |
| `pasajeros_transportados_total` | Suma de abordados | Pasajeros que subieron a algún autobús. |
| `pasajeros_restantes_cola` | Cola al finalizar ($t=H$) | Pasajeros que aún esperan (censurados). |
| `cola_maxima` | Máximo de $Q(t)$ registrado | Máxima longitud alcanzada. |
| `cola_media_temporal` | Área_cola / duración | Promedio temporal de longitud de cola. |
| `espera_media_abordados`, mediana, p90, p95, máxima | Sobre `tiempos_espera_abordados` | Estadísticos de espera (solo abordados). |
| `asientos_libres_promedio` | Suma/asientos_libres / num_autobuses_registrados | Promedio de asientos libres por autobús. |
| `autobuses_sin_asientos_libres` / `%` | Contadores | Autobuses que llegaron completos ($F==0$). |
| `tiempo_saturacion_operativa`, `minutos_en_saturacion` | Basado en $Q>=Q_{max,op}$ | Métricas de saturación operativa. |
| `balance_pasajeros()` | $N_{lleg}+Q_0 - N_{transp} - Q_{rest}$ | Debe ser 0 (verificado por pruebas). |

### 7.8. Naturaleza de la simulación

**Simulación de eventos discretos (DES).** El sistema avanza por eventos (`LLEGADA_PASAJERO`, `LLEGADA_AUTOBUS`) en una cola de prioridad (`heapq`), actualizando el estado únicamente en instantes de evento. Los tiempos entre eventos son continuos (generados por exponencial/gamma), pero la dinámica es discreta en eventos — esto es característico de DES con tiempos continuos entre llegadas. Es **estocástica** (distribuciones probabilísticas + semilla reproducible). No es simulación de tiempo continuo por ecuaciones diferenciales ni simulación puramente de tiempo discreto con pasos fijos.

### 7.9. Reproducibilidad y aleatoriedad

- **Generador:** `numpy.random.Generator` via `RandomGenerator`. Métodos: `exponencial(tasa)`, `gamma(shape,scale)`, `poisson(lam)`, `binomial(n,p)`.
- **Semilla:** Configurable por simulación (`SimulationConfig.semilla`, `SimulationEngine` acepta semilla). `ejecutar_repeticiones()` usa `semilla_base + i` para repeticiones independientes pero reproducibles.
- **Reproducibilidad:** Verificada por pruebas (`test_reproducibilidad_semilla`, `test_reproducibilidad` en generador).
- **Separación:** Parámetros en `SimulationConfig`, estado del generador encapsulado en `RandomGenerator`.

### 7.10. Clasificación de carga

`models/saturacion.py` define clasificación matemática basada en $\rho = \lambda_p / \mu_{efectiva}$ con $\mu_{efectiva}=C_e/h$: `ESTABLE` ($\rho<1$ y < umbral), `ALTA_UTILIZACION` ($umbral \le \rho < 1$), `CRITICO` ($|\rho-1|\le \epsilon$), `SOBRECARGADO` ($\rho>1$), `SIN_SERVICIO` ($\mu\le0, \lambda_p>0$), `INACTIVO`. Existe distinción explícita entre estado **matemático** (parámetros), estado **operativo** (cola real vs $Q_{max,op}$) y estado **visual** (interfaz). Escenarios ilustrativos verificables por `comprobar_escenarios()`.

## 8. Comparación con el borrador y requisitos

### 8.1. Título/tema
- **Borrador:** Sugiere comparativo de modelos determinísticos/estocásticos/discretos/continuos.  
- **Implementación real:** Solo modelo **estocástico de eventos discretos**. Se ajusta el tema a lo efectivamente implementado (sección 1).

### 8.2. Objetivos
- **Borrador:** Planteaba comparar modelos determinísticos/estocásticos/discretos/continuos.  
- **Implementación real:** Implementa y evalúa un modelo DES estocástico con distintos escenarios. Se reescriben objetivos para reflejar lo verificable (sección 4). Se mantienen exactamente dos objetivos específicos.

### 8.3. Formulación matemática
- **Borrador:** Presenta ecuaciones mayormente coherentes con la implementación (Poisson/exponencial, Gamma con $\alpha=1/cv^2, \theta=h cv^2$, Binomial($C,1-p_o$), $S=\min(Q,F)$, FIFO con procesamiento de llegadas antes de autobús en mismo instante).  
- **Ajustes necesarios:** Distinguir explícitamente que promedio de espera reportado corresponde **solo a pasajeros abordados**; los restantes son censurados. Clarificar parametrización forma/escala de Gamma (NumPy). Especificar desempate de eventos.

### 8.4. Herramientas
- **Borrador:** Menciona NumPy, Matplotlib, Rich, pytest, pandas.  
- **Verificado:** NumPy, pytest usados. Matplotlib/Rich/pandas pueden estar presentes en entorno/dependencias pero su uso debe verificarse caso a caso; la auditoría se basa en código fuente del repositorio. Se documentan tecnologías verificadas.

### 8.5. Declaratoria de IA
- **Borrador:** Menciona Gemini (mejora de redacción) y ChatGPT (planificación/revisión de implementación 3D, animación, integración).  
- **Acción:** Se conserva estructura, se requiere completar prompt principal si no está disponible en archivos (marcador). No se inventan prompts.

## 9. Interfaz web y visualización tridimensional

Verificado en estructura: `web/` contiene componentes (incluye `Scene3D.tsx`, `BusStopScene.tsx`, `PassengerModel.tsx`, `BusModel.tsx`), `server/` con API FastAPI (`app.py`), `main.py` arranca servidor web. Tecnologías observadas: React/TypeScript, Three.js, React Three Fiber (basado en nombres de archivos/componentes). La sincronización entre animación y motor matemático debe verificarse en código de integración; el presente informe **no** afirma acoplamiento completo sin evidencia línea a línea, limitándose a documentar tecnologías y componentes detectados. Los resultados visuales deben provenir del motor real cuando estén conectados; cualquier elemento puramente decorativo no se presenta como métrica.

## 10. Resultados

### 10.1. Resultados del objetivo específico 1 (Implementación del motor)

**Evidencia verificable:**
- Clases/estructuras: `SimulationConfig`, `Passenger`, `Bus`, `PassengerQueue` (FIFO), `RandomGenerator`, `EventType` (desempate), `SimulationResults`, `SimulationEngine`.
- Generadores: exponencial (Poisson), gamma (Gamma con forma/escala), binomial, poisson.
- Eventos: programación con heap, procesamiento en orden correcto con desempate, reprogramación.
- Lógica de abordaje: `S = min(Q,F)`, marcado de abordados, registro de tiempos, FIFO.
- Métricas y balance: `balance_pasajeros() == 0` verificado por pruebas.
- Reproducibilidad: semillas funcionan correctamente.

### 10.2. Resultados del objetivo específico 2 (Evaluación/comparación)

**Evidencia verificable:**
- Funciones: `ejecutar_repeticiones()`, `resumen_metricas()`, `comparar_escenarios()`, escenarios predeterminados.
- Escenarios ilustrativos en `models/saturacion.py` con clasificación verificable (`comprobar_escenarios()`).
- Pruebas cubren: reproducibilidad, balance, límites de ocupación/capacidad, cola vacía, censura de tiempos restantes, desempate de eventos.

**Datos experimentales pendientes:** No se encontraron archivos de resultados numéricos (CSV/JSON/reportes) en la raíz que contengan corridas verificadas. Por consiguiente, se omiten tablas con promedios de ejecución concreta. 

`[PENDIENTE: incorporar resultados experimentales verificados (corridas con semilla/configuración documentada)]`  
`[PENDIENTE: confirmar el escenario y sus parámetros usados para resultados numéricos]`

## 11. Discusión

El modelo implementado es coherente con la literatura revisada [1]-[5]: usa DES, representa estocasticidad en llegadas e intervalos, considera capacidad limitada y proceso de abordaje. La distinción entre tiempos de espera de abordados vs restantes es metodológicamente correcta (evita sesgo al incluir solo completados). El orden de eventos con prioridad a llegadas de pasajeros en instantes iguales es un detalle importante para consistencia. La clasificación separando estado matemático/operativo/visual es razonable. 

Sin resultados numéricos ejecutados/verificados en el repositorio, no es posible comparar cuantitativamente con valores reportados en los artículos citados. Cualquier comparación cuantitativa quedaría especulativa. Las limitaciones incluyen: sin modelado explícito de tiempos de servicio/embarque, sin prioridades distintas a FIFO, sin consideraciones de paradas múltiples o transferencias, sin análisis de intervalos de confianza más allá de lo que provee `resumen_metricas()` con desviación estándar (cuando hay >=2 repeticiones).

## 12. Conclusiones

1. **Respecto al objetivo 1:** Se implementó un motor de simulación de eventos discretos estocástico que reproduce correctamente los elementos identificados: proceso de Poisson para pasajeros, Gamma(forma/escala) para intervalos con $\alpha=1/cv^2, \theta=h cv^2$, Binomial($C,1-p_o$) para asientos libres, abordaje FIFO con $S=\min(Q,F)$, desempate a favor de llegadas de pasajeros en tiempo simultáneo, registro de tiempos de espera diferenciando abordados/censurados, y balance de pasajeros verificado.
2. **Respecto al objetivo 2:** La infraestructura para evaluación comparativa existe (`ejecutar_repeticiones`, `comparar_escenarios`, escenarios predefinidos, clasificación de carga). Sin embargo, **no hay evidencia de resultados experimentales ejecutados y almacenados** en el repositorio al momento de la auditoría; las conclusiones cuantitativas requieren incorporar corridas verificadas con configuración y semillas documentadas.

`[PENDIENTE: completar conclusiones cuantitativas tras incorporar resultados experimentales verificados]`

## 13. Recomendaciones

- **Reproducibilidad:** Documentar en `README` o en informe las semillas, configuración exacta y versión para corridas reportadas.
- **Análisis estadístico:** Ampliar `resumen_metricas()` para incluir intervalos de confianza (t-Student) y número de réplicas justificado.
- **Validación:** Comparar con casos límite teóricos (p.ej., $\lambda_p \to 0$, $F \ge Q$ siempre) — parte ya cubierta por pruebas.
- **Modelo:** Considerar tiempos de abordaje/servicio si se desea mayor realismo; documentar explícitamente que no están modelados.
- **Resultados:** Ejecutar escenarios base/comparativos con semillas fijas y guardar salidas verificables (JSON/CSV) antes de reportar promedios.
- **Visualización:** Verificar y documentar acoplamiento motor-animación (sincronización temporal) si se reportan métricas visuales.

## 14. Referencias

[1] R. Fernández, “Modelling public transport stops by microscopic simulation,” *Transportation Research Part C: Emerging Technologies*, vol. 18, no. 6, pp. 856–868, 2010, doi: 10.1016/j.trc.2010.02.002.

[2] C. Wang, Z. Ye, J. D. Fricker, Y. Zhang, and S. V. Ukkusuri, “Bus capacity estimation using stochastic queuing models for isolated bus stops in China,” *Transportation Research Record: Journal of the Transportation Research Board*, vol. 2672, no. 8, pp. 108–120, 2018, doi: 10.1177/0361198118777358.

[3] F. Delgado, J. C. Muñoz, and R. Giesen, “How much can holding and/or limiting boarding improve transit performance?,” *Transportation Research Part B: Methodological*, vol. 46, no. 9, pp. 1202–1217, 2012, doi: 10.1016/j.trb.2012.04.005.

[4] L. M. Kieu and C. Cai, “Stochastic collective model of public transport passenger arrival process,” *IET Intelligent Transport Systems*, vol. 12, no. 9, pp. 1027–1035, 2018, doi: 10.1049/iet-its.2018.0085.

[5] T. Lindberg, F. Johansson, A. Peterson, and A. Tapani, “Discrete event simulation of bus terminals: A modular approach with a high spatial resolution,” *Journal of Advanced Transportation*, vol. 2021, Art. no. 8862893, 2021, doi: 10.1155/2021/8862893.

## 15. Bibliografía complementaria

`[PENDIENTE: verificar fuentes adicionales consultadas que no fueron citadas directamente]`

## 16. Declaratoria de uso de inteligencia artificial

**Herramienta de Inteligencia Artificial utilizada:** Gemini  
**Forma en que se utilizó la herramienta:** Apoyo para mejorar la redacción del texto (según declaración del borrador).  
**Prompt utilizado:** `[PENDIENTE: incorporar el prompt original utilizado]`

**Herramienta de Inteligencia Artificial utilizada:** ChatGPT  
**Forma en que se utilizó la herramienta:** Apoyo en la planificación, revisión y mejora de la implementación del proyecto de simulación de transporte, especialmente en el diseño de la interfaz web tridimensional, la animación de pasajeros y autobuses, y la integración visual con el motor matemático existente (según declaración del borrador).  
**Prompt utilizado:** “Analiza la estructura del proyecto de simulación de transporte y propone e implementa mejoras en la visualización 3D, la animación de pasajeros y autobuses, los controles de velocidad y cámara, y la interfaz web, preservando la lógica matemática y verificando el funcionamiento mediante pruebas.”  
**Enlace al prompt completo:** `[PENDIENTE: incorporar enlace/prompts completos si existen]`

*El uso de herramientas de IA no exime al estudiante de la responsabilidad sobre el contenido, resultados, análisis, referencias y conclusiones presentadas en este informe.*
