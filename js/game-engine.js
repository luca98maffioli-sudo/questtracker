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

    // Distanza punto-segmento con proiezione equirettangolare: approssimazione
    // adeguata per le scale di trekking/MTB (poche decine di km), molto più
    // leggera di un calcolo geodetico esatto e sufficiente per un check di coerenza.
    static pointToSegmentDistanceMeters(lat, lng, lat1, lon1, lat2, lon2) {
        const refLat = lat1;
        const toXY = (la, lo) => ({
            x: lo * Math.cos(refLat * Math.PI / 180) * 111320,
            y: la * 110540
        });
        const p = toXY(lat, lng);
        const a = toXY(lat1, lon1);
        const b = toXY(lat2, lon2);
        const abx = b.x - a.x, aby = b.y - a.y;
        const apx = p.x - a.x, apy = p.y - a.y;
        const lenSq = abx * abx + aby * aby;
        let t = lenSq > 0 ? (apx * abx + apy * aby) / lenSq : 0;
        t = Math.max(0, Math.min(1, t));
        const cx = a.x + t * abx, cy = a.y + t * aby;
        const dx = p.x - cx, dy = p.y - cy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    static minDistanceToPolyline(lat, lng, pathCoords) {
        let min = Infinity;
        for (let i = 1; i < pathCoords.length; i++) {
            const d = this.pointToSegmentDistanceMeters(
                lat, lng,
                pathCoords[i - 1][0], pathCoords[i - 1][1],
                pathCoords[i][0], pathCoords[i][1]
            );
            if (d < min) min = d;
        }
        return min;
    }

    // Campiona al massimo ~40 punti del tracciato per stimare quanto in media
    // ci si è discostati dal percorso ufficiale della quest, senza appesantire il calcolo.
    static averageDeviationFromPath(trackPoints, pathCoords) {
        const step = Math.max(1, Math.floor(trackPoints.length / 40));
        let sum = 0, count = 0;
        for (let i = 0; i < trackPoints.length; i += step) {
            const p = trackPoints[i];
            sum += this.minDistanceToPolyline(p.lat, p.lng, pathCoords);
            count++;
        }
        return count > 0 ? sum / count : 0;
    }

    static validateQuest(trackPoints, quest) {
        if (trackPoints.length < 2) {
            return { valid: false, reason: 'Tracciato troppo corto' };
        }

        // Soglia minima di punti GPS, scalata sulla distanza attesa (evita di
        // validare un'attività ricostruita da 2-3 punti isolati).
        const minPoints = quest.isFreeExploration ? 5 : Math.max(5, Math.round((quest.distance || 0) * 1.5));
        if (trackPoints.length < minPoints) {
            return { valid: false, reason: `Punti GPS insufficienti per validare il tracciato (minimo ${minPoints})` };
        }

        const startTime = trackPoints[0].timestamp;
        const endTime = trackPoints[trackPoints.length - 1].timestamp;
        const duration = (endTime - startTime) / 1000 / 60;

        // Oltre questa velocità istantanea tra due punti consecutivi si tratta quasi
        // certamente di un errore/salto del sensore GPS, non di un vero spostamento:
        // il segmento viene scartato dal calcolo invece di invalidare subito la quest.
        const MAX_JUMP_KMH = 150;

        let totalDistance = 0;
        let totalElevation = 0;
        let teleportSegments = 0;
        let validSegments = 0;

        for (let i = 1; i < trackPoints.length; i++) {
            const prev = trackPoints[i - 1];
            const curr = trackPoints[i];
            const dist = this.calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
            const dtHours = Math.max((curr.timestamp - prev.timestamp) / 3600000, 1 / 3600);
            const segSpeedKmh = (dist / 1000) / dtHours;

            if (segSpeedKmh > MAX_JUMP_KMH) {
                teleportSegments++;
                continue;
            }
            validSegments++;
            totalDistance += dist;
            if (curr.alt && prev.alt && curr.alt > prev.alt) {
                totalElevation += curr.alt - prev.alt;
            }
        }

        if (validSegments === 0) {
            return { valid: false, reason: 'Tracciato GPS non attendibile (troppi salti anomali)' };
        }
        const teleportRatio = teleportSegments / (teleportSegments + validSegments);
        if (teleportRatio > 0.3) {
            return { valid: false, reason: 'Troppi salti GPS anomali rilevati: controlla il segnale e riprova' };
        }

        const distanceKm = totalDistance / 1000;
        const avgSpeed = distanceKm / (duration / 60);
        const maxSpeed = quest.type === 'mtb' ? 40 : 6;

        if (avgSpeed > maxSpeed) {
            return { valid: false, reason: `Velocità media troppo alta: ${avgSpeed.toFixed(1)} km/h` };
        }

        if (quest.isFreeExploration) {
            // Esplorazione libera: nessun percorso ufficiale da rispettare, ma serve
            // comunque un minimo di sforzo reale per evitare attività banali.
            if (distanceKm < 0.3 && duration < 10) {
                return { valid: false, reason: 'Attività troppo breve per essere registrata come esplorazione' };
            }
        } else {
            if (distanceKm < quest.distance * 0.9) {
                return { valid: false, reason: `Distanza insufficiente: ${distanceKm.toFixed(1)} km` };
            }

            if (Array.isArray(quest.coords) && quest.coords.length > 1) {
                const avgDeviation = this.averageDeviationFromPath(trackPoints, quest.coords);
                const maxDeviationMeters = 400;
                if (avgDeviation > maxDeviationMeters) {
                    return {
                        valid: false,
                        reason: `Il tracciato si discosta troppo dal percorso ufficiale della quest (${Math.round(avgDeviation)}m in media)`
                    };
                }
            }
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
