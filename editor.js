// ==========================================================
// РЕДАКТОР КАРТЫ
// ==========================================================
(function () {
    'use strict';

    // ─── ГЛОБАЛЬНЫЙ ФЛАГ РЕДАКТОРА ───
    // Поставьте false перед публикацией (в прод), чтобы полностью
    // отключить панель и скрыть её с экрана.
    const ENABLE_EDITOR = true;
    // ──────────────────────────────────

    if (!ENABLE_EDITOR) {
        const p = document.getElementById('editor-panel');
        if (p) p.style.display = 'none';
        return; // Прекращаем выполнение скрипта
    }

    if (!window.MythMap) {
        console.error('editor.js: window.MythMap не найден. Подключите editor.js после script.js');
        return;
    }

    const {
        map,
        CREATURES,
        zonesLayer,
        markersLayer,
        creatureRefs,
        createAreaLabel,
    } = window.MythMap;

    let editMode = false;
    let selectedId = null;

    // ─── DOM ───
    const panel       = document.getElementById('editor-panel');
    const listEl      = document.getElementById('editor-list');
    const detailsEl   = document.getElementById('editor-details');
    const toggleBtn   = document.getElementById('editor-toggle');
    const downloadBtn = document.getElementById('editor-download');
    const copyBtn     = document.getElementById('editor-copy');
    const reloadBtn   = document.getElementById('editor-reload');

    if (!panel) {
        console.warn('editor.js: панель #editor-panel не найдена в index.html');
        return;
    }

    // Названия категорий для группировки
    const CATEGORIES = {
        constellation: 'Созвездия животных',
        minor: 'Второстепенные созвездия',
        dragon: 'Змеи и драконы',
        beast: 'Звери и чудовища'
    };

    // ==========================================================
    // СПИСОК СУЩНОСТЕЙ (С ГРУППИРОВКОЙ)
    // ==========================================================
    function renderList() {
        listEl.innerHTML = '';

        // Группируем массив по type
        const groups = {};
        CREATURES.forEach(c => {
            if (!groups[c.type]) groups[c.type] = [];
            groups[c.type].push(c);
        });

        // Проходим по всем возможным категориям
        Object.keys(CATEGORIES).forEach(type => {
            const items = groups[type];
            if (!items || items.length === 0) return; // Пропускаем пустые

            // Заголовок группы
            const header = document.createElement('div');
            header.className = 'editor-group-title';
            header.textContent = CATEGORIES[type];
            listEl.appendChild(header);

            // Сами элементы
            items.forEach(c => {
                const row = document.createElement('div');
                row.className = 'editor-row';
                row.innerHTML = `
                    <input type="checkbox" data-id="${c.id}" ${c.enabled !== false ? 'checked' : ''}>
                    <span class="editor-emoji">${c.emoji}</span>
                    <span class="editor-name">${c.name}</span>
                `;
                const checkbox = row.querySelector('input');
                checkbox.addEventListener('change', () => {
                    setEnabled(c.id, checkbox.checked);
                });
                row.querySelector('.editor-name').addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectCreature(c.id);
                });
                listEl.appendChild(row);
            });
        });

        if (selectedId) {
            const row = listEl.querySelector(`input[data-id="${selectedId}"]`)?.closest('.editor-row');
            if (row) row.classList.add('selected');
        }
    }

    // ==========================================================
    // ВЫБОР СУЩНОСТИ
    // ==========================================================
    function selectCreature(id) {
        selectedId = id;
        listEl.querySelectorAll('.editor-row').forEach(r => r.classList.remove('selected'));
        const row = listEl.querySelector(`input[data-id="${id}"]`)?.closest('.editor-row');
        if (row) row.classList.add('selected');

        const ref = creatureRefs.get(id);
        if (ref) renderDetails(ref);
    }

    // ==========================================================
    // ВКЛЮЧЕНИЕ / ВЫКЛЮЧЕНИЕ
    // ==========================================================
    function setEnabled(id, enabled) {
        const ref = creatureRefs.get(id);
        if (!ref) return;

        ref.creature.enabled = enabled;

        if (enabled) {
            markersLayer.addLayer(ref.marker);
            if (ref.zone) zonesLayer.addLayer(ref.zone);
            if (ref.label) zonesLayer.addLayer(ref.label); // Добавлено
            if (editMode) enableEditingForRef(ref, true);
        } else {
            markersLayer.removeLayer(ref.marker);
            if (ref.zone) zonesLayer.removeLayer(ref.zone);
            if (ref.label) zonesLayer.removeLayer(ref.label); // Добавлено
            enableEditingForRef(ref, false);
        }
    }

    // ==========================================================
    // РЕЖИМ РЕДАКТИРОВАНИЯ (ГЛОБАЛЬНЫЙ)
    // ==========================================================
    function setEditMode(on) {
        editMode = on;
        toggleBtn.classList.toggle('active', on);
        toggleBtn.textContent = on
            ? '✖ Выйти из режима редактирования'
            : '✎ Режим редактирования';

        creatureRefs.forEach((ref) => enableEditingForRef(ref, on));

        // Если сейчас выбрана сущность — перерисовываем панель,
        // чтобы показать/скрыть поля ввода координат
        if (selectedId) {
            const ref = creatureRefs.get(selectedId);
            if (ref) renderDetails(ref);
        }
    }

    function enableEditingForRef(ref, on) {
        const { creature, marker } = ref;
        const visible = creature.enabled !== false;

        ref.handles.forEach(h => map.removeLayer(h));
        ref.handles = [];
        ref._radiusHandle = null;

        if (on && visible) {
            marker.dragging.enable();
            marker.off('dragend', onMarkerDragEnd);
            marker.on('dragend', onMarkerDragEnd);

            if (ref.zone && creature.habitat) {
                if (creature.habitat.type === 'circle') createRadiusHandle(ref);
                else if (creature.habitat.type === 'polygon') createVertexHandles(ref);
            }
        } else {
            marker.dragging.disable();
            marker.off('dragend', onMarkerDragEnd);
        }
    }

    // ==========================================================
    // ПЕРЕТАСКИВАНИЕ МАРКЕРА
    // ==========================================================
    function onMarkerDragEnd(e) {
        const marker = e.target;
        const id = findIdByMarker(marker);
        if (!id) return;

        const ref = creatureRefs.get(id);
        const pos = marker.getLatLng();
        ref.creature.coords = [pos.lat, pos.lng];

        if (ref.zone && ref.creature.habitat) {
            if (ref.creature.habitat.type === 'circle') {
                ref.zone.setLatLng(pos);
                if (ref.label) ref.label.setLatLng(pos);
                refreshRadiusHandle(ref);
            } else if (ref.creature.habitat.type === 'polygon') {
                const oldCenter = computePolygonCenter(ref.creature.habitat.points);
                const dx = pos.lng - oldCenter[1];
                const dy = pos.lat - oldCenter[0];
                ref.creature.habitat.points = ref.creature.habitat.points.map(
                    p => [p[0] + dy, p[1] + dx],
                );
                ref.zone.setLatLngs(ref.creature.habitat.points);
                ref.handles.forEach(h => map.removeLayer(h));
                ref.handles = [];
                if (ref.label) ref.label.setLatLng(computePolygonCenter(ref.creature.habitat.points));
                if (editMode) createVertexHandles(ref);
            }
        }
        updateDetailsInputs(ref);
    }

    function findIdByMarker(marker) {
        for (const [id, ref] of creatureRefs) {
            if (ref.marker === marker) return id;
        }
        return null;
    }

    function computePolygonCenter(points) {
        const lat = points.reduce((s, p) => s + p[0], 0) / points.length;
        const lng = points.reduce((s, p) => s + p[1], 0) / points.length;
        return [lat, lng];
    }

    // ==========================================================
    // РУЧКА РАДИУСА (круг)
    // ==========================================================
    function createRadiusHandle(ref) {
        const c = ref.creature;
        const center = ref.marker.getLatLng();
        const edge = L.latLng(center.lat + c.habitat.radius, center.lng);

        const handle = L.marker(edge, {
            draggable: true,
            icon: L.divIcon({
                className: '',
                html: '<div class="editor-handle"></div>',
                iconSize: [14, 14],
                iconAnchor: [7, 7],
            }),
            zIndexOffset: 1000,
        }).addTo(map);

        handle.on('drag', () => {
            const p = handle.getLatLng();
            const dx = p.lng - center.lng;
            const dy = p.lat - center.lat;
            const newRadius = Math.max(3, Math.sqrt(dx * dx + dy * dy));
            c.habitat.radius = newRadius;
            ref.zone.setRadius(newRadius);
            updateDetailsInputs(ref);
        });

        ref.handles.push(handle);
        ref._radiusHandle = handle;
    }

    function refreshRadiusHandle(ref) {
        if (!ref._radiusHandle) return;
        const center = ref.marker.getLatLng();
        ref._radiusHandle.setLatLng(
            L.latLng(center.lat + ref.creature.habitat.radius, center.lng),
        );
    }

    // ==========================================================
    // РУЧКИ ВЕРШИН (полигон)
    // ==========================================================
    function createVertexHandles(ref) {
        const c = ref.creature;
        c.habitat.points.forEach((pt, idx) => {
            const handle = L.marker(pt, {
                draggable: true,
                icon: L.divIcon({
                    className: '',
                    html: '<div class="editor-handle editor-vertex"></div>',
                    iconSize: [12, 12],
                    iconAnchor: [6, 6],
                }),
                zIndexOffset: 1000,
            }).addTo(map);

            handle.on('drag', () => {
                const p = handle.getLatLng();
                c.habitat.points[idx] = [p.lat, p.lng];
                ref.zone.setLatLngs(c.habitat.points);
                if (ref.label) ref.label.setLatLng(computePolygonCenter(c.habitat.points));
                updateDetailsInputs(ref);
            });

            ref.handles.push(handle);
        });
    }

    // ==========================================================
    // ПАНЕЛЬ ДЕТАЛЕЙ (ИЗМЕНЕНА ДЛЯ СТРОГОГО РЕЖИМА)
    // ==========================================================
    function renderDetails(ref) {
        const c = ref.creature;

        // Если НЕ в режиме редактирования — только заглушка
        if (!editMode) {
            detailsEl.innerHTML = `
                <div class="editor-details-title">${c.emoji} ${c.name}</div>
                <div class="editor-details-hint" style="margin-top: 8px; line-height: 1.4;">
                    Нажмите «✎ Режим редактирования» сверху, чтобы изменить координаты и ареал.
                </div>
            `;
            return;
        }

        // Если В режиме — генерируем полную форму
        let html = `
            <div class="editor-details-title">${c.emoji} ${c.name}</div>
            <div class="editor-field-row">
                <label>Y: <input type="number" step="1" id="edit-coords-y" value="${c.coords[0].toFixed(1)}"></label>
                <label>X: <input type="number" step="1" id="edit-coords-x" value="${c.coords[1].toFixed(1)}"></label>
                <button id="edit-coords-apply" class="editor-btn editor-btn-small" title="Применить координаты">↻</button>
                <button id="edit-center" class="editor-btn editor-btn-small" title="Центрировать">⌖</button>
            </div>
            <div class="editor-field-row">
                <label>Ареал:
                    <select id="edit-habitat-type">
                        <option value="none"${!c.habitat ? ' selected' : ''}>Нет</option>
                        <option value="circle"${c.habitat && c.habitat.type === 'circle' ? ' selected' : ''}>Круг</option>
                        <option value="polygon"${c.habitat && c.habitat.type === 'polygon' ? ' selected' : ''}>Полигон</option>
                    </select>
                </label>
            </div>
        `;

        if (c.habitat && c.habitat.type === 'circle') {
            html += `
                <div class="editor-field-row">
                    <label>Радиус: <input type="number" step="1" min="1" id="edit-radius" value="${c.habitat.radius.toFixed(1)}"></label>
                </div>
            `;
        } else if (c.habitat && c.habitat.type === 'polygon') {
            html += `<div class="editor-points-list">`;
            c.habitat.points.forEach((pt, i) => {
                html += `
                    <div class="editor-point-row">
                        <input type="number" step="1" data-point-idx="${i}" data-axis="0" value="${pt[0].toFixed(1)}">
                        <input type="number" step="1" data-point-idx="${i}" data-axis="1" value="${pt[1].toFixed(1)}">
                        <button class="editor-btn editor-btn-small editor-btn-danger" data-remove-point="${i}" title="Удалить вершину">×</button>
                    </div>
                `;
            });
            html += `</div>
                <button id="edit-add-point" class="editor-btn editor-btn-small">+ Добавить точку</button>
            `;
        }

        detailsEl.innerHTML = html;

        // Обработчики (вешаем только если editMode === true)
        document.getElementById('edit-coords-apply')?.addEventListener('click', () => {
            updateCoordsFromInputs(ref);
        });
        document.getElementById('edit-center')?.addEventListener('click', () => {
            map.setView(ref.marker.getLatLng(), Math.max(map.getZoom(), 1));
        });
        document.getElementById('edit-habitat-type')?.addEventListener('change', (e) => {
            setHabitatType(ref, e.target.value);
        });
        document.getElementById('edit-radius')?.addEventListener('change', () => {
            updateRadiusFromInput(ref);
        });
        document.getElementById('edit-add-point')?.addEventListener('click', () => {
            addVertex(ref);
        });

        detailsEl.querySelectorAll('input[data-point-idx]').forEach(input => {
            input.addEventListener('change', () => {
                const idx = parseInt(input.dataset.pointIdx);
                const axis = parseInt(input.dataset.axis);
                const val = parseFloat(input.value);
                if (isNaN(val) || !c.habitat) return;
                c.habitat.points[idx][axis] = val;
                ref.zone.setLatLngs(c.habitat.points);
                if (ref.label) ref.label.setLatLng(computePolygonCenter(c.habitat.points)); // ВАЖНОЕ ДОПОЛНЕНИЕ
                ref.handles.forEach(h => map.removeLayer(h));
                ref.handles = [];
                if (editMode && c.enabled !== false) createVertexHandles(ref);
            });
        });

        detailsEl.querySelectorAll('button[data-remove-point]').forEach(btn => {
            btn.addEventListener('click', () => {
                removeVertex(ref, parseInt(btn.dataset.removePoint));
            });
        });
    }

    function updateDetailsInputs(ref) {
        const c = ref.creature;
        const yInput = document.getElementById('edit-coords-y');
        const xInput = document.getElementById('edit-coords-x');
        if (yInput) yInput.value = c.coords[0].toFixed(1);
        if (xInput) xInput.value = c.coords[1].toFixed(1);

        if (c.habitat && c.habitat.type === 'circle') {
            const rInput = document.getElementById('edit-radius');
            if (rInput) rInput.value = c.habitat.radius.toFixed(1);
        } else if (c.habitat && c.habitat.type === 'polygon') {
            detailsEl.querySelectorAll('input[data-point-idx]').forEach(input => {
                const idx = parseInt(input.dataset.pointIdx);
                const axis = parseInt(input.dataset.axis);
                if (c.habitat.points[idx]) {
                    input.value = c.habitat.points[idx][axis].toFixed(1);
                }
            });
        }
    }

    // ==========================================================
    // ПЕРЕСОЗДАНИЕ ЗОНЫ
    // ==========================================================
    function rebuildZone(ref) {
        const c = ref.creature;
        const visible = c.enabled !== false;

        if (ref.zone) zonesLayer.removeLayer(ref.zone);
        if (ref.label) zonesLayer.removeLayer(ref.label); // Удаляем старую подпись
        ref.handles.forEach(h => map.removeLayer(h));
        ref.handles = [];
        ref._radiusHandle = null;

        let zone = null;
        let label = null; // Создаем переменную

        if (c.habitat) {
            const style = window.MythMap.TYPE_STYLES[c.type] || window.MythMap.TYPE_STYLES.constellation;

            if (c.habitat.type === 'circle') {
                zone = L.circle(c.coords, { ...style, radius: c.habitat.radius });
            } else if (c.habitat.type === 'polygon') {
                zone = L.polygon(c.habitat.points, style);
            }

            if (zone) {
                const popupHtml = `
                    <h3 class="popup-title">${c.emoji} ${c.name}</h3>
                    <p class="popup-desc">${c.desc}</p>
                `;
                zone.bindPopup(popupHtml);
                if (visible) zone.addTo(zonesLayer);
            }

            // Создаем новую подпись
            label = createAreaLabel(c);
            if (visible && label) label.addTo(zonesLayer);
        }

        ref.zone = zone;
        ref.label = label; // Сохраняем в ref

        if (editMode && visible && zone && c.habitat) {
            if (c.habitat.type === 'circle') createRadiusHandle(ref);
            else if (c.habitat.type === 'polygon') createVertexHandles(ref);
        }
    }

    // ==========================================================
    // СМЕНА ТИПА АРЕАЛА
    // ==========================================================
    function setHabitatType(ref, newType) {
        const c = ref.creature;
        const markerPos = ref.marker.getLatLng();
        const center = [markerPos.lat, markerPos.lng];

        if (newType === 'none') {
            c.habitat = null;
        } else if (newType === 'circle') {
            let radius = 20;
            if (c.habitat && c.habitat.type === 'polygon' && c.habitat.points.length > 0) {
                const centroid = computePolygonCenter(c.habitat.points);
                const dists = c.habitat.points.map(p =>
                    Math.sqrt(Math.pow(p[0] - centroid[0], 2) + Math.pow(p[1] - centroid[1], 2))
                );
                radius = Math.max(3, dists.reduce((a, b) => a + b, 0) / dists.length);
            }
            c.habitat = { type: 'circle', radius };
        } else if (newType === 'polygon') {
            let points;
            if (c.habitat && c.habitat.type === 'circle') {
                const r = c.habitat.radius;
                points = [];
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    points.push([
                        center[0] + Math.sin(angle) * r,
                        center[1] + Math.cos(angle) * r,
                    ]);
                }
            } else {
                points = [
                    [center[0] + 15, center[1]],
                    [center[0] - 10, center[1] + 15],
                    [center[0] - 10, center[1] - 15],
                ];
            }
            c.habitat = { type: 'polygon', points };
        }

        rebuildZone(ref);
        renderDetails(ref);
    }

    // ==========================================================
    // ДОБАВИТЬ / УДАЛИТЬ ВЕРШИНУ
    // ==========================================================
    function addVertex(ref) {
        const c = ref.creature;
        if (!c.habitat || c.habitat.type !== 'polygon') return;

        const points = c.habitat.points;
        if (points.length < 2) {
            const markerPos = ref.marker.getLatLng();
            points.push([markerPos.lat + 10, markerPos.lng + 10]);
        } else {
            let maxLen = -1, insertAfter = 0;
            for (let i = 0; i < points.length; i++) {
                const j = (i + 1) % points.length;
                const len = Math.sqrt(
                    Math.pow(points[j][0] - points[i][0], 2) +
                    Math.pow(points[j][1] - points[i][1], 2)
                );
                if (len > maxLen) { maxLen = len; insertAfter = i; }
            }
            const nextIdx = (insertAfter + 1) % points.length;
            const mid = [
                (points[insertAfter][0] + points[nextIdx][0]) / 2,
                (points[insertAfter][1] + points[nextIdx][1]) / 2,
            ];
            points.splice(insertAfter + 1, 0, mid);
        }

        rebuildZone(ref);
        renderDetails(ref);
    }

    function removeVertex(ref, idx) {
        const c = ref.creature;
        if (!c.habitat || c.habitat.type !== 'polygon') return;
        if (c.habitat.points.length <= 3) {
            alert('Полигон должен иметь минимум 3 вершины.');
            return;
        }
        c.habitat.points.splice(idx, 1);
        rebuildZone(ref);
        renderDetails(ref);
    }

    // ==========================================================
    // ВВОД КООРДИНАТ / РАДИУСА ВРУЧНУЮ
    // ==========================================================
    function updateCoordsFromInputs(ref) {
        const c = ref.creature;
        const yInput = document.getElementById('edit-coords-y');
        const xInput = document.getElementById('edit-coords-x');
        if (!yInput || !xInput) return;

        const y = parseFloat(yInput.value);
        const x = parseFloat(xInput.value);
        if (isNaN(y) || isNaN(x)) return;

        const oldLat = c.coords[0];
        const oldLng = c.coords[1];
        const dy = y - oldLat;
        const dx = x - oldLng;

        c.coords = [y, x];
        ref.marker.setLatLng([y, x]);

        if (c.habitat) {
            if (c.habitat.type === 'circle') {
                ref.zone.setLatLng([y, x]);
                if (ref.label) ref.label.setLatLng([y, x]);
                refreshRadiusHandle(ref);
            } else if (c.habitat.type === 'polygon') {
                c.habitat.points = c.habitat.points.map(p => [p[0] + dy, p[1] + dx]);
                ref.zone.setLatLngs(c.habitat.points);
                ref.handles.forEach(h => map.removeLayer(h));
                ref.handles = [];
                if (ref.label) ref.label.setLatLng(computePolygonCenter(c.habitat.points));
                if (editMode && c.enabled !== false) createVertexHandles(ref);
            }
        }
        renderDetails(ref);
    }

    function updateRadiusFromInput(ref) {
        const c = ref.creature;
        const input = document.getElementById('edit-radius');
        if (!input || !c.habitat || c.habitat.type !== 'circle') return;
        const r = parseFloat(input.value);
        if (isNaN(r) || r <= 0) return;
        c.habitat.radius = r;
        ref.zone.setRadius(r);
        refreshRadiusHandle(ref);
    }

    // ==========================================================
    // ГЕНЕРАЦИЯ / СКАЧИВАНИЕ
    // ==========================================================
    function generateCreaturesFile() {
        const out = [];
        out.push('// ==========================================================');
        out.push('// ДАННЫЕ О СУЩЕСТВАХ');
        out.push('// Файл сгенерирован редактором карты.');
        out.push('// Замените им data/creatures.js и обновите страницу.');
        out.push('// ==========================================================');
        out.push('const CREATURES = [');

        CREATURES.forEach((c) => {
            const safeName  = c.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const safeEmoji = c.emoji.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

            out.push('    {');
            out.push(`        id: '${c.id}',`);
            out.push(`        name: '${safeName}',`);
            out.push(`        coords: [${c.coords[0].toFixed(1)}, ${c.coords[1].toFixed(1)}],`);
            out.push(`        emoji: '${safeEmoji}',`);
            out.push(`        type: '${c.type}',`);

            if (c.enabled === false) {
                out.push(`        enabled: false,`);
            }

            if (c.habitat) {
                if (c.habitat.type === 'circle') {
                    out.push(`        habitat: { type: 'circle', radius: ${c.habitat.radius.toFixed(1)} },`);
                } else if (c.habitat.type === 'polygon') {
                    out.push(`        habitat: {`);
                    out.push(`            type: 'polygon',`);
                    out.push(`            points: [`);
                    c.habitat.points.forEach((p) => {
                        out.push(`                [${p[0].toFixed(1)}, ${p[1].toFixed(1)}],`);
                    });
                    out.push(`            ],`);
                    out.push(`        },`);
                }
            }

            out.push(`        desc: DESCRIPTIONS['${c.id}'],`);
            out.push('    },');
        });

        out.push('];');
        return out.join('\n');
    }

    function downloadCreatures() {
        const text = generateCreaturesFile();
        const blob = new Blob([text], { type: 'text/javascript;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'creatures.js';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 500);
    }

    function copyCreaturesToClipboard() {
        const text = generateCreaturesFile();
        navigator.clipboard.writeText(text)
            .then(() => alert('Код creatures.js скопирован в буфер обмена.'))
            .catch(() => {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                try { document.execCommand('copy'); } catch (e) { /* noop */ }
                document.body.removeChild(ta);
                alert('Код creatures.js скопирован в буфер обмена.');
            });
    }

    // ==========================================================
    // ОБРАБОТЧИКИ КНОПОК
    // ==========================================================
    toggleBtn.addEventListener('click', () => setEditMode(!editMode));
    if (downloadBtn) downloadBtn.addEventListener('click', downloadCreatures);
    if (copyBtn)     copyBtn.addEventListener('click', copyCreaturesToClipboard);
    if (reloadBtn)   reloadBtn.addEventListener('click', () => {
        if (confirm('Перезагрузить страницу? Несохранённые правки будут потеряны.')) {
            location.reload();
        }
    });

    // ==========================================================
    // СТАРТ
    // ==========================================================
    renderList();
    console.log('Редактор карты готов. Сущностей в списке:', CREATURES.length);
})();