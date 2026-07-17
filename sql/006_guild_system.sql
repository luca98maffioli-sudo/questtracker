-- ============================================================================
-- 006: Guild System — Bacheca, Inventario, Titoli, Aree & Grande Avventura
-- Esegui DOPO full_schema.sql (sicuro anche se già eseguito)
-- ============================================================================

-- 0. PULIZIA (per esecuzioni multiple sicure)
DROP TABLE IF EXISTS player_active_quests CASCADE;
DROP TABLE IF EXISTS player_area_progress CASCADE;
DROP TABLE IF EXISTS player_items CASCADE;
DROP TABLE IF EXISTS player_titles CASCADE;

-- 1. NUOVE COLONNE su tabelle esistenti
-- ============================================================================

ALTER TABLE quests ADD COLUMN IF NOT EXISTS quest_type text NOT NULL DEFAULT 'normal'
    CHECK (quest_type IN ('normal', 'grande_avventura'));
ALTER TABLE quests ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES fantasy_map_areas(id) ON DELETE SET NULL;
ALTER TABLE quests ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE quests ADD COLUMN IF NOT EXISTS is_story boolean NOT NULL DEFAULT false;
ALTER TABLE quests ADD COLUMN IF NOT EXISTS chapter_number integer;

ALTER TABLE fantasy_map_areas ADD COLUMN IF NOT EXISTS is_starting_area boolean NOT NULL DEFAULT false;
ALTER TABLE fantasy_map_areas ADD COLUMN IF NOT EXISTS required_quests_completed integer NOT NULL DEFAULT 0;
ALTER TABLE fantasy_map_areas ADD COLUMN IF NOT EXISTS boss_quest_id uuid REFERENCES quests(id) ON DELETE SET NULL;
ALTER TABLE fantasy_map_areas ADD COLUMN IF NOT EXISTS unlock_order integer;

-- ============================================================================
-- 2. NUOVE TABELLE
-- ============================================================================

-- 2a. Catalogo oggetti
CREATE TABLE IF NOT EXISTS items_catalog (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    icon text NOT NULL DEFAULT '📦',
    slot_type text NOT NULL CHECK (slot_type IN ('tool', 'footwear', 'amulet')),
    effect_type text NOT NULL,
    effect_value numeric NOT NULL DEFAULT 0,
    cost_rupie integer NOT NULL DEFAULT 0,
    cost_cristalli integer NOT NULL DEFAULT 0,
    rarity text NOT NULL DEFAULT 'common',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 2b. Oggetti del giocatore
CREATE TABLE IF NOT EXISTS player_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES items_catalog(id) ON DELETE CASCADE,
    quantity integer NOT NULL DEFAULT 1,
    equipped boolean NOT NULL DEFAULT false,
    acquired_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_item UNIQUE (user_id, item_id)
);

-- 2c. Catalogo titoli
CREATE TABLE IF NOT EXISTS titles_catalog (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    icon text NOT NULL DEFAULT '🏅',
    requirement_type text NOT NULL CHECK (requirement_type IN ('level', 'quests_completed', 'total_distance_km', 'total_elevation', 'total_xp')),
    requirement_value integer NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 2d. Titoli sbloccati dal giocatore
CREATE TABLE IF NOT EXISTS player_titles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title_id uuid NOT NULL REFERENCES titles_catalog(id) ON DELETE CASCADE,
    earned_at timestamptz NOT NULL DEFAULT now(),
    is_active boolean NOT NULL DEFAULT false,
    CONSTRAINT unique_user_title UNIQUE (user_id, title_id)
);

-- 2e. Quest attualmente accettate dal giocatore (max 2 normali + 1 Grande Avventura)
CREATE TABLE IF NOT EXISTS player_active_quests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quest_id uuid NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    quest_type text NOT NULL CHECK (quest_type IN ('normal', 'grande_avventura')),
    accepted_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_active_user_quest UNIQUE (user_id, quest_id)
);

-- 2f. Progresso aree (sblocco, boss sbloccato, completata)
CREATE TABLE IF NOT EXISTS player_area_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    area_id uuid NOT NULL REFERENCES fantasy_map_areas(id) ON DELETE CASCADE,
    is_unlocked boolean NOT NULL DEFAULT false,
    is_boss_unlocked boolean NOT NULL DEFAULT false,
    is_completed boolean NOT NULL DEFAULT false,
    normal_quests_done integer NOT NULL DEFAULT 0,
    unlocked_at timestamptz,
    completed_at timestamptz,
    CONSTRAINT unique_user_area UNIQUE (user_id, area_id)
);

