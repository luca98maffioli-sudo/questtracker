-- ============================================================================
-- FULL SCHEMA: gandalf
-- Esegui tutto in una volta nell'SQL Editor di Supabase
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS gandalf;
SET search_path TO gandalf;

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username text NOT NULL,
    player_class text,
    level integer NOT NULL DEFAULT 1,
    current_xp integer NOT NULL DEFAULT 0,
    total_xp integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_profile UNIQUE (user_id)
);

-- 2. REGIONS
CREATE TABLE IF NOT EXISTS regions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. QUESTS (mondo reale)
CREATE TABLE IF NOT EXISTS quests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    region_id uuid REFERENCES regions(id) ON DELETE SET NULL,
    type text NOT NULL CHECK (type IN ('trekking', 'mtb', 'corsa', 'camminata')),
    difficulty integer NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
    xp_reward integer NOT NULL DEFAULT 0,
    distance numeric(10,2) NOT NULL DEFAULT 0,
    elevation integer NOT NULL DEFAULT 0,
    coords jsonb NOT NULL DEFAULT '[]',
    description text,
    npc_dialogue text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. USER QUEST PROGRESS
CREATE TABLE IF NOT EXISTS user_quest_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quest_id uuid NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    completed_at timestamptz NOT NULL DEFAULT now(),
    stats jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_quest UNIQUE (user_id, quest_id)
);

-- 5. PLAYER STATS (con attributi GDR)
CREATE TABLE IF NOT EXISTS player_stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_distance numeric(10,2) NOT NULL DEFAULT 0,
    total_elevation integer NOT NULL DEFAULT 0,
    total_time integer NOT NULL DEFAULT 0,
    forza integer NOT NULL DEFAULT 0,
    agilita integer NOT NULL DEFAULT 0,
    costituzione integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_stats UNIQUE (user_id)
);

-- 6. TRACKED ACTIVITIES
CREATE TABLE IF NOT EXISTS tracked_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quest_id uuid REFERENCES quests(id) ON DELETE SET NULL,
    activity_type text NOT NULL,
    distance_km numeric(10,2),
    elevation_m numeric(10,2),
    duration_minutes numeric(10,2),
    avg_speed_kmh numeric(5,2),
    track_points jsonb NOT NULL DEFAULT '[]',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. PLAYER FANTASY RESOURCES (Fase 1B)
CREATE TABLE IF NOT EXISTS player_fantasy_resources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rupie bigint NOT NULL DEFAULT 0,
    cristalli bigint NOT NULL DEFAULT 0,
    punti_esplorazione bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_fantasy_resources UNIQUE (user_id)
);

-- 8. BRIDGE RULES (Fase 1B)
CREATE TABLE IF NOT EXISTS bridge_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name text NOT NULL UNIQUE,
    description text NOT NULL,
    conditions jsonb NOT NULL DEFAULT '{}',
    effects jsonb NOT NULL DEFAULT '{}',
    priority integer NOT NULL DEFAULT 0,
    cooldown_minutes integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. PLAYER BRIDGE TRIGGERS (Fase 1B)
CREATE TABLE IF NOT EXISTS player_bridge_triggers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_id uuid NOT NULL,
    rule_id uuid NOT NULL REFERENCES bridge_rules(id) ON DELETE CASCADE,
    activity_type text NOT NULL,
    effects_applied jsonb NOT NULL DEFAULT '{}',
    executed_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_activity_rule UNIQUE (activity_id, rule_id)
);

