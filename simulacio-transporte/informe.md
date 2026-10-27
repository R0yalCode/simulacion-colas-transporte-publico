Resumen— El presente informe aborda …

PALABRAS CLAVE: Teoría de colas, Modelos estocásticos, Transporte público, Python

I. INTRODUCCIÓN

El transporte público constituye un componente fundamental de la movilidad urbana, ya que permite el desplazamiento de un gran número de personas mediante recursos compartidos, como los autobuses y las paradas. Sin embargo, cuando la demanda de pasajeros supera la capacidad de atención del servicio, o cuando los tiempos de llegada entre autobuses son demasiados largos o irregulares, pueden producirse una gran cola de pasajeros, incrementos en los tiempos de espera y situaciones en las que algunos usuarios no logran abordar el autobús disponible. Por esta razón, analizar la relación entre la frecuencia de los autobuses, la demanda de pasajeros y la capacidad de transporte resulta importante para comprender el comportamiento del sistema y evaluar alternativas que contribuyan a mejorar su funcionamiento [1], [2].
Diversas investigaciones han estudiado estos fenómenos mediante modelos matemáticos y técnicas de simulación. Entre estas investigaciones está la de Fernández [1] donde desarrolló un enfoque de simulación microscópica para analizar de forma cuantitativa y modelar las operaciones en las paradas del transporte público, considerando la interacción entre la llegada de pasajeros, los intervalos entre vehículos, los tiempos de permanencia y la capacidad de las instalaciones. Su aporte teórico consiste en conceptualizar la parada no únicamente como un espacio físico, sino que como un sistema de colas que es concurrente e interactivo entre vehículos y los usuarios. De etsa forma, Fernandez demostró que la formación de estas colas de buses y lso tiempos de espera de los usuarios se afectan entre sí.

Por su parte, Wang et al. [2] propusieron modelos estocásticos basados en la teoría de colas para estimar la capacidad de las paradas de autobús y los retrasos de los vehículos. Su aporte de investigación usó datos observados en campo para evaluar el desempeño de sus modelos. Al agregar la variabilidad inseparable del tráfico urbano y del tiempo de abordar, su trabajo ayudo a calcular numéricamente los grados de saturación y también de la probabilidad de que se formen colas en las paradas, proponiendo una herramienta matemática para evaluar el problema del nivel del servicio y la interrupción vehicular cuando hay mucha demanda y esta supera su capacidad teórica de la parada.

Asimismo, Delgado, Munoz y Giesen [3] analizaron estrategias dinámicas y de control para reducir los efectos del agrupamiento de autobuses (bus bunching) y los tiempos de espera de los pasajeros, considerando tanto la regulación de la permanencia de los vehículos como la limitación del número de pasajeros que pueden abordar. Su aporte principal fue evaluar de forma cuantitativa la unión de dos mecanismos  de control en tiempo real, los cuales fueron, la retención  de forma coordinada de vehículos en paradas (holding) y la imposición de límites de abordaje (boarding limits). 

Por otro lado, Kien y Cai [4] estudiaron el proceso estocástico de llegada de los pasajeros a las paradas y centraron su investigación en la caracterización probabilística del  proceso de los pasajeros al llegar a las paradas de buses y su interacción con el servicio y su frecuencia. Los autores enfatizaron que si se asume patrones de llegada uniformes o con tasas constantes se ingresan sesgos significativos a la hora de estimar los tiempos de espera y los niveles de ocupación de los buses, en especial en las líneas con mayor frecuencia. Aportando además modelos estocásticos para plasmar las variaciones temporales al momento de la llegada de pasajeros, y con ello poder predecir la acumulación de pasajeros con mayor acierto y analizar el impacto de la demanda del servicio.

