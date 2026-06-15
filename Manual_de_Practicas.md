# Manual de Prácticas: Implementación de un Sistema GPS Logístico Inteligente

**Asignatura:** Lógica y Algoritmos / Ingeniería de Software  
**Título de la Práctica:** Ruteo Dinámico, Análisis de Polígonos Espaciales y Evasión de Zonas Críticas.

---

## 1. Objetivos de la Práctica
- **General:** Desarrollar un sistema de ruteo vehicular que evalúe costos, tiempos y restricciones geográficas en tiempo real aplicando estructuras de datos eficientes.
- **Específicos:**
  1. Integrar y configurar `Leaflet.js` y `Leaflet Routing Machine` para el mapeo interactivo.
  2. Implementar un servidor REST con **Flask (Python)** para procesar arreglos masivos de coordenadas.
  3. Reducir la complejidad algorítmica de búsquedas usando un algoritmo de **Bounding Box**.
  4. Desarrollar un mecanismo trigonométrico capaz de evadir polígonos de peligro (Zonas Rojas) generando rutas alternativas.
  5. Entender la comunicación asíncrona cliente-servidor mediante peticiones `fetch`.

---

## 2. Marco Teórico y Tecnologías
- **Python y Flask:** Para el servidor lógico (Backend).
- **HTML, CSS, JS:** Para la interfaz interactiva.
- **Leaflet & OSRM:** Tecnologías libres que reemplazan las costosas APIs de Google Maps. OSRM usa grafos matemáticos (como Dijkstra o A*) sobre la red de calles reales.
- **Distancia Euclidiana Espacial:** Una aproximación de la distancia usando el Teorema de Pitágoras sobre un plano cartesiano geográfico, ideal para distancias cortas por su bajo costo de CPU frente a la fórmula de *Haversine*.

---

## 3. Desarrollo de la Práctica

### Paso 1: Configuración del Entorno Servidor
Primero, levantamos un micro-framework en Python para atender peticiones en tiempo real. 

```python
# app.py
from flask import Flask, render_template, request, jsonify
import requests

app = Flask(__name__)

# Base de datos interna (Zonas de peligro)
zonas_criticas = [
    {"nombre": "Tepito, CDMX", "lat": 19.4444, "lon": -99.1301, "radio_km": 2, "riesgo": "Alto"},
    {"nombre": "Ecatepec Centro", "lat": 19.6097, "lon": -99.0600, "radio_km": 4, "riesgo": "Alto"}
]

@app.route('/')
def index():
    return render_template('index.html')  
```

### Paso 2: Interfaz Cartográfica (Frontend)
Inicializamos un mapa centrado en México. Escuchamos el evento de trazado de ruta de Leaflet para capturar las coordenadas de todo el viaje.

```javascript
// templates/index.html
var mapa = L.map('mapa').setView([23.6345, -102.5528], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);

controlRuta.on('routeselected', function (e) {
    const coordsRutaCompleta = e.route.coordinates;
    const minutos = Math.round(e.route.summary.totalTime / 60);

    // Mandar el "gusano" de coordenadas al backend
    fetch('/analisis_ruta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruta: coordsRutaCompleta, tiempo_minutos: minutos })
    }).then(res => res.json()).then(data => {
        // Manejar tarjetas visuales de costos y advertencias...
    });
});
```

### Paso 3: Optimización de Búsqueda (Algoritmo Bounding Box)
El servidor procesa el JSON recibido. Para no analizar cada punto contra todo el catálogo de casetas, enjaulamos la ruta en sus límites `Min` y `Max`.

```python
# Extracción de la "Caja Delimitadora" (Bounding Box)
lats = [p['lat'] for p in ruta]
lons = [p['lon'] for p in ruta]
min_lat, max_lat = min(lats) - 0.01, max(lats) + 0.01
min_lon, max_lon = min(lons) - 0.01, max(lons) + 0.01

# Filtro $O(N)$ optimizado
casetas_candidatas = [c for c in casetas if min_lat <= c['lat'] <= max_lat and min_lon <= c['lon'] <= max_lon]
```
Posteriormente, usamos una comparación Euclidiana al cuadrado para detectar intersecciones exactas entre la ruta y el radio de la caseta:
```python
dist_sq = (p['lat'] - c['lat'])**2 + (p['lon'] - c['lon'])**2
if dist_sq < 0.00001:  # Equivalencia a ~30 metros
    casetas_cruzadas.append(c)
```

