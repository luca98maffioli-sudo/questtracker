class GameEngine {
    static calculateXPRequired(level) {
        return level * 1000;
    }

    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const phi1 = lat1 * Math.PI / 180;
        const phi2 = lat2 * Math.PI / 180;
        const deltaPhi = (lat2 - lat1) * Math.PI / 180;
        const deltaLambda = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    static validateQuest(trackPoints, quest) {
        if (trackPoints.length < 2) {
            return { valid: false, reason: 'Tracciato troppo corto' };
        }

        let totalDistance = 0;
        let totalElevation = 0;
        const startTime = trackPoints[0].timestamp;
        const endTime = trackPoints[trackPoints.length - 1].timestamp;
        const duration = (endTime - startTime) / 1000 / 60;

        for (let i = 1; i < trackPoints.length; i++) {
            const prev = trackPoints[i - 1];
            const curr = trackPoints[i];
            const dist = this.calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
            totalDistance += dist;

            if (curr.alt && prev.alt && curr.alt > prev.alt) {
                totalElevation += curr.alt - prev.alt;
            }
        }

        const distanceKm = totalDistance / 1000;
        const avgSpeed = distanceKm / (duration / 60);
        const maxSpeed = quest.type === 'mtb' ? 40 : 6;

        if (avgSpeed > maxSpeed) {
            return { valid: false, reason: `Velocità media troppo alta: ${avgSpeed.toFixed(1)} km/h` };
        }
        if (distanceKm < quest.distance * 0.9) {
            return { valid: false, reason: `Distanza insufficiente: ${distanceKm.toFixed(1)} km` };
        }

        return {
            valid: true,
            stats: { distance: distanceKm, elevation: totalElevation, duration }
        };
    }

    static processLevelUp(player, xpGained) {
        player.currentXP += xpGained;
        player.totalXP += xpGained;

        let leveledUp = false;
        while (player.currentXP >= this.calculateXPRequired(player.level)) {
            player.currentXP -= this.calculateXPRequired(player.level);
            player.level++;
            leveledUp = true;
        }

        return leveledUp;
    }
}