Además, Lindberg y Tapani [5] presentaron un modelo de simulación de eventos discretos para evaluar las operaciones en terminales de autobuses y las interacciones entre vehículos, con el propósito de estudiar problemas operativos y la formación de colas. Su estudio resaltó las interacciones microscópicas entre las diversas líneas o rutas autobuses que comparten andenes y carriles con poca margen de maniobra. Siguiendo diversos puntos como la llegada, la transferencia de usuarios, y la salida del mismo, identificaron que había cuellos de botella  y una formación de colas que eran causas por la interacción entre sí de las unidades, otorgando una metodología para la optimización de las paradas y el diseño de las terminales.

En conjunto, estos antecedentes muestran que la frecuencia de llegada de los autobuses, la variabilidad de los tiempos de servicio, la demanda de pasajeros y las restricciones de capacidad son factores relevantes para el desempeño del transporte público. No obstante, para el problema abordado en este trabajo, resulta necesario integrar estas variables en un modelo de simulación que permita comparar diferentes escenarios bajo condiciones controladas y observar sus efectos sobre la acumulación de pasajeros y la atención de la demanda. Esta aproximación facilita el análisis de situaciones en las que la capacidad disponible de cada autobús no es suficiente para atender a todos los pasajeros que esperan en la parada.

Por lo tanto, en el presente informe se desarrolló un modelo de simulación estocástica para analizar el efecto de la frecuencia de llegada de los autobuses y de su capacidad limitada sobre el comportamiento de las colas de pasajeros. Mediante la evaluación de distintos escenarios, se estudiarán indicadores como la longitud de la cola, el tiempo promedio de espera, la cantidad de pasajeros que logran abordar y aquellos que permanecen esperando después de la llegada de un autobús. Los resultados permitirán comparar el desempeño del sistema bajo diferentes condiciones de la operación y comprender cómo la variación de los parámetros de operación y comprender cómo la variación de los parámetros influye en la calidad del servicio.

II. OBJETIVOS
A. Objetivo general
Desarrollar una simulación de eventos discretos para representar el comportamiento de la fila de pasajeros en una parada de autobuses, mediante modelos probabilísticos y el análisis de diferentes escenarios, con el fin de evaluar los tiempos de espera y la cantidad de pasajeros transportados.

B. Objetivos Específicos
1)	Implementar un modelo de simulación de eventos discretos que represente las llegadas de pasajeros y autobuses, la disponibilidad de asientos y el proceso de abordaje.

2)	Evaluar el comportamiento de la fila de espera mediante la ejecución y comparación de diferentes escenarios, utilizando indicadores estadísticos y representaciones gráficas de los tiempos de espera y la cantidad de pasajeros transportados.


		III. METODOLOGÍA 

A. Enfoque
La presente investigación tiene un enfoque cualitativo, debido a que utiliza variables y modelos matemáticos para simular la llegada de pasajeros, los intervalos entre autobuses y la disponibilidad de asientos. A partir de estos parámetros, se obtienen resultados numéricos que permiten analizar el comportamiento de la fila de espera, los tiempos de espera y la cantidad de pasajeros transportados. Además, los resultados se representan mediante gráficas para comparar distintos escenarios.

B. Tipo de estudio

La investigación es de tipo aplicada, ya que utiliza conocimientos matemáticos y técnicas de simulación para analizar el funcionamiento de una parada de autobuses. Asimismo, es descriptiva, porque permite representar el comportamiento de las variables del sistema, como la llegada de pasajeros, los intervalos entre autobuses y la disponibilidad de asientos. Finalmente, es comparativa, debido a que se analizan diferentes escenarios mediante la modificación de estos parámetros y la comparación de los resultados obtenidos, como el tamaño de la fila y los tiempos de espera.

C. Herramientas y recursos 

Para el desarrollo de la simulación se utilizaron las siguientes herramientas y recursos:
Lenguaje de programación: Python, utilizado para implementar la lógica de la simulación, procesar los parámetros de entrada y obtener resultados numéricos para su análisis.