CREATE INDEX IF NOT EXISTS idx_bridge_triggers_user ON player_bridge_triggers(user_id);
CREATE INDEX IF NOT EXISTS idx_bridge_triggers_activity ON player_bridge_triggers(activity_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stats_select_own" ON player_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "stats_update_own" ON player_stats FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE tracked_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activities_select_own" ON tracked_activities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "activities_insert_own" ON tracked_activities FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE player_fantasy_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resources_select_own" ON player_fantasy_resources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "resources_insert_own" ON player_fantasy_resources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "resources_update_own" ON player_fantasy_resources FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE bridge_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bridge_rules_read_all" ON bridge_rules FOR SELECT TO authenticated USING (true);

ALTER TABLE player_bridge_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "triggers_select_own" ON player_bridge_triggers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "triggers_insert_own" ON player_bridge_triggers FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regions_read_all" ON regions FOR SELECT TO authenticated USING (true);

ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quests_read_all" ON quests FOR SELECT TO authenticated USING (true);

ALTER TABLE user_quest_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress_select_own" ON user_quest_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "progress_insert_own" ON user_quest_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "progress_update_own" ON user_quest_progress FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-create profilo, stats e risorse al signup
CREATE OR REPLACE FUNCTION gandalf.auto_create_profile_and_resources()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO gandalf
AS $$
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

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_profile ON auth.users;
CREATE TRIGGER trg_auto_create_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION gandalf.auto_create_profile_and_resources();

-- Update timestamp automatico
CREATE OR REPLACE FUNCTION gandalf.update_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO gandalf
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_player_stats_timestamp
    BEFORE UPDATE ON player_stats
    FOR EACH ROW
    EXECUTE FUNCTION gandalf.update_timestamp();

CREATE TRIGGER trg_update_fantasy_resources_timestamp
    BEFORE UPDATE ON player_fantasy_resources
    FOR EACH ROW
    EXECUTE FUNCTION gandalf.update_timestamp();

-- Bridge engine: applica regole di conversione su un'attività completata
CREATE OR REPLACE FUNCTION gandalf.apply_bridge_rules(
    p_user_id uuid,
    p_activity_id uuid,
    p_activity_type text,
    p_stats jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO gandalf
AS $$
DECLARE
    v_rule record;
    v_effects jsonb := '{}'::jsonb;
    v_applied_effects jsonb := '{}'::jsonb;
    v_effect_key text;
    v_effect_value int;
    v_cooldown_ok boolean;
BEGIN
    FOR v_rule IN
        SELECT * FROM bridge_rules
        WHERE is_active = true
        ORDER BY priority DESC
    LOOP
        SELECT NOT EXISTS (
            SELECT 1 FROM player_bridge_triggers
            WHERE user_id = p_user_id
              AND rule_id = v_rule.id
              AND executed_at > now() - (v_rule.cooldown_minutes || ' minutes')::interval
        ) INTO v_cooldown_ok;

        IF NOT v_cooldown_ok THEN CONTINUE; END IF;

        IF v_rule.conditions ? 'activity_type' THEN
            IF NOT (p_activity_type = ANY (ARRAY(SELECT jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(v_rule.conditions->'activity_type') = 'array'
                     THEN v_rule.conditions->'activity_type'
                     ELSE to_jsonb(ARRAY[v_rule.conditions->>'activity_type'])
                END
            )))) THEN CONTINUE; END IF;
        END IF;

        IF v_rule.conditions ? 'min_distance_km' AND (p_stats->>'distance_km')::numeric < (v_rule.conditions->>'min_distance_km')::numeric THEN CONTINUE; END IF;
        IF v_rule.conditions ? 'min_elevation' AND (p_stats->>'elevation_m')::numeric < (v_rule.conditions->>'min_elevation')::numeric THEN CONTINUE; END IF;
        IF v_rule.conditions ? 'min_duration_minutes' AND (p_stats->>'duration_minutes')::numeric < (v_rule.conditions->>'min_duration_minutes')::numeric THEN CONTINUE; END IF;
        IF v_rule.conditions ? 'min_avg_speed_kmh' AND (p_stats->>'avg_speed_kmh')::numeric < (v_rule.conditions->>'min_avg_speed_kmh')::numeric THEN CONTINUE; END IF;

        v_applied_effects := v_rule.effects;

        FOR v_effect_key, v_effect_value IN SELECT * FROM jsonb_each_text(v_rule.effects)
        LOOP
            v_effects := jsonb_set(
                v_effects,
                ARRAY[v_effect_key],
                to_jsonb(COALESCE((v_effects->>v_effect_key)::int, 0) + v_effect_value)
            );
        END LOOP;

        INSERT INTO player_bridge_triggers (user_id, activity_id, rule_id, activity_type, effects_applied)
        VALUES (p_user_id, p_activity_id, v_rule.id, p_activity_type, v_applied_effects)
        ON CONFLICT (activity_id, rule_id) DO NOTHING;
    END LOOP;

    UPDATE player_stats
    SET
        forza = forza + COALESCE((v_effects->>'forza')::int, 0),
        agilita = agilita + COALESCE((v_effects->>'agilita')::int, 0),
        costituzione = costituzione + COALESCE((v_effects->>'costituzione')::int, 0),
        updated_at = now()
    WHERE user_id = p_user_id;

    UPDATE player_fantasy_resources
    SET
        rupie = rupie + COALESCE((v_effects->>'rupie')::int, 0),
        cristalli = cristalli + COALESCE((v_effects->>'cristalli')::int, 0),
        punti_esplorazione = punti_esplorazione + COALESCE((v_effects->>'punti_esplorazione')::int, 0),
        updated_at = now()
    WHERE user_id = p_user_id;

    RETURN v_effects;
END;
$$;

-- Calcolo Punti Esplorazione passivi
CREATE OR REPLACE FUNCTION gandalf.calculate_passive_exploration_points(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO gandalf
AS $$
DECLARE
    v_total_minutes numeric;
BEGIN
    SELECT COALESCE(SUM(duration_minutes), 0) INTO v_total_minutes
    FROM tracked_activities
    WHERE user_id = p_user_id
      AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM now());

    RETURN floor(v_total_minutes / 30)::integer;
END;
$$;

-- ============================================================================
-- SEED DATA
-- ============================================================================

INSERT INTO regions (name, description) VALUES
    ('Valli di Lanzo', 'Valli alpine del Piemonte, ideali per trekking e MTB'),
    ('Alta Via', 'Percorsi d''alta quota con dislivelli significativi'),
    ('Parco Naturale', 'Aree protette con sentieri boschivi e panorami'),
    ('Alpi', 'Le montagne più alte d''Europa: ghiacciai, pareti verticali e aria sottile')
ON CONFLICT DO NOTHING;

INSERT INTO quests (title, region_id, type, difficulty, xp_reward, distance, elevation, coords, description, npc_dialogue)
SELECT 'Anello del Lago Nero', r.id, 'trekking', 2, 250, 8.5, 450,
    '[[45.2850,7.5620],[45.2870,7.5640],[45.2890,7.5660],[45.2910,7.5650],[45.2920,7.5630],[45.2900,7.5610],[45.2880,7.5600],[45.2860,7.5610],[45.2850,7.5620]]'::jsonb,
    'Un anello di acque scure circonda la foresta incantata. I pescatori parlano di luci che danzano sulla superficie nelle notti di luna piena.',
    '"Ah, finalmente un''avventuriero! Il Lago Nero è irrequeto da settimane. Portami prove del tuo passaggio e ti ricompenserò!"'
FROM regions r WHERE r.name = 'Valli di Lanzo'
ON CONFLICT DO NOTHING;

INSERT INTO quests (title, region_id, type, difficulty, xp_reward, distance, elevation, coords, description, npc_dialogue)
SELECT 'Sentiero dei Contrabbandieri', r.id, 'trekking', 4, 600, 15.2, 1200,
    '[[45.3200,7.6100],[45.3220,7.6150],[45.3250,7.6200],[45.3280,7.6180],[45.3300,7.6150],[45.3280,7.6120],[45.3250,7.6100]]'::jsonb,
    'Un antico sentiero usato dai contrabbandieri tra picchi aguzzi e passaggi stretti.',
    '"Sssst! Non parlarne troppo forte. Quel sentiero nasconde più segreti di quanti tu possa immaginare. Arriva in cima e portami una prova. E prega di non incontrare ciò che ci abita."'
FROM regions r WHERE r.name = 'Alta Via'
ON CONFLICT DO NOTHING;

INSERT INTO quests (title, region_id, type, difficulty, xp_reward, distance, elevation, coords, description, npc_dialogue)
SELECT 'Discesa Fulmine', r.id, 'mtb', 3, 400, 12.0, 300,
    '[[45.2500,7.5800],[45.2520,7.5850],[45.2540,7.5900],[45.2560,7.5950],[45.2580,7.6000]]'::jsonb,
    'Una discesa mozzafiato attraverso i boschi. Il vento fischia tra i rami mentre la montagna precipita verso la valle.',
    '"Ehi, tu! Scommetto che non hai il coraggio di fare la Discesa Fulmine in meno di un''ora. Se ce la fai, ti insegno il trucco per saltare il ruscello!"'
FROM regions r WHERE r.name = 'Parco Naturale'
ON CONFLICT DO NOTHING;

INSERT INTO quests (title, region_id, type, difficulty, xp_reward, distance, elevation, coords, description, npc_dialogue)
SELECT 'Scalatore Puro', r.id, 'trekking', 5, 1500, 20.0, 5000,
    '[
        [45.8550,7.8620],[45.8600,7.8700],[45.8680,7.8780],[45.8750,7.8850],
        [45.8820,7.8920],[45.8900,7.8980],[45.8970,7.9050],[45.9050,7.9100],
        [45.9120,7.9150],[45.9200,7.9180],[45.9270,7.9200],[45.9350,7.9220],
        [45.9420,7.9180],[45.9480,7.9120],[45.9400,7.9020],[45.9320,7.8950],
        [45.9250,7.8880],[45.9180,7.8800],[45.9100,7.8720],[45.9020,7.8650]
    ]'::jsonb,
    'Sfida estrema: 20 km con 5000 m di dislivello positivo attraverso ghiacciai, creste e pareti verticali del Monte Rosa. Solo i veri alpinisti sopravvivono a questa prova.',
    '"Pochi hanno accettato la sfida dello Scalatore Puro. Ancora meno sono tornati indietro. Le gambe ti bruceranno, i polmoni ti imploreranno pietà, ma se arriverai in cima, il tuo nome sarà inciso nella pietra. — Lo Stregone della Montagna"'
