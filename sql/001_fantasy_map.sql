-- ============================================================================
-- FANTASY MAP (Fase 1C)
-- SCHEMA: gandalf
-- Esegui nell'SQL Editor dopo 000_full_schema_gandalf.sql
-- ============================================================================

SET search_path TO gandalf;

-- Aree della mappa fantasy (ciascuna copre una zona sulla mappa)
CREATE TABLE IF NOT EXISTS fantasy_map_areas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    lore_text text,
    area_type text NOT NULL DEFAULT 'wilderness' CHECK (area_type IN ('wilderness', 'dungeon', 'boss', 'town', 'landmark')),
    pos_x numeric NOT NULL CHECK (pos_x BETWEEN 0 AND 100),
    pos_y numeric NOT NULL CHECK (pos_y BETWEEN 0 AND 100),
    size_x numeric NOT NULL DEFAULT 15 CHECK (size_x BETWEEN 5 AND 50),
    size_y numeric NOT NULL DEFAULT 15 CHECK (size_y BETWEEN 5 AND 50),
    exploration_cost integer NOT NULL DEFAULT 10 CHECK (exploration_cost >= 0),
    required_forza integer NOT NULL DEFAULT 0,
    required_agilita integer NOT NULL DEFAULT 0,
    required_costituzione integer NOT NULL DEFAULT 0,
    is_boss boolean NOT NULL DEFAULT false,
    rupie_reward integer NOT NULL DEFAULT 0,
    cristalli_reward integer NOT NULL DEFAULT 0,
    -- Per i dungeon: id della quest fantasy associata (Fase 1C+)
    quest_id uuid,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Scoperte del giocatore (fog-of-war)
CREATE TABLE IF NOT EXISTS player_map_discoveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    area_id uuid NOT NULL REFERENCES fantasy_map_areas(id) ON DELETE CASCADE,
    revealed_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_player_area UNIQUE (user_id, area_id)
);

-- RLS
ALTER TABLE fantasy_map_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fantasy_areas_read_all" ON fantasy_map_areas FOR SELECT TO authenticated USING (true);

