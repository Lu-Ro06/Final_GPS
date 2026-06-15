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

### 2.2. Detección de Colisiones Geográficas (Distancia Euclidiana)
Una vez que tenemos las `casetas_candidatas`, debemos saber si la línea azul dibujada por el GPS pasa por encima de ellas. Para eso usamos matemáticas geométricas (Teorema de Pitágoras adaptado a grados).

**El Código:**
```python
    for c in casetas_candidatas:
        costo = c.get('costo', 0)
        nombre = c.get('nombre', 'Caseta Desconocida')
        
        # Iterar sobre las coordenadas de la ruta
        for p in ruta:
            # Fórmula de distancia euclidiana al cuadrado (para evitar la costosa raíz cuadrada)
            dist_sq = (p['lat'] - c['lat'])**2 + (p['lon'] - c['lon'])**2
            
            # Si el resultado es menor al umbral (aprox 30-50 metros), se detectó un cruce
            if dist_sq < 0.00001: 
                # Verificar que no la hayamos cobrado ya (evitar dobles cobros)
                if not any(ya_cruzada['nombre'] == nombre for ya_cruzada in casetas_cruzadas):
                    costo_total_casetas += costo
                    casetas_cruzadas.append({"nombre": nombre, "costo": costo}) 
                break # Dejar de analizar esta caseta
```
**Explicación:** Se evita usar `math.sqrt()` (la raíz cuadrada) porque es computacionalmente costosa. Simplemente se compara el cuadrado de la distancia contra el cuadrado del umbral. Si la distancia es diminuta, el camión cruzó la caseta y se suma su costo.

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

### 2.4. Integración de API Externa (Open-Meteo)
Para el desgaste del motor y predicciones de combustible, tomamos muestras geográficas y pedimos la altitud sobre el nivel del mar.

**El Código:**
```python
    def obtener_desnivel_acumulado(ruta_muestra):
        lats_str = ",".join([str(round(p['lat'], 4)) for p in ruta_muestra])
        lons_str = ",".join([str(round(p['lon'], 4)) for p in ruta_muestra])
        url = f"https://api.open-meteo.com/v1/elevation?latitude={lats_str}&longitude={lons_str}"
        response = requests.get(url, timeout=5)
        # Sigue la lógica que suma la diferencia de altura positiva y negativa...
```
**Explicación:** Se empaquetan varias coordenadas (separadas por comas) en una sola llamada HTTP `GET` a Open-Meteo. Luego se analiza si el camión "sube" o "baja" montañas restando la altitud actual de la anterior.

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

## 4. Conclusión / Posibles Preguntas del Jurado

- **¿Por qué usaste Flask y Python en lugar de Node.js o PHP?**
  **R:** Python es superior para el manejo matemático y análisis de datos masivos (arreglos enormes de coordenadas, geolocalización, Bounding Box y manipulación de JSON). Flask, al ser ligero, permite crear una API muy rápida sin el peso de otros frameworks.
  
- **¿Qué pasaría si la red de Open-Meteo o de OSRM se cae?**
  **R:** Hemos diseñado un sistema con bloqueos `catch(e)`. Si una API falla, el código tiene "Fallbacks". Por ejemplo, en caso de un error en el Fetch, el GPS muestra los datos calculados de forma cruda sin que la aplicación se rompa (se atrapa el error y la interfaz sigue funcionando).

- **¿Qué técnica matemática se usa para el cálculo de distancia euclidiana y por qué no Haversine?**
  **R:** La **Fórmula de Haversine** es exacta para distancias curvas intercontinentales, pero para detectar un peaje a 30 metros de distancia o una zona roja a 5 km, aplicar tantas funciones trigonométricas por miles de puntos colapsaría el rendimiento del servidor. Por ello usamos una **aproximación Pitagórica (Euclidiana al cuadrado)** que, aunque asume que la Tierra es plana a distancias muy cortas, el margen de error métrico es imperceptible y ganamos velocidad computacional. Para compensar errores mayores (como el desvío de la ruta evasiva), allí sí multiplicamos por el `Coseno` de la latitud.

- **¿Cómo se logró integrar el autocompletado en los campos de dirección si no se usa Google Maps?**
  **R:** A través de llamadas a la API de **Nominatim (OpenStreetMap)** unidas con la librería **jQuery UI** para poblar las listas visuales.

Con todo esto dominado, estás completamente preparado para explicar tu proyecto desde la capa visual más alta, hasta la matemática que corre por el servidor interno. ¡Mucho éxito!
