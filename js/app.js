const CLASS_AVATARS = {
    'Esploratore': '\u{1F5FA}\u{FE0F}', 'Alpinista': '\u26F0\uFE0F',
    'Biker': '\u{1F6B5}', 'Nomade': '\u{1F30D}'
};

class App {
    constructor() {
        this.currentQuest = null;
        this.tracker = null;
        this.trackPoints = [];
        this.startTime = null;
        this.timerInterval = null;
        this.tabTitleInterval = null;
        this.totalDistance = 0;
        this.totalElevation = 0;
        this.map = null;
        this.trackingMap = null;
        this.questLayers = {};
        this.quests = [];
        this.progress = {};
        this.player = null;
        this.userId = null;
        this.fantasyResources = null;
        this.fantasyMap = null;
        this.journal = [];
        this.dayOffset = 0;
        this.combatEngine = null;
        this.activeQuests = [];
        this.areaProgress = [];
        this.itemsCatalog = [];
        this.playerItems = [];
        this.playerTitles = [];
        this.titlesCatalog = [];

        this.init();
    }

    async init() {
        const saved = localStorage.getItem('questtracker_player');
        if (saved) {
            this.player = JSON.parse(saved);
            this.userId = this.player.userId || null;
            const resSaved = localStorage.getItem('questtracker_resources');
            if (resSaved) this.fantasyResources = JSON.parse(resSaved);
            this.loadJournal();
            if (this.userId) {
                try {
                    const { data: { session } } = await SupaDB.supa.auth.getSession();
                    if (!session) {
                        console.warn('[QuestTracker] Nessuna sessione valida al refresh, mostra login');
                        this.player = null;
                        this.userId = null;
                        localStorage.removeItem('questtracker_player');
                    }
                } catch (err) {
                    console.warn('[QuestTracker] Errore verifica sessione:', err);
                    this.player = null;
                    this.userId = null;
                    localStorage.removeItem('questtracker_player');
                }
            } else if (this.player.username) {
                try {
                    const user = await SupaDB.ensureSession(this.player.username);
                    this.userId = user.id;
                    await this.refreshPlayerFromSupabase(user.id, this.player.username, this.player.playerClass);
                    this.savePlayer();
                } catch (err) {
                    console.warn('[QuestTracker] Auto-login fallito, modalità locale:', err);
                }
            }
            if (this.player) {
                await this.loadQuests();
                this.loadLocalProgress();
                if (this.userId) await this.initGuild();
            }
        }
        if (this.player) this.showMainApp();
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('loginForm').addEventListener('submit', async e => {
            e.preventDefault();
            await this.login();
        });
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchScreen(tab.dataset.screen));
        });
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderQuests(btn.dataset.filter);
            });
        });
        document.getElementById('qdStartBtn').addEventListener('click', () => {
            document.getElementById('questDetailOverlay').classList.remove('active');
            this.beginTracking();
        });
        document.getElementById('qdCancelBtn').addEventListener('click', () => {
            document.getElementById('questDetailOverlay').classList.remove('active');
            this.currentQuest = null;
        });
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopTracking());
        document.getElementById('modalCloseBtn').addEventListener('click', () => {
            document.getElementById('completionModal').classList.remove('active');
        });
        document.getElementById('combatAttackBtn').addEventListener('click', () => {
            this.combatEngine?.resolveCombat();
        });
        document.getElementById('combatCloseBtn').addEventListener('click', () => {
            this.combatEngine?.closeCombat();
        });
    }

    async login() {
        const btn = document.getElementById('loginBtn');
        const username = document.getElementById('username').value;
        const playerClass = document.getElementById('playerClass').value;
        btn.textContent = '\u23F3 Connessione...';
        btn.disabled = true;
        try {
            const user = await SupaDB.ensureSession(username);
            this.userId = user.id;
            await SupaDB.updateProfile(this.userId, { username, player_class: playerClass });
            await this.refreshPlayerFromSupabase(this.userId, username, playerClass);
            this.savePlayer();
            await this.loadQuests();
            await this.initGuild();
            this.showMainApp();
        } catch (err) {
            console.warn('Supabase login failed, using local mode:', err);
            this.createPlayerLocal(username, playerClass);
        }
        btn.textContent = '\u2694\uFE0F Inizia l\'Avventura';
        btn.disabled = false;
    }

    createPlayerLocal(username, playerClass) {
        this.player = {
            userId: null, username, playerClass,
            level: 1, currentXP: 0, totalXP: 0, questsCompleted: 0,
            totalDistance: 0, totalElevation: 0, totalTime: 0,
            forza: 0, agilita: 0, costituzione: 0
        };
        this.fantasyResources = { rupie: 0, cristalli: 0, punti_esplorazione: 0 };
        this.progress = {};

        this.savePlayer();
        this.saveJournal();
        this.showMainApp();
    }

    async refreshPlayerFromSupabase(userId, username, playerClass) {
        const [profile, stats, resources] = await Promise.all([
            SupaDB.getProfile(userId),
            SupaDB.getStats(userId),
            SupaDB.getResources(userId)
        ]);
        this.player = {
            userId, username: profile?.username || username,
            playerClass: profile?.player_class || playerClass,
            level: profile?.level || 1, currentXP: profile?.current_xp || 0,
            totalXP: profile?.total_xp || 0, questsCompleted: 0,
            totalDistance: stats?.total_distance || 0, totalElevation: stats?.total_elevation || 0,
            totalTime: stats?.total_time || 0,
            forza: stats?.forza || 0, agilita: stats?.agilita || 0, costituzione: stats?.costituzione || 0
        };
        this.fantasyResources = resources || { rupie: 100, cristalli: 0, punti_esplorazione: 0 };
    }

    async refreshFantasyResources() {
        if (!this.userId) return;
        const r = await SupaDB.getResources(this.userId);
        if (r) this.fantasyResources = r;
        this.savePlayer();
    }

    async loadQuests() {
        try {
            const quests = await SupaDB.getQuests();
            if (quests && quests.length > 0) {
                this.quests = quests.map(q => {
                    let coords = q.coords;
                    if (typeof coords === 'string') { try { coords = JSON.parse(coords); } catch (_) {} }
                    return {
                        id: q.id, title: q.title, region: q.regions?.name || '',
                        type: q.type, difficulty: q.difficulty, xpReward: q.xp_reward,
                        distance: Number(q.distance), elevation: q.elevation,
                        description: q.description || null,
                        npc_dialogue: q.npc_dialogue || null,
                        coords, quest_type: q.quest_type || 'normal', area_id: q.area_id,
                        emoji: q.emoji || ''
                    };
                });
                console.log(`[QuestTracker] Caricate ${this.quests.length} quest da Supabase`);
                return;
            }
            console.warn('[QuestTracker] Nessuna quest su Supabase');
        } catch (err) {
            console.warn('[QuestTracker] Errore caricamento quest:', err);
        }
        this.quests = [];
    }

    loadLocalProgress() {
        try { const s = localStorage.getItem('questtracker_progress'); if (s) this.progress = JSON.parse(s); } catch (_) {}
    }

    saveProgress() { localStorage.setItem('questtracker_progress', JSON.stringify(this.progress)); }

    loadJournal() {
        try {
            const s = localStorage.getItem('questtracker_journal');
            if (s) {
                this.journal = JSON.parse(s);
                if (this.journal.length > 0) {
                    const first = new Date(this.journal[0].ts);
                    this.dayOffset = Math.floor((Date.now() - first.getTime()) / 86400000);
                }
            }
        } catch (_) {}
    }

    saveJournal() {
        localStorage.setItem('questtracker_journal', JSON.stringify(this.journal));
        if (this.userId) {
            SupaDB.addJournalEntries?.(this.userId, this.journal.slice(-5)).catch(() => {});
        }
    }

    addJournalEntry(type, title, desc) {
        this.journal.push({ ts: Date.now(), type, title, desc });
        if (this.journal.length > 100) this.journal = this.journal.slice(-100);
        this.saveJournal();
        this.updateHero();
    }

    savePlayer() {
        localStorage.setItem('questtracker_player', JSON.stringify(this.player));
        localStorage.setItem('questtracker_resources', JSON.stringify(this.fantasyResources));
        this.syncToSupabase();
    }

    async syncToSupabase() {
        if (!this.userId) return;
        try {
            await SupaDB.supa.from('profiles').update({
                username: this.player.username, player_class: this.player.playerClass,
                level: this.player.level, current_xp: this.player.currentXP, total_xp: this.player.totalXP
            }).eq('user_id', this.userId);
            await SupaDB.supa.from('player_stats').update({
                total_distance: this.player.totalDistance, total_elevation: this.player.totalElevation,
                total_time: this.player.totalTime,
                forza: this.player.forza, agilita: this.player.agilita, costituzione: this.player.costituzione
            }).eq('user_id', this.userId);
        } catch (err) {
            console.warn('[QuestTracker] Sync fallito:', err);
        }
    }

    showMainApp() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        if (!this.combatEngine) this.combatEngine = new CombatEngine(this);
        this.updateHero();
        this.renderQuests();
        this.initMap();
    }

    switchScreen(screen) {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-screen="${screen}"]`).classList.add('active');
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(`${screen}Screen`).classList.add('active');
        if (screen === 'map') setTimeout(() => this.map?.invalidateSize(), 100);
        if (screen === 'fantasy') this.initFantasyMap();
        if (screen === 'guild') this.renderGuild();
        if (screen === 'diary') this.renderDiary();
    }

    initFantasyMap() {
        if (!this.fantasyMap) this.fantasyMap = new FantasyMap(this);
        this.fantasyMap.init();
    }

    updateHero() {
        const p = this.player;
        if (!p) return;
        const xpRequired = GameEngine.calculateXPRequired(p.level);
        const xpPercent = Math.min((p.currentXP / xpRequired) * 100, 100);
        const r = this.fantasyResources || {};
        const avatar = CLASS_AVATARS[p.playerClass] || '\u{1F5E1}\u{FE0F}';

        document.getElementById('headerUsername').textContent = p.username;
        document.getElementById('headerLevel').textContent = `Lv.${p.level}`;
        document.getElementById('headerAvatar').textContent = avatar;
        document.getElementById('heroName').textContent = p.username;
        document.getElementById('heroClassLabel').textContent = p.playerClass;
        document.getElementById('heroLevel').textContent = p.level;
        document.getElementById('heroAvatarIcon').textContent = avatar;
        document.getElementById('xpCurrent').textContent = p.currentXP;
        document.getElementById('xpTotal').textContent = xpRequired;

        const fill = document.getElementById('xpBarFill');
        fill.style.width = `${xpPercent}%`;
        fill.classList.toggle('glow', xpPercent >= 80);

        document.getElementById('totalDistance').textContent = Number(p.totalDistance).toFixed(1);
        document.getElementById('totalElevation').textContent = Math.round(Number(p.totalElevation));
        document.getElementById('totalTime').textContent = (Number(p.totalTime) / 60).toFixed(1);
        document.getElementById('questsCompleted').textContent = p.questsCompleted;

        const maxAttr = 20;
        [
            { val: p.forza || 0, el: 'statForza', bar: 'attrFillForza' },
            { val: p.agilita || 0, el: 'statAgilita', bar: 'attrFillAgilita' },
            { val: p.costituzione || 0, el: 'statCostituzione', bar: 'attrFillCostituzione' }
        ].forEach(a => {
            document.getElementById(a.el).textContent = a.val;
            document.getElementById(a.bar).style.width = `${Math.min((a.val / maxAttr) * 100, 100)}%`;
        });

        document.getElementById('resRupie').textContent = r.rupie ?? 0;
        document.getElementById('resCristalli').textContent = r.cristalli ?? 0;
        document.getElementById('resEsplorazione').textContent = r.punti_esplorazione ?? 0;

        this.renderJournal();
        this.renderCombatCard();
        this.renderInventory();
        this.renderTitles();
    }

    renderJournal() {
        const list = document.getElementById('journalList');
        if (!list) return;
        list.innerHTML = '';
        const entries = this.journal.slice(-20).reverse();
        if (entries.length === 0) {
            list.innerHTML = '<div class="journal-entry system"><div class="journal-body"><div class="journal-title">Nessuna voce nel diario</div><div class="journal-desc">Completa una quest per iniziare la tua cronaca.</div></div></div>';
            return;
        }
        entries.forEach(e => {
            const day = Math.floor((Date.now() - e.ts) / 86400000) + 1;
            const div = document.createElement('div');
            div.className = `journal-entry ${e.type || 'system'}`;
            div.innerHTML = `
                <div class="journal-day">G.${day}</div>
                <div class="journal-body">
                    <div class="journal-title">${e.title}</div>
                    ${e.desc ? `<div class="journal-desc">${e.desc}</div>` : ''}
                </div>
            `;
            list.appendChild(div);
        });
    }

    renderCombatCard() {
        const el = document.getElementById('combatCardContent');
        if (!el) return;
        if (!this.combatEngine) { el.innerHTML = ''; return; }
        const available = this.combatEngine.getAvailableMonsters();
        if (available.length === 0) {
            const qc = this.player?.questsCompleted || 0;
            if (qc === 0) {
                el.innerHTML = '<div class="combat-none">Completa <strong>2 quest</strong> per sbloccare la prima sfida!</div>';
            } else {
                const next = MONSTERS.find(m => m.unlockQuests > qc);
                if (next) {
                    el.innerHTML = `<div class="combat-none">Altre <strong>${next.unlockQuests - qc}</strong> quest per sbloccare: ${next.emoji} ${next.name}</div>`;
                } else {
                    el.innerHTML = '<div class="combat-none">Tutti i nemici sconfitti! Nuove sfide in arrivo...</div>';
                }
            }
            return;
        }
        el.innerHTML = available.map(m => {
            const reqs = [];
            if (m.requiredForza) reqs.push(`FORZA ${m.requiredForza}`);
            if (m.requiredAgilita) reqs.push(`AGILITÀ ${m.requiredAgilita}`);
            if (m.requiredCostituzione) reqs.push(`COST. ${m.requiredCostituzione}`);
            return `
                <div class="combat-card-item" data-monster="${m.id}">
                    <div class="combat-card-icon">${m.emoji}</div>
                    <div class="combat-card-info">
                        <div class="combat-card-name">${m.name}</div>
                        <div class="combat-card-req">Richiede: ${reqs.join(' • ')}</div>
                        <div class="combat-card-reward">⚡ ${m.xpReward} XP • 🪙 ${m.rupieReward} Rupie${m.cristalliReward > 0 ? ` • 💎 ${m.cristalliReward} Cristalli` : ''}</div>
                    </div>
                </div>
            `;
        }).join('');
        el.querySelectorAll('.combat-card-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.monster;
                const m = available.find(x => x.id === id);
                if (m) this.combatEngine.openEncounter(m);
            });
        });
    }

    renderInventory() {
        const items = this.playerItems || [];
        const catalog = this.itemsCatalog || [];

        // Equipped slots
        const equipped = {};
        items.forEach(pi => {
            if (pi.equipped && pi.items_catalog) {
                equipped[pi.items_catalog.slot_type] = { ...pi.items_catalog, player_item_id: pi.id };
            }
        });
        const slotMap = { tool: 'slotTool', footwear: 'slotFootwear', amulet: 'slotAmulet' };
        Object.entries(slotMap).forEach(([slot, id]) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (equipped[slot]) {
                const item = equipped[slot];
                el.innerHTML = `${item.icon || item.emoji || ''} ${item.name} <button class="btn-unequip-sm" data-item-id="${item.id}">❌</button>`;
            } else {
                el.innerHTML = '—';
            }
        });
        document.querySelectorAll('.btn-unequip-sm').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.handleUnequipItem(btn.dataset.itemId);
            });
        });

        // Owned items (not equipped)
        const owned = items.filter(pi => !pi.equipped);
        document.getElementById('ownedCount').textContent = owned.length;
        const ownedList = document.getElementById('ownedItemsList');
        if (owned.length === 0) {
            ownedList.innerHTML = '<div class="empty-state">Nessun oggetto nello zaino.</div>';
            return;
        }
        ownedList.innerHTML = owned.map(pi => {
            const c = pi.items_catalog;
            if (!c) return '';
            return `<div class="inv-owned-item">
                <span class="inv-owned-icon">${c.icon || c.emoji || '📦'}</span>
                <span class="inv-owned-name">${c.name}</span>
                <span class="inv-owned-slot">${c.slot_type || 'generico'}</span>
                <button class="btn-equip-sm" data-item-id="${c.id}">🎒 Equip.</button>
            </div>`;
        }).join('');
        ownedList.querySelectorAll('.btn-equip-sm').forEach(btn => {
            btn.addEventListener('click', () => this.handleEquipItem(btn.dataset.itemId));
        });
    }

    async handleUnequipItem(itemId) {
        if (!this.userId) return;
        try {
            await SupaDB.unequipItem(this.userId, itemId);
            this.playerItems = await SupaDB.getPlayerItems(this.userId);
            this.renderInventory();
            this.updateHero();
        } catch (err) {
            console.warn('[QuestTracker] Unequip error:', err);
        }
    }

    renderTitles() {
        const list = document.getElementById('titlesList');
        if (!list) return;
        const all = this.titlesCatalog || [];
        const earned = this.playerTitles || [];
        const earnedIds = new Set(earned.map(pt => pt.title_id));
        if (all.length === 0) {
            list.innerHTML = '<div class="empty-state">Nessun titolo disponibile.</div>';
            return;
        }
        list.innerHTML = all.map(t => {
            const has = earnedIds.has(t.id);
            return `<div class="title-item ${has ? 'earned' : 'locked'}">
                <span class="title-icon">${t.icon || '🏅'}</span>
                <span class="title-info">
                    <span class="title-name">${t.name}</span>
                    <span class="title-desc">${t.description || ''}</span>
                </span>
                <span class="title-status">${has ? '✅' : '🔒'}</span>
            </div>`;
        }).join('');
    }

    renderDiary() {
        // Journal entries
        const entryList = document.getElementById('diaryEntryList');
        if (entryList) {
            const entries = this.journal.slice().reverse();
            if (entries.length === 0) {
                entryList.innerHTML = '<div class="empty-state">Nessuna voce nel diario. Inizia la tua avventura!</div>';
            } else {
                entryList.innerHTML = entries.map(e => {
                    const d = new Date(e.ts);
                    const dateStr = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
                    return `<div class="diary-entry ${e.type || 'system'}">
                        <div class="diary-date">${dateStr}</div>
                        <div class="diary-body">
                            <div class="diary-entry-title">${e.title}</div>
                            ${e.desc ? `<div class="diary-entry-desc">${e.desc}</div>` : ''}
                        </div>
                    </div>`;
                }).join('');
            }
        }

        // Lore chapters
        const loreList = document.getElementById('diaryLoreList');
        if (!loreList) return;
        const completedAreas = (this.areaProgress || []).filter(a => a.is_completed);
        const loreQuests = (this.quests || []).filter(q => q.quest_type === 'grande_avventura' && q.lore);
        if (completedAreas.length === 0 && loreQuests.length === 0) {
            loreList.innerHTML = '<div class="empty-state">Completa la Grande Avventura per sbloccare i capitoli della storia.</div>';
            return;
        }
        loreList.innerHTML = loreQuests.map(q => {
            const areaDone = q.area_id && completedAreas.some(a => a.area_id === q.area_id);
            return `<div class="diary-lore-chapter ${areaDone ? 'unlocked' : 'locked'}">
                <div class="lore-chapter-icon">${areaDone ? '📖' : '🔒'}</div>
                <div class="lore-chapter-info">
                    <div class="lore-chapter-title">${q.title}</div>
                    ${areaDone ? `<div class="lore-chapter-text">${q.lore}</div>` : '<div class="lore-chapter-text locked-text">Capitolo da sbloccare...</div>'}
                </div>
            </div>`;
        }).join('');
    }

    renderQuests(filter = 'all') {
        const list = document.getElementById('questList');
        list.innerHTML = '';
        let quests = this.quests;
        if (filter === 'available') quests = quests.filter(q => !this.progress[q.id]);
        else if (filter === 'completed') quests = quests.filter(q => this.progress[q.id]);
        else if (filter === 'trekking') quests = quests.filter(q => q.type === 'trekking');
        else if (filter === 'mtb') quests = quests.filter(q => q.type === 'mtb');

        quests.forEach(quest => {
            const completed = this.progress[quest.id];
            const card = document.createElement('div');
            card.className = `quest-card ${completed ? 'completed' : ''}`;
            card.innerHTML = `
                <div class="quest-header">
                    <div class="quest-icon ${quest.type}">${quest.type === 'trekking' ? '\u{1F97E}' : '\u{1F6B5}'}</div>
                    <div><div class="quest-title">${quest.title}</div><div class="quest-region">${quest.region}</div></div>
                </div>
                <div class="quest-meta">
                    <span>\u{1F4CF} ${quest.distance} km</span>
                    <span>\u26F0\uFE0F ${quest.elevation}m</span>
                    <span class="quest-xp">\u26A1 ${quest.xpReward} XP</span>
                </div>
            `;
            card.addEventListener('click', () => { if (!completed) this.showQuestDetail(quest); });
            list.appendChild(card);
        });
    }

    showQuestDetail(quest) {
        this.currentQuest = quest;
        document.getElementById('qdIcon').textContent = quest.type === 'trekking' ? '\u{1F97E}' : '\u{1F6B5}';
        document.getElementById('qdTitle').textContent = quest.title;
        document.getElementById('qdRegion').textContent = quest.region;
        document.getElementById('qdLore').textContent = quest.description || 'Intraprendi questa missione e scopri cosa ti aspetta...';
        document.getElementById('qdDialogueText').textContent = quest.npc_dialogue || '"Parla con gli abitanti del villaggio per saperne di più..."';
        document.getElementById('qdDist').textContent = quest.distance;
        document.getElementById('qdElev').textContent = quest.elevation;
        document.getElementById('qdXp').textContent = quest.xpReward;
        document.getElementById('questDetailOverlay').classList.add('active');
    }

    beginTracking() {
        const quest = this.currentQuest;
        if (!quest) return;
        this.trackPoints = [];
        this.totalDistance = 0;
        this.totalElevation = 0;
        this.startTime = Date.now();
        document.title = `\u2694\uFE0F ${quest.title} — 0.00 km`;

        document.getElementById('trackingTitle').textContent = quest.title;
        document.getElementById('trackingScreen').classList.add('active');

        this.tabTitleInterval = setInterval(() => {
            const km = (this.totalDistance / 1000).toFixed(2);
            document.title = `\u2694\uFE0F ${this.currentQuest?.title || ''} — ${km} km`;
        }, 3000);

        setTimeout(() => {
            this.trackingMap = L.map('trackingMap').setView(quest.coords[0], 14);
            L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17 }).addTo(this.trackingMap);
            L.polyline(quest.coords, { color: '#4a8c3f', weight: 4, opacity: 0.5 }).addTo(this.trackingMap);
            this.tracker = new GPSTracker(point => this.handleTrackPoint(point));
            this.tracker.start();
            this.timerInterval = setInterval(() => this.updateTimer(), 1000);
        }, 100);
    }

    handleTrackPoint(point) {
        if (this.trackPoints.length > 0) {
            const last = this.trackPoints[this.trackPoints.length - 1];
            const dist = GameEngine.calculateDistance(last.lat, last.lng, point.lat, point.lng);
            this.totalDistance += dist;
            if (point.alt && last.alt && point.alt > last.alt) this.totalElevation += point.alt - last.alt;
        }
        this.trackPoints.push(point);
        L.circleMarker([point.lat, point.lng], { radius: 6, color: '#fff', fillColor: '#4a8c3f', fillOpacity: 1 }).addTo(this.trackingMap);
        this.trackingMap.setView([point.lat, point.lng], this.trackingMap.getZoom());
        document.getElementById('trackDistance').textContent = (this.totalDistance / 1000).toFixed(2);
        document.getElementById('trackElevation').textContent = Math.round(this.totalElevation);
    }

    updateTimer() {
        const elapsed = Date.now() - this.startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        document.getElementById('trackTime').textContent =
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    togglePause() {
        const btn = document.getElementById('pauseBtn');
        if (this.tracker?.watchId) {
            this.tracker.stop();
            clearInterval(this.timerInterval);
            btn.innerHTML = '\u25B6\uFE0F Riprendi';
        } else {
            this.tracker?.start();
            this.timerInterval = setInterval(() => this.updateTimer(), 1000);
            btn.innerHTML = '\u23F8\uFE0F Pausa';
        }
    }

    stopTracking() {
        clearInterval(this.tabTitleInterval);
        document.title = '\u2694\uFE0F QuestTracker RPG';
        this.tracker?.stop();
        clearInterval(this.timerInterval);
        const validation = GameEngine.validateQuest(this.trackPoints, this.currentQuest);
        if (validation.valid) {
            this.completeQuest(validation.stats);
        } else {
            alert(`Quest non valida: ${validation.reason}`);
            document.getElementById('trackingScreen').classList.remove('active');
        }
    }

    async completeQuest(stats) {
        const quest = this.currentQuest;
        const bridgeResult = BridgeEngine.applyRules({
            type: quest.type, distance: stats.distance,
            elevation: stats.elevation, duration: stats.duration
        });
        const leveledUp = GameEngine.processLevelUp(this.player, quest.xpReward);
        this.player.questsCompleted++;
        this.player.totalDistance += stats.distance;
        this.player.totalElevation += stats.elevation;
        this.player.totalTime += stats.duration;

        const eff = bridgeResult.effects;
        if (eff.forza) this.player.forza = (this.player.forza || 0) + eff.forza;
        if (eff.agilita) this.player.agilita = (this.player.agilita || 0) + eff.agilita;
        if (eff.costituzione) this.player.costituzione = (this.player.costituzione || 0) + eff.costituzione;
        if (!this.fantasyResources) this.fantasyResources = { rupie: 0, cristalli: 0, punti_esplorazione: 0 };
        if (eff.rupie) this.fantasyResources.rupie += eff.rupie;
        if (eff.cristalli) this.fantasyResources.cristalli += eff.cristalli;
        if (eff.punti_esplorazione) this.fantasyResources.punti_esplorazione += eff.punti_esplorazione;

        this.progress[quest.id] = { completedAt: Date.now(), stats };
        this.saveProgress();
        this.savePlayer();
        if (this.questLayers[quest.id]) this.questLayers[quest.id].setStyle({ opacity: 1 });

        // Journal entry
        let jTitle = `Completata: ${quest.title}`;
        let jDesc = `+${quest.xpReward} XP`;
        const summary = BridgeEngine.getEffectsSummary(eff);
        if (summary.length > 0) jDesc += ` \u2022 ${summary.join(' \u2022 ')}`;
        this.addJournalEntry('quest', jTitle, jDesc);

        if (leveledUp) {
            this.addJournalEntry('levelup', `Livello ${this.player.level}!`, 'Hai raggiunto un nuovo livello di potere.');
        }

        this.syncQuestToSupabase(quest, stats);
        this.completeGuildQuest(quest, stats);

        document.getElementById('trackingScreen').classList.remove('active');
        this.showCompletionModal(leveledUp, quest, bridgeResult);
        this.updateHero();
        this.renderQuests();
    }

    showCompletionModal(leveledUp, quest, bridgeResult) {
        const modal = document.getElementById('completionModal');
        modal.classList.add('active');
        document.getElementById('modalIcon').textContent = leveledUp ? '\u{1F38A}' : '\u{1F389}';
        document.getElementById('modalTitle').textContent = leveledUp ? 'LEVEL UP!' : 'QUEST COMPLETATA!';
        let text = leveledUp ? `Sei salito al livello ${this.player.level}!` : `Hai guadagnato ${quest.xpReward} XP`;
        const summary = BridgeEngine.getEffectsSummary(bridgeResult.effects);
        if (summary.length > 0) text += `<br><br><span style="font-size:13px;color:#e8b830;">${summary.join(' \u2022 ')}</span>`;
        document.getElementById('modalText').innerHTML = text;

        const box = modal.querySelector('.modal-box');
        box.querySelectorAll('.particle-container').forEach(p => p.remove());
        if (bridgeResult.effects.cristalli) {
            this.spawnParticles(box);
        }
    }

    spawnParticles(container) {
        const wrapper = document.createElement('div');
        wrapper.className = 'particle-container';
        for (let i = 0; i < 16; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.textContent = '\u2726';
            p.style.left = `${10 + Math.random() * 80}%`;
            p.style.animationDelay = `${Math.random() * 1.2}s`;
            p.style.fontSize = `${14 + Math.random() * 18}px`;
            wrapper.appendChild(p);
        }
        container.appendChild(wrapper);
        setTimeout(() => wrapper.remove(), 2500);
    }

    async completeGuildQuest(quest, stats) {
        if (!this.userId || !quest) return;
        const active = this.activeQuests?.find(aq => aq.quest_id == quest.id);
        if (!active) return;
        try {
            await SupaDB.completeQuestWithProgress(this.userId, quest.id);
            await this.initGuild();
            await this.refreshFantasyResources();
            this.renderGuild();
            this.addJournalEntry('quest', 'Avanzamento Gilda',
                `La quest "${quest.title}" è stata completata e registrata nella Gilda.`);
        } catch (err) {
            console.warn('[QuestTracker] Guild completion error:', err);
        }
    }

    async syncQuestToSupabase(quest, stats) {
        if (!this.userId) return;
        try {
            const activity = await SupaDB.saveActivity(
                this.userId, quest.id.startsWith('hc-') ? null : quest.id,
                quest.type, stats, this.trackPoints
            );
            await SupaDB.saveQuestProgress(this.userId, quest.id, stats);
            if (activity?.id) {
                await SupaDB.applyBridgeRules(this.userId, activity.id, quest.type, {
                    distance_km: stats.distance, elevation_m: stats.elevation,
                    duration_minutes: stats.duration,
                    avg_speed_kmh: stats.duration > 0 ? (stats.distance / (stats.duration / 60)) : 0
                });
            }
            // Sync journal
            if (this.journal.length > 0) {
                const lastEntries = this.journal.slice(-3);
                for (const e of lastEntries) {
                    await SupaDB.supa.rpc('add_journal_entry', {
                        p_user_id: this.userId, p_entry_type: e.type,
                        p_title: e.title, p_description: e.desc
                    }).catch(() => {});
                }
            }
        } catch (err) { console.warn('Supabase sync failed:', err); }
    }

    // ── Guild System ──

    async initGuild() {
        if (!this.userId) return;
        try {
            this.activeQuests = await SupaDB.getActiveQuests(this.userId);
            this.areaProgress = await SupaDB.getAreaProgress(this.userId);
            this.itemsCatalog = await SupaDB.getItems();
            this.titlesCatalog = await SupaDB.getTitles();
            this.playerItems = await SupaDB.getPlayerItems(this.userId);
            this.playerTitles = await SupaDB.getPlayerTitles(this.userId);
            // Check titles on init (catches any that were earned offline)
            await SupaDB.checkTitles(this.userId);
            this.playerTitles = await SupaDB.getPlayerTitles(this.userId);
        } catch (err) {
            console.warn('[QuestTracker] Guild init error:', err);
            this.activeQuests = [];
            this.areaProgress = [];
            this.itemsCatalog = [];
            this.playerItems = [];
            this.playerTitles = [];
        }
    }

    renderGuild() {
        this.renderGrandeAvventura();
        this.renderActiveQuests();
        this.renderBacheca();
        this.renderMerchant();
    }

    renderGrandeAvventura() {
        const gaProgress = this.areaProgress.find(a => a.fantasy_map_areas?.boss_quest_id);
        if (!gaProgress) {
            document.getElementById('gaStatus').textContent = 'Completa le quest della tua area per sbloccare la Grande Avventura!';
            return;
        }
        const area = gaProgress.fantasy_map_areas;
        const bossQuest = this.quests.find(q => q.id === area.boss_quest_id);
        if (!bossQuest) return;
        document.getElementById('gaQuestName').textContent = bossQuest.title;
        document.getElementById('gaChapter').textContent = bossQuest.description || '';
        if (gaProgress.is_completed) {
            document.getElementById('gaStatus').innerHTML = '✅ Completata!';
            document.getElementById('gaProgressFill').style.width = '100%';
        } else if (this.activeQuests.some(aq => aq.quest_id === area.boss_quest_id)) {
            document.getElementById('gaStatus').innerHTML = '📌 Attiva — esci e completa la quest!';
            document.getElementById('gaProgressFill').style.width = '50%';
        } else if (gaProgress.is_boss_unlocked) {
            document.getElementById('gaStatus').innerHTML = '⬆️ Accetta la quest per iniziare';
            document.getElementById('gaProgressFill').style.width = '0%';
        } else {
            document.getElementById('gaStatus').innerHTML = `🔒 Sblocca dopo ${area.required_quests_completed || 5} quest completate`;
            document.getElementById('gaProgressFill').style.width = '0%';
        }
    }

    renderActiveQuests() {
        const list = document.getElementById('activeQuestsList');
        const count = document.getElementById('activeQuestCount');
        const active = this.activeQuests || [];
        count.textContent = `${active.length}/2`;
        if (active.length === 0) {
            list.innerHTML = '<div class="empty-state">Nessuna quest attiva. Scegli dalla bacheca!</div>';
            return;
        }
        list.innerHTML = active.map(aq => {
            const q = aq.quests;
            if (!q) return '';
            const isGA = q.quest_type === 'grande_avventura';
            return `<div class="guild-card ${isGA ? 'ga-quest' : ''}">
                <div class="guild-card-title">${aq.quests_emoji || q.emoji || ''} ${q.title}</div>
                <div class="guild-card-meta">${q.difficulty || ''}${q.distance ? ' · ' + q.distance + 'km' : ''}${q.elevation ? ' · ' + q.elevation + 'm D+' : ''}</div>
                <div class="guild-card-progress">${isGA ? '⚔️ Grande Avventura' : 'Completala con una attività'}</div>
            </div>`;
        }).join('');
    }

    renderBacheca() {
        const list = document.getElementById('bachecaList');
        const areas = this.areaProgress || [];
        const currentArea = areas.find(a => a.is_unlocked && !a.is_completed);
        if (!currentArea) {
            list.innerHTML = '<div class="empty-state">Nessuna area disponibile.</div>';
            return;
        }
        const areaMeta = currentArea.fantasy_map_areas;
        document.getElementById('currentAreaName').textContent = areaMeta?.name || 'Sconosciuta';
        const needed = areaMeta?.required_quests_completed || 5;
        const done = currentArea.normal_quests_done || 0;
        document.getElementById('currentAreaProgress').textContent = `(${done}/${needed} quest completate)`;

        const activeIds = new Set((this.activeQuests || []).map(aq => aq.quest_id));
        const areaQuests = (this.quests || []).filter(q =>
            q.area_id === currentArea.area_id && q.quest_type === 'normal' && !this.progress[q.id]);
        const freeSlots = 2 - (this.activeQuests || []).filter(aq => aq.quests?.quest_type !== 'grande_avventura').length;

        if (areaQuests.length === 0) {
            const allDone = (this.quests || []).filter(q =>
                q.area_id === currentArea.area_id && q.quest_type === 'normal').every(q => this.progress[q.id]);
            list.innerHTML = allDone
                ? '<div class="empty-state">Tutte le quest completate! Torna presto per nuove sfide.</div>'
                : '<div class="empty-state">Nessuna quest disponibile in quest\'area.</div>';
            return;
        }
        list.innerHTML = areaQuests.map(q => {
            const isActive = activeIds.has(q.id);
            return `<div class="guild-card ${isActive ? 'active' : ''}">
                <div class="guild-card-title">${q.emoji || ''} ${q.title}</div>
                <div class="guild-card-desc">${q.description || ''}</div>
                <div class="guild-card-meta">${q.difficulty || 'media'}${q.distance ? ' · ' + q.distance + 'km' : ''}${q.elevation ? ' · ' + q.elevation + 'm' : ''} · ${q.xp_reward || 0} XP</div>
                ${!isActive && freeSlots > 0 ? `<button class="btn-accept" data-quest-id="${q.id}">➕ Accetta</button>` : ''}
                ${isActive ? '<span class="badge-active">✅ Accettata</span>' : ''}
            </div>`;
        }).join('');

        list.querySelectorAll('.btn-accept').forEach(btn => {
            btn.addEventListener('click', () => this.handleAcceptQuest(btn.dataset.questId));
        });
    }

    async handleAcceptQuest(questId) {
        if (!this.userId) return;
        const active = this.activeQuests || [];
        const normalCount = active.filter(aq => aq.quests?.quest_type !== 'grande_avventura').length;
        if (normalCount >= 2) {
            alert('Hai già 2 quest attive! Completane una prima di accettarne un\'altra.');
            return;
        }
        try {
            const result = await SupaDB.acceptQuest(this.userId, questId);
            if (result === false || result === null) {
                alert('Impossibile accettare la quest. Forse è già attiva o l\'area non è sbloccata.');
                return;
            }
            await this.initGuild();
            this.renderGuild();
            this.addJournalEntry('quest', 'Nuova Quest Accettata',
                `Hai accettato la quest: ${this.quests.find(q => q.id == questId)?.title || ''}`);
        } catch (err) {
            console.warn('[QuestTracker] Accept quest error:', err);
            alert('Errore durante l\'accettazione della quest.');
        }
    }

    renderMerchant() {
        const list = document.getElementById('merchantList');
        const resources = this.fantasyResources || { rupie: 0, cristalli: 0 };
        document.getElementById('merchantRupie').textContent = resources.rupie || 0;
        document.getElementById('merchantCristalli').textContent = resources.cristalli || 0;

        const items = this.itemsCatalog || [];
        const ownedIds = new Set((this.playerItems || []).map(pi => pi.item_id));
        const equippedIds = new Set((this.playerItems || []).filter(pi => pi.equipped).map(pi => pi.item_id));

        if (items.length === 0) {
            list.innerHTML = '<div class="empty-state">Nessun oggetto disponibile al momento.</div>';
            return;
        }
        list.innerHTML = items.map(item => {
            const owned = ownedIds.has(item.id);
            const equipped = equippedIds.has(item.id);
            const canAfford = (resources.rupie || 0) >= item.cost_rupie && (resources.cristalli || 0) >= item.cost_cristalli;
            return `<div class="guild-card merchant-item ${owned ? 'owned' : ''}">
                <div class="guild-card-title">${item.emoji || ''} ${item.name}</div>
                <div class="guild-card-desc">${item.description || ''}</div>
                <div class="guild-card-meta">
                    🪙 ${item.cost_rupie} Rupie ${item.cost_cristalli > 0 ? '💎 ' + item.cost_cristalli + ' Cristalli' : ''}
                    · Slot: ${item.slot || 'generico'}
                </div>
                ${!owned ? `<button class="btn-buy" data-item-id="${item.id}" ${!canAfford ? 'disabled' : ''}>🛒 Compra (${item.cost_rupie}R)</button>` : ''}
                ${owned && !equipped ? `<button class="btn-equip" data-item-id="${item.id}">🎒 Equipaggia</button>` : ''}
                ${owned && equipped ? `<span class="badge-equipped">✅ Equipaggiato</span>` : ''}
            </div>`;
        }).join('');

        list.querySelectorAll('.btn-buy').forEach(btn => {
            btn.addEventListener('click', () => this.handleBuyItem(btn.dataset.itemId));
        });
        list.querySelectorAll('.btn-equip').forEach(btn => {
            btn.addEventListener('click', () => this.handleEquipItem(btn.dataset.itemId));
        });
    }

    async handleBuyItem(itemId) {
        if (!this.userId) return;
        try {
            const result = await SupaDB.purchaseItem(this.userId, itemId);
            if (!result) {
                alert('Acquisto fallito. Rupie o Cristalli insufficienti!');
                return;
            }
            const item = this.itemsCatalog.find(i => i.id == itemId);
            await this.refreshFantasyResources();
            this.playerItems = await SupaDB.getPlayerItems(this.userId);
            this.renderMerchant();
            this.addJournalEntry('item', 'Acquisto', `Hai comprato: ${item?.name || 'oggetto'}`);
        } catch (err) {
            console.warn('[QuestTracker] Purchase error:', err);
            alert('Errore durante l\'acquisto.');
        }
    }

    async handleEquipItem(itemId) {
        if (!this.userId) return;
        try {
            await SupaDB.equipItem(this.userId, itemId);
            this.playerItems = await SupaDB.getPlayerItems(this.userId);
            this.renderMerchant();
            this.renderInventory();
            this.updateHero();
        } catch (err) {
            console.warn('[QuestTracker] Equip error:', err);
            alert('Errore durante l\'equipaggiamento.');
        }
    }

    initMap() {
        if (this.map) return;
        this.map = L.map('map').setView([45.2850, 7.5620], 12);
        L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17 }).addTo(this.map);
        this.quests.forEach(quest => {
            const completed = this.progress[quest.id];
            this.questLayers[quest.id] = L.polyline(quest.coords, {
                color: quest.type === 'trekking' ? '#4a8c3f' : '#b84040',
                weight: 4, opacity: completed ? 1 : 0.3
            }).addTo(this.map);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => { new App(); });
