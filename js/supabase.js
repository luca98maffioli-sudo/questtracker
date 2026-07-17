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
        },

        // -- Guild System --

        async getAreaProgress(userId) {
            const { data } = await supa.from('player_area_progress')
                .select('*, fantasy_map_areas(name, emoji, required_quests_completed, unlock_order, boss_quest_id)')
                .eq('user_id', userId);
            return data || [];
        },

        async getActiveQuests(userId) {
            const { data } = await supa.from('player_active_quests')
                .select('*, quests(title, type, difficulty, xp_reward, distance, elevation, description, region_id, area_id, coords, npc_dialogue, lore)')
                .eq('user_id', userId);
            return data || [];
        },

        async getItems() {
            const { data } = await supa.from('items_catalog').select('*').order('cost_rupie');
            return data || [];
        },

        async getPlayerItems(userId) {
            const { data } = await supa.from('player_items')
                .select('*, items_catalog(*)')
                .eq('user_id', userId);
            return data || [];
        },

        async getTitles() {
            const { data } = await supa.from('titles_catalog').select('*').order('sort_order');
            return data || [];
        },

        async getPlayerTitles(userId) {
            const { data } = await supa.from('player_titles')
                .select('*, titles_catalog(*)')
                .eq('user_id', userId);
            return data || [];
        },

        async acceptQuest(userId, questId) {
            const { data } = await supa.rpc('accept_quest', { p_user_id: userId, p_quest_id: questId });
            return data;
        },

        async completeQuestWithProgress(userId, questId) {
            const { data } = await supa.rpc('complete_quest_and_check_progress', { p_user_id: userId, p_quest_id: questId });
            return data;
        },

        async purchaseItem(userId, itemId) {
            const { data } = await supa.rpc('purchase_item', { p_user_id: userId, p_item_id: itemId });
            return data;
        },

        async equipItem(userId, itemId) {
            const { data } = await supa.rpc('equip_item', { p_user_id: userId, p_item_id: itemId });
            return data;
        },

        async unequipItem(userId, itemId) {
            const { data } = await supa.rpc('unequip_item', { p_user_id: userId, p_item_id: itemId });
            return data;
        },

        async checkTitles(userId) {
            const { data } = await supa.rpc('check_player_titles', { p_user_id: userId });
            return data;
        }
    };
})();
