// ==========================================================
// КОНФИГУРАЦИЯ КАРТЫ (пиксельный режим, CRS.Simple)
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

// ==========================================================
// ГЕОГРАФИЧЕСКИЕ ГРАНИЦЫ SVG (для ll())
// ==========================================================
const GEO_BOUNDS = {
    minLat: 30,  maxLat: 48,
    minLng: -10, maxLng: 40,
};

// ==========================================================
// ЦВЕТОВЫЕ СТИЛИ АРЕАЛОВ ПО ТИПАМ
// ==========================================================
const TYPE_STYLES = {
    constellation: {
        color: '#c9a227',
        fillColor: '#ffd966',
        fillOpacity: 0.28,
        weight: 2,
        dashArray: '8 5',
    },
    minor: {
        color: '#5b8c3e',
        fillColor: '#a8c96e',
        fillOpacity: 0.22,
        weight: 1.5,
        dashArray: '4 4',
    },
    dragon: {
        color: '#8b1e1e',
        fillColor: '#d44a4a',
        fillOpacity: 0.25,
        weight: 2,
        dashArray: null,
    },
};

// ==========================================================
// ХЕЛПЕР: lat/lng → пиксели
// ==========================================================
function ll(lat, lng) {
    const y = (lat - GEO_BOUNDS.minLat)
        / (GEO_BOUNDS.maxLat - GEO_BOUNDS.minLat)
        * CONFIG.imageBounds[1][0];
    const x = (lng - GEO_BOUNDS.minLng)
        / (GEO_BOUNDS.maxLng - GEO_BOUNDS.minLng)
        * CONFIG.imageBounds[1][1];
    return [y, x];
}

