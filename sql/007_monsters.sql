-- ============================================================================
-- 007: Monsters Catalog & Unified Encounter System
-- Unifica i mostri "selvaggi" (ex combat-engine.js MONSTERS) su database,
-- rendendoli coerenti con le aree boss della Gilda.
-- Esegui DOPO 006_guild_system.sql (sicuro anche se già eseguito)
-- ============================================================================

-- 0. PULIZIA (per esecuzioni multiple sicure)
DROP TABLE IF EXISTS player_defeated_monsters CASCADE;
DROP TABLE IF EXISTS monsters_catalog CASCADE;

-- ============================================================================
-- 1. TABELLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS monsters_catalog (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    emoji text NOT NULL DEFAULT '🐉',
    description text,
    required_forza integer NOT NULL DEFAULT 0,
    required_agilita integer NOT NULL DEFAULT 0,
    required_costituzione integer NOT NULL DEFAULT 0,
    unlock_quests integer NOT NULL DEFAULT 0,
    rupie_reward integer NOT NULL DEFAULT 0,
    cristalli_reward integer NOT NULL DEFAULT 0,
    xp_reward integer NOT NULL DEFAULT 0,
    win_text text,
    lose_text text,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_defeated_monsters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    monster_id uuid NOT NULL REFERENCES monsters_catalog(id) ON DELETE CASCADE,
    defeated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_monster UNIQUE (user_id, monster_id)
);

-- ============================================================================
-- 2. INDICI
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_defeated_monsters_user ON player_defeated_monsters(user_id);

-- ============================================================================
-- 3. RLS
-- ============================================================================

ALTER TABLE monsters_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_defeated_monsters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monsters_read_all" ON monsters_catalog;
DROP POLICY IF EXISTS "defeated_select_own" ON player_defeated_monsters;
DROP POLICY IF EXISTS "defeated_insert_own" ON player_defeated_monsters;

CREATE POLICY "monsters_read_all" ON monsters_catalog
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "defeated_select_own" ON player_defeated_monsters
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "defeated_insert_own" ON player_defeated_monsters
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 4. SEED — 3 mostri (ex MONSTERS in combat-engine.js)
-- ============================================================================

INSERT INTO monsters_catalog (name, emoji, description, required_forza, required_agilita, required_costituzione, unlock_quests, rupie_reward, cristalli_reward, xp_reward, win_text, lose_text, sort_order) VALUES
(
    'Goblin delle Rocce',
    '👺',
    'Una piccola creatura verde con occhi rossi e un randello nodoso. Blocca il ponte verso la Gola del Tuono.',
    3, 0, 0, 2, 50, 1, 100,
    'Con un colpo ben piazzato, il Goblin vola nel fosso. Il ponte è libero!',
    'Il Goblin ti colpisce con il randello. "Ah ah! Torna quando avrai scalato più montagne, rammollito!"',
    1
),
(
    'Guardiano della Foresta',
    '🌲',
    'Un enorme golem di legno e muschio. I suoi occhi brillano di luce verde e la terra trema ad ogni passo.',
    8, 3, 0, 5, 120, 2, 250,
    'Il Guardiano si inchina e si dissolve in foglie dorate. Il sentiero per le Rovine Antiche è aperto!',
    'Il Guardiano ti solleva con una radice e ti deposita fuori dalla foresta. "Non sei ancora pronto, giovane eroe. Accumula più forza."',
    2
),
(
    'Drago della Vetta',
    '🐉',
    'Il leggendario drago di rubino che custodisce il Cristallo Eterno. Le sue scaglie scintillano come brace viva.',
    15, 8, 10, 8, 500, 5, 1000,
    'Con un ultimo colpo, il Drago ruggisce e si accascia. Il Cristallo Eterno è tuo! La leggenda della tua impresa si diffonderà in tutto il regno.',
    'Il Drago soffia un getto di fiamme che ti costringe alla ritirata. "Troppo debole. Torna quando la tua forza eguaglierà la tua, o brucerai."',
    3
)
ON CONFLICT DO NOTHING;
