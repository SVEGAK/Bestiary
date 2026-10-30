// ==========================================================
// КОНФИГУРАЦИЯ КАРТЫ
// ==========================================================
const CONFIG = {
    center: [348, 632],
    zoom: 0,
    minZoom: 0,
    maxZoom: 3,
    imageUrl: 'assets/map.svg',
    imageBounds: [[0, 0], [696, 1264]],
    imageOpacity: 0.95,
    debugCoords: true,
};

const GEO_BOUNDS = {
    minLat: 30,  maxLat: 48,
    minLng: -10, maxLng: 40,
};

function ll(lat, lng) {
    const y = (lat - GEO_BOUNDS.minLat)
        / (GEO_BOUNDS.maxLat - GEO_BOUNDS.minLat)
        * CONFIG.imageBounds[1][0];
    const x = (lng - GEO_BOUNDS.minLng)
        / (GEO_BOUNDS.maxLng - GEO_BOUNDS.minLng)
        * CONFIG.imageBounds[1][1];
    return [y, x];
}

const TYPE_STYLES = {
    constellation: {
        color: '#c9a227', fillColor: '#ffd966',
        fillOpacity: 0.28, weight: 2, dashArray: '8 5',
    },
    minor: {
        color: '#5b8c3e', fillColor: '#a8c96e',
        fillOpacity: 0.22, weight: 1.5, dashArray: '4 4',
    },
    dragon: {
        color: '#8b1e1e', fillColor: '#d44a4a',
        fillOpacity: 0.25, weight: 2, dashArray: null,
    },
    beast: {
        color: '#6b4423', fillColor: '#b07c4f',
        fillOpacity: 0.25, weight: 2, dashArray: null,
    },
};