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
    zoomControl: false
});
L.control.zoom({ position: 'topright' }).addTo(map);

// ==========================================================
// ИЗОБРАЖЕНИЕ-ПОДЛОЖКА
// ==========================================================
L.imageOverlay(CONFIG.imageUrl, CONFIG.imageBounds, {
    opacity: CONFIG.imageOpacity,
    interactive: false,
    className: 'map-overlay',
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

const creatureRefs = new Map();

// ==========================================================
// ФУНКЦИЯ СБОРКИ HTML ДЛЯ ПОПАПА
// ==========================================================
function buildPopupHtml(creature) {
    const imgPath = typeof IMAGES !== 'undefined' ? IMAGES[creature.id] : null;

    let processedDesc = creature.desc || 'Описание отсутствует.';
    processedDesc = processedDesc.replace(/(Статус:)/g, '<span class="highlight">$1</span>');
    processedDesc = processedDesc.replace(/\*(.*?)\*/g, '<span class="highlight">$1</span>');

    const textHtml = `
        <div class="popup-text">
            <p class="popup-desc">${processedDesc}</p>
        </div>
    `;

    const imgHtml = imgPath
        ? `<div class="popup-image-wrapper">
               <img src="${imgPath}"
                    class="popup-image"
                    loading="lazy"
                    decoding="async"
                    alt="${creature.name}"
                    onload="this.closest('.popup-content').classList.add(this.naturalHeight > this.naturalWidth ? 'is-vertical' : 'is-horizontal'); this.dispatchEvent(new Event('popup-img-loaded', { bubbles: true }))">
           </div>`
        : '';

    return `
        <div class="popup-title-wrapper">
            <h3 class="popup-title">${creature.emoji} ${creature.name}</h3>
        </div>
        <div class="popup-meander-wrapper">
            <div class="meander top"></div>
            <div class="meander bottom"></div>

            <div class="popup-content ${imgPath ? 'has-image' : 'no-image'}">
                ${textHtml}
                ${imgHtml}
            </div>
        </div>
    `;
}

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

    const shortName = creature.name.split('—')[0].trim();

    const icon = L.divIcon({
        className: 'area-label-wrapper',
        html: `<div class="area-label">${shortName}</div>`,
    });

    return L.marker(pos, { icon, interactive: false, zIndexOffset: -100 });
}
// ==========================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ЦЕНТРИРОВАНИЯ
// ==========================================================
function getCreatureBounds(creature) {
    if (creature.habitat) {
        if (creature.habitat.type === 'circle') {
            const center = L.latLng(creature.coords);
            return center.toBounds(creature.habitat.radius * 2);
        } else if (creature.habitat.type === 'polygon') {
            return L.latLngBounds(creature.habitat.points);
        }
    }
    return null;
}
// ==========================================================
// УПРАВЛЕНИЕ МНОГОЭТАПНОЙ АНИМАЦИЕЙ И ПОЗИЦИЕЙ ПОПАПА (5 ЭТАПОВ)
// ==========================================================
let activeAnimTimers = [];
let activePopupSession = 0;

function clearAnimationQueue() {
    activeAnimTimers.forEach(id => clearTimeout(id));
    activeAnimTimers = [];
    map.stop(); // Останавливаем текущий полёт Leaflet, если был
}

// Вычисляем финальный центр карты с учетом высоты попапа и отступа
function calculateTargetCenter(creatureLatLng, targetZoom, popupHeight, openDownward) {
    const mapSize = map.getSize();
    const anchorPixel = map.project(creatureLatLng, targetZoom);

    const paddingTop = 80;    // отступ под шапку сайта
    const paddingBottom = 50; // отступ снизу
    const markerBottomOffset = 26; // 16px (радиус иконки) + 20px (высота стрелочки) + 2px зазор

    let desiredScreenY;

    if (openDownward) {
        const totalBlockHeight = markerBottomOffset + popupHeight;
        desiredScreenY = Math.max(
            paddingTop + 16,
            (mapSize.y - totalBlockHeight) / 2
        );
    } else {
        const totalBlockHeight = 16 + popupHeight + 10;
        desiredScreenY = Math.min(
            mapSize.y - paddingBottom - 16,
            (mapSize.y + totalBlockHeight) / 2
        );
    }

    const deltaY = (mapSize.y / 2) - desiredScreenY;
    const targetCenterPixel = L.point(anchorPixel.x, anchorPixel.y + deltaY);

    return map.unproject(targetCenterPixel, targetZoom);
}

// Пересчет позиции, если картинка внутри попапа догрузилась
function adjustPopupPosition(popup, creature, targetZoom, openDownward, sessionId) {
    if (sessionId !== activePopupSession || !map.hasLayer(popup)) return;

    const popupEl = popup.getElement();
    if (!popupEl) return;

    const wrapper = popupEl.querySelector('.leaflet-popup-content-wrapper');
    const popupHeight = wrapper ? wrapper.offsetHeight : popupEl.offsetHeight;
    const creatureLatLng = L.latLng(creature.coords);
    const markerBottomOffset = 26;

    if (openDownward) {
        popupEl.classList.add('popup-downward');
        // Смещаем вниз на высоту попапа + отступ от иконки, чтобы верх попапа был под иконкой
        popup.options.offset = L.point(0, popupHeight + markerBottomOffset);
    } else {
        popupEl.classList.remove('popup-downward');
        popup.options.offset = L.point(0, -18);
    }
    popup.update();

    const finalCenter = calculateTargetCenter(creatureLatLng, targetZoom, popupHeight, openDownward);
    map.panTo(finalCenter, { animate: true, duration: 0.3, easeLinearity: 0.25 });
}

map.on('popupopen', function (e) {
    const popup = e.popup;
    const layer = popup._source;
    if (!layer) return;

    let creature = null;
    for (const [, ref] of creatureRefs) {
        if (ref.marker === layer || ref.zone === layer) {
            creature = ref.creature;
            break;
        }
    }
    if (!creature) return;

    clearAnimationQueue();
    const sessionId = ++activePopupSession;

    const creatureLatLng = L.latLng(creature.coords);
    popup.setLatLng(creatureLatLng);

    // 1. Определяем направление (вверх или вниз) по положению иконки
    const screenPoint = map.latLngToContainerPoint(creatureLatLng);
    const mapHeight = map.getSize().y;
    const openDownward = screenPoint.y < mapHeight * 0.45;

    // 2. Вычисляем целевой зум
    const startZoom = map.getZoom();
    const startCenter = map.getCenter();
    const bounds = getCreatureBounds(creature);
    let targetZoom = startZoom;

    if (bounds && bounds.isValid()) {
        const boundsZoom = map.getBoundsZoom(bounds, false, [80, 80]);
        targetZoom = Math.min(boundsZoom, CONFIG.maxZoom - 0.5);
    } else {
        targetZoom = Math.min(startZoom + 1.5, CONFIG.maxZoom - 0.5);
    }
    targetZoom = Math.max(startZoom, targetZoom);

    // Считываем реальную высоту попапа (или берем актуальную из DOM)
    const popupEl = popup.getElement();
    if (popupEl) {
        popupEl.style.opacity = '0';
        popupEl.style.transition = 'opacity 0.2s ease';
    }
    const wrapper = popupEl ? popupEl.querySelector('.leaflet-popup-content-wrapper') : null;
    const popupHeight = wrapper ? wrapper.offsetHeight : 280;
    const markerBottomOffset = 26;

    // 3. Настраиваем направление и правильный offset заранее
    if (popupEl) {
        if (openDownward) {
            popupEl.classList.add('popup-downward');
            popup.options.offset = L.point(0, popupHeight + markerBottomOffset);
        } else {
            popupEl.classList.remove('popup-downward');
            popup.options.offset = L.point(0, -18);
        }
        popup.update();
    }

    // Вычисляем финальный центр карты
    const finalCenter = calculateTargetCenter(creatureLatLng, targetZoom, popupHeight, openDownward);

    // 4. Плавное приближение в 5 этапов (~1.1 сек)
    const totalSteps = 5;
    const totalDurationMs = 1100;
    const stepDurationMs = totalDurationMs / totalSteps;

    for (let i = 1; i <= totalSteps; i++) {
        const progress = i / totalSteps;

        const t = setTimeout(() => {
            if (sessionId !== activePopupSession) return;

            const currentZoom = startZoom + (targetZoom - startZoom) * progress;
            const currentCenter = L.latLng(
                startCenter.lat + (finalCenter.lat - startCenter.lat) * progress,
                startCenter.lng + (finalCenter.lng - startCenter.lng) * progress
            );

            const isLastStep = (i === totalSteps);

            if (isLastStep) {
                map.setView(currentCenter, currentZoom, {
                    animate: true,
                    duration: stepDurationMs / 1000,
                    easeLinearity: 0.25
                });

                if (popupEl) {
                    popupEl.style.opacity = '1';
                }

                // Докорректировка при загрузке картинки
                const img = popupEl ? popupEl.querySelector('.popup-image') : null;
                if (img && !img.complete) {
                    img.addEventListener('popup-img-loaded', () => {
                        adjustPopupPosition(popup, creature, targetZoom, openDownward, sessionId);
                    }, { once: true });
                }
            } else {
                map.setView(currentCenter, currentZoom, {
                    animate: true,
                    duration: stepDurationMs / 1000,
                    easeLinearity: 0.2
                });
            }
        }, stepDurationMs * i);

        activeAnimTimers.push(t);
    }
});

map.on('popupclose', function () {
    clearAnimationQueue();
});

const popupOptions = {
    autoPan: false,
    maxWidth: window.innerWidth < 768 ? 340 : 800, // 340px для телефонов
    minWidth: 280
};
// И используйте popupOptions внутри bindPopup(...)
// ==========================================================
// РЕНДЕР СУЩЕСТВ
// ==========================================================
CREATURES.forEach((creature) => {
    const popupHtml = buildPopupHtml(creature);

    let zone = null;
    let label = null;

    if (creature.habitat) {
        const style = TYPE_STYLES[creature.type] || TYPE_STYLES.constellation;
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
            zone.bindPopup(popupHtml, { autoPan: false, maxWidth: 800, minWidth: 300 });
        }

        label = createAreaLabel(creature);
    }

    const style = TYPE_STYLES[creature.type] || TYPE_STYLES.constellation;
    const bgColor = style.fillColor;
    const outlineColor = style.color;

    const icon = L.divIcon({
        className: '',
        html: `<div class="creature-marker"
                    style="background-color: ${bgColor}; border: 2px solid #fff; box-shadow: 0 0 0 2px ${outlineColor}, 0 2px 4px rgba(0,0,0,0.3);"
                    title="${creature.name}">
                    ${creature.emoji}
               </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, 0], // ВАЖНО: ставим 0,0, чтобы мы могли управлять позицией через offset
    });

    const marker = L.marker(creature.coords, {
        icon,
        bubblingMouseEvents: false
    }).bindPopup(popupHtml, { autoPan: false, maxWidth: 800, minWidth: 300 });

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
    buildPopupHtml,
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