Bibliotecas: NumPy, para los cálculos numéricos y la generación de variables aleatorias; Matplotlib, para elaborar las gráficas estadísticas; y Rich, para presentar el menú y la evolución de la simulación en la terminal. También se utiliza pytest para realizar pruebas del funcionamiento del sistema y pandas para organizar y exportar los resultados cuando sea necesario.

Software de desarrollo: Visual Studio Code, utilizado para escribir, organizar, ejecutar y depurar el código del proyecto, además de la terminal para levantar el proyecto. 

Control de versiones: Se utilizó Git, GitHub, Git Kraken como herramientas  para el control de versiones y trabajo en equipo, permitiendo que cada integrante pueda tener una copia del código a trabajar y ahí vaya implementando sus funcionalidades para después unir las ramas y llegar a un código final. 

Datos y parámetros de entrada: tasa de llegada de pasajeros, intervalo medio entre autobuses, capacidad de los autobuses, porcentaje de ocupación, horizonte temporal y semilla aleatoria. Estos parámetros permiten configurar y comparar diferentes escenarios de simulación.

Modelos matemáticos:  se emplean distribuciones de probabilidad para representar la llegada de pasajeros y la disponibilidad de asientos, así como ecuaciones para calcular los pasajeros que suben a cada autobús, la evolución de la fila y los tiempos de espera

D. Procedimientos

El desarrollo de este trabajo está estructurado en las siguientes etapas las cuales son:
Etapa 1. Identificación y análisis del problema: Se identificó la necesidad de analizar la formación de filas de pasajeros en una parada de autobuses, considerando la llegada aleatoria de personas, los intervalos entre autobuses y la disponibilidad de asientos. A partir de ello, se establecieron las variables y los indicadores necesarios para evaluar el comportamiento del sistema.

Etapa 2. Revisión de literatura científica: Se revisó literatura científica relacionada con los sistemas de colas, la simulación de eventos discretos y los modelos probabilísticos aplicados al transporte público. Se consideraron publicaciones consultadas en bases de datos como IEEE Xplore, ACM Digital Library y ScienceDirect. 

Etapa 3. Selección de los modelos: Se seleccionó un modelo de simulación de eventos discretos para representar la llegada de pasajeros y autobuses, la formación de la fila y el abordaje. Se utilizaron distribuciones probabilísticas para incorporar la variabilidad de las llegadas y de los asientos disponibles.

Etapa 4. Definición de variables y parámetros:  Se establecieron las siguientes variables y parámetros para representar el sistema:


Símbolo
Descripción
Unidad
    p
Tasa media de llegada de pasajeros
Pasajeros/min
    h
Intervalo medio entre autobuses
Minutos
    Tp
Tiempo entre llegadas de pasajeros
Minutos
  Tb
Tiempo entre llegadas de autobuses
Minutos
 C
Capacidad total del autobús
Asientos
      po
Probabilidad de que un asiento esté ocupado al llegar el autobús
Adimensional
     F
Asientos disponibles al llegar el autobús
Asientos
   Q(t)
Cantidad de pasajeros en espera
Pasajeros
     S
Pasajeros que suben al autobús
Pasajeros
     H
Horizonte de simulación
Minutos


Los parámetros iniciales del escenario base son:

Parámetro
Símbolo
Valor
Tasa de llegada de pasajeros

0,6 pasajeros/min
Intervalo medio entre autobuses
h
12,0 min
Coeficiente de variación de intervalos
cv
0,30
Capacidad del autobús
C
40 asientos
Ocupación de referencia
po
70 %
Horizonte de simulación
H
120 min



Estos valores son configurables y pueden modificarse para comparar escenarios.

Etapa 5. Formulación de los modelos matemáticos: 

5.1. Llegada de pasajeros
Se considera que los pasajeros llegan de forma independiente, siguiendo un proceso de Poisson con tasa media constante p.
Fórmula 1. Número de pasajeros que llegan en un intervalo
Nₚ(Δt) ~ Poisson(pΔt)
Fórmula 2. Probabilidad de llegada de k pasajeros
P(Np=k)=(pΔt)ke-pΔtk!
Fórmula 3. Tiempo entre llegadas de pasajeros
Tₚ ~ Exponencial (p) 

