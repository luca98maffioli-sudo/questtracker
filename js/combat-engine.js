const MONSTERS = [
    {
        id: 'goblin', name: 'Goblin delle Rocce', emoji: '\u{1F47A}',
        description: 'Una piccola creatura verde con occhi rossi e un randello nodoso. Blocca il ponte verso la Gola del Tuono.',
        requiredForza: 3, requiredAgilita: 0, requiredCostituzione: 0,
        unlockQuests: 2, rupieReward: 50, cristalliReward: 1, xpReward: 100,
        winText: 'Con un colpo ben piazzato, il Goblin vola nel fosso. Il ponte è libero!',
        loseText: 'Il Goblin ti colpisce con il randello. "Ah ah! Torna quando avrai scalato più montagne, rammollito!"'
    },
    {
        id: 'guardiano', name: 'Guardiano della Foresta', emoji: '\u{1F332}',
        description: 'Un enorme golem di legno e muschio. I suoi occhi brillano di luce verde e la terra trema ad ogni passo.',
        requiredForza: 8, requiredAgilita: 3, requiredCostituzione: 0,
        unlockQuests: 5, rupieReward: 120, cristalliReward: 2, xpReward: 250,
        winText: 'Il Guardiano si inchina e si dissolve in foglie dorate. Il sentiero per le Rovine Antiche è aperto!',
        loseText: 'Il Guardiano ti solleva con una radice e ti deposita fuori dalla foresta. "Non sei ancora pronto, giovane eroe. Accumula più forza."'
    },
    {
        id: 'drago', name: 'Drago della Vetta', emoji: '\u{1F409}',
        description: 'Il leggendario drago di rubino che custodisce il Cristallo Eterno. Le sue scaglie scintillano come brace viva.',
        requiredForza: 15, requiredAgilita: 8, requiredCostituzione: 10,
        unlockQuests: 8, rupieReward: 500, cristalliReward: 5, xpReward: 1000,
        winText: 'Con un ultimo colpo, il Drago ruggisce e si accascia. Il Cristallo Eterno è tuo! La leggenda della tua impresa si diffonderà in tutto il regno.',
        loseText: 'Il Drago soffia un getto di fiamme che ti costringe alla ritirata. "Troppo debole. Torna quando la tua forza eguaglierà la mia, o brucerai."'
    }
];

class CombatEngine {
    constructor(app) {
        this.app = app;
        this.currentMonster = null;
    }

    getAvailableMonsters() {
        const qc = this.app.player?.questsCompleted || 0;
        const defeated = this.getDefeated();
        return MONSTERS.filter(m => qc >= m.unlockQuests && !defeated.includes(m.id));
    }

    getDefeated() {
        try {
            const s = localStorage.getItem('questtracker_defeated');
            return s ? JSON.parse(s) : [];
        } catch { return []; }
    }

    markDefeated(monsterId) {
        const d = this.getDefeated();
        if (!d.includes(monsterId)) {
            d.push(monsterId);
            localStorage.setItem('questtracker_defeated', JSON.stringify(d));
        }
    }

    hasDefeated(monsterId) {
        return this.getDefeated().includes(monsterId);
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

    resolveCombat() {
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

            this.markDefeated(monster.id);
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