### Paso 4: Dinamismo Vectorial (Evasión de Rutas)
Si el servidor alerta que cruzamos una zona peligrosa, activamos la rutina matemática de evasión en el cliente. Usamos trigonometría para calcular un punto de fuga.

```javascript
window.evadirZonasRojas = function() {
    let waypoints = controlRuta.getWaypoints().map(w => w.latLng).filter(w => w);
    
    zonasCruzadasGlobal.forEach(z => {
        // Se calcula un desfase usando el radio. (1 grado = ~111km)
        let offsetLat = (z.radio_km * 2.0) / 111; 
        // Compensación polar dividiendo entre Coseno
        let offsetLon = (z.radio_km * 2.0) / (111 * Math.cos(z.lat * Math.PI / 180));
        
        let pEvasion = L.latLng(z.lat + offsetLat, z.lon + offsetLon);
        waypoints.splice(waypoints.length - 1, 0, pEvasion); // Inserción previa al final
    });
    
    controlRuta.setWaypoints(waypoints); // Recálculo forzado
};
```

### Paso 5: Polling (Tiempo Real Simulado)
Para que las zonas de peligro aparezcan en vivo y cambien sin recargar la página, se implementó un bucle que consulta al servidor cada 10 segundos.

```javascript
function cargarZonasCriticas() {
    fetch('/get_zonas_criticas')
        .then(res => res.json())
        .then(zonas => {
            zonasCriticasLayers.forEach(layer => mapa.removeLayer(layer));
            zonasCriticasLayers = [];
            zonas.forEach(zona => {
                let circulo = L.circle([zona.lat, zona.lon], { color: 'red', radius: zona.radio_km * 1000 }).addTo(mapa);
                zonasCriticasLayers.push(circulo);
            });
        });
}
setInterval(cargarZonasCriticas, 10000);
```

---

## 4. Pruebas de Funcionamiento

Para validar el sistema en un ambiente de evaluación, se deben ejecutar los siguientes pasos:
1. Abrir terminal y activar el entorno virtual: `source env/bin/activate`.
2. Levantar el servidor Flask: `python app.py`.
3. Ingresar en el navegador a `http://127.0.0.1:5000`.
4. Observar que las zonas de peligro rojas se rendericen inmediatamente en el mapa.
5. Calcular una ruta (ej. *CDMX a Monterrey*). El panel derecho deberá desglosar casetas, tiempo bajo NOM-087 y costo total.
6. Si la ruta atraviesa la marca roja de "Carretera Matehuala", el botón rojo **"Ruta Segura (Evadir)"** debe aparecer. Al presionarlo, el sistema debe rodear por completo el área.

---

## 5. Conclusión General

La práctica demuestra cómo la conjunción de las **ciencias computacionales teóricas** y la **ingeniería de software práctica** logran resolver problemas logísticos del mundo real. 

Por un lado, la aplicación de un algoritmo de limitación geométrica (Bounding Box) redujo exponencialmente el tiempo de procesamiento en el Backend, evitando que el servidor colapsara al cruzar matrices de datos enormes (coordenadas del camino vs catálogos de peaje). Por otro lado, la comprensión de la trigonometría esférica permitió crear un manipulador de rutas dinámico, dándole a los conductores de transporte pesado la capacidad de evadir siniestros de forma inteligente. 

Finalmente, el uso de peticiones asíncronas (`fetch`) y esquemas de `polling` garantizan que la aplicación funcione como un verdadero GPS en tiempo real, ofreciendo una experiencia reactiva que compite con productos empresariales de alto nivel, pero desarrollado íntegramente bajo un paradigma de código abierto.
