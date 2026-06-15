function ajustarRutaManhattan(coordenadas) {
    let rutaManhattan = [];
    
    for (let i = 0; i < coordenadas.length - 1; i++) {
        let inicio = coordenadas[i];
        let destino = coordenadas[i + 1];

        let actual = { lat: inicio.lat, lng: inicio.lng };

        while (actual.lat !== destino.lat) {
            actual.lat += (actual.lat < destino.lat) ? 0.0005 : -0.0005; // Movimiento vertical
            rutaManhattan.push({ lat: actual.lat, lng: actual.lng });
        }
        
        while (actual.lng !== destino.lng) {
            actual.lng += (actual.lng < destino.lng) ? 0.0005 : -0.0005; // Movimiento horizontal
            rutaManhattan.push({ lat: actual.lat, lng: actual.lng });
        }
    }
    
    return rutaManhattan;
}

// Modificar el evento 'routesfound' para ajustar la ruta
routeControl.on('routesfound', function(e) {
    let routes = e.routes[0].coordinates.map(coord => ({ lat: coord[1], lng: coord[0] }));
    
    let rutaManhattan = ajustarRutaManhattan(routes);

    L.polyline(rutaManhattan, { color: 'blue', opacity: 1, weight: 5 }).addTo(map);
});
