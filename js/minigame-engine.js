const FISH_CATALOG = [
    { id: 1, name: 'Carpa', emoji: '\u{1F41F}', rarity: 'common', flavor: 'Un pesce comune ma sostanzioso.', minRupie: 5, maxRupie: 15, cristalliChance: 0, cristalliMin: 0, cristalliMax: 0, statBonus: null, statVal: 0, weight: 50 },
    { id: 2, name: 'Trota', emoji: '\u{1F420}', rarity: 'common', flavor: 'Una trota scattante dalle squame brillanti.', minRupie: 10, maxRupie: 25, cristalliChance: 0.02, cristalliMin: 0, cristalliMax: 1, statBonus: null, statVal: 0, weight: 30 },
    { id: 3, name: 'Luccio', emoji: '\u{1FA21}', rarity: 'rare', flavor: 'Un predatore dai denti aguzzi.', minRupie: 30, maxRupie: 50, cristalliChance: 0.05, cristalliMin: 1, cristalliMax: 1, statBonus: null, statVal: 0, weight: 12 },
    { id: 4, name: 'Pesce Luna', emoji: '\u{1F319}', rarity: 'epic', flavor: 'Squame di luce argentata. Porta fortuna.', minRupie: 80, maxRupie: 120, cristalliChance: 0.10, cristalliMin: 1, cristalliMax: 2, statBonus: null, statVal: 0, weight: 2 },
    { id: 5, name: 'Re del Lago', emoji: '\u{1F409}', rarity: 'legendary', flavor: 'Il leggendario sovrano delle acque!', minRupie: 200, maxRupie: 300, cristalliChance: 0.20, cristalliMin: 3, cristalliMax: 5, statBonus: 'all_stats', statVal: 1, weight: 1 }
];

class MinigameEngine {
    constructor(app) {
        this.app = app;
        this.lastFishingKm = 0;
        this.fishingActive = false;
        this.currentFish = null;
        this.castingState = 'idle';
        this.baitBonus = 0;
        this.baitType = null;
        this.caughtFish = {};  // fish_id -> count
        this.totalCasts = 0;
    }

    // Called from contributeMovement every time a segment is processed
    rollForFishing(distKm) {
        if (this.fishingActive) return;
        const totalDist = this.app.player.totalDistance || 0;
        const sinceLast = totalDist - this.lastFishingKm;
        if (sinceLast < 0.5) return;

        this.lastFishingKm = totalDist;

        const baseChance = 0.18;
        const multiplier = 1 + Math.min((sinceLast - 0.5) * 0.15, 3);
        const equippedBonus = (this.app.getEquippedEffects?.().fishing_luck || 0) / 100;
        const chance = Math.min(baseChance * multiplier + this.baitBonus + equippedBonus, 0.70);

        if (Math.random() < chance) {
            this.triggerFishing();
        }
    }

    triggerFishing() {
        this.fishingActive = true;
        this.castingState = 'casting';
        const overlay = document.getElementById('fishingOverlay');
        if (overlay) {
            overlay.classList.add('active');
            this.renderFishingUI('intro');
        }
    }

    // ── Fishing UI ──

