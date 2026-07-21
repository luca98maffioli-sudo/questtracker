-- ============================================================================
-- 008: Fase 4 — Mercante rotazione, Sentieri mappa, Eventi random
-- Esegui DOPO 007_monsters.sql
-- ============================================================================

-- ============================================================================
-- 4a — ROTAZIONE MERCANTE
-- ============================================================================

ALTER TABLE items_catalog ADD COLUMN IF NOT EXISTS is_on_sale boolean NOT NULL DEFAULT false;
ALTER TABLE items_catalog ADD COLUMN IF NOT EXISTS sale_price_rupie integer;

-- Ruota le offerte del mercante: resetta tutto, poi sceglie 2 oggetti a caso
-- e li marca con is_on_sale = true e sconto del 30% (arrotondato).
CREATE OR REPLACE FUNCTION rotate_merchant_offers()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE items_catalog SET is_on_sale = false, sale_price_rupie = NULL;

    UPDATE items_catalog
    SET is_on_sale = true,
        sale_price_rupie = GREATEST(1, ROUND(cost_rupie * 0.7))
    WHERE id IN (
        SELECT id FROM items_catalog
        ORDER BY random()
        LIMIT 2
    );
END;
$$;

-- ============================================================================
-- 4b — SENTIERI MAPPA FANTASY
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_map_paths (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    from_area_id uuid NOT NULL REFERENCES fantasy_map_areas(id) ON DELETE CASCADE,
    to_area_id uuid NOT NULL REFERENCES fantasy_map_areas(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fantasy_map_paths ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "paths_read_all" ON fantasy_map_paths;
CREATE POLICY "paths_read_all" ON fantasy_map_paths
    FOR SELECT TO anon, authenticated USING (true);

-- Seed sentieri: collega le aree in ordine di progressione (+ qualche diagonale)
INSERT INTO fantasy_map_paths (from_area_id, to_area_id)
SELECT a1.id, a2.id FROM fantasy_map_areas a1, fantasy_map_areas a2 WHERE a1.name = 'Foresta dei Sussurri' AND a2.name = 'Gola del Tuono'
UNION SELECT a1.id, a2.id FROM fantasy_map_areas a1, fantasy_map_areas a2 WHERE a1.name = 'Foresta dei Sussurri' AND a2.name = 'Lago Cristallino'
UNION SELECT a1.id, a2.id FROM fantasy_map_areas a1, fantasy_map_areas a2 WHERE a1.name = 'Gola del Tuono' AND a2.name = 'Caverne di Cristallo'
UNION SELECT a1.id, a2.id FROM fantasy_map_areas a1, fantasy_map_areas a2 WHERE a1.name = 'Gola del Tuono' AND a2.name = 'Passo dell''Aquila'
UNION SELECT a1.id, a2.id FROM fantasy_map_areas a1, fantasy_map_areas a2 WHERE a1.name = 'Lago Cristallino' AND a2.name = 'Rovine Antiche'
UNION SELECT a1.id, a2.id FROM fantasy_map_areas a1, fantasy_map_areas a2 WHERE a1.name = 'Passo dell''Aquila' AND a2.name = 'Vetta del Drago'
UNION SELECT a1.id, a2.id FROM fantasy_map_areas a1, fantasy_map_areas a2 WHERE a1.name = 'Caverne di Cristallo' AND a2.name = 'Vetta del Drago'
UNION SELECT a1.id, a2.id FROM fantasy_map_areas a1, fantasy_map_areas a2 WHERE a1.name = 'Rovine Antiche' AND a2.name = 'Vetta del Drago'
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_paths_from ON fantasy_map_paths(from_area_id);
CREATE INDEX IF not EXISTS idx_paths_to ON fantasy_map_paths(to_area_id);

-- ============================================================================
-- 4c — EVENTI RANDOM MAPPA
-- ============================================================================

CREATE TABLE IF NOT EXISTS map_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id uuid NOT NULL REFERENCES fantasy_map_areas(id) ON DELETE CASCADE,
    event_type text NOT NULL CHECK (event_type IN ('merchant', 'double_xp', 'boss_respawn')),
    title text NOT NULL,
    description text,
    duration_hours integer NOT NULL DEFAULT 48,
    reward_rupie integer NOT NULL DEFAULT 0,
    reward_cristalli integer NOT NULL DEFAULT 0,
    reward_pe integer NOT NULL DEFAULT 0,
    collected_by uuid[] NOT NULL DEFAULT '{}',
    spawned_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours')
);

ALTER TABLE map_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "events_select_all" ON map_events;
DROP POLICY IF EXISTS "events_update_own" ON map_events;
CREATE POLICY "events_select_all" ON map_events
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "events_update_own" ON map_events
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_events_expires ON map_events(expires_at);
CREATE INDEX IF NOT EXISTS idx_events_area ON map_events(area_id);

-- Genera un evento casuale su un'area già scoperta da almeno un utente.
CREATE OR REPLACE FUNCTION spawn_random_event()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_area_id uuid;
    v_event_type text;
    v_title text;
    v_desc text;
    v_rupie int := 0;
    v_cristalli int := 0;
    v_pe int := 0;
BEGIN
    -- Sceglie un'area a caso tra quelle già scoperte
    SELECT area_id INTO v_area_id FROM player_map_discoveries
    GROUP BY area_id ORDER BY random() LIMIT 1;

    IF v_area_id IS NULL THEN
        -- Nessuna area scoperta: sceglie la starting area
        SELECT id INTO v_area_id FROM fantasy_map_areas WHERE is_starting_area = true;
    END IF;

    -- Sceglie tipo evento
    v_event_type := (ARRAY['merchant', 'double_xp', 'boss_respawn'])[floor(random() * 3 + 1)];

    CASE v_event_type
        WHEN 'merchant' THEN
            v_title := 'Mercante Itinerante';
            v_desc := 'Un mercante errante ha allestito il banco in quest''area. Offre merci rare a prezzi scontati!';
            v_rupie := 50;
            v_cristalli := 1;
        WHEN 'double_xp' THEN
            v_title := 'Zona XP Raddoppiato';
            v_desc := 'Un''antica aureola di potere avvolge quest''area. Le quest completate qui daranno il doppio dell''XP!';
            v_pe := 10;
        WHEN 'boss_respawn' THEN
            v_title := 'Eco del Boss';
            v_desc := 'Un''eco del boss riecheggia tra le montagne. Chi lo ha già sconfitto può raccogliere una ricompensa extra!';
            v_rupie := 100;
            v_cristalli := 2;
    END CASE;

    INSERT INTO map_events (area_id, event_type, title, description, duration_hours, reward_rupie, reward_cristalli, reward_pe, expires_at)
    VALUES (v_area_id, v_event_type, v_title, v_desc, 48, v_rupie, v_cristalli, v_pe, now() + interval '48 hours');

    RETURN jsonb_build_object('success', true, 'area_id', v_area_id, 'event_type', v_event_type);
END;
$$;

-- Raccoglie ricompensa di un evento (se non già raccolto).
CREATE OR REPLACE FUNCTION collect_event_reward(p_user_id uuid, p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_event map_events%ROWTYPE;
    v_res player_fantasy_resources%ROWTYPE;
BEGIN
    SELECT * INTO v_event FROM map_events WHERE id = p_event_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Evento non trovato');
    END IF;

    IF v_event.expires_at < now() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Evento scaduto');
    END IF;

    IF p_user_id = ANY(v_event.collected_by) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ricompensa già raccolta');
    END IF;

    UPDATE player_fantasy_resources
    SET
        rupie = rupie + v_event.reward_rupie,
        cristalli = cristalli + v_event.reward_cristalli,
        punti_esplorazione = punti_esplorazione + v_event.reward_pe,
        updated_at = now()
    WHERE user_id = p_user_id;

    UPDATE map_events
    SET collected_by = array_append(collected_by, p_user_id)
    WHERE id = p_event_id;

    RETURN jsonb_build_object('success', true,
        'rupie', v_event.reward_rupie,
        'cristalli', v_event.reward_cristalli,
        'pe', v_event.reward_pe);
END;
$$;

-- ============================================================================
-- SCHEDULAZIONE pg_cron (solo su progetto Supabase che lo supporta)
-- ============================================================================

-- Ogni lunedì alle 03:00 ruota le offerte del mercante
SELECT cron.schedule('rotate-merchant-offers', '0 3 * * 1', 'SELECT rotate_merchant_offers();');

-- Ogni 24 ore genera un nuovo evento casuale
SELECT cron.schedule('spawn-random-event', '0 6 * * *', 'SELECT spawn_random_event();');