E[Tp]=1p
Con p=6 pasajeros/min, el tiempo medio entre llegadas es de 10 segundos.
5.2. Llegada de autobuses
En este modelo, los intervalos entre autobuses siguen una distribución Gamma para representar la variabilidad de las llegadas manteniendo un intervalo medio configurable.

Fórmula 4. Distribución de los intervalos entre autobuses
T ~ Gamma (∝, ө)
Los parámetros de la distribución se calculan mediante:
=1cv2,θ=hcv2
Donde h es el intervalo medio entre autobuses, cv  
es su coeficiente de variación,  es el parámetro de forma y  es el parámetro de escala.

Fórmula 5. Tiempo medio entre autobuses
E[Tb]=αθ=h
Para el escenario base, h=10 minutos y cv=0,30. Por tanto, el modelo mantiene un intervalo medio de 10 minutos, con variaciones aleatorias entre llegadas.
5.3. Disponibilidad de asientos
Se considera que cada asiento tiene una probabilidad independiente po de estar ocupado cuando llega el autobús.
Fórmula 6. Número de asientos disponibles
F ~ Binomial (C, 1 - Pо)
La cantidad esperada de asientos disponibles es:
E[F]=C(1-po)
Para C=40 y po=0,70, se esperan, en promedio, 12 asientos disponibles por autobús.
5.4. Abordaje de pasajeros
El autobús recoge pasajeros de acuerdo con la cantidad que espera en la parada y el número de asientos disponibles.
Fórmula 7. Pasajeros que suben al autobús
S=(Q,F)
Donde Q es la cantidad de pasajeros en espera y F es el número de asientos disponibles.
5.5. Evolución de la fila
La fila aumenta con las nuevas llegadas y disminuye cuando los pasajeros suben al autobús.
Fórmula 8. Actualización de la fila después de las llegadas
Q+=Q-+Ap
Fórmula 9. Actualización de la fila después del abordaje

Qnuevo=Qanterior-S
Donde Ap representa los pasajeros que llegan al evento y S la cantidad que sube al autobús.
Para garantizar que los resultados sean consistentes, las llegadas de pasajeros se procesan antes que la llegada del autobús cuando ambos eventos ocurren en el mismo instante.
5.6. Indicadores de desempeño
Además de las fórmulas anteriores, se registran los indicadores que permiten evaluar los escenarios:
Tiempo de espera de cada pasajero
Wi=ti,subida-ti,llegada
Cantidad máxima de pasajeros en espera

Q=0≤t≤HQ(t)
Estos indicadores permiten analizar el tiempo que esperan los pasajeros y el tamaño máximo que alcanza la fila durante la simulación.

 Etapa 6.  Implementación computacional: El modelo matemático se implementó en Python mediante una simulación de eventos discretos. El programa permite configurar los parámetros de entrada, representar la llegada de pasajeros y autobuses, actualizar la fila de espera y registrar los pasajeros transportados, generando gráficas para su respectivo análisis.
Etapa 7.  Ejecución de los experimentos: Se ejecutó la simulación utilizando los parámetros establecidos para el escenario base. Posteriormente, se modificaron las tasas de llegada de pasajeros, los intervalos entre autobuses, la capacidad y la ocupación para evaluar diferentes condiciones de operación
Etapa 8. Recolección de resultados: Durante cada ejecución se registraron los datos necesarios para evaluar el sistema, como la cantidad de pasajeros que llegan, los pasajeros transportados, la evolución de la fila, los tiempos de espera y la cantidad máxima de personas en espera. Los resultados se almacenaron para el respectivo análisis. 
Etapa 9.  Representación gráfica de los datos: Los resultados obtenidos se representaron mediante gráficas estadísticas que permiten observar la evolución de la fila, comparar los pasajeros que llegan y los que son transportados, analizar los tiempos de espera y visualizar las diferencias entre escenarios.
Etapa 10.  Comparación y análisis de los resultados: Finalmente, se compararon los resultados de los diferentes escenarios para identificar cómo los cambios en los parámetros afectan la fila de espera, los tiempos de espera y la cantidad de pasajeros transportados. A partir de esta comparación, se analizaron las condiciones que favorecen o dificultan el funcionamiento del sistema.

