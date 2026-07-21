class FantasyMap {
    constructor(app) {
        this.app = app;
        this.areas = [];
        this.discoveries = [];
        this.paths = [];
        this.events = [];
        this.gridCols = 8;
        this.gridRows = 6;
        this.container = null;
        this.cells = [];
        this.markers = [];
        this.eventMarkers = [];
        // true quando stiamo usando il set locale FANTASY_AREAS (nessun dato DB disponibile)
        this.usingLocalAreas = false;
    }

    async init() {
        this.container = document.getElementById('fantasyMapContent');
        if (!this.container) return;

        await this.loadData();
        this.render();
    }

    async loadData() {
        let dbAreas = null;

        if (this.app.userId) {
            try {
                const { data } = await SupaDB.supa
                    .from('fantasy_map_areas')
                    .select('*');
                if (data && data.length > 0) dbAreas = data;

                const { data: disc } = await SupaDB.supa
                    .from('player_map_discoveries')
                    .select('area_id')
                    .eq('user_id', this.app.userId);
                if (disc) this.discoveries = disc.map(d => d.area_id);
            } catch (e) {
                console.warn('[FantasyMap] Errore caricamento da Supabase:', e);
            }
        }

        if (dbAreas) {
            this.usingLocalAreas = false;
            this.areas = dbAreas.map(a => ({
                id: a.id,
                name: a.name,
                description: a.description,
                lore_text: a.lore,
                area_type: a.is_boss ? 'boss' : 'wilderness',
                emoji: a.emoji,
                pos_x: (a.grid_x / this.gridCols) * 100,
                pos_y: (a.grid_y / this.gridRows) * 100,
                size_x: (a.grid_w / this.gridCols) * 100,
                size_y: (a.grid_h / this.gridRows) * 100,
                exploration_cost: a.required_punti_esplorazione,
                required_forza: a.required_stats?.forza || 0,
                required_agilita: a.required_stats?.agilita || 0,
                required_costituzione: a.required_stats?.costituzione || 0,
                rupie_reward: a.reward_rupie,
                cristalli_reward: a.reward_cristalli,
                is_starting_area: a.is_starting_area,
                unlock_order: a.unlock_order,
                required_quests_completed: a.required_quests_completed,
                boss_quest_id: a.boss_quest_id
            }));

            // Carica sentieri e eventi
            try {
                const [pathsData, eventsData] = await Promise.all([
                    SupaDB.getMapPaths(),
                    SupaDB.getActiveEvents(this.app.userId)
                ]);
                this.paths = pathsData || [];
                this.events = eventsData || [];
            } catch (e) {
                console.warn('[FantasyMap] Errore caricamento sentieri/eventi:', e);
                this.paths = [];
                this.events = [];
            }
        } else {
            // Modalità locale/offline: usiamo il set statico e uno sblocco
            // sequenziale calcolato qui, senza dipendere da player_area_progress
            // (che esiste solo lato Supabase per utenti loggati).
            this.usingLocalAreas = true;
            this.areas = FANTASY_AREAS;

            const savedLocal = localStorage.getItem('questtracker_discoveries');
            if (savedLocal) {
                const parsed = JSON.parse(savedLocal);
                this.discoveries = [...new Set([...this.discoveries, ...parsed])];
            }
        }
    }

    // In modalità DB, lo sblocco viene da player_area_progress (this.app.areaProgress).
    // In modalità locale, l'area i-esima si sblocca quando l'area precedente è stata scoperta.
    isAreaUnlocked(area, index, progMap) {
        if (this.usingLocalAreas) {
            if (index === 0) return true;
            const prevArea = this.areas[index - 1];
            return this.discoveries.includes(prevArea.id);
        }
        const prog = progMap[area.id];
        return prog?.is_unlocked === true;
    }

    render() {
        this.container.innerHTML = '';

        const mapEl = document.createElement('div');
        mapEl.className = 'fantasy-map';

        const bg = document.createElement('div');
        bg.className = 'fantasy-map-bg';
        mapEl.appendChild(bg);

        const grid = document.createElement('div');
        grid.className = 'fantasy-grid';
        grid.style.gridTemplateColumns = `repeat(${this.gridCols}, 1fr)`;
        grid.style.gridTemplateRows = `repeat(${this.gridRows}, 1fr)`;

        this.cells = [];
        for (let row = 0; row < this.gridRows; row++) {
            for (let col = 0; col < this.gridCols; col++) {
                const cell = document.createElement('div');
                cell.className = 'map-cell fog';
                cell.dataset.row = row;
                cell.dataset.col = col;
                grid.appendChild(cell);
                this.cells.push({ el: cell, row, col });
            }
        }

        mapEl.appendChild(grid);

        const areaProgress = this.app.areaProgress || [];
        const progMap = {};
        areaProgress.forEach(ap => { progMap[ap.area_id] = ap; });

        const markersLayer = document.createElement('div');
        markersLayer.className = 'fantasy-markers';

        this.markers = [];
        this.areas.forEach((area, index) => {
            const areaUnlocked = this.isAreaUnlocked(area, index, progMap);
            const discovered = this.discoveries.includes(area.id);

            let visibility = 'locked';
            if (areaUnlocked) visibility = discovered ? 'revealed' : 'hidden';

            const marker = document.createElement('div');
            marker.className = `map-marker ${visibility}`;
            marker.style.left = `${area.pos_x}%`;
            marker.style.top = `${area.pos_y}%`;

            let tooltipHtml = '';
            if (!areaUnlocked) {
                tooltipHtml = `
                    <div class="marker-name">🔒 ???</div>
                    <div class="marker-desc">Scopri l'area precedente per sbloccare questa zona.</div>
                `;
            } else if (!discovered) {
                tooltipHtml = `
                    <div class="marker-name">${area.emoji || '❓'} ${area.name}</div>
                    <div class="marker-desc">${area.description || ''}</div>
                    <div class="marker-cost">
                        <span>🗺️ ${area.exploration_cost} PE</span>
                        ${area.required_forza > 0 ? `<span>💪 ${area.required_forza}</span>` : ''}
                        ${area.required_agilita > 0 ? `<span>🏃 ${area.required_agilita}</span>` : ''}
                    </div>
                    <button class="btn-reveal" data-area-id="${area.id}">🔍 Rivela</button>
                `;
            } else {
                tooltipHtml = `
                    <div class="marker-name">${area.emoji || ''} ${area.name}</div>
                    <div class="marker-desc">${area.description || ''}</div>
                    <div class="marker-reward">
                        ${area.rupie_reward > 0 ? `🪙+${area.rupie_reward}` : ''}
                        ${area.cristalli_reward > 0 ? ` 💎+${area.cristalli_reward}` : ''}
                    </div>
                    ${area.lore_text ? `<div class="marker-lore">"${area.lore_text}"</div>` : ''}
                `;
            }

            marker.innerHTML = `
                <div class="marker-icon">${!areaUnlocked ? '🔒' : (discovered ? (area.emoji || '📍') : '❓')}</div>
                <div class="marker-tooltip">${tooltipHtml}</div>
            `;

            if (areaUnlocked && !discovered) {
                const btn = marker.querySelector('.btn-reveal');
                if (btn) {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.revealArea(area.id);
                    });
                }
            }

            markersLayer.appendChild(marker);
            this.markers.push({ el: marker, area, index, discovered, areaUnlocked });
        });

        mapEl.appendChild(markersLayer);

        // Sentieri SVG tra le aree connesse
        const svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgLayer.setAttribute('class', 'fantasy-paths');
        svgLayer.setAttribute('viewBox', '0 0 100 100');
        svgLayer.setAttribute('preserveAspectRatio', 'none');
        this.paths.forEach(path => {
            const from = this.areas.find(a => a.id === path.from_area_id);
            const to = this.areas.find(a => a.id === path.to_area_id);
            if (!from || !to) return;
            const discovered = this.discoveries.includes(to.id);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', from.pos_x + (from.size_x || 10) / 2);
            line.setAttribute('y1', from.pos_y + (from.size_y || 10) / 2);
            line.setAttribute('x2', to.pos_x + (to.size_x || 10) / 2);
            line.setAttribute('y2', to.pos_y + (to.size_y || 10) / 2);
            line.setAttribute('class', `path-line ${discovered ? 'revealed' : 'hidden'}`);
            svgLayer.appendChild(line);
        });
        mapEl.appendChild(svgLayer);

        // Eventi random
        this.eventMarkers = [];
        this.events.forEach(evt => {
            const area = this.areas.find(a => a.id === evt.area_id);
            if (!area || !this.discoveries.includes(area.id)) return;
            const em = document.createElement('div');
            em.className = 'map-event-marker';
            em.style.left = `${area.pos_x + (area.size_x || 10) * 0.8}%`;
            em.style.top = `${area.pos_y}%`;
            em.innerHTML = `<div class="event-icon">✨</div>
                <div class="event-tooltip">
                    <div class="event-title">${evt.title}</div>
                    <div class="event-desc">${evt.description || ''}</div>
                    ${evt.reward_rupie > 0 ? `<div class="event-reward">🪙 +${evt.reward_rupie} Rupie</div>` : ''}
                    ${evt.reward_cristalli > 0 ? `<div class="event-reward">💎 +${evt.reward_cristalli} Cristalli</div>` : ''}
                    ${evt.reward_pe > 0 ? `<div class="event-reward">🗺️ +${evt.reward_pe} PE</div>` : ''}
                    <button class="btn-event-collect" data-event-id="${evt.id}">🎁 Raccogli</button>
                </div>`;
            mapEl.appendChild(em);
            this.eventMarkers.push(em);

            const btn = em.querySelector('.btn-event-collect');
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.collectEventReward(evt.id);
                });
            }
        });

        const legend = document.createElement('div');
        legend.className = 'fantasy-legend';
        legend.innerHTML = `
            <div class="legend-title">🧭 Leggenda</div>
            <div class="legend-row"><span>🌳</span> Terra Selvaggia</div>
            <div class="legend-row"><span>🏛️</span> Dungeon</div>
            <div class="legend-row"><span>🐉</span> Boss</div>
            <div class="legend-row"><span>🏠</span> Villaggio</div>
            <div class="legend-row"><span>🏔️</span> Punto di Riferimento</div>
        `;
        mapEl.appendChild(legend);

        this.container.appendChild(mapEl);
        this.updateFog();
    }

    updateFog() {
        const areaProgress = this.app.areaProgress || [];
        const progMap = {};
        areaProgress.forEach(ap => { progMap[ap.area_id] = ap; });

        this.cells.forEach(cell => {
            const { el, row, col } = cell;
            const cx = (col + 0.5) / this.gridCols * 100;
            const cy = (row + 0.5) / this.gridRows * 100;

            const nearRevealed = this.areas.some((area, index) => {
                if (!this.isAreaUnlocked(area, index, progMap)) return false;
                if (!this.discoveries.includes(area.id)) return false;
                const dx = cx - area.pos_x;
                const dy = cy - area.pos_y;
                return Math.sqrt(dx * dx + dy * dy) < (area.size_x || 15);
            });

            el.className = `map-cell ${nearRevealed ? 'revealed' : 'fog'}`;
        });

        this.markers.forEach(m => {
            const areaUnlocked = this.isAreaUnlocked(m.area, m.index, progMap);
            let visibility = 'locked';
            if (areaUnlocked) visibility = this.discoveries.includes(m.area.id) ? 'revealed' : 'hidden';
            m.el.className = `map-marker ${visibility}`;
            m.areaUnlocked = areaUnlocked;
        });
    }

    // buildBossMonster spostato in combat-engine.js per coerenza
    // (tutti i combattimenti passano dallo stesso motore).
    // Qui chiamiamo direttamente combatEngine.buildBossMonster().

    async revealArea(areaId) {
        const area = this.areas.find(a => a.id === areaId);
        if (!area) return;

        const pe = this.app.fantasyResources?.punti_esplorazione || 0;
        if (pe < area.exploration_cost) {
            alert(`\u{1F5FA}\u{FE0F} Punti Esplorazione insufficienti! Ne servono ${area.exploration_cost}, ne hai ${pe}.\n\nCompleta più attività per accumularne.`);
            return;
        }

        const isBoss = area.area_type === 'boss';

        // Paga sempre il costo in Punti Esplorazione per rivelare l'area
        this.app.fantasyResources.punti_esplorazione -= area.exploration_cost;

        // Per le aree non-boss la ricompensa si ottiene subito con la scoperta.
        // Per le aree boss la ricompensa è invece condizionata all'esito del combattimento
        // (vedi CombatEngine.resolveCombat), quindi non la anticipiamo qui.
        if (!isBoss) {
            if (area.rupie_reward) this.app.fantasyResources.rupie += area.rupie_reward;
            if (area.cristalli_reward) this.app.fantasyResources.cristalli += area.cristalli_reward;
        }

        this.app.savePlayer();
        this.app.updateHero();

        if (this.app.userId) {
            try {
                await SupaDB.supa.rpc('reveal_map_area', {
                    p_user_id: this.app.userId,
                    p_area_id: areaId
                });
            } catch (err) {
                console.warn('[FantasyMap] Sync reveal_map_area fallito (continuo in locale):', err);
            }
        }

        this.discoveries.push(areaId);
        localStorage.setItem('questtracker_discoveries', JSON.stringify(this.discoveries));

        // Lore per-area: ogni scoperta lascia una traccia narrativa nel diario,
        // non solo nel tooltip della mappa.
        if (this.app.addJournalEntry) {
            this.app.addJournalEntry('exploration', `Scoperta: ${area.name}`, area.lore_text || area.description || '');
        }

        this.updateFog();

        if (isBoss) {
            this.app.combatEngine.openEncounter(this.app.combatEngine.buildBossMonster(area));
        }
    }

    async collectEventReward(eventId) {
        if (!this.app.userId) return;
        try {
            const result = await SupaDB.collectEventReward(this.app.userId, eventId);
            if (result?.success) {
                const parts = [];
                if (result.rupie) parts.push(`🪙 +${result.rupie} Rupie`);
                if (result.cristalli) parts.push(`💎 +${result.cristalli} Cristalli`);
                if (result.pe) parts.push(`🗺️ +${result.pe} PE`);
                alert(`Ricompensa raccolta!\n\n${parts.join('\n')}`);

                // Rimuove il marker evento
                this.eventMarkers.forEach(em => {
                    const btn = em.querySelector('.btn-event-collect');
                    if (btn && btn.dataset.eventId === eventId) em.remove();
                });
                this.eventMarkers = this.eventMarkers.filter(em => {
                    const btn = em.querySelector('.btn-event-collect');
                    return btn && btn.dataset.eventId !== eventId;
                });
                this.events = this.events.filter(e => e.id !== eventId);

                await this.app.refreshFantasyResources();
                this.app.updateHero();
            } else {
                alert(result?.error || 'Impossibile raccogliere la ricompensa.');
            }
        } catch (err) {
            console.warn('[FantasyMap] Collect event reward error:', err);
            alert('Errore durante la raccolta della ricompensa.');
        }
    }
}

