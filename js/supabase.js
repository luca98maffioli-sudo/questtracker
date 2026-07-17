const SUPABASE_URL = 'https://vcrfhoucpapszwraamea.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Y9PZlWpDRTEm50opWQiQDQ_24G5J1Qz';

window.SupaDB = (() => {
    const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    return {
        supa,

        async ensureSession(username) {
            const { data: { session } } = await supa.auth.getSession();
            if (session?.user) return session.user;

            const email = `${username.toLowerCase().replace(/\s+/g, '')}@questtracker.app`;
            const password = 'quest2024!';

            const { data: si } = await supa.auth.signInWithPassword({ email, password });
            if (si?.user) return si.user;

            try {
                const { data: su } = await supa.auth.signUp({ email, password });
                if (su?.user) {
                    if (su.session) return su.user;
                    const { data: si2 } = await supa.auth.signInWithPassword({ email, password });
                    if (si2?.user) return si2.user;
                }
            } catch (_) {
                // signUp fallito (es. utente già esistente) — riprova signIn
            }

            const { data: si3 } = await supa.auth.signInWithPassword({ email, password });
            if (si3?.user) return si3.user;

            throw new Error('Impossibile autenticarsi con Supabase');
        },

        async getQuests() {
            const { data, error } = await supa.from('quests').select('*, regions(name)');
            if (error) throw error;
            return data || [];
        },

        async getProfile(userId) {
            const { data } = await supa.from('profiles').select('*').eq('user_id', userId).maybeSingle();
            return data;
        },

        async updateProfile(userId, updates) {
            return supa.from('profiles').update(updates).eq('user_id', userId);
        },

        async getStats(userId) {
            const { data } = await supa.from('player_stats').select('*').eq('user_id', userId).maybeSingle();
            return data;
        },

        async getResources(userId) {
            const { data } = await supa.from('player_fantasy_resources').select('*').eq('user_id', userId).maybeSingle();
            return data;
        },

        async saveActivity(userId, questId, type, activityData, trackPoints) {
            const { data } = await supa.from('tracked_activities').insert({
                user_id: userId,
                quest_id: questId,
                activity_type: type,
                distance_km: activityData.distance,
                elevation_m: activityData.elevation,
                duration_minutes: activityData.duration,
                avg_speed_kmh: activityData.duration > 0 ? (activityData.distance / (activityData.duration / 60)) : 0,
                track_points: trackPoints || []
            }).select('id').single();
            return data;
        },

        async saveQuestProgress(userId, questId, stats) {
            return supa.from('user_quest_progress').upsert({
                user_id: userId,
                quest_id: questId,
                completed_at: new Date().toISOString(),
                stats
            }, { onConflict: 'user_id,quest_id' });
        },

        async applyBridgeRules(userId, activityId, activityType, stats) {
            const { data } = await supa.rpc('apply_bridge_rules', {
                p_user_id: userId,
                p_activity_id: activityId,
                p_activity_type: activityType,
                p_stats: stats
            });
            return data;
        },

        async addJournalEntries(userId, entries) {
            for (const e of entries) {
                await supa.rpc('add_journal_entry', {
                    p_user_id: userId, p_entry_type: e.type,
                    p_title: e.title, p_description: e.desc
                }).catch(() => {});
            }
        }
    };
})();