    renderFishingUI(state) {
        const content = document.getElementById('fishingContent');
        if (!content) return;

        switch (state) {
            case 'intro':
                content.innerHTML = `
                    <div class="fishing-scene">
                        <div class="fishing-water">
                            <div class="fishing-waves"></div>
                            <div class="fishing-bobber" id="fishingBobber">🎣</div>
                        </div>
                        <div class="fishing-controls">
                            <p class="fishing-hint">Hai trovato un punto di pesca! Lancia l'amo.</p>
                            <div class="fishing-bait-select">
                                <label>Esca:</label>
                                <select id="fishingBaitSelect">
                                    <option value="none">Nessuna</option>
                                    ${this.getBaitOptions()}
                                </select>
                            </div>
                            <button class="btn btn-primary" id="fishingCastBtn">🎣 Lancia!</button>
                            <button class="btn btn-secondary" id="fishingCloseBtn">✖️ Vattene</button>
                        </div>
                    </div>
                `;
                this.bindFishingButtons();
                break;

            case 'waiting':
                content.innerHTML = `
                    <div class="fishing-scene">
                        <div class="fishing-water">
                            <div class="fishing-waves"></div>
                            <div class="fishing-bobber bobber-waiting">🎣</div>
                            <div class="fishing-ripple"></div>
                        </div>
                        <div class="fishing-controls">
                            <p class="fishing-hint">Aspetta... guarda il galleggiante...</p>
                        </div>
                    </div>
                `;
                this.startFishTimer();
                break;

            case 'bite':
                content.innerHTML = `
                    <div class="fishing-scene">
                        <div class="fishing-water">
                            <div class="fishing-waves"></div>
                            <div class="fishing-bobber bobber-bite">🎣</div>
                            <div class="fishing-splash"></div>
                        </div>
                        <div class="fishing-controls">
                            <p class="fishing-hint fishing-bite-text">⚠️ Qualcosa sta abboccando! TIRA!</p>
                            <button class="btn btn-primary fishing-reel-btn" id="fishingReelBtn">🔄 Tira su!</button>
                        </div>
                    </div>
                `;
                document.getElementById('fishingReelBtn')?.addEventListener('click', () => this.reelIn());
                break;

            case 'result':
                const fish = this.currentFish;
                if (!fish) { this.closeFishing(); return; }
                const rupie = this.randomInt(fish.minRupie, fish.maxRupie);
                let cristalli = 0;
                if (fish.cristalliChance > 0 && Math.random() < fish.cristalliChance) {
                    cristalli = this.randomInt(fish.cristalliMin, fish.cristalliMax);
                }
                this.awardRewards(fish, rupie, cristalli);

                content.innerHTML = `
                    <div class="fishing-scene">
                        <div class="fishing-water">
                            <div class="fishing-waves"></div>
                            <div class="fishing-catch">${fish.emoji}</div>
                        </div>
                        <div class="fishing-controls">
                            <div class="fishing-result-card rarity-${fish.rarity}">
                                <div class="fishing-result-name">${fish.emoji} ${fish.name}</div>
                                <div class="fishing-result-rarity">${this.rarityLabel(fish.rarity)}</div>
                                <div class="fishing-result-flavor">"${fish.flavor}"</div>
                                <div class="fishing-result-rewards">
                                    <span>🪙 +${rupie} Rupie</span>
                                    ${cristalli > 0 ? `<span>💎 +${cristalli} Cristallo</span>` : ''}
                                    ${fish.statBonus ? `<span>⚡ +${fish.statVal} a tutti gli attributi!</span>` : ''}
                                </div>
                            </div>
                            <button class="btn btn-primary" id="fishingContinueBtn">🎣 Continua a pescare</button>
                            <button class="btn btn-secondary" id="fishingCloseBtn">✖️ Chiudi</button>
                        </div>
                    </div>
                `;
                document.getElementById('fishingContinueBtn')?.addEventListener('click', () => {
                    this.currentFish = null;
                    this.renderFishingUI('intro');
                });
                document.getElementById('fishingCloseBtn')?.addEventListener('click', () => this.closeFishing());
                break;
        }
    }

    bindFishingButtons() {
        const baitSelect = document.getElementById('fishingBaitSelect');
        if (baitSelect) {
            baitSelect.addEventListener('change', (e) => {
                const val = e.target.value;
                const bonuses = { none: 0, bait_common: 0.10, bait_rare: 0.25, bait_legendary: 0.40 };
                this.baitBonus = bonuses[val] || 0;
                this.baitType = val === 'none' ? null : val;
            });
        }
        document.getElementById('fishingCastBtn')?.addEventListener('click', () => this.castLine());
        document.getElementById('fishingCloseBtn')?.addEventListener('click', () => this.closeFishing());
    }

    getBaitOptions() {
        const inventory = this.app.fishingInventory || {};
        const baits = [
            { type: 'bait_common', label: '🐛 Esca Comune (×' + (inventory.bait_common || 0) + ')' },
            { type: 'bait_rare', label: '✨ Esca Splendente (×' + (inventory.bait_rare || 0) + ')' },
            { type: 'bait_legendary', label: '🌟 Esca Arcana (×' + (inventory.bait_legendary || 0) + ')' }
        ];
        return baits
            .filter(b => b.type === 'bait_common' || (inventory[b.type] || 0) > 0)
            .map(b => `<option value="${b.type}" ${((inventory[b.type] || 0) === 0) ? 'disabled' : ''}>${b.label}</option>`)
            .join('');
    }

