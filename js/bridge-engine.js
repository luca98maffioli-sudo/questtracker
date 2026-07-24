class BridgeEngine {
    static parseActivity(activityData) {
        return {
            distance_km: activityData.distance || 0,
            elevation_m: activityData.elevation || 0,
            duration_minutes: activityData.duration || 0,
            avg_speed_kmh: activityData.duration > 0
                ? (activityData.distance || 0) / (activityData.duration / 60)
                : 0
        };
    }

    static applyRules(activityData, itemEffects) {
        const parsed = this.parseActivity(activityData);
        const effects = {};
        const ie = itemEffects || {};

        const elevReduction = (ie.elevation_reduction || 0) / 100;
        const mtbEndurance = parsed.avg_speed_kmh >= 8 ? (ie.mtb_endurance || 0) / 100 : 0;
        const effectiveElev = parsed.elevation_m * (1 - elevReduction);
        const effectiveDist = parsed.distance_km * (1 - mtbEndurance);

        if (effectiveElev >= 300) {
            effects.forza = (effects.forza || 0) + 2;
            effects.rupie = (effects.rupie || 0) + 30;
        }
        if (effectiveDist >= 8) {
            effects.costituzione = (effects.costituzione || 0) + 1;
            effects.rupie = (effects.rupie || 0) + 20;
        }
        if (parsed.avg_speed_kmh >= 15) {
            effects.agilita = (effects.agilita || 0) + 2;
            effects.rupie = (effects.rupie || 0) + 40;
        }
        if (parsed.duration_minutes >= 90) {
            effects.costituzione = (effects.costituzione || 0) + 1;
            effects.punti_esplorazione = (effects.punti_esplorazione || 0) + 5;
        }
        if (effectiveElev >= 800) {
            effects.cristalli = (effects.cristalli || 0) + 1;
            effects.forza = (effects.forza || 0) + 3;
            effects.rupie = (effects.rupie || 0) + 100;
        }

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
