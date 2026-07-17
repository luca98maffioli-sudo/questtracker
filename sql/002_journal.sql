-- ============================================================================
-- DIARIO DI BORDO (Punto 6)
-- SCHEMA: gandalf
-- ============================================================================

SET search_path TO gandalf;

CREATE TABLE IF NOT EXISTS player_journal (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entry_type text NOT NULL DEFAULT 'quest' CHECK (entry_type IN ('quest', 'levelup', 'exploration', 'bridge', 'system')),
    title text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_user ON player_journal(user_id, created_at DESC);

ALTER TABLE player_journal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journal_select_own" ON player_journal FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "journal_insert_own" ON player_journal FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Funzione: aggiunge una voce al diario
CREATE OR REPLACE FUNCTION add_journal_entry(
    p_user_id uuid,
    p_entry_type text,
    p_title text,
    p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO gandalf
AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO player_journal (user_id, entry_type, title, description)
    VALUES (p_user_id, p_entry_type, p_title, p_description)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;