E. Evaluación
	Se realizó la evaluación del sistema mediante análisis que indicaron el desempeño que tuvo durante su ejecución se consideraron parámetros como:
Evaluación de la fila de espera.
Tiempo de espera de los pasajeros.
Cantidad de pasajeros transportados. 
Cantidad máxima de personas que permanecen en la parada.
Estos indicadores permitieron determinar el comportamiento y variaciones del sistema en cuanto a la entrada influyente en la acumulación de pasajeros y el servicio proporcionado por los autobuses. 

Para realizar la evaluación se establece un escenario base con una tasa media de llegada de pasajeros de 6 pasajeros por minuto, un intervalo medio entre autobuses de 10 minutos, un coeficiente de variación de los intervalos de 0,30, una capacidad de 40 asientos y una ocupación de referencia del 70 %. El tiempo de cada simulación fue de 120 min a partir de la estimación de estos parámetros se generaron simulaciones con escenarios alternativos bajo diferentes condiciones de operación.  

Los criterios a evaluar se definieron de acuerdo a los objetivos planteados:
Evaluación de la acumulación de pasajeros: 
Se analizó la evolución de la cantidad de pasajeros en espera durante el tiempo y su valor máximo, lo que permitió determinar en qué condiciones se produce una mayor acumulación de personas y cómo influyen las llegadas de pasajeros, los intervalos entre autobuses y la disponibilidad de asientos.

Evaluación de tiempos de espera: 
Se analizaron los tiempos de espera de los pasajeros que lograron tomar el bus, calculados a partir de la diferencia entre el abordaje y la llegada a la parada. Se utilizó el tiempo de espera promedio para comparar los escenarios y determinar cuáles presentaron mejores condiciones de servicio, los pasajeros que permanecieron en la fila al finalizar la simulación no se consideraron debido a que su tiempo de espera aun no concluye. 

Evaluación de los pasajeros transportados:
Se contabilizó la cantidad total de pasajeros que abordaron los autobuses durante el tiempo de simulación. Este indicador permitió examinar la capacidad del sistema para atender la demanda generada y comparar el efecto de las variaciones en la capacidad de los autobuses, su ocupación inicial y la frecuencia de llegada.

Evaluación de la influencia de los parámetros:
Se compararon los resultados obtenidos al modificar la tasa de llegada de pasajeros, el intervalo medio entre autobuses, el coeficiente de variación de los intervalos, la capacidad y el porcentaje de ocupación. Se buscó identificar las relaciones entre estos parámetros y los indicadores de crecimiento de la fila, los tiempos de espera y la cantidad de pasajeros transportados.

Evaluación de la consistencia del modelo:
Se verificó que la evolución de la fila fuera coherente con los eventos simulados. Se comprobó que las nuevas llegadas incrementaron la cantidad de pasajeros en espera y que el abordaje la redujera según el número de personas disponibles y los asientos libres del autobús. De igual forma se consideró la utilización de una semilla aleatoria para facilitar la reproducción de las ejecuciones y se  contemplaron pruebas del funcionamiento del programa para detectar posibles errores en los cálculos y en la lógica de los eventos.

Los resultados se analizaron mediante tablas y gráficas estadísticas que permitieron una mejor observación de los resultados de la simulación. Finalmente se noto que un escenario presenta mejores condiciones cuando operan en comparación con otro y bajo condiciones equivalentes, registra menos niveles de acumulacion de pasajeros y menor tiempo de espera sin reducir la cantidad de personas transportadas. De esa manera se pudo identificar las condiciones favorables de la parada de autobuses.