-- ============================================================================
-- 3. INDICI
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_quests_area ON quests(area_id);
CREATE INDEX IF NOT EXISTS idx_quests_type ON quests(quest_type);
CREATE INDEX IF NOT EXISTS idx_player_items_user ON player_items(user_id);
CREATE INDEX IF NOT EXISTS idx_player_items_equipped ON player_items(user_id) WHERE equipped = true;
CREATE INDEX IF NOT EXISTS idx_player_titles_user ON player_titles(user_id);
CREATE INDEX IF NOT EXISTS idx_player_titles_active ON player_titles(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_active_quests_user ON player_active_quests(user_id);
CREATE INDEX IF NOT EXISTS idx_active_quests_user_type ON player_active_quests(user_id, quest_type);
CREATE INDEX IF NOT EXISTS idx_player_area_progress_user ON player_area_progress(user_id);

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

ALTER TABLE items_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "items_read_all" ON items_catalog;
CREATE POLICY "items_read_all" ON items_catalog FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE player_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "items_select_own" ON player_items;
DROP POLICY IF EXISTS "items_insert_own" ON player_items;
DROP POLICY IF EXISTS "items_update_own" ON player_items;
CREATE POLICY "items_select_own" ON player_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "items_insert_own" ON player_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "items_update_own" ON player_items FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE titles_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "titles_read_all" ON titles_catalog;
CREATE POLICY "titles_read_all" ON titles_catalog FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE player_titles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "titles_select_own" ON player_titles;
DROP POLICY IF EXISTS "titles_insert_own" ON player_titles;
DROP POLICY IF EXISTS "titles_update_own" ON player_titles;
CREATE POLICY "titles_select_own" ON player_titles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "titles_insert_own" ON player_titles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "titles_update_own" ON player_titles FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE player_active_quests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "active_quests_select_own" ON player_active_quests;
DROP POLICY IF EXISTS "active_quests_insert_own" ON player_active_quests;
DROP POLICY IF EXISTS "active_quests_delete_own" ON player_active_quests;
CREATE POLICY "active_quests_select_own" ON player_active_quests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "active_quests_insert_own" ON player_active_quests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "active_quests_delete_own" ON player_active_quests FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE player_area_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "area_progress_select_own" ON player_area_progress;
DROP POLICY IF EXISTS "area_progress_insert_own" ON player_area_progress;
DROP POLICY IF EXISTS "area_progress_update_own" ON player_area_progress;
CREATE POLICY "area_progress_select_own" ON player_area_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "area_progress_insert_own" ON player_area_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "area_progress_update_own" ON player_area_progress FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- 5. FUNZIONI
-- ============================================================================

-- 5a. Aggiorna auto_create_profile per creare anche l'area di partenza
CREATE OR REPLACE FUNCTION auto_create_profile_and_resources()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO profiles (user_id, username, player_class, level, current_xp, total_xp)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', 'Eroe'), 'Esploratore', 1, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO player_stats (user_id, total_distance, total_elevation, total_time, forza, agilita, costituzione)
    VALUES (NEW.id, 0, 0, 0, 0, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO player_fantasy_resources (user_id, rupie, cristalli, punti_esplorazione)
    VALUES (NEW.id, 100, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO player_area_progress (user_id, area_id, is_unlocked)
    SELECT NEW.id, id, true FROM fantasy_map_areas WHERE is_starting_area = true
    ON CONFLICT (user_id, area_id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- 5b. Acquista oggetto dal mercante
CREATE OR REPLACE FUNCTION purchase_item(p_user_id uuid, p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_item items_catalog%ROWTYPE; v_res player_fantasy_resources%ROWTYPE;
BEGIN
    SELECT * INTO v_item FROM items_catalog WHERE id = p_item_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Item non trovato'); END IF;

    SELECT * INTO v_res FROM player_fantasy_resources WHERE user_id = p_user_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Risorse non trovate'); END IF;

    IF v_res.rupie < v_item.cost_rupie THEN
        RETURN jsonb_build_object('success', false, 'error', 'Rupie insufficienti');
    END IF;
    IF v_res.cristalli < v_item.cost_cristalli THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cristalli insufficienti');
    END IF;

    INSERT INTO player_items (user_id, item_id, quantity)
    VALUES (p_user_id, p_item_id, 1)
    ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = player_items.quantity + 1;

    UPDATE player_fantasy_resources
    SET rupie = rupie - v_item.cost_rupie, cristalli = cristalli - v_item.cost_cristalli, updated_at = now()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object('success', true, 'item_id', p_item_id, 'name', v_item.name);
END;
$$;

-- 5c. Equipaggia oggetto (max 1 per slot_type, 3 totali)
CREATE OR REPLACE FUNCTION equip_item(p_user_id uuid, p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_item player_items%ROWTYPE; v_catalog items_catalog%ROWTYPE; v_equipped_count int;
BEGIN
    SELECT * INTO v_item FROM player_items WHERE user_id = p_user_id AND item_id = p_item_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Oggetto non posseduto'); END IF;

    SELECT * INTO v_catalog FROM items_catalog WHERE id = p_item_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Catalogo non trovato'); END IF;

    -- Unequip same slot type
    UPDATE player_items SET equipped = false
    WHERE user_id = p_user_id AND item_id IN (
        SELECT pi.item_id FROM player_items pi
        JOIN items_catalog ic ON ic.id = pi.item_id
        WHERE pi.user_id = p_user_id AND pi.equipped = true AND ic.slot_type = v_catalog.slot_type
    );

    -- Equip new item
    UPDATE player_items SET equipped = true WHERE user_id = p_user_id AND item_id = p_item_id;

    SELECT COUNT(*) INTO v_equipped_count FROM player_items WHERE user_id = p_user_id AND equipped = true;

    RETURN jsonb_build_object('success', true, 'item_id', p_item_id, 'slot_type', v_catalog.slot_type, 'total_equipped', v_equipped_count);
END;
$$;

-- 5d. Rimuovi equipaggiamento
CREATE OR REPLACE FUNCTION unequip_item(p_user_id uuid, p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE player_items SET equipped = false WHERE user_id = p_user_id AND item_id = p_item_id;
    RETURN jsonb_build_object('success', true, 'item_id', p_item_id);
END;
$$;

-- 5e. Controlla e assegna nuovi titoli
CREATE OR REPLACE FUNCTION check_player_titles(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_player record;
    v_title record;
    v_awarded jsonb := '[]'::jsonb;
BEGIN
    SELECT
        p.level,
        COALESCE(uqp.quest_count, 0) AS quests_completed,
        COALESCE(ps.total_distance, 0) AS distance,
        COALESCE(ps.total_elevation, 0) AS elevation,
        COALESCE(p.total_xp, 0) AS xp
    INTO v_player
    FROM profiles p
    LEFT JOIN (SELECT user_id, COUNT(*) AS quest_count FROM user_quest_progress GROUP BY user_id) uqp ON uqp.user_id = p.user_id
    LEFT JOIN player_stats ps ON ps.user_id = p.user_id
    WHERE p.user_id = p_user_id;

    IF NOT FOUND THEN RETURN v_awarded; END IF;

    FOR v_title IN SELECT * FROM titles_catalog ORDER BY sort_order LOOP
        IF (v_title.requirement_type = 'level' AND v_player.level >= v_title.requirement_value) OR
           (v_title.requirement_type = 'quests_completed' AND v_player.quests_completed >= v_title.requirement_value) OR
           (v_title.requirement_type = 'total_distance_km' AND v_player.distance >= v_title.requirement_value) OR
           (v_title.requirement_type = 'total_elevation' AND v_player.elevation >= v_title.requirement_value) OR
           (v_title.requirement_type = 'total_xp' AND v_player.xp >= v_title.requirement_value) THEN
            INSERT INTO player_titles (user_id, title_id) VALUES (p_user_id, v_title.id)
            ON CONFLICT (user_id, title_id) DO NOTHING;
            IF FOUND THEN
                v_awarded := v_awarded || jsonb_build_object('title_id', v_title.id, 'name', v_title.name, 'icon', v_title.icon);
            END IF;
        END IF;
    END LOOP;

    RETURN v_awarded;
END;
$$;

-- 5f. Accetta una quest (con controllo limite 2 normali)
CREATE OR REPLACE FUNCTION accept_quest(p_user_id uuid, p_quest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_quest quests%ROWTYPE; v_count int;
BEGIN
    SELECT * INTO v_quest FROM quests WHERE id = p_quest_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Quest non trovata'); END IF;

    IF v_quest.quest_type = 'normal' THEN
        SELECT COUNT(*) INTO v_count FROM player_active_quests
        WHERE user_id = p_user_id AND quest_type = 'normal';
        IF v_count >= 2 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Hai già 2 quest attive. Completane una prima di accettarne un\'altra.');
        END IF;
    END IF;

    INSERT INTO player_active_quests (user_id, quest_id, quest_type)
    VALUES (p_user_id, p_quest_id, v_quest.quest_type)
    ON CONFLICT (user_id, quest_id) DO NOTHING;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quest già accettata');
    END IF;

    RETURN jsonb_build_object('success', true, 'quest_id', p_quest_id, 'title', v_quest.title);
END;
$$;

-- 5g. Completa quest aggiornando progress area e sblocchi
CREATE OR REPLACE FUNCTION complete_quest_and_check_progress(p_user_id uuid, p_quest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_quest quests%ROWTYPE;
    v_area fantasy_map_areas%ROWTYPE;
    v_area_progress player_area_progress%ROWTYPE;
    v_quests_done int;
    v_result jsonb := '{}'::jsonb;
BEGIN
    SELECT * INTO v_quest FROM quests WHERE id = p_quest_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Quest non trovata'); END IF;

    -- Rimuovi dalle attive
    DELETE FROM player_active_quests WHERE user_id = p_user_id AND quest_id = p_quest_id;

    -- Se ha un'area, aggiorna il progresso
    IF v_quest.area_id IS NOT NULL THEN
        SELECT * INTO v_area FROM fantasy_map_areas WHERE id = v_quest.area_id;

        SELECT COUNT(*) INTO v_quests_done FROM user_quest_progress uqp
        JOIN quests q ON q.id = uqp.quest_id
        WHERE uqp.user_id = p_user_id AND q.area_id = v_quest.area_id AND q.quest_type = 'normal';

        UPDATE player_area_progress SET normal_quests_done = v_quests_done
        WHERE user_id = p_user_id AND area_id = v_quest.area_id;

        SELECT * INTO v_area_progress FROM player_area_progress WHERE user_id = p_user_id AND area_id = v_quest.area_id;

        -- Sblocca boss quest se raggiunto il requisito
        IF v_area_progress.id IS NOT NULL AND NOT v_area_progress.is_boss_unlocked
           AND v_quests_done >= v_area.required_quests_completed THEN
            UPDATE player_area_progress SET is_boss_unlocked = true
            WHERE user_id = p_user_id AND area_id = v_quest.area_id;
            v_result := v_result || jsonb_build_object('boss_unlocked', true, 'boss_area', v_area.name);
        END IF;

        -- Se è una quest boss (grande_avventura), completa l'area e sblocca la prossima
        IF v_quest.quest_type = 'grande_avventura' THEN
            UPDATE player_area_progress SET is_completed = true, completed_at = now()
            WHERE user_id = p_user_id AND area_id = v_quest.area_id;

            -- Sblocca area successiva per unlock_order
            UPDATE player_area_progress SET is_unlocked = true
            WHERE user_id = p_user_id AND area_id IN (
                SELECT id FROM fantasy_map_areas WHERE unlock_order = v_area.unlock_order + 1
            );

            v_result := v_result || jsonb_build_object('area_completed', true, 'next_area_unlocked', true);
        END IF;
    END IF;

    -- Controlla titoli
    v_result := v_result || jsonb_build_object('titles', check_player_titles(p_user_id));

    RETURN jsonb_build_object('success', true, 'quest_id', p_quest_id) || v_result;
END;
$$;

-- ============================================================================
-- 6. SEED DATA — OGGETTI
-- ============================================================================

INSERT INTO items_catalog (name, description, icon, slot_type, effect_type, effect_value, cost_rupie, cost_cristalli, rarity) VALUES
('Bussola d''Oriente',       'Aumenta del 10% l''XP guadagnato completando le quest.',     '🧭', 'tool',     'xp_bonus', 10,   200, 0, 'uncommon'),
('Corda dell''Alpinista',    'Riduce del 20% il dislivello richiesto per la validazione.',  '🪢', 'tool',     'elevation_reduction', 20, 150, 0, 'uncommon'),
('Mappa Antica',             'Sblocca un''area senza completarne i requisiti.',              '📜', 'tool',     'area_unlock', 1, 500, 3, 'rare'),
('Scarpe della Velocità',    'Aumenta del 10% la velocità massima consentita per validare.', '👟', 'footwear', 'speed_bonus', 10, 300, 0, 'uncommon'),
('Copertone Rinforzato',     'Riduce del 15% la fatica sulle lunghe distanze in MTB.',      '⚙️', 'footwear', 'mtb_endurance', 15, 250, 0, 'common'),
('Amuleto del Vigore',       'Concede +1 Costituzione alla fine della Grande Avventura.',   '📿', 'amulet',   'stat_bonus', 1, 400, 2, 'rare'),
('Pozione della Forza',      '+2 Forza temporanea per la prossima uscita.',                  '🧪', 'amulet',   'temp_stat', 2, 100, 1, 'common'),
('Cristallo della Memoria',  'Salva un punto di ritorno durante il tracciato GPS.',          '💎', 'amulet',   'waypoint_save', 1, 0, 2, 'rare')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. SEED DATA — TITOLI
-- ============================================================================

INSERT INTO titles_catalog (name, description, icon, requirement_type, requirement_value, sort_order) VALUES
('Novizio',             'Benvenuto nella gilda, giovane avventuriero.',                    '🌱', 'level', 1, 1),
('Avventuriero',        'Hai dimostrato di saper affrontare le sfide del mondo.',         '⚔️',  'level', 5, 2),
('Esploratore Esperto', 'Le terre selvagge non hanno più segreti per te.',                '🗺️',  'level', 10, 3),
('Maestro della Gilda', 'Un punto di riferimento per tutti gli avventurieri.',            '🏰', 'level', 15, 4),
('Leggenda Vivente',    'Il tuo nome è inciso nella pietra della storia.',                '🌟', 'level', 20, 5),
('Cacciatore di Missioni', '10 quest completate. La bacheca ti ringrazia.',               '📋', 'quests_completed', 10, 6),
('Eroe del Popolo',     '50 quest completate. Il popolo canta le tue gesta.',              '👑', 'quests_completed', 50, 7),
('Camminatore Infaticabile', '500 km percorsi. Le tue gambe sono d''acciaio.',           '🦵', 'total_distance_km', 500, 8),
('Maratoneta Leggendario', '1.000 km percorsi. Nessuna distanza ti spaventa.',           '🏃', 'total_distance_km', 1000, 9),
('Scalatore delle Vette','10.000 m di dislivello superati. Le montagne si inchinano.',    '⛰️', 'total_elevation', 10000, 10),
('Signore dell''Altitudine','50.000 m di dislivello. Il cielo è il tuo limite.',         '☁️', 'total_elevation', 50000, 11),
('Cercatore di Saggezza','100.000 XP totali. La conoscenza è potere.',                    '📖', 'total_xp', 100000, 12)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 8. AGGIORNA AREE CON DATI DI PROGRESSIONE
-- ============================================================================

UPDATE fantasy_map_areas SET is_starting_area = true, required_quests_completed = 5, unlock_order = 1
WHERE name = 'Foresta dei Sussurri';
UPDATE fantasy_map_areas SET required_quests_completed = 0, unlock_order = 2
WHERE name = 'Gola del Tuono';
UPDATE fantasy_map_areas SET required_quests_completed = 0, unlock_order = 3
WHERE name = 'Lago Cristallino';
UPDATE fantasy_map_areas SET required_quests_completed = 0, unlock_order = 4
WHERE name = 'Passo dell''Aquila';
UPDATE fantasy_map_areas SET required_quests_completed = 0, unlock_order = 5
WHERE name = 'Caverne di Cristallo';
UPDATE fantasy_map_areas SET required_quests_completed = 0, unlock_order = 6
WHERE name = 'Rovine Antiche';
UPDATE fantasy_map_areas SET required_quests_completed = 0, unlock_order = 7
WHERE name = 'Vetta del Drago';

-- ============================================================================
-- 9. ASSEGNA QUEST ESISTENTI ALL'AREA 1 (Foresta dei Sussurri)
-- ============================================================================

DO $$
DECLARE v_area_id uuid;
BEGIN
    SELECT id INTO v_area_id FROM fantasy_map_areas WHERE name = 'Foresta dei Sussurri';
    IF v_area_id IS NOT NULL THEN
        UPDATE quests SET area_id = v_area_id, quest_type = 'normal', sort_order = 1 WHERE title = 'Anello del Lago Nero';
        UPDATE quests SET area_id = v_area_id, quest_type = 'normal', sort_order = 2 WHERE title = 'Sentiero dei Contrabbandieri';
        UPDATE quests SET area_id = v_area_id, quest_type = 'normal', sort_order = 3 WHERE title = 'Discesa Fulmine';
        UPDATE quests SET area_id = v_area_id, quest_type = 'normal', sort_order = 4 WHERE title = 'Ascesa della Capra';
        UPDATE quests SET area_id = v_area_id, quest_type = 'normal', sort_order = 5 WHERE title = 'Scalatore Puro';
    END IF;
END $$;

-- ============================================================================
-- 10. CREA QUEST BOSS AREA 1 (Grande Avventura — Capitolo 1)
-- ============================================================================

DO $$
DECLARE
    v_area_id uuid;
    v_region_id uuid;
    v_quest_id uuid;
    v_boss_exists boolean;
BEGIN
    SELECT id INTO v_area_id FROM fantasy_map_areas WHERE name = 'Foresta dei Sussurri';
    SELECT id INTO v_region_id FROM regions WHERE name = 'Valli di Lanzo';

    -- Controlla se già esiste
    SELECT EXISTS (SELECT 1 FROM quests WHERE title = 'La Caccia al Drago d''Oro: Il Custode della Foresta') INTO v_boss_exists;

    IF NOT v_boss_exists AND v_area_id IS NOT NULL AND v_region_id IS NOT NULL THEN
        INSERT INTO quests (title, region_id, type, quest_type, difficulty, xp_reward, distance, elevation, coords, description, npc_dialogue, lore, area_id, sort_order, is_story, chapter_number)
        VALUES (
            'La Caccia al Drago d''Oro: Il Custode della Foresta',
            v_region_id,
            'trekking',
            'grande_avventura',
            4, 800, 14.0, 600,
            '[[45.2850,7.5620],[45.2870,7.5640],[45.2890,7.5660],[45.2910,7.5650],[45.2920,7.5630],[45.2900,7.5610],[45.2880,7.5600],[45.2860,7.5610],[45.2850,7.5620]]'::jsonb,
            'Una luce dorata si leva dalla foresta. Il Custode, un antico spirito arboreo, ha risvegliato gli alberi. Devi attraversare il cuore della foresta e placare la sua ira per proseguire il tuo viaggio.',
            '"Così sei tu il nuovo avventuriero di cui parlano gli uccelli? La foresta ha deciso di metterti alla prova. Segui il sentiero di luce tra gli alberi e dimostra il tuo valore. Solo allora ti sarà concesso il passaggio verso le terre oltre."',
            'La leggenda narra che il Custode della Foresta sia nato da una ghianda caduta nella terra dove cadde la prima lacrima di un drago. Da millenni protegge il confine tra la foresta e le terre selvagge, e solo chi ne ottiene la benedizione può proseguire oltre.',
            v_area_id, 0, true, 1
        )
        RETURNING id INTO v_quest_id;

        UPDATE fantasy_map_areas SET boss_quest_id = v_quest_id WHERE id = v_area_id;
    END IF;
END $$;

-- ============================================================================
-- 11. BACKFILL area progress per utenti esistenti
-- ============================================================================

INSERT INTO player_area_progress (user_id, area_id, is_unlocked)
SELECT au.id, fma.id, true
FROM auth.users au
CROSS JOIN fantasy_map_areas fma
WHERE fma.is_starting_area = true
AND au.id NOT IN (SELECT user_id FROM player_area_progress)
ON CONFLICT (user_id, area_id) DO NOTHING;

-- ============================================================================
-- 12. BACKFILL titoli per utenti esistenti
-- ============================================================================

-- Nota: il frontend chiamerà check_player_titles() al login
-- per tutti gli utenti esistenti, assegnando i titoli arretrati.