    castLine() {
        this.castingState = 'waiting';
        this.renderFishingUI('waiting');
    }

    startFishTimer() {
        // Fish bites after 1.5-4 seconds
        const delay = 1500 + Math.random() * 2500;
        setTimeout(() => {
            if (this.castingState === 'waiting') {
                this.castingState = 'bite';
                this.currentFish = this.rollFish();
                this.renderFishingUI('bite');
            }
        }, delay);

        // Auto-fail: if user doesn't click within 4 seconds of bite
        setTimeout(() => {
            if (this.castingState === 'bite') {
                this.castingState = 'idle';
                this.renderFishingUI('intro');
            }
        }, delay + 4000);
    }

    reelIn() {
        this.totalCasts++;
        this.castingState = 'result';
        // Consume bait if used
        if (this.baitType && this.baitType !== 'none') {
            const inv = this.app.fishingInventory || {};
            if ((inv[this.baitType] || 0) > 0) {
                inv[this.baitType]--;
                this.app.fishingInventory = inv;
            }
        }
        this.renderFishingUI('result');
    }

    rollFish() {
        const bonus = this.getRarityBonus();
        const totalWeight = FISH_CATALOG.reduce((s, f) => s + f.weight, 0);

        // Weighted random with rarity bonus
        let roll = Math.random();
        if (bonus > 0) {
            // Shift: reduce common weight, increase rare+ weight
            roll = roll * (1 - bonus);
        }

        let cumulative = 0;
        for (const fish of FISH_CATALOG) {
            cumulative += fish.weight / totalWeight;
            if (roll < cumulative) return { ...fish };
        }
        return { ...FISH_CATALOG[0] };
    }

    getRarityBonus() {
        const effects = this.app.getEquippedEffects?.() || {};
        let bonus = (effects.fishing_luck || 0) / 100;
        if (this.baitType === 'bait_legendary') bonus += 0.15;
        return Math.min(bonus, 0.5);
    }

    awardRewards(fish, rupie, cristalli) {
        const p = this.app.player;
        if (!p) return;

        if (!this.app.fantasyResources) {
            this.app.fantasyResources = { rupie: 0, cristalli: 0, punti_esplorazione: 0 };
        }
        this.app.fantasyResources.rupie += rupie;
        this.app.fantasyResources.cristalli += cristalli;

        if (fish.statBonus === 'all_stats') {
            p.forza = (p.forza || 0) + fish.statVal;
            p.agilita = (p.agilita || 0) + fish.statVal;
            p.costituzione = (p.costituzione || 0) + fish.statVal;
        }

        // Track caught fish
        if (!this.caughtFish[fish.id]) this.caughtFish[fish.id] = 0;
        this.caughtFish[fish.id]++;

        this.app.addJournalEntry('exploration', `Pesca: ${fish.name}!`,
            `Hai catturato ${fish.emoji} ${fish.name} (${this.rarityLabel(fish.rarity)}) — ${rupie} Rupie${cristalli > 0 ? ', ' + cristalli + ' Cristalli' : ''}`);

        this.app.savePlayer();
        this.app.updateHero();
    }

    closeFishing() {
        this.fishingActive = false;
        this.currentFish = null;
        this.castingState = 'idle';
        this.baitBonus = 0;
        this.baitType = null;
        const overlay = document.getElementById('fishingOverlay');
        if (overlay) overlay.classList.remove('active');
    }

    // ── Helpers ──

    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    rarityLabel(rarity) {
        const labels = { common: 'Comune', rare: 'Raro', epic: 'Epico', legendary: 'Leggendario' };
        return labels[rarity] || rarity;
    }

    getFishingStats() {
        return {
            totalCasts: this.totalCasts,
            fishCaught: this.caughtFish,
            uniqueSpecies: Object.keys(this.caughtFish).length
        };
    }
}
