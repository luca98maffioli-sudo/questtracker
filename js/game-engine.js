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

    static MAX_HUMAN_SPEED_KMH = 35;

    static filterMovementSegment(prev, curr, speedBonus) {
        const distMeters = this.calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
        const dtHours = Math.max((curr.timestamp - prev.timestamp) / 3600000, 1 / 3600);
        const speedKmh = (distMeters / 1000) / dtHours;
        const effectiveMaxSpeed = this.MAX_HUMAN_SPEED_KMH * (1 + (speedBonus || 0));

        if (speedKmh > effectiveMaxSpeed) {
            return { valid: false, reason: 'speed' };
        }

        let elevationMeters = 0;
        if (curr.alt != null && prev.alt != null && curr.alt > prev.alt) {
            elevationMeters = curr.alt - prev.alt;
        }

        return {
            valid: true,
            distanceMeters: distMeters,
            elevationMeters,
            minutes: dtHours * 60
        };
    }

    static validateAdventureTrack(trackPoints) {
        if (!trackPoints || trackPoints.length < 2) {
            return { valid: false, reason: 'Tracciato troppo corto' };
        }

        let totalDistance = 0;
        let totalElevation = 0;
        let teleportSegments = 0;
        let validSegments = 0;

        for (let i = 1; i < trackPoints.length; i++) {
            const seg = this.filterMovementSegment(trackPoints[i - 1], trackPoints[i]);
            if (!seg.valid) { teleportSegments++; continue; }
            validSegments++;
            totalDistance += seg.distanceMeters;
            totalElevation += seg.elevationMeters;
        }

        if (validSegments === 0) {
            return { valid: false, reason: 'Tracciato GPS non attendibile' };
        }

        const duration = (trackPoints[trackPoints.length - 1].timestamp - trackPoints[0].timestamp) / 60000;
        return {
            valid: true,
            stats: { distance: totalDistance / 1000, elevation: totalElevation, duration }
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
