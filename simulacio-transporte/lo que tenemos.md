lo que tenemos


Resumen— El presente informe aborda …

PALABRAS CLAVE: Teoría de colas, Modelos estocásticos, Transporte público, Python

I. INTRODUCCIÓN

El transporte público constituye un componente fundamental de la movilidad urbana, ya que permite el desplazamiento de un gran número de personas mediante recursos compartidos, como los autobuses y las paradas. Sin embargo, cuando la demanda de pasajeros supera la capacidad de atención del servicio, o cuando los tiempos de llegada entre autobuses son demasiados largos o irregulares, pueden producirse una gran cola de pasajeros, incrementos en los tiempos de espera y situaciones en las que algunos usuarios no logran abordar el autobús disponible. Por esta razón, analizar la relación entre la frecuencia de los autobuses, la demanda de pasajeros y la capacidad de transporte resulta importante para comprender el comportamiento del sistema y evaluar alternativas que contribuyan a mejorar su funcionamiento [1], [2].
Diversas investigaciones han estudiado estos fenómenos mediante modelos matemáticos y técnicas de simulación. Fernández [1] desarrolló un enfoque de simulación microscópica para modelar las operaciones en las paradas del transporte público, considerando la interacción entre la llegada de pasajeros, los intervalos entre vehículos, los tiempos de permanencia y la capacidad de las instalaciones. Por su parte, Wang et al. [2] propusieron modelos estocásticos basados en la teoría de colas para estimar la capacidad de las paradas de autobús y los retrasos de los vehículos, utilizando datos observados para evaluar el desempeño de sus modelos. 

Asimismo, Delgado, Munoz y Giesen [3] analizaron estrategias de control para reducir los efectos del agrupamiento de autobuses (bus bunching) y los tiempos de espera de los pasajeros, considerando tanto la regulación de la permanencia de los vehículos como la limitación del número de pasajeros que pueden abordar. En una línea complementaria, Kieu y Cai [4] estudiaron el proceso estocástico de llegada de los pasajeros a las paradas, destacando la importancia de representar adecuadamente sus patrones de llegada para estimar la demanda y los tiempos de espera. Además, Lindberg y Tapani [5] presentaron un modelo de simulación de eventos discretos para evaluar las operaciones en terminales de autobuses y las interacciones entre vehículos, con el propósito de estudiar problemas operativos y la formación de colas. 

En conjunto, estos antecedentes muestran que la frecuencia de llegada de los autobuses, la variabilidad de los tiempos de servicio, la demanda de pasajeros y las restricciones de capacidad son factores relevantes para el desempeño del transporte público. No obstante, para el problema abordado en este trabajo, resulta necesario integrar estas variables en un modelo de simulación que permita comparar diferentes escenarios bajo condiciones controladas y observar sus efectos sobre la acumulación de pasajeros y la atención de la demanda. Esta aproximación facilita el análisis de situaciones en las que la capacidad disponible de cada autobús no es suficiente para atender a todos los pasajeros que esperan en la parada.

Por lo tanto, en el presente informe se desarrollará un modelo de simulación estocástica en Python para analizar el efecto de la frecuencia de llegada de los autobuses y de su capacidad limitada sobre el comportamiento de las colas de pasajeros. Mediante la evaluación de distintos escenarios, se estudiarán indicadores como la longitud de la cola, el tiempo promedio de espera, la cantidad de pasajeros que logran abordar y aquellos que permanecen esperando después de la llegada de un autobús. Los resultados permitirán comparar el desempeño del sistema bajo diferentes condiciones de la operación y comprender como la variación de los parámetros de operación y comprender cómo la variación de los parámetros influye en la calidad del servicio.

II. OBJETIVOS
A. Objetivo general
Desarrollar una simulación de eventos discretos en Python para representar el comportamiento de la fila de pasajeros en una parada de autobuses, mediante modelos probabilísticos y el análisis de diferentes escenarios, con el fin de evaluar los tiempos de espera y la cantidad de pasajeros transportados.

B. Objetivos Específicos
1)	Implementar un modelo de simulación de eventos discretos que represente las llegadas de pasajeros y autobuses, la disponibilidad de asientos y el proceso de abordaje.
2)	Evaluar el comportamiento de la fila de espera mediante la ejecución y comparación de diferentes escenarios, utilizando indicadores estadísticos y representaciones gráficas de los tiempos de espera y la cantidad de pasajeros transportados

		III. METODOLOGÍA 

A. Enfoque
La presente investigación tiene un enfoque cuantitativo, debido a que utiliza variables y modelos matemáticos para simular la llegada de pasajeros, los intervalos entre autobuses y la disponibilidad de asientos. A partir de estos parámetros, se obtienen resultados numéricos que permiten analizar el comportamiento de la fila de espera, los tiempos de espera y la cantidad de pasajeros transportados. Además, los resultados se representan mediante gráficas para comparar distintos escenarios.

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
Valor inicial
Tasa de llegada de pasajeros   p
6 pasajeros/min
Intervalo medio entre autobuses h
10 min
Coeficiente de variación de los intervalos  cv
0,30
Capacidad del autobús C
40 asientos
Ocupación de referencia po
0,70
Horizonte de simulación H
120 min



Estos valores son configurables y pueden modificarse para comparar escenarios.
Etapa 4. Formulación de los modelos matemáticos: 

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


IV. RESULTADOS


V. DISCUSIÓN

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



DECLARATORIA DE USO DE INTELIGENCIA ARTIFICIAL

1) Herramienta de Inteligencia Artificial utilizada: Gemini.

2) Forma en que se utilizó la herramienta: La herramienta fue utilizada como apoyo para mejorar la redacción del texto.

3) Prompt utilizado:
“Analiza lo siguiente… ”

1) Herramienta de Inteligencia Artificial utilizada: ChatGPT.

2) Forma en que se utilizó la herramienta: La herramienta fue utilizada como apoyo en la planificación, revisión y mejora de la implementación del proyecto de simulación de transporte, especialmente en el diseño de la interfaz web tridimensional, la animación de pasajeros y autobuses, y la integración visual con el motor matemático existente.

3) Prompt utilizado:
“Analiza la estructura del proyecto de simulación de transporte y propone e implementa mejoras en la visualización 3D, la animación de pasajeros y autobuses, los controles de velocidad y cámara, y la interfaz web, preservando la lógica matemática y verificando el funcionamiento mediante pruebas.”

Enlace al prompt completo: [Aquí]

