# Manual de Estudio Exhaustivo: GPS Logístico Inteligente (Manhattan LyA2)

Este documento es una guía de estudio integral diseñada para que domines cada aspecto técnico, lógico y arquitectónico de tu proyecto. El objetivo es que puedas explicar con total seguridad y con el código en mano cómo funciona cada pieza del sistema ante cualquier jurado o examen.

---

## 1. Introducción y Arquitectura General

El proyecto es un **Sistema de Planificación de Rutas Logísticas** diseñado para calcular no solo la distancia de un viaje, sino el costo económico total, la seguridad de la carga y el cumplimiento legal.

Para lograr esto, utilizamos una **Arquitectura Cliente-Servidor**.
- **El Cliente (Frontend):** Se encarga de la visualización, la interacción humana (clicks, inputs) y de pintar el mapa. Está construido con `HTML5`, `CSS3` (diseño sin frameworks pesados, puro CSS con variables), y `JavaScript`. Utiliza la librería **Leaflet.js** para renderizar mapas cartográficos.
- **El Servidor (Backend):** Se encarga del procesamiento pesado. Está construido en **Python** utilizando el micro-framework **Flask**. Actúa como el "cerebro" que cruza los datos de las rutas contra bases de datos internas de casetas, leyes y zonas de peligro.

---

## 2. Análisis del Código Backend (`app.py`)

El Backend recibe una lista masiva de puntos (coordenadas geográficas) desde el cliente y las analiza paso a paso.

### 2.1. El Algoritmo de Bounding Box (Optimización)
Imagina que una ruta tiene 2,000 coordenadas y en México hay 1,000 casetas. Analizar cada punto contra cada caseta requeriría 2 millones de cálculos ($O(N \times M)$). Para evitar que el servidor se vuelva lento, usamos un **Bounding Box** (Caja Delimitadora).

**El Código:**
```python
@app.route('/analisis_ruta', methods=['POST'])
def analisis_ruta():
    data = request.get_json()
    ruta = data.get('ruta', [])
    
    # 1. Bounding Box: Encontrar los bordes geográficos extremos de toda la ruta
    lats = [p['lat'] for p in ruta]
    lons = [p['lon'] for p in ruta]
    min_lat, max_lat = min(lats) - 0.01, max(lats) + 0.01
    min_lon, max_lon = min(lons) - 0.01, max(lons) + 0.01

    # Filtrar solo las casetas que estén dentro de este "rectángulo"
    casetas_candidatas = [c for c in casetas if min_lat <= c['lat'] <= max_lat and min_lon <= c['lon'] <= max_lon]
```
**Explicación:** Al sacar el mínimo y máximo de las coordenadas, creamos un rectángulo virtual que envuelve la ruta. Descartamos instantáneamente todas las casetas que queden fuera del país o del estado por donde vamos, reduciendo drásticamente las operaciones matemáticas.

### 2.2. Proyección Vectorial Ortogonal y Distancia de Manhattan
Una vez filtradas las casetas candidatas, determinamos si la ruta exacta pasa por ellas utilizando modelos matemáticos espaciales avanzados en lugar de validaciones punto a punto.

**El Código:**
```python
def distancia_manhattan(p1, p2):
    # Separación de componentes para aproximación ágil
    km_lat = abs(lat1 - lat2) * 111
    km_lon = abs(lon1 - lon2) * 111 * cos(radians((lat1+lat2)/2))
    return km_lat + km_lon

def punto_cerca_de_segmento(p, seg_inicio, seg_fin, umbral_km=0.1):
    # Cálculo de Proyección Ortogonal mediante Producto Punto (Dot Product)
    t = ((x0 - x1)*dx + (y0 - y1)*dy) / l2
    # ...
```
**Explicación:** 
- **Distancia de Manhattan:** Se utiliza para separar las componentes X y Y al medir proximidades geográficas rápidas (verificar cercanía de zonas rojas o para evitar duplicar el cobro de la misma caseta), aplicando una corrección trigonométrica (`cos`) para compensar la curvatura terrestre.
- **Proyección Vectorial (Producto Punto):** Es un algoritmo avanzado de geometría computacional. En lugar de iterar cada punto de la curva, el sistema toma "segmentos" (vectores rectos) de la ruta y proyecta ortogonalmente la coordenada de la caseta sobre la línea. Esto revela con precisión matemática si la trayectoria cruza la plaza de cobro, economizando recursos de CPU de forma dramática frente a la fórmula tradicional esférica de Haversine.

### 2.3. Lógica Laboral NOM-087 (Sueldo del Operador)
La logística moderna no es solo gasolina; el factor humano está regulado por ley. 