ALTER TABLE player_map_discoveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "discoveries_select_own" ON player_map_discoveries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "discoveries_insert_own" ON player_map_discoveries FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Funzione: rivela un'area consumando Punti Esplorazione
CREATE OR REPLACE FUNCTION reveal_map_area(p_user_id uuid, p_area_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO gandalf
AS $$
DECLARE
    v_area fantasy_map_areas%ROWTYPE;
    v_resources player_fantasy_resources%ROWTYPE;
BEGIN
    SELECT * INTO v_area FROM fantasy_map_areas WHERE id = p_area_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Area non trovata');
    END IF;

    IF EXISTS (SELECT 1 FROM player_map_discoveries WHERE user_id = p_user_id AND area_id = p_area_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Area già scoperta');
    END IF;

    SELECT * INTO v_resources FROM player_fantasy_resources WHERE user_id = p_user_id;
    IF NOT FOUND OR v_resources.punti_esplorazione < v_area.exploration_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Punti Esplorazione insufficienti');
    END IF;

    IF v_area.required_forza > 0 THEN
        IF NOT EXISTS (SELECT 1 FROM player_stats WHERE user_id = p_user_id AND forza >= v_area.required_forza) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Forza insufficiente: serve ' || v_area.required_forza);
        END IF;
    END IF;

    UPDATE player_fantasy_resources
    SET
        punti_esplorazione = punti_esplorazione - v_area.exploration_cost,
        rupie = rupie + v_area.rupie_reward,
        cristalli = cristalli + v_area.cristalli_reward,
        updated_at = now()
    WHERE user_id = p_user_id;

    INSERT INTO player_map_discoveries (user_id, area_id) VALUES (p_user_id, p_area_id);

    RETURN jsonb_build_object(
        'success', true,
        'area_name', v_area.name,
        'cost', v_area.exploration_cost,
        'rupie_reward', v_area.rupie_reward,
        'cristalli_reward', v_area.cristalli_reward
    );
END;
$$;

-- Seed: aree della mappa fantasy
INSERT INTO fantasy_map_areas (name, description, lore_text, area_type, pos_x, pos_y, exploration_cost, required_forza, rupie_reward) VALUES
(
    'Foresta dei Sussurri',
    'Una foresta antica dove gli alberi mormorano segreti dimenticati.',
    'Si dice che chi cammina abbastanza a lungo tra questi alberi senta le voci degli antichi guardiani della natura. I sentieri sono consumati dal tempo, ma le Rupie scintillano come lucciole tra i cespugli.',
    'wilderness', 20, 25, 5, 0, 15
),
(
    'Gola del Tuono',
    'Un canyon squarciato nella roccia da antiche battaglie tra giganti.',
    'Il vento che soffia tra le gole produce un rombo che echeggia per miglia. I minatori parlano di vene di Cristallo nascoste nelle profondità, ma solo i più forti possono scalare le pareti a picco.',
    'wilderness', 45, 20, 15, 3, 30
),
(
    'Lago delle Laure',
    'Uno specchio d''acqua cristallino al centro del mondo conosciuto.',
    'Le acque del lago riflettono non il cielo, ma i desideri di chi vi si specchia. I vecchi saggi vengono qui per meditare e raccogliere le energie della terra.',
    'landmark', 35, 45, 8, 0, 20
),
(
    'Rovine Antiche',
    'I resti di una civiltà dimenticata, pieni di trappole e tesori.',
    'Nessuno sa chi costruì queste mura ciclopiche. I simboli incisi sulle pietre non appartengono a nessuna lingua conosciuta. Ma qualcosa brilla ancora nei sotterranei...',
    'dungeon', 60, 55, 25, 5, 80
),
(
    'Tempio del Guardiano',
    'Un tempio sommerso dalla vegetazione, protetto da un antico guardiano.',
    'La statua del Guardiano sbarra l''ingresso. I suoi occhi di smeraldo sembrano seguirti. La scritta alla base recita: "Solo chi ha superato la prova della montagna può passare."',
    'dungeon', 25, 65, 20, 8, 60
),
(
    'Vetta del Drago',
    'La montagna più alta, dove un drago antico custodisce il Cristallo Eterno.',
    'Nessuno è mai tornato dalla Vetta. Le mappe dei vecchi esploratori la segnano con un teschio. Il drago non dorme mai, e il suo ruggito fa tremare le fondamenta del mondo.',
    'boss', 70, 30, 50, 15, 200
),
(
    'Villaggio dell''Alba',
    'L''ultimo avamposto degli esploratori prima delle terre selvagge.',
    'Un villaggio accogliente dove gli eroi possono riposare e scambiare storie. La locandiera conosce tutte le voci e i segreti della regione.',
    'town', 15, 15, 0, 0, 10
)
ON CONFLICT DO NOTHING;

-- Aggiunge lore alle quest esistenti
ALTER TABLE quests ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE quests ADD COLUMN IF NOT EXISTS npc_dialogue text;

UPDATE quests SET
    description = 'Un anello di acque scure circonda la foresta incantata. I pescatori parlano di luci che danzano sulla superficie nelle notti di luna piena.',
    npc_dialogue = '"Ah, finalmente un°avventuriera! Il Lago Nero è irrequeto da settimane. Le rane parlano di un tesoro sul fondo, ma nessuno è mai riuscito a fare il giro completo senza perdersi. Portami prove del tuo passaggio e ti ricompenserò!"'
WHERE title = 'Anello del Lago Nero';

UPDATE quests SET
    description = 'Un antico sentiero usato dai contrabbandieri per trasportare merci proibite attraverso le montagne. Si snoda tra picchi aguzzi e passaggi stretti.',
    npc_dialogue = '"Sssst! Non parlarne troppo forte. Quel sentiero nasconde più segreti di quanti tu possa immaginare. Io... io ho visto cose lassù. Pietre che si muovono da sole. Ombre che non proiettano ombra. Se arrivi in cima, portami una prova. E prega di non incontrare ciò che ci abita."'
WHERE title = 'Sentiero dei Contrabbandieri';

UPDATE quests SET
    description = 'Una discesa mozzafiato attraverso i boschi del parco naturale. Il vento fischia tra i rami mentre la montagna precipita verso la valle.',
    npc_dialogue = '"Ehi, tu! Hai una bella macchina lì. Scommetto che non hai il coraggio di fare la Discesa Fulmine in meno di un''ora. Io l''ho fatto... una volta. Le ruote quasi prendevano fuoco. Se ce la fai, ti insegno il trucco per saltare il ruscolo!"'
WHERE title = 'Discesa Fulmine';
