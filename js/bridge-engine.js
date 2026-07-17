class BridgeEngine {
    static parseActivity(activityData) {
        return {
            type: activityData.type || 'unknown',
            distance_km: activityData.distance || 0,
            elevation_m: activityData.elevation || 0,
            duration_minutes: activityData.duration || 0,
            avg_speed_kmh: activityData.duration > 0
                ? (activityData.distance || 0) / (activityData.duration / 60)
                : 0
        };
    }

    static applyRules(activityData) {
        const parsed = this.parseActivity(activityData);
        const effects = {};

        if (parsed.type === 'trekking' && parsed.elevation_m >= 300) {
            effects.forza = 2;
            effects.rupie = 30;
        }
        if ((parsed.type === 'trekking' || parsed.type === 'mtb') && parsed.distance_km >= 8) {
            effects.costituzione = (effects.costituzione || 0) + 1;
            effects.rupie = (effects.rupie || 0) + 20;
        }
        if (parsed.type === 'mtb' && parsed.avg_speed_kmh >= 15) {
            effects.agilita = 2;
            effects.rupie = (effects.rupie || 0) + 40;
        }
        if (parsed.duration_minutes >= 90) {
            effects.costituzione = (effects.costituzione || 0) + 1;
            effects.punti_esplorazione = 5;
        }
        if (parsed.elevation_m >= 800) {
            effects.cristalli = 1;
            effects.forza = (effects.forza || 0) + 3;
            effects.rupie = (effects.rupie || 0) + 100;
        }

        console.log('[BridgeEngine] Activity parsed:', parsed);
        console.log('[BridgeEngine] Effects applied:', effects);

        return { parsed, effects };
    }

    static getEffectsSummary(effects) {
        const labels = [];
        if (effects.forza) labels.push(`+${effects.forza} Forza`);
        if (effects.agilita) labels.push(`+${effects.agilita} Agilità`);
        if (effects.costituzione) labels.push(`+${effects.costituzione} Costituzione`);
        if (effects.rupie) labels.push(`+${effects.rupie} Rupie`);
        if (effects.cristalli) labels.push(`+${effects.cristalli} Cristalli`);
        if (effects.punti_esplorazione) labels.push(`+${effects.punti_esplorazione} Punti Esplorazione`);
        return labels;
    }
}