IV. RESULTADOS

Resultados del objetivo específico 1:


Gráfica 1. Evolución de la fila de pasajeros

Tabla 1. Parámetros del escenario base

Parámetro
Símbolo
Valor
Tasa de llegada de pasajeros

0,6 pasajeros/min
Intervalo medio entre autobuses
h
12,0 min
Coeficiente de variación de intervalos
cv
0,30
Capacidad del autobús
C
40 asientos
Ocupación de referencia
po
70 %
Horizonte de simulación
H
120 min


Como se observa en la Tabla 1, estos parámetros  

Resultados del objetivo específico 2:

Gráfica 2. Comparación de la evolución de la fila entre escenarios


Gráfica 3. Comparación de los tiempos de espera

Gráfica 4. Pasajeros que llegan frente a pasajeros transportados

V. DISCUSIÓN

A través de la simulación de eventos nos permitió comprender el comportamiento de las filas de espera en las paradas de transporte. El modelo desarrollado evidencia cómo la interacción entre la aleatoriedad en la llegada de pasajeros, la irregularidad de los intervalos entre autobuses y la restricción de capacidad residual genera cuellos de botella operativos que inciden de manera no lineal.

Interpretación de los Resultados

En el escenario base, con una tasa media de llegada de pasajeros de p=0,6pas/min y un intervalo medio entre autobuses de h=12,0min, el volumen promedio de usuarios que es de 7,2 personas. Dado que la capacidad de los vehículos es de C=40 asientos y presentan una ocupación previa de referencia del po = 70%, la disponibilidad esperada de asientos vacíos al llegar a la parada es de E[F]=12 asientos. Teóricamente, la oferta de transporte superaría a la demanda promedio.
Sin embargo, los resultados simulados muestran la formación reiterada de colas residuales (Q>0) y la acumulación progresiva de usuarios en el tiempo. Este comportamiento responde a la estocasticidad incorporada en el sistema:
Llegadas de pasajeros: Las llegadas presentan tiempos entre arribos distribuidos exponencialmente (E[Tp]=10 segundos), lo que genera ráfagas y concentraciones puntuales de usuarios que elevan temporalmente la fila máxima (Q).
Variabilidad en los intervalos de servicio: Tienen un coeficiente de variación cv=0,30, los autobuses no arriban a intervalos homogéneos de 12 minutos. Cuando el intervalo entre vehículos se expande por fluctuaciones estocásticas, la cola Q(t) crece linealmente con el tiempo acumulado de espera; al llegar el autobús, el número de abordajes queda estrictamente limitado por los asientos disponibles FBinomial(C,1-po). Si Q>F, la cantidad de pasajeros que suben es S=F, dejando una fracción de usuarios insatisfechos en la parada que deben aguardar por el siguiente vehículo, disparando el tiempo de espera individual Wi.

Comparación con Trabajos Científicos Relacionados

