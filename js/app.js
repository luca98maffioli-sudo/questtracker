const CLASS_AVATARS = {
    'Esploratore': '\u{1F5FA}\u{FE0F}', 'Alpinista': '\u26F0\uFE0F',
    'Biker': '\u{1F6B5}', 'Nomade': '\u{1F30D}'
};

const NPC_DIALOGUES = {
    saggio: [
        {
            text: '"Sei diventato un vero eroe! Il mondo reale e quello fantasy sono più connessi di quanto immagini."',
            minLevel: 8
        },
        {
            text: '"La Gilda ha sentito parlare di te. Forse è il momento di farti vedere da loro."',
            minLevel: 5, minForza: 3
        },
        {
            text: '"Continua così! Ogni passo nel mondo reale rafforza il tuo spirito qui."',
            minQuests: 3
        },
        {
            text: '"Le statistiche che accumuli nel mondo reale — distanza, dislivello, tempo — si riflettono nelle tue abilità. Forza, Agilità, Costituzione: tutto è collegato."',
            minLevel: 3
        },
        {
            text: '"Benvenuto, giovane avventuriero. Il mondo là fuori è pieno di meraviglie. Inizia con una quest e il cammino si svelerà."'
        }
    ],
    capo_gilda: [
        {
            text: '"Hai completato la Grande Avventura di quest\'area! Preparati: la prossima ti aspetta, e sarà ancora più impegnativa."',
            hasAreaCompleted: true
        },
        {
            text: '"La Grande Avventura è pronta per te! Accettala dalla Bacheca e dimostra il tuo valore. Il boss non aspetta."',
            hasBossUnlocked: true
        },
        {
            text: '"Le tue gesta iniziano a farsi sentire in tutto il regno. Continua a completare quest: la Grande Avventura si sta preparando."',
            minLevel: 5, minQuests: 5
        },
        {
            text: '"Buon lavoro. Tieni d\'occhio la Bacheca: nuove quest arrivano regolarmente e il progresso nell\'area corrente è la chiave per sbloccare sfide maggiori."',
            minLevel: 3, minQuests: 2
        },
        {
            text: '"Benvenuto in Gilda, avventuriero. Qui troverai la Bacheca con le quest disponibili e il Mercante per rifornirti. Scegli con saggezza: puoi accettare solo 2 quest alla volta."'
        }
    ],
    mercante: [
        {
            text: '"Grazie alla tua fedeltà, ho ricevuto merce rara! Dai un\'occhiata: potrebbe esserci qualcosa che fa al caso tuo."',
            minLevel: 7, minQuests: 10
        },
        {
            text: '"Ottimi acquisti! Torni spesso, vedo. Ho qualcosa di speciale in serbo per chi sa apprezzare la qualità."',
            hasPurchased: true, minLevel: 4
        },
        {
            text: '"Vedo che hai già del buon equipaggiamento. Se vuoi potenziarti, qui trovi quello che cerchi."',
            hasEquipped: true
        },
        {
            text: '"Bentornato! Ho ricevuto nuova merce. Prenditi il tuo tempo per guardare."',
            hasPurchased: true
        },
        {
            text: '"Dai un\'occhiata alla mia merce! Ho di tutto: attrezzi, calzature, amuleti. Tutto quello che serve a un avventuriero."'
        }
    ]
};

const INFO_CONTENT = {
    economy: {
        icon: '\u{1F4B0}',
        title: 'Il Borsellino',
        html: `
            <p>\u{1FA99} <b>Rupie</b> \u2014 la valuta base. Si guadagnano completando quest, superando alcune soglie di distanza/dislivello durante le attivit\u00e0, e vincendo combattimenti. Si spendono dal Mercante per comprare oggetti.</p>
            <p>\u{1F48E} <b>Cristalli</b> \u2014 valuta rara. Si ottengono solo da imprese impegnative (dislivello alto, boss, mostri forti). Servono per gli oggetti pi\u00f9 pregiati.</p>
            <p>\u{1F5FA}\u{FE0F} <b>Punti Esplorazione</b> \u2014 si accumulano restando in movimento a lungo (attivit\u00e0 di almeno 90 minuti). Servono per rivelare nuove aree sulla Mappa Fantasy.</p>
        `
    },
    'guild-slots': {
        icon: '\u2694\uFE0F',
        title: 'Quest Attive',
        html: `
            <p>Puoi tenere al massimo <b>2 quest normali attive</b> contemporaneamente. Completane una (facendo l'attivit\u00e0 richiesta nel mondo reale) prima di accettarne un'altra dalla Bacheca.</p>
            <p>La <b>Grande Avventura</b> (quest della storia principale) non conta nel limite di 2: si sblocca separatamente quando completi abbastanza quest normali nell'area corrente.</p>
        `
    },
    merchant: {
        icon: '\u{1F6CD}',
        title: 'Il Mercante',
        html: `
            <p>Ogni oggetto ha uno <b>slot</b> (Attrezzo, Calzatura, Amuleto). Puoi possederne quanti vuoi, ma equipaggiarne solo <b>uno per slot</b> alla volta.</p>
            <p>Gli oggetti danno un <b>bonus concreto</b> (es. pi\u00f9 XP dalle quest, meno fatica in MTB, ecc.) mostrato sotto ogni oggetto \u2014 non sono solo collezionabili.</p>
            <p>Per comprare serve avere abbastanza Rupie e/o Cristalli richiesti; l'oggetto resta nello zaino finch\u00e9 non lo equipaggi dalla schermata Eroe o da qui.</p>
        `
    }
};

