-- ============================================================================
-- 010: Minigioco Pesca — Catalogo pesci, statistiche giocatore, inventario esche
-- Esegui DOPO 009_fase5.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS minigame_fish_catalog (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    flavor_text TEXT,
    min_rupie INT NOT NULL DEFAULT 0,
    max_rupie INT NOT NULL DEFAULT 0,
    cristalli_chance NUMERIC NOT NULL DEFAULT 0 CHECK (cristalli_chance BETWEEN 0 AND 1),
    cristalli_min INT NOT NULL DEFAULT 0,
    cristalli_max INT NOT NULL DEFAULT 0,
    stat_bonus TEXT,
    stat_bonus_value INT NOT NULL DEFAULT 0,
    pull_weight INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS player_fishing_stats (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_casts INT NOT NULL DEFAULT 0,
    fish_caught JSONB NOT NULL DEFAULT '{}'::jsonb,
    largest_fish_id BIGINT REFERENCES minigame_fish_catalog(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS player_fishing_inventory (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('bait_common', 'bait_rare', 'bait_legendary', 'rod_special')),
    quantity INT NOT NULL DEFAULT 0,
    UNIQUE(user_id, item_type)
);

-- Seed: catalogo pesci
INSERT INTO minigame_fish_catalog (name, emoji, rarity, flavor_text, min_rupie, max_rupie, cristalli_chance, cristalli_min, cristalli_max, stat_bonus, stat_bonus_value, pull_weight) VALUES
    ('Carpa', '🐟', 'common', 'Un pesce comune ma sostanzioso. I mercanti del villaggio lo pagano volentieri.', 5, 15, 0, 0, 0, NULL, 0, 50),
    ('Trota', '🐠', 'common', 'Una trota scattante dalle squame brillanti. Ottima per la cena!', 10, 25, 0.02, 0, 1, NULL, 0, 30),
    ('Luccio', '🐡', 'rare', 'Un predatore dai denti aguzzi. Difficile da catturare, ma la ricompensa vale la fatica.', 30, 50, 0.05, 1, 1, NULL, 0, 12),
    ('Pesce Luna', '🌙', 'epic', 'Rarissimo, le sue squame brillano di luce argentata. Porta fortuna a chi lo cattura.', 80, 120, 0.10, 1, 2, NULL, 0, 2),
    ('Re del Lago', '🐉', 'legendary', 'Il leggendario sovrano delle acque! Catturarlo è un''impresa che pochi possono raccontare.', 200, 300, 0.20, 3, 5, 'all_stats', 1, 1)
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE minigame_fish_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fish_catalog_read" ON minigame_fish_catalog FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE player_fishing_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fishing_stats_select_own" ON player_fishing_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fishing_stats_insert_own" ON player_fishing_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fishing_stats_update_own" ON player_fishing_stats FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE player_fishing_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fishing_inv_select_own" ON player_fishing_inventory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fishing_inv_insert_own" ON player_fishing_inventory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fishing_inv_update_own" ON player_fishing_inventory FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fishing_stats_user ON player_fishing_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_fishing_inv_user ON player_fishing_inventory(user_id);