Fernández: Al ratificar que las operaciones en las paradas dependen críticamente de la acoplada interacción entre las llegadas de usuarios, los intervalos entre vehículos y los tiempos de permanencia y capacidad de las instalaciones. La simulación valida que evaluar la parada únicamente por la capacidad nominal del autobús (C=40genera estimaciones erróneas, siendo la capacidad residual el determinante de la cola.
Wang et al.: La necesidad de aplicar modelos estocásticos para estimar el desempeño y los retrasos en paradas de autobús. Los experimentos de simulación demuestran que cuando la ocupación de referencia po es elevada (70%) o la variabilidad de llegadas sube, la cola no alcanza una estabilidad permanente de H=120 min, sino que se obtiene picos críticos.
Delgado, Muñoz y Giesen3: La acentuación de las filas producto de la variabilidad en los tiempos de llegada (cv=0,30respalda las observaciones respecto al agrupamiento de autobuses y sus efectos en el servicio. Los retrasos en un autobús no solo aumentan la cola de la parada y saturan la capacidad de abordaje del vehículo retrasado.
Kieu y Cai4: La modelación Poisson / Exponencial utilizada confirma que la variabilidad aleatoria en los patrones de llegada es responsable de las desviaciones entre la cola promedio esperada y la cola máxima real observada en las simulaciones.
Lindberg y Tapani5: El empleo de la simulación de eventos discretos (DES) demuestra ser una herramienta eficaz para examinar la formación de filas e interacciones operativas bajo condiciones controladas sin necesidad de alterar el sistema real.

Ventajas y Limitaciones de la Metodología Utilizada

Ventajas del método:
Modelización estocástica integral: El modelo acopla  la variabilidad de la demanda (Poisson), la variabilidad de la oferta de transporte (Gamma) y la incertidumbre en la disponibilidad física de asientos (Binomial)..
Flexible y de bajo costo: La arquitectura permite evaluar múltiples escenarios de operación en poco tiempo computacional y con repetibilidad probabilística mediante control de semillas aleatorias.
Representación de dinámicas transitorias: Permite registrar la evolución evento por evento de la fila Q(t), capturando estados de congestión momentánea que quedan invisibles en promedios estáticos.
Limitaciones del método:
Parámetros de llegada estacionarios: El modelo asume una tasa media de llegada de pasajeros (p) constante a lo largo de las 2 horas de simulación (H=120 min), omitiendo los perfiles dinámicos con picos temporales característicos de las horas punta.
Ausencia de comportamiento adaptativo: Se asume que los pasajeros permanecen en la fila hasta abordar, sin contemplar la frustración o el abandono de la parada tras tiempos de espera prolongados.
Análisis de parada aislada: El estudio se concentra en una única parada y línea de transporte, sin incorporar dinámicas de red, transbordos o interferencias entre múltiples líneas en una misma bahía de abordaje.
4. Aportes de la Investigación frente a los Estudios Revisados

Generó un marco accesible y modular que cuantifica el impacto de la ocupación previa de los vehículos (po) en la generación de colas de usuarios. Se analizó paradas con capacidad teórica completa o modelos matemáticos abstractos, se demostró que en sistemas de transporte urbano con alta saturación previa, se generaron ligeros incrementos en la tasa de llegada de pasajeros o en la variabilidad de los intervalos degeneran en un crecimiento desproporcionado de los tiempos de espera.


VI.CONCLUSIONES

VII.RECOMENDACIONES

REFERENCIAS

[1]
R. Fernández, “Modelling public transport stops by microscopic simulation,” Transportation Research Part C: Emerging Technologies, vol. 18, no. 6, pp. 856–868, 2010, doi: 10.1016/j.trc.2010.02.002. 
[2]
C. Wang, Z. Ye, J. D. Fricker, Y. Zhang, and S. V. Ukkusuri, “Bus capacity estimation using stochastic queuing models for isolated bus stops in China,” Transportation Research Record: Journal of the Transportation Research Board, vol. 2672, no. 8, pp. 108–120, 2018, doi: 10.1177/0361198118777358. 
[3]
F. Delgado, J. C. Muñoz, and R. Giesen, “How much can holding and/or limiting boarding improve transit performance?,” Transportation Research Part B: Methodological, vol. 46, no. 9, pp. 1202–1217, 2012, doi: 10.1016/j.trb.2012.04.005.
[4]
L. M. Kieu and C. Cai, “Stochastic collective model of public transport passenger arrival process,” IET Intelligent Transport Systems, vol. 12, no. 9, pp. 1027–1035, 2018, doi: 10.1049/iet-its.2018.0085. 
[5]
T. Lindberg, F. Johansson, A. Peterson, and A. Tapani, “Discrete event simulation of bus terminals: A modular approach with a high spatial resolution,” Journal of Advanced Transportation, vol. 2021, Art. no. 8862893, 2021, doi: 10.1155/2021/8862893.


