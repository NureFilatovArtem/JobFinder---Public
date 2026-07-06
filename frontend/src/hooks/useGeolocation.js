import { useState, useCallback } from 'react';

/**
 * Custom hook for browser geolocation.
 * Does NOT request permission on mount — only when `requestLocation()` is called.
 *
 * @returns {{
 *   coords: { lat: number, lng: number } | null,
 *   error: string | null,
 *   loading: boolean,
 *   isSupported: boolean,
 *   requestLocation: () => void
 * }}
 */
export function useGeolocation() {
    const [coords, setCoords] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const isSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

    const requestLocation = useCallback(() => {
        if (!isSupported) {
            setError('Geolocation is not supported by your browser.');
            return;
        }

        setLoading(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setCoords({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
                setLoading(false);
            },
            (err) => {
                let message;
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        message = 'Location permission denied. You can select a city manually instead.';
                        break;
                    case err.POSITION_UNAVAILABLE:
                        message = 'Location unavailable. Please select a city manually.';
                        break;
                    case err.TIMEOUT:
                        message = 'Location request timed out. Please try again or select a city.';
                        break;
                    default:
                        message = 'An unknown error occurred while getting your location.';
                }
                setError(message);
                setLoading(false);
            },
            {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 300000, // Cache for 5 minutes
            }
        );
    }, [isSupported]);

    return { coords, error, loading, isSupported, requestLocation };
}