// ==========================================================
// ДАННЫЕ О СУЩЕСТВАХ
// ==========================================================
const CREATURES = [

    // ─── СОЗВЕЗДИЯ ЖИВОТНЫХ ───
    {
        id: 'kriy',
        name: 'Овен / Златорунный баран — Крий',
        coords: [381.1, 557.4],
        emoji: '🐏',
        type: 'constellation',
        habitat: { type: 'circle', radius: 18 },
        desc: DESCRIPTIONS['kriy'],
    },
    {
        id: 'karkin',
        name: 'Рак / Краб — Каркин',
        coords: [341.9, 542.8],
        emoji: '🦀',
        type: 'constellation',
        desc: DESCRIPTIONS['karkin'],
    },
    {
        id: 'skorpios',
        name: 'Скорпион — Скорпиос',
        coords: [250.6, 611.7],
        emoji: '🦂',
        type: 'constellation',
        desc: DESCRIPTIONS['skorpios'],
    },
    {
        id: 'ichthys',
        name: 'Рыбы — Ихтис',
        coords: [212.8, 949.7],
        emoji: '🐟',
        type: 'constellation',
        habitat: {
            type: 'polygon',
            points: [
                [263.9, 923.1],
                [302.6, 944.5],
                [315.8, 962.6],
                [305.6, 966.6],
                [292.5, 958.5],
                [ 273.0, 961.8],
                [220.0, 971.8],
                [197.8, 934.5],
                [218.5, 878.6],
                [236.5, 908.6],
],
                },
        desc: DESCRIPTIONS['ichthys'],
    },
    {
        id: 'chiron',
        name: 'Стрелец / Центавр — Хирон',
        coords: [418.9, 548.8],
        emoji: '🏹',
        type: 'constellation',
        desc: DESCRIPTIONS['chiron'],
    },


    // ─── ВТОРОСТЕПЕННЫЕ СОЗВЕЗДИЯ ───
    {
        id: 'eagle-zeus',
        name: 'Орёл Зевса',
        coords: [446.5, 521.8],
        emoji: '🦅',
        type: 'minor',
        desc: DESCRIPTIONS['eagle-zeus'],
    },
    {
        id: 'laelaps',
        name: 'Большой пёс — Лелап',
        coords: [241.4, 619.9],
        emoji: '🐕',
        type: 'minor',
             habitat: {
                         type: 'polygon',
                         points: [
                             [259.1, 577.1],
                             [260.0, 581.3],
                             [ 264.4, 582.0],
                             [263.5, 583.4],
                             [259.9, 585.4],
                             [259.9, 592.0],
                             [262.4, 594.5],
                             [260.4, 596.9],
                             [258.3, 594.8],
                              [256.9, 598.6],
                              [253.5, 599.9],
                              [256.4, 613.0],
                              [254.9, 617.3],
                            [255.3, 622.0],
                              [253.6, 623.9],
                              [251.8, 633.1],
                              [249.9, 638.0],
                              [252.0, 645.4],
                              [250.9, 647.0],
                            [243.8, 647.0],
                            [242.6, 649.6],
                            [245.5, 652.0],
                            [246.9, 655.8],
                            [246.5, 660.3],
                            [250.3, 663.0],
                            [248.5, 663.8],
                            [239.9, 663.6],
                            [237.6, 659.5],
                            [237.5, 643.9],
                            [234.4, 620.5],
                            [234.9, 615.4],
                            [240.9, 613.5],
                            [246.8, 588.5],
                            [246.8, 579.9],
                            [252.6, 576.6],
             ],
                             },
        desc: DESCRIPTIONS['laelaps'],
    },
    {
        id: 'teumessian-fox',
        name: 'Малый пёс — Тевмесская лисица',
        coords: [376.5, 561.3],
        emoji: '🦊',
        type: 'minor',
        desc: DESCRIPTIONS['teumessian-fox'],
    },
    {
        id: 'pholus',
        name: 'Кентавр и Чаша — Фолос',
        coords: [352.8, 510.9],
        emoji: '🏺',
        type: 'minor',
        desc: DESCRIPTIONS['pholus'],
    },
{
     id: 'ket-troy',
     name: 'Кит — Кет',
     coords: [438.9, 638.5],
     emoji: '🐋',
     type: 'minor',
     habitat: {
                 type: 'polygon',
                 points: [
                     [421.3, 642.4],
                     [ 441.8, 642.8],
                     [448.0, 636.0],
                     [446.0, 625.4],
                     [441.1, 620.9],
                     [435.6, 618.6],
                     [428.5, 618.1],
                     [423.6, 617.9],
                     [420.1, 623.5],
     ],
                     },
     desc: DESCRIPTIONS['ket-troy'],
 },
    {
        id: 'pegasus',
        name: 'Пегас',
        coords: [445.5, 520.5],
        emoji: '🐴',
        type: 'minor',
        desc: DESCRIPTIONS['pegasus'],
    },
    {
        id: 'hare',
        name: 'Заяц',
        coords: [319.3, 678.6],
        emoji: '🐇',
        type: 'minor',
        desc: DESCRIPTIONS['hare'],
    },
    {
        id: 'amalthea',
        name: 'Козлята — Коза Амалфея',
        coords: [245.0, 637.9],
        emoji: '🌟',
        type: 'minor',
        desc: DESCRIPTIONS['amalthea'],
    },

    // ─── ЗМЕИ И ДРАКОНЫ ───
    {
        id: 'chimera',
        name: 'Химера Ликийская',
        coords: [305.8, 748.0],
        emoji: '🦁',
        type: 'dragon',
        desc: DESCRIPTIONS['chimera'],
    },
    {
        id: 'colchian-dragon',
        name: 'Колхидский дракон — Колхис',
        coords: [537.5, 1110.1],
        emoji: '🐉',
        type: 'dragon',
        desc: DESCRIPTIONS['colchian-dragon'],
    },
    {
        id: 'ismenian-dragon',
        name: 'Исменийский дракон',
        coords: [378.1, 559.4],
        emoji: '🐲',
        type: 'dragon',
        desc: DESCRIPTIONS['ismenian-dragon'],
    },
    {
        id: 'python',
        name: 'Пифон',
        coords: [381.8, 527.6],
        emoji: '🐍',
        type: 'dragon',
        desc: DESCRIPTIONS['python'],
    },
    {
        id: 'cychreus',
        name: 'Кихрид',
        coords: [359.0, 567.3],
        emoji: '🐍',
        type: 'dragon',
        desc: DESCRIPTIONS['cychreus'],
    },
    {
        id: 'maeonian-dragon',
        name: 'Меонийский дракон',
        coords: [390.1, 754.8],
        emoji: '🐲',
        type: 'dragon',
        habitat: { type: 'circle', radius: 55 },
        desc: DESCRIPTIONS['maeonian-dragon'],
    },
    {
        id: 'nemean-dragon',
        name: 'Немейский дракон',
        coords: [355.8, 545.5],
        emoji: '🐲',
        type: 'dragon',
        habitat: { type: 'circle', radius: 5 },
        desc: DESCRIPTIONS['nemean-dragon'],
    },
    {
        id: 'ophiogenes',
        name: 'Офиоген',
        coords: [457.8, 670.0],
        emoji: '🐍',
        type: 'dragon',
        desc: DESCRIPTIONS['ophiogenes'],
    },
    {
        id: 'pitane-dragon',
        name: 'Дракон Питаны',
        coords: [380.0, 787.5],
        emoji: '🐍',
        type: 'dragon',
        habitat: { type: 'circle', radius: 20 },
        desc: DESCRIPTIONS['pitane-dragon'],
    },
    {
        id: 'rhodes-dragons',
        name: 'Драконы Родоса',
        coords: [288.9, 713.1],
        emoji: '🐉',
        type: 'dragon',
        desc: DESCRIPTIONS['rhodes-dragons'],
    },
    {
        id: 'thespian-dragon',
        name: 'Феспийский дракон',
        coords: [381.5, 544.9],
        emoji: '🐲',
        type: 'dragon',
        desc: DESCRIPTIONS['thespian-dragon'],
    },
];
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

CREATURES.forEach((creature) => {
    const popupHtml = `
        <h3 class="popup-title">${creature.emoji} ${creature.name}</h3>
        <p class="popup-desc">${creature.desc}</p>
    `;

    // ── 1. Ареал обитания ──
    if (creature.habitat) {
        const style = TYPE_STYLES[creature.type] || TYPE_STYLES.constellation;

        let zone = null;
        if (creature.habitat.type === 'circle') {
            zone = L.circle(creature.coords, {
                ...style,
                radius: creature.habitat.radius,
            });
        } else if (creature.habitat.type === 'polygon') {
            zone = L.polygon(creature.habitat.points, style);
        }

        if (zone) {
            zone.bindPopup(popupHtml).addTo(zonesLayer);
        }
    }

    // ── 2. Маркер (эмодзи) ──
    const icon = L.divIcon({
        className: '',
        html: `<div class="creature-marker" title="${creature.name}">${creature.emoji}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
    });

    L.marker(creature.coords, { icon })
        .bindPopup(popupHtml)
        .addTo(markersLayer);
});

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