FROM regions r WHERE r.name = 'Alpi'
ON CONFLICT DO NOTHING;

INSERT INTO bridge_rules (rule_name, description, conditions, effects, priority, cooldown_minutes) VALUES
(
    'forza_trekking_salita',
    'Trekking con dislivello > 300m: assegna Forza',
    '{"activity_type": "trekking", "min_elevation": 300}',
    '{"forza": 2, "rupie": 30}',
    10, 0
),
(
    'costituzione_trekking_lungo',
    'Trekking con distanza > 8km: assegna Costituzione',
    '{"activity_type": "trekking", "min_distance_km": 8}',
    '{"costituzione": 1, "rupie": 20}',
    10, 0
),
(
    'agilita_mtb_veloce',
    'MTB con velocità media > 15km/h: assegna Agilità',
    '{"activity_type": "mtb", "min_avg_speed_kmh": 15}',
    '{"agilita": 2, "rupie": 40}',
    10, 0
),
(
    'costituzione_attivita_lunga',
    'Attività con durata > 90 minuti: assegna Costituzione',
    '{"min_duration_minutes": 90}',
    '{"costituzione": 1, "punti_esplorazione": 5}',
    5, 0
),
(
    'cristalli_dislivello_epico',
    'Dislivello > 800m in singola attività: ricompensa Cristalli',
    '{"min_elevation": 800}',
    '{"cristalli": 1, "forza": 3, "rupie": 100}',
    20, 0
),
(
    'esplorazione_completamento',
    'Completamento di qualsiasi attività tracciata: Punti Esplorazione base',
    '{"activity_type": ["trekking", "mtb", "corsa", "camminata"]}',
    '{"punti_esplorazione": 2}',
    1, 0
),
(
    'rupie_mtb_distanza',
    'MTB con distanza > 20km: ricompensa Rupie extra',
    '{"activity_type": "mtb", "min_distance_km": 20}',
    '{"rupie": 80, "agilita": 1}',
    10, 0
),
(
    'costituzione_camminata',
    'Camminata con distanza > 5km: Costituzione leggera',
    '{"activity_type": "camminata", "min_distance_km": 5}',
    '{"costituzione": 1, "rupie": 10}',
    10, 0
)
ON CONFLICT (rule_name) DO NOTHING;

-- ============================================================================
-- BACKFILL: per utenti già registrati prima della migration
-- ============================================================================

INSERT INTO profiles (user_id, username, player_class, level, current_xp, total_xp)
SELECT id, COALESCE(raw_user_meta_data->>'username', 'Eroe'), 'Esploratore', 1, 0, 0
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM profiles)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO player_stats (user_id, total_distance, total_elevation, total_time, forza, agilita, costituzione)
SELECT id, 0, 0, 0, 0, 0, 0
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM player_stats)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO player_fantasy_resources (user_id, rupie, cristalli, punti_esplorazione)
SELECT id, 100, 0, 0
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM player_fantasy_resources)
ON CONFLICT (user_id) DO NOTHING;