**El Código:**
```python
    # Normativa NOM-087 (14 horas de conducción por 8 horas de descanso)
    tiempo_horas = tiempo_minutos / 60
    ciclos_14h = int(tiempo_horas // 14)
    horas_descanso_largos = ciclos_14h * 8
    
    # Adicional: 30 minutos por cada 5 horas consecutivas
    pausas_30m = int(tiempo_horas // 5)
    horas_pausas_cortas = pausas_30m * 0.5
    
    horas_totales_laboradas = tiempo_horas + horas_descanso_largos + horas_pausas_cortas
    sueldo_operador = round(horas_totales_laboradas * 100, 2) # $100 MXN la hora
```
**Explicación:** Se divide matemáticamente el tiempo total entre los ciclos reglamentarios. Esto permite proyectar con total precisión el dinero que se le pagará al conductor, previendo que su jornada se alargará por ley si el viaje es muy largo.

### 2.4. Integración de APIs (OSRM y Open-Elevation)
El sistema depende de poderosas APIs externas para resolver los problemas matemáticos y de grafos que requerirían supercomputadoras si se procesaran localmente.

**El Código (Topografía):**
```python
    def obtener_desnivel_acumulado(ruta_muestra):
        # Se contacta a la API de Open-Elevation
        url = f"https://api.open-elevation.com/api/v1/lookup?locations={locations}"
        response = requests.get(url, timeout=3)
        # Sigue la lógica que suma la diferencia de altura positiva...
```
**Explicación y APIs usadas:** 
1. **OSRM (Open Source Routing Machine):** Utilizada intensivamente por el Frontend (`Leaflet Routing Machine`). OSRM es un motor C++ ultrarrápido que resuelve la **teoría de grafos** aplicando algoritmos de camino mínimo (como **Dijkstra** o **A***) sobre la densa red de calles mapeadas del mundo para devolvernos la ruta óptima.
2. **Open-Elevation API:** Es una API topográfica gratuita. Python empaqueta muestras de coordenadas del viaje en una llamada `GET` y la API nos devuelve la altitud (Eje Z). Esto permite calcular iterativamente el **desnivel positivo acumulado** (metros reales subidos) para estimar el desgaste de los motores de transporte pesado.

---

## 3. Análisis del Código Frontend (`index.html`)

El Frontend es un archivo interactivo que maneja todos los mapas de forma reactiva a las acciones del usuario.

### 3.1. Ruteo Dinámico con OSRM y AJAX (Fetch)
Utilizamos `Leaflet Routing Machine`, el cual contacta los servidores de `OSRM` para encontrar caminos pavimentados. Una vez que la ruta existe, enviamos los datos a Python usando `fetch`.

**El Código:**
```javascript
controlRuta.on('routeselected', function (e) {
    const coordsRutaCompleta = e.route.coordinates; // Toda la "víbora" azul

    // Solicitud Asíncrona (AJAX) al servidor Flask
    fetch('/analisis_ruta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ruta: coordsRutaCompleta.map(p => ({ lat: p.lat, lon: p.lng })),
            tiempo_minutos: minutos
        })
    }).then(response => response.json())
      .then(data => {
          // Acá se actualiza la Interfaz de Usuario Gráfica (Tarjetas) con la 'data' que mandó Python
      });
});
```

### 3.2. Evasión Avanzada de Rutas Peligrosas
Este es uno de los módulos más fuertes del proyecto. Al recibir que la ruta cruza una **Zona Roja**, ofrecemos al usuario calcular un trayecto seguro.

**El Código:**
```javascript
window.evadirZonasRojas = function() {
    let waypoints = controlRuta.getWaypoints().map(w => w.latLng).filter(w => w);
    
    zonasCruzadasGlobal.forEach(z => {
        // Conversión: 1 grado de latitud son aprox 111 km. 
        // Desplazamos un punto multiplicando el radio por 2.0 para garantizar estar fuera.
        let offsetLat = (z.radio_km * 2.0) / 111;
        
        // En longitud, la Tierra se "encoge" en los polos, compensamos dividiendo por el Coseno.
        let offsetLon = (z.radio_km * 2.0) / (111 * Math.cos(z.lat * Math.PI / 180));
        
        let pEvasion = L.latLng(z.lat + offsetLat, z.lon + offsetLon);
        
        // Insertamos el punto ciego de desvío justo antes de llegar al destino
        waypoints.splice(waypoints.length - 1, 0, pEvasion);
    });
    
    // Al setear nuevos puntos, OSRM recalcula esquivando la amenaza automáticamente.
    controlRuta.setWaypoints(waypoints);
};
```
**Explicación Técnica para el Examen:**
Para garantizar que el camión no pase por la zona roja, usamos **Trigonometría Esférica básica**. Sabiendo el centro del radio de peligro (`z.lat`, `z.lon`), generamos una nueva coordenada ficticia (`pEvasion`) que está al doble del radio de distancia (asegurando el perímetro seguro). Luego se le obliga al GPS a ir a ese punto fantasma, obligando a recalcular la gráfica de carreteras evadiendo la zona central peligrosa.

### 3.3. Zonas Rojas de Polling en Tiempo Real
El mapa pide al servidor los datos actualizados de peligro cada 10 segundos para simular sistemas de tráfico dinámico.

