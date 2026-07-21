class CombatEngine {
    constructor(app) {
        this.app = app;
        this.currentMonster = null;
        this.monsters = [];
        this.defeatedIds = new Set();
    }

    async loadMonsters() {
        this.monsters = [];
        this.defeatedIds = new Set();
        if (!this.app.userId) return;
        try {
            const [dbMonsters, defeated] = await Promise.all([
                SupaDB.getMonsters(),
                SupaDB.getDefeatedMonsters(this.app.userId)
            ]);
            this.monsters = dbMonsters || [];
            this.defeatedIds = new Set((defeated || []).map(d => d.monster_id));
        } catch (err) {
            console.warn('[CombatEngine] Load monsters error:', err);
        }
    }

    async loadIfNeeded() {
        if (this.monsters.length === 0) await this.loadMonsters();
    }

    getAvailableMonsters() {
        const qc = this.app.player?.questsCompleted || 0;
        const dbAvailable = this.monsters.filter(m =>
            qc >= (m.unlock_quests || 0) && !this.defeatedIds.has(m.id)
        );

        // Merge boss areas che sono sbloccate ma non ancora completate
        const areaProgress = this.app.areaProgress || [];
        const bossAreas = areaProgress
            .filter(ap => ap.is_boss_unlocked && !ap.is_completed && ap.fantasy_map_areas?.boss_quest_id)
            .map(ap => this.buildBossMonster(ap.fantasy_map_areas));

        return [...dbAvailable, ...bossAreas];
    }

    // Converte un'area fantasy in formato mostro per CombatEngine.
    // Usato sia qui (per unificare i boss nel sistema di combattimento)
    // sia da fantasy-map.js (quando il giocatore rivela un'area boss).
    buildBossMonster(area) {
        if (!area) return null;
        const xpReward = Math.round((area.rupie_reward || 0) * 3);
        return {
            id: `area-${area.id}`,
            name: area.name,
            emoji: area.emoji || '🐉',
            description: area.description || '',
            requiredForza: area.required_forza || 0,
            requiredAgilita: area.required_agilita || 0,
            requiredCostituzione: area.required_costituzione || 0,
            unlockQuests: 0,
            rupieReward: area.rupie_reward || 0,
            cristalliReward: area.cristalli_reward || 0,
            xpReward,
            isBoss: true,
            winText: area.lore_text
                ? `${area.lore_text} Il guardiano di ${area.name} è stato sconfitto!`
                : `Hai conquistato ${area.name}!`,
            loseText: `Il guardiano di ${area.name} ti respinge. Allenati nel mondo reale e torna più forte.`
        };
    }

    canFight() {
        return this.getAvailableMonsters().length > 0;
    }

    openEncounter(monster) {
        this.currentMonster = monster;
        const p = this.app.player;

        document.getElementById('combatIcon').textContent = monster.emoji;
        document.getElementById('combatName').textContent = monster.name;
        document.getElementById('combatDesc').textContent = monster.description;

        const reqs = [
            { label: 'FORZA', required: monster.requiredForza, current: p.forza || 0, icon: '\u{1F4AA}' },
            { label: 'AGILITÀ', required: monster.requiredAgilita, current: p.agilita || 0, icon: '\u{1F3C3}' },
            { label: 'COSTITUZIONE', required: monster.requiredCostituzione, current: p.costituzione || 0, icon: '\u{1F5A1}\u{FE0F}' }
        ];

        const reqsContainer = document.getElementById('combatReqs');
        reqsContainer.innerHTML = reqs.map(r => {
            const ok = r.current >= r.required;
            return `
                <div class="creq-row ${ok ? 'ok' : 'fail'}">
                    <span class="creq-icon">${r.icon}</span>
                    <span class="creq-label">${r.label}</span>
                    <div class="creq-bar">
                        <div class="creq-fill" style="width: ${Math.min((r.current / Math.max(r.required, 1)) * 100, 100)}%"></div>
                    </div>
                    <span class="creq-vs">${r.current} / ${r.required}</span>
                    <span class="creq-result">${ok ? '\u2714' : '\u2716'}</span>
                </div>
            `;
        }).join('');

        const allOk = reqs.every(r => r.current >= r.required);
        document.getElementById('combatRewards').innerHTML = `
            \u26A1 ${monster.xpReward} XP \u2022 \u{1FA99} ${monster.rupieReward} Rupie ${monster.cristalliReward > 0 ? `\u2022 \u{1F48E} ${monster.cristalliReward} Cristalli` : ''}
        `;

        const attackBtn = document.getElementById('combatAttackBtn');
        attackBtn.textContent = allOk ? '\u2694\uFE0F Attacca!' : '\u26F0\uFE0F Non sei pronto';
        attackBtn.className = `btn ${allOk ? 'btn-primary' : 'btn-secondary'}`;
        attackBtn.disabled = !allOk;

        document.getElementById('combatResult').classList.add('hidden');
        document.getElementById('combatOverlay').classList.add('active');
    }

    async resolveCombat() {
        const monster = this.currentMonster;
        const p = this.app.player;
        const forzOk = (p.forza || 0) >= monster.requiredForza;
        const agiOk = (p.agilita || 0) >= monster.requiredAgilita;
        const cosOk = (p.costituzione || 0) >= monster.requiredCostituzione;
        const victory = forzOk && agiOk && cosOk;

        const resultEl = document.getElementById('combatResult');
        resultEl.classList.remove('hidden');

        if (victory) {
            resultEl.className = 'combat-result victory';
            resultEl.innerHTML = `
                <div class="cr-icon">\u{1F3C6}</div>
                <div class="cr-title">VITTORIA!</div>
                <div class="cr-text">${monster.winText}</div>
                <div class="cr-rewards">
                    \u26A1 +${monster.xpReward} XP \u2022 \u{1FA99} +${monster.rupieReward} Rupie
                    ${monster.cristalliReward > 0 ? `\u2022 \u{1F48E} +${monster.cristalliReward} Cristalli` : ''}
                </div>
            `;

            GameEngine.processLevelUp(p, monster.xpReward);
            p.totalXP += monster.xpReward;
            if (!this.app.fantasyResources) this.app.fantasyResources = { rupie: 0, cristalli: 0, punti_esplorazione: 0 };
            this.app.fantasyResources.rupie += monster.rupieReward;
            this.app.fantasyResources.cristalli += (monster.cristalliReward || 0);

            if (monster.isBoss) {
                // Boss area: completa la quest boss e aggiorna area progress
                const areaId = monster.id.replace('area-', '');
                const bossQuest = this.app.quests.find(q => q.id === monster.id.replace('area-', ''));
                const questId = monster.bossQuestId || (this.app.quests || []).find(q =>
                    q.quest_type === 'grande_avventura' && q.area_id === areaId
                )?.id;
                if (questId && this.app.userId) {
                    await SupaDB.completeQuestWithProgress(this.app.userId, questId);
                    await this.app.initGuild();
                    await this.app.refreshFantasyResources();
                }
            } else {
                // Mostro normale: segna come sconfitto su Supabase
                if (this.app.userId) {
                    await SupaDB.markMonsterDefeated(this.app.userId, monster.id);
                    this.defeatedIds.add(monster.id);
                }
            }

            this.app.addJournalEntry('quest', `Sconfitto: ${monster.name}!`, `${monster.winText.slice(0, 60)}...`);
            this.app.savePlayer();
            this.app.updateHero();

        } else {
            resultEl.className = 'combat-result defeat';
            resultEl.innerHTML = `
                <div class="cr-icon">\u{1F6AB}</div>
                <div class="cr-title">SCONFITTA</div>
                <div class="cr-text">${monster.loseText}</div>
                <div class="cr-hint">
                    ${!forzOk ? '\u{26F0}\u{FE0F} Servono più trekking in salita per aumentare la Forza<br>' : ''}
                    ${!agiOk ? '\u{1F6B5} Pedala più veloce per aumentare l\'Agilità<br>' : ''}
                    ${!cosOk ? '\u{1F3C3} Cammina più a lungo per aumentare la Costituzione' : ''}
                </div>
            `;
        }

        document.getElementById('combatAttackBtn').classList.add('hidden');
        document.getElementById('combatCloseBtn').classList.remove('hidden');
    }

    closeCombat() {
        document.getElementById('combatOverlay').classList.remove('active');
        this.currentMonster = null;
        document.getElementById('combatAttackBtn').classList.remove('hidden');
        document.getElementById('combatCloseBtn').classList.add('hidden');
        document.getElementById('combatResult').classList.add('hidden');
    }
}
