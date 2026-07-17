class GPSTracker {
    constructor(onPoint) {
        this.watchId = null;
        this.lastPosition = null;
        this.minDistance = 10;
        this.onPoint = onPoint;
    }

    start() {
        if (!navigator.geolocation) return false;
        this.watchId = navigator.geolocation.watchPosition(
            pos => this.handlePosition(pos),
            err => console.error(err),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
        return true;
    }

    stop() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    handlePosition(position) {
        const { latitude, longitude, altitude } = position.coords;

        if (!this.lastPosition) {
            this.savePoint(position);
            this.lastPosition = position;
            return;
        }

        const distance = GameEngine.calculateDistance(
            this.lastPosition.coords.latitude,
            this.lastPosition.coords.longitude,
            latitude,
            longitude
        );

        if (distance >= this.minDistance) {
            this.savePoint(position);
            this.lastPosition = position;
        }
    }

    savePoint(position) {
        const point = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            alt: position.coords.altitude,
            timestamp: Date.now()
        };
        this.onPoint(point);
    }
}