function formatItemEffect(item) {
    if (!item || !item.effect_type) return '';
    const v = item.effect_value;
    const labels = {
        xp_bonus: `+${v}% XP dalle quest`,
        elevation_reduction: `-${v}% dislivello richiesto in validazione`,
        area_unlock: `Sblocca un'area senza requisiti`,
        speed_bonus: `+${v}% velocit\u00e0 massima consentita`,
        mtb_endurance: `-${v}% fatica su lunghe distanze MTB`,
        stat_bonus: `+${v} Costituzione a fine Grande Avventura`,
        temp_stat: `+${v} Forza temporanea (prossima uscita)`,
        waypoint_save: `Salva un punto di ritorno GPS`,
        fishing_luck: `+${v}% probabilità pesca rara`
    };
    return labels[item.effect_type] || `Effetto: ${item.effect_type} (${v})`;
}

class App {
    constructor() {
        this.userId = null;
        this.player = null;
        this.fantasyResources = null;
        this.quests = [];
        this.activeQuests = [];
        this.playerItems = [];
        this.itemsCatalog = [];
        this.titlesCatalog = [];
        this.playerTitles = [];
        this.areaProgress = [];
        this.journal = [];
        this.combatEngine = null;
        this.fantasyMap = null;
        this.lastQuestFetch = 0;

        // Passive GPS tracking
        this.gpsWatchId = null;
        this.lastPosition = null;
        this.questProgress = {};
        this.passiveEnabled = false;

        // Adventure mode
        this.adventureMode = false;
        this.adventureStartTime = null;
        this.adventureTrack = [];
        this.adventureTimer = null;

        // Minigame engine
        this.minigameEngine = null;
        this.fishingInventory = {};

        // Completed quests tracking
        this.completedQuestIds = new Set();

        // Event queue for toast notifications
        this.eventQueue = [];

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
            // Load quest progress from localStorage
            try {
                const qp = localStorage.getItem('questtracker_quest_progress');
                if (qp) this.questProgress = JSON.parse(qp);
            } catch (_) {}
            // Load completed quests
            try {
                const cq = localStorage.getItem('questtracker_completed_quests');
                if (cq) this.completedQuestIds = new Set(JSON.parse(cq));
            } catch (_) {}
            if (this.userId) {
                try {
                    const { data: { session } } = await SupaDB.supa.auth.getSession();
                    if (!session) {
                        this.player = null;
                        this.userId = null;
                        localStorage.removeItem('questtracker_player');
                    }
                } catch (err) {
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
                    console.warn('[App] Auto-login fallito, modalità locale:', err);
                }
            }
            if (this.player) {
                await this.loadQuests();
                if (this.userId) {
                    await this.initGuild();
                    // Sync quest progress to DB
                    await this.syncQuestProgressToDB();
                }
            }
        }
        this.setupEventListeners();
        if (this.player) this.showMainApp();
    }

    setupEventListeners() {
        document.getElementById('loginForm').addEventListener('submit', async e => {
            e.preventDefault();
            await this.login();
        });
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchScreen(tab.dataset.screen));
        });
        document.getElementById('qdCancelBtn').addEventListener('click', () => {
            document.getElementById('questDetailOverlay').classList.remove('active');
            this.currentQuest = null;
        });
        document.getElementById('modalCloseBtn').addEventListener('click', () => {
            document.getElementById('completionModal').classList.remove('active');
        });
        document.getElementById('infoModalCloseBtn').addEventListener('click', () => {
            document.getElementById('infoModal').classList.remove('active');
        });
        document.querySelectorAll('.info-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showInfoModal(btn.dataset.info);
            });
        });
        document.getElementById('combatAttackBtn').addEventListener('click', () => {
            this.combatEngine?.resolveCombat();
        });
        document.getElementById('combatCloseBtn').addEventListener('click', () => {
            this.combatEngine?.closeCombat();
        });
        document.getElementById('advStartBtn').addEventListener('click', () => this.startAdventureMode());
        document.getElementById('advStopBtn').addEventListener('click', () => this.stopAdventureMode());
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
                        emoji: q.emoji || '', lore: q.lore || null
                    };
                });
                return;
            }
        } catch (err) {
            console.warn('[App] Errore caricamento quest:', err);
        }
        this.quests = [];
    }

    loadJournal() {
        try {
            const s = localStorage.getItem('questtracker_journal');
            if (s) {
                this.journal = JSON.parse(s);
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

    saveQuestProgress() {
        localStorage.setItem('questtracker_quest_progress', JSON.stringify(this.questProgress));
    }

    async syncQuestProgressToDB() {
        if (!this.userId) return;
        for (const [questId, progress] of Object.entries(this.questProgress)) {
            try {
                await SupaDB.supa.from('quest_progress').upsert({
                    user_id: this.userId,
                    quest_id: parseInt(questId),
                    distance_covered: progress.distance,
                    elevation_gained: progress.elevation,
                    duration_seconds: Math.round(progress.duration * 60)
                }, { onConflict: 'user_id,quest_id' });
            } catch (_) {}
        }
    }

    async loadQuestProgressFromDB() {
        if (!this.userId) return;
        try {
            const { data } = await SupaDB.supa.from('quest_progress')
                .select('*')
                .eq('user_id', this.userId);
            if (data) {
                data.forEach(row => {
                    // Don't overwrite local progress (which may be more recent)
                    if (!this.questProgress[row.quest_id]) {
                        this.questProgress[row.quest_id] = {
                            distance: row.distance_covered || 0,
                            elevation: row.elevation_gained || 0,
                            duration: (row.duration_seconds || 0) / 60
                        };
                    }
                });
            }
        } catch (_) {}
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
            console.warn('[App] Sync fallito:', err);
        }
    }

    showMainApp() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        if (!this.combatEngine) {
            this.combatEngine = new CombatEngine(this);
            this.combatEngine.loadMonsters();
        }
        if (!this.minigameEngine) {
            this.minigameEngine = new MinigameEngine(this);
        }
        this.updateHero();
        this.initFantasyMap();
        this.renderGuild();
        this.renderMerchant();
        this.initPassiveTracking();
    }

    switchScreen(screen) {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-screen="${screen}"]`).classList.add('active');
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(`${screen}Screen`).classList.add('active');
        if (screen === 'fantasy') this.initFantasyMap();
        if (screen === 'guild') {
            this.renderGuild();
        }
        if (screen === 'diary') this.renderDiary();
    }

    initFantasyMap() {
        if (!this.fantasyMap) this.fantasyMap = new FantasyMap(this);
        this.fantasyMap.init();
    }

    showInfoModal(topic) {
        const info = INFO_CONTENT[topic];
        if (!info) return;
        document.getElementById('infoModalIcon').textContent = info.icon || '\u{1F4D6}';
        document.getElementById('infoModalTitle').textContent = info.title || 'Info';
        document.getElementById('infoModalText').innerHTML = info.html || '';
        document.getElementById('infoModal').classList.add('active');
    }

    updateNpcDialogues() {
        const p = this.player;
        if (!p) return;

        const areaProgress = this.areaProgress || [];
        const hasBossUnlocked = areaProgress.some(a => a.is_boss_unlocked && !a.is_completed);
        const hasAreaCompleted = areaProgress.some(a => a.is_completed);
        const hasPurchased = (this.playerItems || []).length > 0;
        const hasEquipped = (this.playerItems || []).some(pi => pi.equipped);

        const stats = {
            minLevel: p.level,
            minQuests: p.questsCompleted,
            minForza: p.forza || 0,
            minAgilita: p.agilita || 0,
            minCostituzione: p.costituzione || 0,
            hasBossUnlocked,
            hasAreaCompleted,
            hasPurchased,
            hasEquipped
        };

        const npcIds = ['saggio', 'capo_gilda', 'mercante'];
        npcIds.forEach(npcId => {
            const elId = npcId === 'capo_gilda' ? 'capoGildaDialogueText' :
                         npcId === 'mercante' ? 'mercanteDialogueText' :
                         'saggioDialogueText';
            const el = document.getElementById(elId);
            if (!el) return;

            const dialogues = NPC_DIALOGUES[npcId];
            if (!dialogues) return;

            const match = dialogues.find(d => {
                if (d.minLevel && p.level < d.minLevel) return false;
                if (d.minQuests && p.questsCompleted < d.minQuests) return false;
                if (d.minForza && (p.forza || 0) < d.minForza) return false;
                if (d.minAgilita && (p.agilita || 0) < d.minAgilita) return false;
                if (d.minCostituzione && (p.costituzione || 0) < d.minCostituzione) return false;
                if (d.hasBossUnlocked === true && !hasBossUnlocked) return false;
                if (d.hasAreaCompleted === true && !hasAreaCompleted) return false;
                if (d.hasPurchased === true && !hasPurchased) return false;
                if (d.hasEquipped === true && !hasEquipped) return false;
                return true;
            });

            if (match) {
                el.textContent = match.text;
            }
        });
    }

    getEquippedEffects() {
        const effects = {};
        const items = this.playerItems || [];
        items.forEach(pi => {
            if (!pi.equipped || !pi.items_catalog) return;
            const c = pi.items_catalog;
            if (c.effect_type) {
                effects[c.effect_type] = c.effect_value;
            }
        });
        return effects;
    }

    renderItemEffectsBadge() {
        const badge = document.getElementById('itemEffectsBadge');
        if (!badge) return;
        const effects = this.getEquippedEffects();
        const entries = Object.entries(effects);
        if (entries.length === 0) {
            badge.innerHTML = '';
            return;
        }
        badge.innerHTML = '<div class="effects-badge-title">✨ Effetti Attivi</div>' +
            entries.map(([type, val]) => {
                const labels = {
                    xp_bonus: `+${val}% XP`,
                    elevation_reduction: `-${val}% dislivello`,
                    area_unlock: `Sblocco area`,
                    speed_bonus: `+${val}% velocità`,
                    mtb_endurance: `-${val}% fatica`,
                    stat_bonus: `+${val} Cost.`,
                    temp_stat: `+${val} Forza temp.`,
                    waypoint_save: `Waypoint`
                };
                return `<span class="effects-badge-item">✨ ${labels[type] || type}</span>`;
            }).join('');
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
        this.renderItemEffectsBadge();
        this.updateNpcDialogues();
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
                const next = (this.combatEngine?.monsters || []).find(m => m.unlockQuests > qc);
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
                el.title = formatItemEffect(item);
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
                <span class="inv-owned-effect">✨ ${formatItemEffect(c)}</span>
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
            console.warn('[App] Unequip error:', err);
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

    // ── Passive GPS Tracking ──

    initPassiveTracking() {
        if (this.passiveEnabled) return;
        if (!navigator.geolocation) {
            console.warn('[App] Geolocation non disponibile');
            return;
        }
        this.passiveEnabled = true;
        this.gpsWatchId = navigator.geolocation.watchPosition(
            pos => this.contributeMovement(
                pos.coords.latitude,
                pos.coords.longitude,
                pos.coords.altitude || 0,
                pos.timestamp
            ),
            err => {
                if (err.code === err.PERMISSION_DENIED) {
                    console.warn('[App] GPS permesso negato');
                    this.passiveEnabled = false;
                }
            },
            { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
        );
    }

    contributeMovement(lat, lng, alt, timestamp) {
        const ts = typeof timestamp === 'number' ? timestamp : Date.now();
        const curr = { lat, lng, alt, timestamp: ts };

        if (!this.lastPosition) {
            this.lastPosition = curr;
            return;
        }

        const effects = this.getEquippedEffects();
        const speedBonus = effects.mtb_endurance || 0;
        const segment = GameEngine.filterMovementSegment(this.lastPosition, curr, speedBonus);
        this.lastPosition = curr;
        if (!segment || !segment.valid) return;

        const distKm = segment.distanceMeters / 1000;
        const elevM = segment.elevationMeters;
        const durMin = segment.minutes;

        // Adventure mode recording
        if (this.adventureMode) {
            this.adventureTrack.push({ lat, lng, alt, timestamp: ts });
            this.updateLiveCounters(distKm, elevM);
        }

        // Update player totals
        this.player.totalDistance += distKm;
        this.player.totalElevation += elevM;
        this.player.totalTime += durMin;

        // Update quest progress for each active quest
        let anyUpdated = false;
        for (const aq of this.activeQuests) {
            const q = aq.quests;
            if (!q || q.quest_type === 'grande_avventura') continue;
            const questId = aq.quest_id;
            const qp = this.questProgress[questId] || { distance: 0, elevation: 0, duration: 0 };

            qp.distance += distKm;
            qp.elevation += elevM;
            qp.duration += durMin;
            this.questProgress[questId] = qp;
            anyUpdated = true;

            // Check if quest thresholds are met
            if (!aq._completing) {
                const distOk = !q.distance || qp.distance >= q.distance;
                const elevOk = !q.elevation || qp.elevation >= q.elevation;
                if (distOk && elevOk) {
                    aq._completing = true;
                    this.finalizeQuestCompletion(aq, qp);
                }
            }
        }

        if (anyUpdated) {
            this.saveQuestProgress();
            if (document.getElementById('guildScreen')?.classList.contains('active')) {
                this.renderBacheca();
            }
        }

        // Minigame roll: fishing chance based on distance traveled
        this.minigameEngine?.rollForFishing(distKm);
    }

    async finalizeQuestCompletion(aq, qp) {
        const q = aq.quests;
        if (!q) return;

        const effects = this.getEquippedEffects();
        const xpBonus = (effects.xp_bonus || 0) / 100;
        const xpReward = Math.round(q.xpReward * (1 + xpBonus));
        const leveledUp = GameEngine.processLevelUp(this.player, xpReward);

        // Bridge rewards based on accumulated activity data
        const activityData = {
            distance: qp.distance,
            elevation: qp.elevation,
            duration: qp.duration
        };
        const result = BridgeEngine.applyRules(activityData, effects);
        const eff = result.effects || {};

        this.player.questsCompleted++;
        if (eff.forza) this.player.forza = (this.player.forza || 0) + eff.forza;
        if (eff.agilita) this.player.agilita = (this.player.agilita || 0) + eff.agilita;
        if (eff.costituzione) this.player.costituzione = (this.player.costituzione || 0) + eff.costituzione;
        if (!this.fantasyResources) this.fantasyResources = { rupie: 0, cristalli: 0, punti_esplorazione: 0 };
        if (eff.rupie) this.fantasyResources.rupie += eff.rupie;
        if (eff.cristalli) this.fantasyResources.cristalli += eff.cristalli;
        if (eff.punti_esplorazione) this.fantasyResources.punti_esplorazione += eff.punti_esplorazione;

        // Remove from active quests, mark as completed
        this.activeQuests = this.activeQuests.filter(a => a.quest_id !== aq.quest_id);
        delete this.questProgress[aq.quest_id];
        this.completedQuestIds.add(aq.quest_id);
        this.saveQuestProgress();
        localStorage.setItem('questtracker_completed_quests', JSON.stringify([...this.completedQuestIds]));
        this.savePlayer();

        // Sync to Supabase
        if (this.userId) {
            try {
                await SupaDB.completeQuestWithProgress(this.userId, aq.quest_id);
                await this.refreshFantasyResources();
            } catch (err) {
                console.warn('[App] Sync quest completion error:', err);
            }
        }

        // Journal
        let jTitle = `Completata: ${q.title}`;
        let jDesc = `+${xpReward} XP`;
        const summary = BridgeEngine.getEffectsSummary(eff);
        if (summary.length > 0) jDesc += ` · ${summary.join(' · ')}`;
        this.addJournalEntry('quest', jTitle, jDesc);

        if (leveledUp) {
            this.addJournalEntry('levelup', `Livello ${this.player.level}!`, 'Hai raggiunto un nuovo livello di potere.');
        }

        this.updateHero();
        this.renderBacheca();

        this.addEvent('quest_complete', {
            title: leveledUp ? '⚡ LEVEL UP!' : '✅ Quest Completata!',
            text: `"${q.title}" — ${jDesc}`
        });
    }

    // ── Guild System ──

    async initGuild() {
        if (!this.userId) return;
        try {
            const [activeQuests, areaProgress] = await Promise.all([
                SupaDB.getActiveQuests(this.userId),
                SupaDB.getAreaProgress(this.userId)
            ]);
            this.activeQuests = activeQuests || [];
            this.areaProgress = areaProgress || [];
            this.itemsCatalog = await SupaDB.getItems();
            this.titlesCatalog = await SupaDB.getTitles();
            this.playerItems = await SupaDB.getPlayerItems(this.userId);
            this.playerTitles = await SupaDB.getPlayerTitles(this.userId);
            await SupaDB.checkTitles(this.userId);
            this.playerTitles = await SupaDB.getPlayerTitles(this.userId);

            // Load quest progress from DB
            await this.loadQuestProgressFromDB();
        } catch (err) {
            console.warn('[App] Guild init error:', err);
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
            const qp = this.questProgress[aq.quest_id];
            const pct = qp ? this.calcProgressPercent(q, qp) : 0;
            return `<div class="guild-card ${isGA ? 'ga-quest' : ''}">
                <div class="guild-card-title">${q.emoji || ''} ${q.title}</div>
                <div class="guild-card-meta">${q.difficulty || ''}${q.distance ? ' · ' + q.distance + 'km' : ''}${q.elevation ? ' · ' + q.elevation + 'm D+' : ''}</div>
                ${!isGA && qp ? `
                    <div class="quest-slider-container">
                        <div class="quest-slider-bar">
                            <div class="quest-slider-fill" style="width:${pct}%"></div>
                        </div>
                        <div class="quest-slider-label">${Math.round(pct)}% · ${qp.distance.toFixed(1)}/${q.distance || '?'}km</div>
                    </div>
                ` : ''}
                <div class="guild-card-progress">${isGA ? '⚔️ Grande Avventura' : (pct >= 100 ? '✅ Pronta per completare!' : '📡 Tracking passivo...')}</div>
            </div>`;
        }).join('');
    }

    calcProgressPercent(q, qp) {
        const d = qp?.distance || 0;
        const e = qp?.elevation || 0;
        const du = qp?.duration || 0;
        let pct = 0;
        if (q.distance > 0) pct += 0.5 * Math.min(d / q.distance, 1);
        if (q.elevation > 0) pct += 0.3 * Math.min(e / q.elevation, 1);
        if (q.duration > 0) pct += 0.2 * Math.min(du / q.duration, 1);
        return Math.min(pct * 100, 100);
    }

    renderBacheca() {
        const list = document.getElementById('bachecaList');
        const areas = this.areaProgress || [];
        const currentArea = areas.find(a => a.is_unlocked && !a.is_completed);

        // Show area info if available
        if (currentArea) {
            const areaMeta = currentArea.fantasy_map_areas;
            document.getElementById('currentAreaName').textContent = areaMeta?.name || 'Sconosciuta';
            const needed = areaMeta?.required_quests_completed || 5;
            const done = currentArea.normal_quests_done || 0;
            document.getElementById('currentAreaProgress').textContent = `(${done}/${needed} quest completate)`;
        } else {
            const allCompleted = areas.length > 0 && areas.every(a => a.is_completed);
            document.getElementById('currentAreaName').textContent = allCompleted ? '🏁 Tutte completate!' : '🌍 Tutte le quest';
            document.getElementById('currentAreaProgress').textContent = '';
        }

        // Build quest list: try current area first, fallback to all normal quests
        const activeIds = new Set((this.activeQuests || []).map(aq => aq.quest_id));
        let areaQuests = (this.quests || []).filter(q =>
            q.quest_type === 'normal' && !this.completedQuestIds.has(q.id));

        if (currentArea) {
            const matching = areaQuests.filter(q => q.area_id === currentArea.area_id);
            if (matching.length > 0) areaQuests = matching;
        }

        const freeSlots = 2 - (this.activeQuests || []).filter(aq => aq.quests?.quest_type !== 'grande_avventura').length;

        // Update bacheca quest count (active normal quests / max)
        const countEl = document.getElementById('bachecaQuestCount');
        if (countEl) countEl.textContent = (this.activeQuests || []).filter(aq => aq.quests?.quest_type !== 'grande_avventura').length;

        if (areaQuests.length === 0) {
            list.innerHTML = '<div class="empty-state">Nessuna quest disponibile al momento.</div>';
            return;
        }
        list.innerHTML = areaQuests.map(q => {
            const isActive = activeIds.has(q.id);
            const completed = this.questProgress[q.id] && this.calcProgressPercent(q, this.questProgress[q.id]) >= 100;
            return `<div class="guild-card ${isActive ? 'active' : ''} ${completed ? 'completed' : ''}">
                <div class="guild-card-title">${q.emoji || ''} ${q.title}</div>
                <div class="guild-card-desc">${q.description || ''}</div>
                <div class="guild-card-meta">${q.difficulty || 'media'}${q.distance ? ' · ' + q.distance + 'km' : ''}${q.elevation ? ' · ' + q.elevation + 'm' : ''} · ${q.xpReward || 0} XP</div>
                <div class="guild-card-status">
                    ${isActive ? this.renderBachecaSlider(q) : ''}
                    ${completed ? '<span class="badge-completed">✅ Completata</span>' : ''}
                    ${!isActive && !completed && freeSlots > 0 ? `<button class="btn-accept" data-quest-id="${q.id}">➕ Accetta</button>` : ''}
                    ${!isActive && completed ? '<span class="badge-done">🏁 Già completata</span>' : ''}
                </div>
            </div>`;
        }).join('');

        list.querySelectorAll('.btn-accept').forEach(btn => {
            btn.addEventListener('click', () => this.handleAcceptQuest(btn.dataset.questId));
        });
    }

    renderBachecaSlider(q) {
        const qp = this.questProgress[q.id];
        if (!qp) return '';
        const pct = this.calcProgressPercent(q, qp);
        return `
            <div class="quest-slider-container">
                <div class="quest-slider-bar">
                    <div class="quest-slider-fill" style="width:${pct}%"></div>
                </div>
                <div class="quest-slider-label">${Math.round(pct)}%</div>
            </div>
        `;
    }

    async handleAcceptQuest(questId) {
        const q = this.quests.find(q => q.id == questId);
        if (!q) { alert('Quest non trovata.'); return; }

        const active = this.activeQuests || [];
        const normalCount = active.filter(aq => aq.quests?.quest_type !== 'grande_avventura').length;
        if (normalCount >= 2) {
            alert('Hai già 2 quest attive! Completane una prima di accettarne un\'altra.');
            return;
        }

        if (!this.userId) {
            // Local/offline mode: accept directly into activeQuests
            const fakeActive = { quest_id: q.id, quests: q };
            this.activeQuests.push(fakeActive);
            this.addJournalEntry('quest', 'Nuova Quest Accettata',
                `Hai accettato la quest: ${q.title}`);
            this.renderGuild();
            return;
        }

        try {
            const result = await SupaDB.acceptQuest(this.userId, q.id);
            if (result === false || result === null || result === undefined) {
                alert('Impossibile accettare la quest. Forse è già attiva o l\'area non è sbloccata.');
                return;
            }
            await this.initGuild();
            this.renderGuild();
            this.addJournalEntry('quest', 'Nuova Quest Accettata',
                `Hai accettato la quest: ${q.title}`);
        } catch (err) {
            console.warn('[App] Accept quest error:', err);
            alert('Errore durante l\'accettazione della quest: ' + (err?.message || err));
        }
    }

    renderMerchant() {
        const list = document.getElementById('merchantList');
        const resources = this.fantasyResources || { rupie: 0, cristalli: 0 };
        document.getElementById('merchantRupie').textContent = resources.rupie || 0;
        document.getElementById('merchantCristalli').textContent = resources.cristalli || 0;

        // Fallback items quando il catalogo DB è vuoto
        const FALLBACK_ITEMS = [
            { id: 'fb-bastone', name: 'Bastone del Viandante', description: 'Riduce la fatica sui lunghi tragitti.', emoji: '\u{1F3AF}', cost_rupie: 50, cost_cristalli: 0, slot_type: 'tool', effect_type: 'mtb_endurance', effect_value: 15, is_on_sale: false },
            { id: 'fb-scarpe', name: 'Scarpe del Vento', description: 'Aumenta la velocità massima consentita.', emoji: '\u{1F45F}', cost_rupie: 80, cost_cristalli: 0, slot_type: 'footwear', effect_type: 'speed_bonus', effect_value: 10, is_on_sale: false },
            { id: 'fb-amuleto', name: 'Amuleto della Terra', description: 'Riduce il dislivello richiesto per le validazioni.', emoji: '\u{1F48D}', cost_rupie: 120, cost_cristalli: 1, slot_type: 'amulet', effect_type: 'elevation_reduction', effect_value: 20, is_on_sale: false },
            { id: 'fb-bussola', name: 'Bussola Magica', description: 'Sblocca un\'area senza requisiti.', emoji: '\u{1F9ED}', cost_rupie: 200, cost_cristalli: 3, slot_type: 'tool', effect_type: 'area_unlock', effect_value: null, is_on_sale: false },
            { id: 'fb-forziere', name: 'Forziere Antico', description: 'Aggiunge Costituzione extra a fine Grande Avventura.', emoji: '\u{1F9F0}', cost_rupie: 150, cost_cristalli: 2, slot_type: 'amulet', effect_type: 'stat_bonus', effect_value: 5, is_on_sale: true, sale_price_rupie: 100 },
            { id: 'fb-esca', name: 'Esca Comune', description: 'Aumenta del 10% la probabilità di pesca.', emoji: '\u{1F41B}', cost_rupie: 30, cost_cristalli: 0, slot_type: 'tool', effect_type: 'fishing_luck', effect_value: 10, is_on_sale: false },
            { id: 'fb-amuleto-pesca', name: 'Amuleto del Pescatore', description: 'Aumenta del 15% la probabilità di pescare pesci rari.', emoji: '\u{1F4A7}', cost_rupie: 120, cost_cristalli: 2, slot_type: 'amulet', effect_type: 'fishing_luck', effect_value: 15, is_on_sale: false }
        ];

        const items = (this.itemsCatalog && this.itemsCatalog.length > 0) ? this.itemsCatalog : FALLBACK_ITEMS;
        const ownedIds = new Set((this.playerItems || []).map(pi => pi.item_id));
        const equippedIds = new Set((this.playerItems || []).filter(pi => pi.equipped).map(pi => pi.item_id));
        list.innerHTML = items.map(item => {
            const owned = ownedIds.has(item.id);
            const equipped = equippedIds.has(item.id);
            const actualCost = item.is_on_sale && item.sale_price_rupie ? item.sale_price_rupie : item.cost_rupie;
            const canAfford = (resources.rupie || 0) >= actualCost && (resources.cristalli || 0) >= item.cost_cristalli;
            const priceLabel = item.is_on_sale
                ? `<span style="text-decoration:line-through;color:var(--danger);">🪙 ${item.cost_rupie}</span> 🪙 ${item.sale_price_rupie}`
                : `🪙 ${item.cost_rupie}`;
            return `<div class="guild-card merchant-item ${owned ? 'owned' : ''} ${item.is_on_sale ? 'on-sale' : ''}">
                ${item.is_on_sale ? '<div class="sale-badge">🏷️ IN OFFERTA</div>' : ''}
                <div class="guild-card-title">${item.emoji || item.icon || ''} ${item.name}</div>
                <div class="guild-card-desc">${item.description || ''}</div>
                <div class="guild-card-meta">
                    ${priceLabel} ${item.cost_cristalli > 0 ? '💎 ' + item.cost_cristalli + ' Cristalli' : ''}
                    · Slot: ${item.slot_type || 'generico'}
                </div>
                <div class="item-effect">✨ ${formatItemEffect(item)}</div>
                ${!owned ? `<button class="btn-buy" data-item-id="${item.id}" ${!canAfford ? 'disabled' : ''}>🛒 Compra (${actualCost}R)</button>` : ''}
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
        const items = (this.itemsCatalog && this.itemsCatalog.length > 0) ? this.itemsCatalog : [];
        const item = items.find(i => i.id == itemId);
        if (!item) { alert('Oggetto non trovato.'); return; }

        const resources = this.fantasyResources || { rupie: 0, cristalli: 0 };
        const actualCost = item.is_on_sale && item.sale_price_rupie ? item.sale_price_rupie : item.cost_rupie;
        if ((resources.rupie || 0) < actualCost || (resources.cristalli || 0) < (item.cost_cristalli || 0)) {
            alert('Rupie o Cristalli insufficienti!');
            return;
        }

        resources.rupie -= actualCost;
        resources.cristalli -= (item.cost_cristalli || 0);

        if (!this.playerItems) this.playerItems = [];
        this.playerItems.push({
            id: Date.now(),
            item_id: itemId,
            equipped: false,
            items_catalog: item
        });

        this.fantasyResources = resources;
        this.savePlayer();
        this.renderMerchant();
        this.updateNpcDialogues();
        this.addJournalEntry('item', 'Acquisto', `Hai comprato: ${item.name}`);

        if (this.userId) {
            try {
                await SupaDB.purchaseItem(this.userId, itemId);
                await this.refreshFantasyResources();
                this.playerItems = await SupaDB.getPlayerItems(this.userId);
            } catch (err) {
                console.warn('[App] Purchase sync error:', err);
            }
        }
    }

    async handleEquipItem(itemId) {
        // Toggle equip in local playerItems
        const pi = (this.playerItems || []).find(p => p.item_id == itemId);
        if (pi) {
            // Unequip other items in the same slot
            const slot = pi.items_catalog?.slot_type;
            if (slot) {
                (this.playerItems || []).forEach(p => {
                    if (p.equipped && p.items_catalog?.slot_type === slot) p.equipped = false;
                });
            }
            pi.equipped = !pi.equipped;
        }
        this.renderMerchant();
        this.renderInventory();
        this.updateHero();

        if (this.userId) {
            try {
                await SupaDB.equipItem(this.userId, itemId);
                this.playerItems = await SupaDB.getPlayerItems(this.userId);
            } catch (err) {
                console.warn('[App] Equip sync error:', err);
            }
        }
    }

    // ── Adventure Mode (GPX Recording) ──

    startAdventureMode() {
        if (this.adventureMode) return;
        this.adventureMode = true;
        this.adventureStartTime = Date.now();
        this.adventureTrack = [];

        document.getElementById('advStartBtn').classList.add('hidden');
        document.getElementById('advStopBtn').classList.remove('hidden');
        document.getElementById('advDistance').textContent = '0.00';
        document.getElementById('advElevation').textContent = '0';
        document.getElementById('advTime').textContent = '00:00';

        this.adventureTimer = setInterval(() => {
            if (!this.adventureStartTime) return;
            const elapsed = Math.floor((Date.now() - this.adventureStartTime) / 1000);
            const m = Math.floor(elapsed / 60);
            const s = elapsed % 60;
            document.getElementById('advTime').textContent =
                `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }, 1000);
    }

    stopAdventureMode() {
        this.adventureMode = false;
        clearInterval(this.adventureTimer);

        document.getElementById('advStartBtn').classList.remove('hidden');
        document.getElementById('advStopBtn').classList.add('hidden');

        if (this.adventureTrack.length > 5) {
            const gpx = this.exportGPX();
            this.downloadGPX(gpx);
            const dist = parseFloat(document.getElementById('advDistance').textContent);
            const elev = parseInt(document.getElementById('advElevation').textContent);
            this.addJournalEntry('exploration', 'Avventura Completata',
                `Hai percorso ${dist.toFixed(2)}km con ${elev}m di dislivello. ${this.adventureTrack.length} punti tracciati.`);
        }

        this.adventureTrack = [];
        this.adventureStartTime = null;
    }

    updateLiveCounters(distKm, elevM) {
        if (!this.adventureMode) return;
        const distEl = document.getElementById('advDistance');
        const elevEl = document.getElementById('advElevation');
        if (distEl) {
            const curr = parseFloat(distEl.textContent) || 0;
            distEl.textContent = (curr + distKm).toFixed(2);
        }
        if (elevEl) {
            const curr = parseInt(elevEl.textContent) || 0;
            elevEl.textContent = curr + elevM;
        }
    }

    exportGPX() {
        const points = this.adventureTrack;
        if (points.length === 0) return '';

        const header = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="QuestTrackerRPG" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Avventura ${new Date(this.adventureStartTime || Date.now()).toISOString().split('T')[0]}</name><trkseg>`;
        const footer = `  </trkseg></trk></gpx>`;

        const trackPoints = points.map(p => {
            const ele = p.alt ? `<ele>${p.alt}</ele>` : '';
            const time = p.timestamp ? `<time>${new Date(p.timestamp).toISOString()}</time>` : '';
            return `    <trkpt lat="${p.lat}" lon="${p.lng}">${ele}${time}</trkpt>`;
        }).join('\n');

        return `${header}\n${trackPoints}\n${footer}`;
    }

    downloadGPX(gpx) {
        const blob = new Blob([gpx], { type: 'application/gpx+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `avventura-${dateStr}.gpx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ── Event Queue (Toast Notifications) ──

    addEvent(type, data) {
        this.eventQueue.push({ type, data, ts: Date.now() });
        this.showNextEvent();
    }

    showNextEvent() {
        if (this.eventQueue.length === 0) return;
        const evt = this.eventQueue.shift();
        if (evt.type === 'quest_complete') {
            const modal = document.getElementById('completionModal');
            document.getElementById('modalIcon').textContent = '⚡';
            document.getElementById('modalTitle').textContent = evt.data.title;
            document.getElementById('modalText').innerHTML = evt.data.text;
            modal.classList.add('active');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => { new App(); });
