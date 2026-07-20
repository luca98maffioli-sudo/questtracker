class FantasyMap {
    constructor(app) {
        this.app = app;
        this.areas = [];
        this.discoveries = [];
        this.gridCols = 8;
        this.gridRows = 6;
        this.container = null;
        this.cells = [];
        this.markers = [];
    }

    async init() {
        this.container = document.getElementById('fantasyMapContent');
        if (!this.container) return;

        await this.loadData();
        this.render();
    }

    async loadData() {
        if (this.app.userId) {
            try {
                const { data: dbAreas } = await SupaDB.supa
                    .from('fantasy_map_areas')
                    .select('*');
                if (dbAreas && dbAreas.length > 0) {
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
                }

                const { data: disc } = await SupaDB.supa
                    .from('player_map_discoveries')
                    .select('area_id')
                    .eq('user_id', this.app.userId);
                if (disc) {
                    this.discoveries = disc.map(d => d.area_id);
                }
            } catch (e) {
                console.warn('[FantasyMap] Errore caricamento da Supabase:', e);
            }

            const saved = localStorage.getItem('questtracker_discoveries');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.discoveries = [...new Set([...this.discoveries, ...parsed])];
            }
        }

        if (!this.areas || this.areas.length === 0) {
            this.areas = FANTASY_AREAS;
        }
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
                cell.addEventListener('click', () => this.onCellClick(row, col));
                grid.appendChild(cell);
                this.cells.push({ el: cell, row, col });
            }
        }

        mapEl.appendChild(grid);

        // Build progression lock map: area_id -> is_unlocked_by_progression
        const areaProgress = this.app.areaProgress || [];
        const progMap = {};
        areaProgress.forEach(ap => { progMap[ap.area_id] = ap; });

        // Markers layer
        const markersLayer = document.createElement('div');
        markersLayer.className = 'fantasy-markers';

        this.markers = [];
        this.areas.forEach(area => {
            const prog = progMap[area.id];
            const areaUnlocked = prog?.is_unlocked === true;
            const discovered = this.discoveries.includes(area.id);

            let visibility = 'locked';
            if (!areaUnlocked) visibility = 'locked';
            else if (discovered) visibility = 'revealed';
            else visibility = 'hidden';

            const marker = document.createElement('div');
            marker.className = `map-marker ${visibility}`;
            marker.style.left = `${area.pos_x}%`;
            marker.style.top = `${area.pos_y}%`;

            let tooltipHtml = '';
            if (!areaUnlocked) {
                tooltipHtml = `
                    <div class="marker-name">🔒 ???</div>
                    <div class="marker-desc">Completa la Grande Avventura dell'area precedente per sbloccare.</div>
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
            this.markers.push({ el: marker, area, discovered, areaUnlocked });
        });

        mapEl.appendChild(markersLayer);

        // Legend
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

            const nearRevealed = this.areas.some(area => {
                const prog = progMap[area.id];
                if (!prog?.is_unlocked) return false;
                if (!this.discoveries.includes(area.id)) return false;
                const dx = cx - area.pos_x;
                const dy = cy - area.pos_y;
                return Math.sqrt(dx * dx + dy * dy) < (area.size_x || 15);
            });

            el.className = `map-cell ${nearRevealed ? 'revealed' : 'fog'}`;
        });

        this.markers.forEach(m => {
            let visibility = 'locked';
            if (!m.areaUnlocked) visibility = 'locked';
            else if (this.discoveries.includes(m.area.id)) visibility = 'revealed';
            else visibility = 'hidden';
            m.el.className = `map-marker ${visibility}`;
        });
    }

    async revealArea(areaId) {
        const area = this.areas.find(a => a.id === areaId);
        if (!area) return;

        const pe = this.app.fantasyResources?.punti_esplorazione || 0;
        if (pe < area.exploration_cost) {
            alert(`\u{1F5FA}\u{FE0F} Punti Esplorazione insufficienti! Ne servono ${area.exploration_cost}, ne hai ${pe}.\n\nCompleta più attività per accumularne.`);
            return;
        }

        if (this.app.userId) {
            try {
                const { data, error } = await SupaDB.supa.rpc('reveal_map_area', {
                    p_user_id: this.app.userId,
                    p_area_id: areaId
                });

                if (error || !data?.success) {
                    alert(data?.error || error?.message || 'Errore sconosciuto');
                    return;
                }

                this.app.fantasyResources.punti_esplorazione -= area.exploration_cost;
                if (area.rupie_reward) this.app.fantasyResources.rupie += area.rupie_reward;
                if (area.cristalli_reward) this.app.fantasyResources.cristalli += area.cristalli_reward;
                this.app.savePlayer();
                this.app.updateHero();

            } catch (err) {
                console.warn('Supabase reveal failed, using local mode:', err);
                this.app.fantasyResources.punti_esplorazione -= area.exploration_cost;
                if (area.rupie_reward) this.app.fantasyResources.rupie += area.rupie_reward;
                if (area.cristalli_reward) this.app.fantasyResources.cristalli += area.cristalli_reward;
                this.app.savePlayer();
                this.app.updateHero();
            }
        } else {
            this.app.fantasyResources.punti_esplorazione -= area.exploration_cost;
            if (area.rupie_reward) this.app.fantasyResources.rupie += area.rupie_reward;
            if (area.cristalli_reward) this.app.fantasyResources.cristalli += area.cristalli_reward;
            this.app.savePlayer();
            this.app.updateHero();
        }

        this.discoveries.push(areaId);
        localStorage.setItem('questtracker_discoveries', JSON.stringify(this.discoveries));

        if (area.area_type === 'boss') {
            this.showBossEncounter(area);
        }

        this.updateFog();
    }

    showBossEncounter(area) {
        const p = this.app.player;
        const forzaOk = (p.forza || 0) >= area.required_forza;

        const modal = document.getElementById('completionModal');
        modal.classList.add('active');
        document.getElementById('modalIcon').textContent = '\u{1F409}';
        document.getElementById('modalTitle').textContent = `INCONTRO: ${area.name}!`;

        if (forzaOk) {
            document.getElementById('modalText').innerHTML =
                `La tua Forza (${p.forza}) è sufficiente per affrontare il guardiano!<br><br>` +
                `\u{1F389} Hai superato la sfida!<br>` +
                `\u{1FA99} +${area.rupie_reward} Rupie \u{1F48E} +${area.cristalli_reward} Cristalli`;
        } else {
            document.getElementById('modalText').innerHTML =
                `\u{1F6AB} La tua Forza (${p.forza}) non è sufficiente!<br><br>` +
                `Serve Forza \u{2265} ${area.required_forza} per affrontare questa sfida.<br>` +
                `\u{26F0}\u{FE0F} Allenati in salita nel mondo reale e ritorna più forte!`;
        }

        document.getElementById('modalCloseBtn').textContent = '\u{2728} Continua';
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
