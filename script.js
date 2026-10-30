// ==========================================================
// ИНИЦИАЛИЗАЦИЯ КАРТЫ
// ==========================================================
const map = L.map('map', {
    crs: L.CRS.Simple,
    center: CONFIG.center,
    zoom: CONFIG.zoom,
    minZoom: CONFIG.minZoom,
    maxZoom: CONFIG.maxZoom,
    maxBounds: CONFIG.imageBounds,
    maxBoundsViscosity: 1.0,
    attributionControl: false,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    wheelPxPerZoomLevel: 90,
    inertia: true,
    inertiaDeceleration: 3000,
});

// ==========================================================
// ИЗОБРАЖЕНИЕ-ПОДЛОЖКА
// ==========================================================
L.imageOverlay(CONFIG.imageUrl, CONFIG.imageBounds, {
    opacity: CONFIG.imageOpacity,
    interactive: false,
    className: 'map-overlay',
    errorOverlayUrl:
        'https://placehold.co/800x500/d9cfb8/3b2a1a?text=assets/map.svg+not+found',
}).addTo(map);

// ==========================================================
// ПОДГОНКА minZoom ПОД РАЗМЕР ЭКРАНА (cover-режим)
// ==========================================================
function updateMinZoom() {
    const coverZoom = map.getBoundsZoom(CONFIG.imageBounds, true);
    map.setMinZoom(coverZoom);
    if (map.getZoom() < coverZoom) {
        map.setZoom(coverZoom);
    }
}

map.fitBounds(CONFIG.imageBounds, { animate: false });
updateMinZoom();

map.on('resize', updateMinZoom);
window.addEventListener('orientationchange', () =>
    setTimeout(updateMinZoom, 200),
);

// ==========================================================
// СЛОИ: ареалы (ниже) + маркеры (выше)
// ==========================================================
const zonesLayer   = L.layerGroup().addTo(map);
const markersLayer = L.layerGroup().addTo(map);

// ==========================================================
// ФУНКЦИЯ СОЗДАНИЯ ПОДПИСИ ДЛЯ АРЕАЛА
// ==========================================================
function createAreaLabel(creature) {
    let pos = creature.coords;
    if (creature.habitat && creature.habitat.type === 'polygon') {
        const points = creature.habitat.points;
        const lat = points.reduce((s, p) => s + p[0], 0) / points.length;
        const lng = points.reduce((s, p) => s + p[1], 0) / points.length;
        pos = [lat, lng];
    }

    // Обрезаем длинные названия (оставляем только текст до тире)
    const shortName = creature.name.split('—')[0].trim();

    const icon = L.divIcon({
        className: 'area-label-wrapper',
        html: `<div class="area-label">${shortName}</div>`,
    });

    // interactive: false — чтобы текст не перехватывал клики
    return L.marker(pos, { icon, interactive: false, zIndexOffset: -100 });
}

// ==========================================================
// РЕЕСТР СУЩНОСТЕЙ ДЛЯ РЕДАКТОРА (объявляется ОДИН раз)
// ==========================================================
const creatureRefs = new Map();

// Уровень зума при клике (чуть меньше максимального, чтобы был виден контекст)
const ZOOM_ON_CLICK = CONFIG.maxZoom - 0.50;

CREATURES.forEach((creature) => {
    // Объявляем popupHtml один раз здесь
    const popupHtml = `
        <h3 class="popup-title">${creature.emoji} ${creature.name}</h3>
        <p class="popup-desc">${creature.desc}</p>
    `;

    // ── 1. Ареал и подпись ──
    let zone = null;
    let label = null;

    if (creature.habitat) {
        const style = TYPE_STYLES[creature.type] || TYPE_STYLES.constellation;

        // Добавляем bubblingMouseEvents: false, чтобы клик по ареалу
        // не вызывал клик по карте (и не срабатывала отладка)
        const pathOptions = { ...style, bubblingMouseEvents: false };

        if (creature.habitat.type === 'circle') {
            zone = L.circle(creature.coords, {
                ...pathOptions,
                radius: creature.habitat.radius,
            });
        } else if (creature.habitat.type === 'polygon') {
            zone = L.polygon(creature.habitat.points, pathOptions);
        }

        if (zone) {
            zone.bindPopup(popupHtml, { autoPan: false });

            // Зум при клике на ареал
            zone.on('click', (e) => {
                // e.latlng — это точка, куда кликнул пользователь
                map.flyTo(e.latlng, ZOOM_ON_CLICK, { duration: 1 });
            });
        }

        label = createAreaLabel(creature);
    }

    // ── 2. Маркер ──
    const style = TYPE_STYLES[creature.type] || TYPE_STYLES.constellation;
    const bgColor = style.fillColor;
    const outlineColor = style.color;

    const icon = L.divIcon({
        className: '',
        // Упрощенный box-shadow (без размытия на 6px), это сильно ускорит рендер
        html: `<div class="creature-marker"
                    style="background-color: ${bgColor}; border: 2px solid #fff; box-shadow: 0 0 0 2px ${outlineColor}, 0 2px 4px rgba(0,0,0,0.3);"
                    title="${creature.name}">
                    ${creature.emoji}
               </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
    });

    const marker = L.marker(creature.coords, {
        icon,
        bubblingMouseEvents: false // Отключаем всплытие клика
    }).bindPopup(popupHtml, { autoPan: false});

    // Зум при клике на маркер
    marker.on('click', (e) => {
        map.flyTo(e.latlng, ZOOM_ON_CLICK, { duration: 0.8 });
    });

    // ── 3. Применяем состояние «включено» ──
    const isEnabled = creature.enabled !== false;
    if (isEnabled) {
        marker.addTo(markersLayer);
        if (zone) zone.addTo(zonesLayer);
        if (label) label.addTo(zonesLayer);
    }

    creatureRefs.set(creature.id, {
        creature,
        marker,
        zone,
        label,
        handles: [],
        _radiusHandle: null,
    });
});

// ==========================================================
// ГЛОБАЛЬНЫЙ ОБЪЕКТ ДЛЯ editor.js
// ==========================================================
window.MythMap = {
    map,
    CREATURES,
    zonesLayer,
    markersLayer,
    creatureRefs,
    TYPE_STYLES,
    CONFIG,
    createAreaLabel,
};

// ==========================================================
// ПЕРЕКЛЮЧАТЕЛЬ СЛОЁВ
// ==========================================================
L.control.layers(null, {
    'Ареалы обитания': zonesLayer,
    'Маркеры существ': markersLayer,
}, {
    position: 'bottomright',
    collapsed: false,
}).addTo(map);

// ==========================================================
// ОТЛАДКА: координаты при клике
// ==========================================================
if (CONFIG.debugCoords) {
    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        console.log(`Клик: [${lat.toFixed(1)}, ${lng.toFixed(1)}]`);
        L.popup()
            .setLatLng(e.latlng)
            .setContent(`Координаты: <b>${lat.toFixed(1)}, ${lng.toFixed(1)}</b>`)
            .openOn(map);
    });
}

console.log('Карта инициализирована. Существ на карте:', CREATURES.length);