**El Código:**
```javascript
function cargarZonasCriticas() {
    fetch('/get_zonas_criticas')
        .then(res => res.json())
        .then(zonas => {
            // Borra las marcas anteriores para no encimarlas
            zonasCriticasLayers.forEach(layer => mapa.removeLayer(layer));
            zonasCriticasLayers = [];

            zonas.forEach(zona => {
                // Dibuja círculos translúcidos
                let circulo = L.circle([zona.lat, zona.lon], { color: 'red', radius: zona.radio_km * 1000 }).addTo(mapa);
                zonasCriticasLayers.push(circulo);
            });
        });
}
// Polling asíncrono
setInterval(cargarZonasCriticas, 10000); // 10,000 milisegundos
```

---

## 4. Modelos Matemáticos y Espaciales (El Enfoque 4D)

Este proyecto está construido sobre un **modelo logístico de 4 Dimensiones (4D)**, apoyado por algoritmos específicos de Ciencias de la Computación:

1. **Las 2 Dimensiones Físicas (Plano Cartesiano X, Y):** Se utilizan la Latitud y Longitud para aplicar el modelo de **Bounding Box** ($O(N)$), la **Distancia de Manhattan** y la **Proyección Vectorial Ortogonal** (Producto Punto) en la detección de colisiones con casetas y la trigonometría de evasión de zonas rojas.
2. **La 3ra Dimensión (Altitud Z):** Agregada consultando la API topográfica **Open-Elevation** para medir los relieves montañosos y el desnivel real del viaje.
3. **La 4ta Dimensión (Tiempo T):** Implementada mediante el modelo aritmético de la **NOM-087**, procesando los minutos del viaje a través de divisiones cíclicas para calcular pausas de descanso obligatorio y proyectar con precisión legal el sueldo del operador.
4. **Algoritmos de Grafos (Dijkstra / A*):** Abstraídos a través de la API **OSRM**, encargada de recorrer la red vial como un grafo matemático gigante para buscar el camino más corto.

---
## Explicacion Modelos MATEMATICOS
Dijkstra (Para calcular calles vía OSRM).

Distancia de Manhattan (Para detectar proximidad de zonas peligrosas).

Proyección Vectorial (Para detectar si la ruta cruza exactamente por el punto de una caseta).

## 5. Conclusión / Posibles Preguntas del Jurado

- **¿Qué algoritmos de Lenguajes y Autómatas o Teoría de Grafos utilizas?**
  **R:** La búsqueda del camino más corto se apoya en algoritmos de grafos como **Dijkstra y A*** delegados a la API de **OSRM**. Por parte del código interno (Backend), el intercambio JSON cliente-servidor actúa sobre **Analizadores Sintácticos (Parsers)**, y la lógica del sistema funciona como una **Máquina de Estados** que transiciona desde el input del usuario hasta aplicar filtros espaciales (Manhattan, Proyección Ortogonal) y resolver la 4ta dimensión (NOM-087).

- **¿Por qué usaste Flask y Python en lugar de Node.js o PHP?**
  **R:** Python es superior para el manejo matemático y análisis de datos masivos (arreglos enormes de coordenadas, geolocalización, Bounding Box y manipulación de JSON). Flask, al ser ligero, permite crear una API muy rápida sin el peso de otros frameworks.
  
- **¿Qué pasaría si la red de Open-Meteo o de OSRM se cae?**
  **R:** Hemos diseñado un sistema con bloqueos `catch(e)`. Si una API falla, el código tiene "Fallbacks". Por ejemplo, en caso de un error en el Fetch, el GPS muestra los datos calculados de forma cruda sin que la aplicación se rompa (se atrapa el error y la interfaz sigue funcionando).

- **¿Qué técnica matemática se usa para el cálculo de distancia euclidiana y por qué no Haversine?**
  **R:** La **Fórmula de Haversine** es exacta para distancias curvas intercontinentales, pero para detectar un peaje a 30 metros de distancia o una zona roja a 5 km, aplicar tantas funciones trigonométricas por miles de puntos colapsaría el rendimiento del servidor. Por ello usamos una **aproximación Pitagórica (Euclidiana al cuadrado)** que, aunque asume que la Tierra es plana a distancias muy cortas, el margen de error métrico es imperceptible y ganamos velocidad computacional. Para compensar errores mayores (como el desvío de la ruta evasiva), allí sí multiplicamos por el `Coseno` de la latitud.

- **¿Cómo se logró integrar el autocompletado en los campos de dirección si no se usa Google Maps?**
  **R:** A través de llamadas a la API de **Nominatim (OpenStreetMap)** unidas con la librería **jQuery UI** para poblar las listas visuales.

Con todo esto dominado, estás completamente preparado para explicar tu proyecto desde la capa visual más alta, hasta la matemática que corre por el servidor interno. ¡Mucho éxito!
