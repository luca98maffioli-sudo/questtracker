-- Fase 5: Passive tracking, quest progress, temp buffs
-- Aggiunge supporto per progress tracking incrementale e buff temporanei

-- Tabella per tracciare il progresso incrementale delle quest
CREATE TABLE IF NOT EXISTS quest_progress (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    quest_id BIGINT NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    distance_covered DOUBLE PRECISION DEFAULT 0,
    elevation_gained DOUBLE PRECISION DEFAULT 0,
    duration_seconds DOUBLE PRECISION DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_quest_progress_user ON quest_progress(user_id);

-- Colonna temp_buffs su player_stats per buff temporanei
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS temp_buffs JSONB DEFAULT '{}'::jsonb;

-- Funzione per sincronizzare il progresso quest
CREATE OR REPLACE FUNCTION sync_quest_progress(
    p_user_id UUID,
    p_quest_id BIGINT,
    p_distance DOUBLE PRECISION,
    p_elevation DOUBLE PRECISION,
    p_duration_seconds DOUBLE PRECISION
) RETURNS void AS $$
BEGIN
    INSERT INTO quest_progress (user_id, quest_id, distance_covered, elevation_gained, duration_seconds, updated_at)
    VALUES (p_user_id, p_quest_id, p_distance, p_elevation, p_duration_seconds, now())
    ON CONFLICT (user_id, quest_id) DO UPDATE SET
        distance_covered = GREATEST(quest_progress.distance_covered, EXCLUDED.distance_covered),
        elevation_gained = GREATEST(quest_progress.elevation_gained, EXCLUDED.elevation_gained),
        duration_seconds = GREATEST(quest_progress.duration_seconds, EXCLUDED.duration_seconds),
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Abilita RLS sulla tabella
ALTER TABLE quest_progress ENABLE ROW LEVEL SECURITY;

-- Policy: gli utenti vedono solo il proprio progresso
CREATE POLICY "Users can CRUD their own quest progress"
    ON quest_progress
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