const FANTASY_AREAS = [
    {
        id: 'fa-villaggio', name: 'Villaggio dell\'Alba', description: 'L\'ultimo avamposto prima delle terre selvagge.',
        lore_text: 'Un villaggio accogliente dove gli eroi possono riposare e scambiare storie.',
        area_type: 'town', emoji: '\u{1F3E0}', pos_x: 15, pos_y: 15, size_x: 12, size_y: 10,
        exploration_cost: 0, required_forza: 0, required_agilita: 0, required_costituzione: 0,
        rupie_reward: 10, cristalli_reward: 0
    },
    {
        id: 'fa-foresta', name: 'Foresta dei Sussurri', description: 'Alberi antichi che mormorano segreti.',
        lore_text: 'Si dice che chi cammina tra questi alberi senta le voci degli antichi guardiani.',
        area_type: 'wilderness', emoji: '\u{1F333}', pos_x: 20, pos_y: 25, size_x: 18, size_y: 15,
        exploration_cost: 5, required_forza: 0, required_agilita: 0, required_costituzione: 0,
        rupie_reward: 15, cristalli_reward: 0
    },
    {
        id: 'fa-gola', name: 'Gola del Tuono', description: 'Un canyon squarciato nella roccia.',
        lore_text: 'Il vento produce un rombo che echeggia per miglia. Parlano di Cristalli nascosti.',
        area_type: 'wilderness', emoji: '\u{1F5FB}', pos_x: 45, pos_y: 20, size_x: 15, size_y: 12,
        exploration_cost: 15, required_forza: 3, required_agilita: 0, required_costituzione: 0,
        rupie_reward: 30, cristalli_reward: 1
    },
    {
        id: 'fa-lago', name: 'Lago delle Laure', description: 'Acque cristalline al centro del mondo.',
        lore_text: 'Le acque riflettono non il cielo ma i desideri di chi vi si specchia.',
        area_type: 'landmark', emoji: '\u{1F30A}', pos_x: 35, pos_y: 45, size_x: 12, size_y: 10,
        exploration_cost: 8, required_forza: 0, required_agilita: 0, required_costituzione: 0,
        rupie_reward: 20, cristalli_reward: 0
    },
    {
        id: 'fa-rovine', name: 'Rovine Antiche', description: 'Resti di una civiltà dimenticata.',
        lore_text: 'Simboli incisi su pietre che non appartengono a nessuna lingua conosciuta.',
        area_type: 'dungeon', emoji: '\u{1F3DB}\u{FE0F}', pos_x: 60, pos_y: 55, size_x: 14, size_y: 12,
        exploration_cost: 25, required_forza: 5, required_agilita: 3, required_costituzione: 2,
        rupie_reward: 80, cristalli_reward: 2
    },
    {
        id: 'fa-tempio', name: 'Tempio del Guardiano', description: 'Protetto da un antico guardiano di pietra.',
        lore_text: 'La statua del Guardiano sbarra lingresso. "Solo chi ha superato la prova della montagna può passare."',
        area_type: 'dungeon', emoji: '\u{1F3DB}\u{FE0F}', pos_x: 25, pos_y: 65, size_x: 13, size_y: 11,
        exploration_cost: 20, required_forza: 8, required_agilita: 0, required_costituzione: 4,
        rupie_reward: 60, cristalli_reward: 1
    },
    {
        id: 'fa-vetta', name: 'Vetta del Drago', description: 'La montagna più alta. Un drago custodisce il Cristallo Eterno.',
        lore_text: 'Nessuno è mai tornato dalla Vetta. Il drago non dorme mai.',
        area_type: 'boss', emoji: '\u26F0\uFE0F', pos_x: 70, pos_y: 30, size_x: 16, size_y: 14,
        exploration_cost: 50, required_forza: 15, required_agilita: 8, required_costituzione: 10,
        rupie_reward: 200, cristalli_reward: 5
    }
];
