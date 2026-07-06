import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { vacaturesAPI } from '../api/vacatures';
import { useCountry } from '../context/CountryContext';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, MapPin, Briefcase, Building2, LocateFixed, ExternalLink, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cityToCoords, postcodePrefixToCoords, NL_CITY_KEYS } from '../data/belgianCoords';
import { useGeolocation } from '../hooks/useGeolocation';
import { haversineDistance, formatDistance, getSourceName, RADIUS_OPTIONS } from '../utils/distanceUtils';


// Resolve coordinates for a vacancy using postcode, city name, or prefix fallback
const resolveCoords = (postcode, cityName, locationText) => {
  // 1. Try postcode prefix lookup (first 2 digits)
  if (postcode && postcode.length >= 2) {
    const prefix = postcode.substring(0, 2);
    const prefixMatch = postcodePrefixToCoords[prefix];
    if (prefixMatch) {
      return { lat: prefixMatch.lat, lng: prefixMatch.lng, city: prefixMatch.city };
    }
  }

  // 2. Try city name lookup — try each part of compound locations
  const names = [cityName, locationText].filter(Boolean);
  for (const name of names) {
    const key = name.toLowerCase().trim();
    if (cityToCoords[key]) {
      return { lat: cityToCoords[key].lat, lng: cityToCoords[key].lng, city: name };
    }
    const firstWord = key.split(/[\s,(]/)[0];
    if (firstWord && cityToCoords[firstWord]) {
      return { lat: cityToCoords[firstWord].lat, lng: cityToCoords[firstWord].lng, city: name };
    }
    const parts = name.split(',').map(p => p.trim().toLowerCase());
    for (const part of parts) {
      if (cityToCoords[part]) {
        return { lat: cityToCoords[part].lat, lng: cityToCoords[part].lng, city: part.charAt(0).toUpperCase() + part.slice(1) };
      }
      const partFirst = part.split(/[\s(]/)[0];
      if (partFirst && cityToCoords[partFirst]) {
        return { lat: cityToCoords[partFirst].lat, lng: cityToCoords[partFirst].lng, city: partFirst.charAt(0).toUpperCase() + partFirst.slice(1) };
      }
    }
  }

  return null;
};

// Build city options grouped by country for the manual city selector
const _buildCityList = (filterFn) =>
  Object.entries(cityToCoords)
    .filter(([key]) => key !== 'unknown' && filterFn(key))
    .reduce((acc, [key, val]) => {
      const coordKey = `${val.lat},${val.lng}`;
      if (!acc.seen.has(coordKey)) {
        acc.seen.add(coordKey);
        acc.cities.push({ label: key.charAt(0).toUpperCase() + key.slice(1), lat: val.lat, lng: val.lng });
      }
      return acc;
    }, { seen: new Set(), cities: [] }).cities.sort((a, b) => a.label.localeCompare(b.label));

const CITY_OPTIONS_BE = _buildCityList(key => !NL_CITY_KEYS.has(key));
const CITY_OPTIONS_NL = _buildCityList(key => NL_CITY_KEYS.has(key));
const CITY_OPTIONS = [...CITY_OPTIONS_BE, ...CITY_OPTIONS_NL];


const DemandMap = () => {
  const [vacatures, setVacatures] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCities, setExpandedCities] = useState(new Set());
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const radiusCircleRef = useRef(null);
  const userMarkerRef = useRef(null);
  const { selectedCountry } = useCountry();
  const { t } = useTranslation();
  const geo = useGeolocation();

  // Geolocation & radius state
  const [userOrigin, setUserOrigin] = useState(null); // { lat, lng, label }
  const [radiusKm, setRadiusKm] = useState(null); // null = show all
  const [citySearch, setCitySearch] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  // Update origin when geolocation succeeds
  useEffect(() => {
    if (geo.coords) {
      setUserOrigin({ lat: geo.coords.lat, lng: geo.coords.lng, label: 'My Location' });
      if (!radiusKm) setRadiusKm(25); // Default to 25km when using geolocation
    }
  }, [geo.coords]);

  // Toggle city expansion in sidebar
  const toggleCity = (cityName) => {
    setExpandedCities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cityName)) {
        newSet.delete(cityName);
      } else {
        newSet.add(cityName);
      }
      return newSet;
    });
  };

  useEffect(() => {
    loadVacatures();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current && selectedCountry) {
      mapInstanceRef.current.setView(selectedCountry.center, selectedCountry.zoom);
    }
  }, [selectedCountry]);

  useEffect(() => {
    if (!loading && mapRef.current && !mapInstanceRef.current && selectedCountry) {
      initializeMap();
    }
  }, [loading, selectedCountry]);

  useEffect(() => {
    if (mapInstanceRef.current && !loading) {
      updateMarkers();
    }
  }, [vacatures, loading, userOrigin, radiusKm]);

  // Update radius circle and user marker on map when origin/radius changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old circle and marker
    if (radiusCircleRef.current) {
      map.removeLayer(radiusCircleRef.current);
      radiusCircleRef.current = null;
    }
    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    if (userOrigin) {
      // Add pulsing user position marker
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `
          <div style="
            width: 18px; height: 18px;
            background: #3b82f6;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 0 4px rgba(59,130,246,0.3), 0 2px 8px rgba(0,0,0,0.3);
            animation: pulse-ring 2s ease-out infinite;
          "></div>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      userMarkerRef.current = L.marker([userOrigin.lat, userOrigin.lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);

      // Add radius circle
      if (radiusKm) {
        radiusCircleRef.current = L.circle([userOrigin.lat, userOrigin.lng], {
          radius: radiusKm * 1000,
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.06,
          weight: 2,
          dashArray: '6, 6',
        }).addTo(map);

        // Fit map to the radius circle bounds
        map.fitBounds(radiusCircleRef.current.getBounds(), { padding: [30, 30] });
      } else {
        map.setView([userOrigin.lat, userOrigin.lng], 11);
      }
    }
  }, [userOrigin, radiusKm]);

  const loadVacatures = async () => {
    try {
      setLoading(true);
      const data = await vacaturesAPI.getAll();
      setVacatures(data);
    } catch (error) {
      console.error('Error loading vacatures:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = () => {
    const map = L.map(mapRef.current, {
      center: selectedCountry.center,
      zoom: selectedCountry.zoom,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
    updateMarkers();
  };

  // Aggregate vacatures by location key
  const aggregatedByPostcode = useMemo(() => {
    const grouped = {};

    vacatures.forEach(vac => {
      const postcode = vac.postcode || '';
      const location = vac.location || '';
      const cityName = vac.city_name || '';

      let extractedPostcode = postcode;
      if (!extractedPostcode && location) {
        const match = location.match(/\b(\d{4})\b/);
        if (match) {
          extractedPostcode = match[1];
        }
      }

      const resolved = resolveCoords(extractedPostcode, cityName, location);
      const key = resolved?.city || extractedPostcode || location || 'Unknown';

      if (!grouped[key]) {
        grouped[key] = {
          postcode: extractedPostcode,
          location: location,
          city: resolved?.city || location.split(',')[0].trim() || 'Unknown',
          vacatures: [],
          coords: resolved ? { lat: resolved.lat, lng: resolved.lng } : null,
          _seenLinks: new Set(),
          _seenNames: new Set(),
        };
      }

      const normalizedLink = vac.link ? vac.link.trim().replace(/\/+$/, '') : null;
      const normalizedName = vac.title ? vac.title.trim().toLowerCase() : null;
      const companyKey = normalizedName + '||' + (vac.company || '').trim().toLowerCase();

      if (normalizedLink && grouped[key]._seenLinks.has(normalizedLink)) return;
      if (normalizedName && grouped[key]._seenNames.has(companyKey)) return;

      if (normalizedLink) grouped[key]._seenLinks.add(normalizedLink);
      if (normalizedName) grouped[key]._seenNames.add(companyKey);

      grouped[key].vacatures.push(vac);
    });

    Object.values(grouped).forEach(g => {
      delete g._seenLinks;
      delete g._seenNames;
    });

    return grouped;
  }, [vacatures]);

  // Filter by radius and annotate with distance
  const filteredByRadius = useMemo(() => {
    if (!userOrigin) return aggregatedByPostcode;
    if (!radiusKm) {
      // No radius filter but we have origin — annotate with distance
      const annotated = {};
      Object.entries(aggregatedByPostcode).forEach(([key, data]) => {
        if (data.coords) {
          const dist = haversineDistance(userOrigin.lat, userOrigin.lng, data.coords.lat, data.coords.lng);
          annotated[key] = { ...data, distanceKm: dist };
        } else {
          annotated[key] = { ...data, distanceKm: null };
        }
      });
      return annotated;
    }
    // Filter to radius
    const filtered = {};
    Object.entries(aggregatedByPostcode).forEach(([key, data]) => {
      if (!data.coords) return;
      const dist = haversineDistance(userOrigin.lat, userOrigin.lng, data.coords.lat, data.coords.lng);
      if (dist <= radiusKm) {
        filtered[key] = { ...data, distanceKm: dist };
      }
    });
    return filtered;
  }, [aggregatedByPostcode, userOrigin, radiusKm]);

  // Group by city for sidebar (fallback when no origin)
  const groupedByCity = useMemo(() => {
    const cityGroups = {};

    Object.entries(filteredByRadius).forEach(([key, data]) => {
      const cityName = data.city;

      if (!cityGroups[cityName]) {
        cityGroups[cityName] = {
          name: cityName,
          postcodes: [],
          totalVacatures: 0
        };
      }

      cityGroups[cityName].postcodes.push({
        key,
        postcode: data.postcode,
        location: data.location,
        count: data.vacatures.length,
        vacatures: data.vacatures,
        coords: data.coords,
        distanceKm: data.distanceKm,
      });
      cityGroups[cityName].totalVacatures += data.vacatures.length;
    });

    return Object.values(cityGroups).sort((a, b) => b.totalVacatures - a.totalVacatures);
  }, [filteredByRadius]);

  // Flat list of nearby jobs sorted by distance (for sidebar when origin is set)
  const nearbyJobs = useMemo(() => {
    if (!userOrigin) return [];

    const jobs = [];
    Object.entries(filteredByRadius).forEach(([key, data]) => {
      data.vacatures.forEach(vac => {
        jobs.push({
          ...vac,
          distanceKm: data.distanceKm,
          resolvedCity: data.city,
        });
      });
    });

    return jobs.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  }, [filteredByRadius, userOrigin]);


  // Metrics
  const metrics = useMemo(() => {
    const totalVacancies = Object.values(filteredByRadius).reduce((sum, g) => sum + g.vacatures.length, 0);
    const uniqueCities = groupedByCity.length;
    const avgPerCity = uniqueCities > 0 ? Math.round(totalVacancies / uniqueCities) : 0;

    return { totalVacancies, uniqueCities, avgPerCity };
  }, [filteredByRadius, groupedByCity]);

  const updateMarkers = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current = [];

    // Merge groups that share the same coordinates
    const byCoords = {};
    Object.entries(filteredByRadius).forEach(([key, data]) => {
      if (!data.coords) return;
      const coordKey = `${data.coords.lat},${data.coords.lng}`;
      if (!byCoords[coordKey]) {
        byCoords[coordKey] = {
          ...data, vacatures: [...data.vacatures], key,
          _seenLinks: new Set(data.vacatures.map(v => v.link?.trim().replace(/\/+$/, '')).filter(Boolean)),
          _seenNames: new Set(data.vacatures.map(v => (v.title?.trim().toLowerCase() || '') + '||' + (v.company || '').trim().toLowerCase())),
        };
      } else {
        const merged = byCoords[coordKey];
        data.vacatures.forEach(vac => {
          const normalizedLink = vac.link?.trim().replace(/\/+$/, '');
          const companyKey = (vac.title?.trim().toLowerCase() || '') + '||' + (vac.company || '').trim().toLowerCase();
          if (normalizedLink && merged._seenLinks.has(normalizedLink)) return;
          if (merged._seenNames.has(companyKey)) return;
          if (normalizedLink) merged._seenLinks.add(normalizedLink);
          merged._seenNames.add(companyKey);
          merged.vacatures.push(vac);
        });
      }
    });

    // Create markers with staggered animation
    const entries = Object.values(byCoords);

    // Sort by distance from origin if available (nearest first for animation)
    if (userOrigin) {
      entries.sort((a, b) => {
        const distA = haversineDistance(userOrigin.lat, userOrigin.lng, a.coords.lat, a.coords.lng);
        const distB = haversineDistance(userOrigin.lat, userOrigin.lng, b.coords.lat, b.coords.lng);
        return distA - distB;
      });
    }

    entries.forEach((data, index) => {
      const { key } = data;
      const count = data.vacatures.length;
      const size = Math.min(35 + count * 2, 60);
      const delay = index * 40; // Staggered animation delay

      const customIcon = L.divIcon({
        className: 'postcode-marker',
        html: `
          <div class="marker-pop" style="
            width: ${size}px;
            height: ${size}px;
            background: linear-gradient(135deg, #ffd60a 0%, #e6c009 100%);
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 10px rgba(0,0,0,0.3);
            cursor: pointer;
            animation: marker-pop-in 0.4s ease-out ${delay}ms both;
          ">
            <span style="color: #1a1a2e; font-weight: bold; font-size: 14px; line-height: 1;">
              ${count}
            </span>
            ${data.postcode ? `<span style="color: #1a1a2e; font-size: 9px; opacity: 0.8;">${data.postcode}</span>` : ''}
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([data.coords.lat, data.coords.lng], { icon: customIcon })
        .on('click', () => {
          setSelectedLocation({
            key,
            postcode: data.postcode,
            location: data.location,
            city: data.city,
            vacatures: data.vacatures,
            distanceKm: data.distanceKm,
          });
        });

      marker.addTo(map);
      markersRef.current.push(marker);
    });
  };

  const handlePostcodeClick = (postcodeData) => {
    setSelectedLocation({
      key: postcodeData.key,
      postcode: postcodeData.postcode,
      location: postcodeData.location,
      city: null,
      vacatures: postcodeData.vacatures,
      distanceKm: postcodeData.distanceKm,
    });

    if (postcodeData.coords && mapInstanceRef.current) {
      mapInstanceRef.current.setView([postcodeData.coords.lat, postcodeData.coords.lng], 14);
    }
  };

  const handleVacatureClick = (vacature) => {
    if (vacature.link) {
      window.open(vacature.link, '_blank');
    }
  };

  // City selector filter (only used when search term is present; grouped view uses CITY_OPTIONS_BE/NL directly)
  const filteredCityOptions = useMemo(() => {
    if (!citySearch) return [];
    return CITY_OPTIONS.filter(c => c.label.toLowerCase().includes(citySearch.toLowerCase())).slice(0, 15);
  }, [citySearch]);

  const selectCity = (city) => {
    setUserOrigin({ lat: city.lat, lng: city.lng, label: city.label });
    setCitySearch('');
    setShowCityDropdown(false);
    if (!radiusKm) setRadiusKm(25);
  };

  const clearOrigin = () => {
    setUserOrigin(null);
    setRadiusKm(null);
    setCitySearch('');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1920px] mx-auto px-4">
      <div className="mb-6 text-center">
        <h1 className="text-4xl font-bold text-foreground mb-2 tracking-tight">
          {t('demandMap.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('demandMap.controls')}
        </p>
      </div>

      {/* Origin & Radius Toolbar */}
      <div className="bg-card rounded-2xl shadow-sm border p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Use my location button */}
          <button
            onClick={geo.requestLocation}
            disabled={geo.loading}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${userOrigin && userOrigin.label === 'My Location'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
              }`}
          >
            <LocateFixed className="w-4 h-4" />
            {geo.loading ? t('filters.detecting') : t('filters.myLocation')}
          </button>

          {/* Divider */}
          <span className="text-muted-foreground text-sm">{t('filters.or')}</span>

          {/* City selector */}
          <div className="relative">
            <input
              type="text"
              value={citySearch}
              onChange={(e) => {
                setCitySearch(e.target.value);
                setShowCityDropdown(true);
              }}
              onFocus={() => setShowCityDropdown(true)}
              onBlur={() => setTimeout(() => setShowCityDropdown(false), 150)}
              placeholder={t('filters.selectCityPlaceholder')}
              className="px-4 py-2.5 w-52 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-all"
            />
            {showCityDropdown && (citySearch ? filteredCityOptions.length > 0 : true) && (
              <div className="absolute z-50 top-full mt-1 w-56 bg-white border rounded-xl shadow-xl max-h-64 overflow-y-auto">
                {citySearch ? (
                  filteredCityOptions.map(city => (
                    <button
                      key={`${city.lat}-${city.lng}`}
                      onClick={() => selectCity(city)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors"
                    >
                      <MapPin className="w-3 h-3 inline mr-2 text-gray-400" />
                      {city.label}
                    </button>
                  ))
                ) : (
                  <>
                    <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b sticky top-0">
                      🇧🇪 {t('demandMap.belgiumGroup')}
                    </div>
                    {CITY_OPTIONS_BE.map(city => (
                      <button
                        key={`be-${city.lat}-${city.lng}`}
                        onClick={() => selectCity(city)}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors"
                      >
                        <MapPin className="w-3 h-3 inline mr-2 text-gray-400" />
                        {city.label}
                      </button>
                    ))}
                    <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-t sticky top-0">
                      🇳🇱 {t('demandMap.netherlandsGroup')}
                    </div>
                    {CITY_OPTIONS_NL.map(city => (
                      <button
                        key={`nl-${city.lat}-${city.lng}`}
                        onClick={() => selectCity(city)}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors"
                      >
                        <MapPin className="w-3 h-3 inline mr-2 text-gray-400" />
                        {city.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Radius selector */}
          {userOrigin && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {RADIUS_OPTIONS.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => setRadiusKm(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${radiusKm === opt.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Active origin badge */}
          {userOrigin && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-sm border border-blue-200">
              <MapPin className="w-3.5 h-3.5" />
              <span className="font-medium">{userOrigin.label}</span>
              <button onClick={clearOrigin} className="ml-1 hover:text-red-600 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Geolocation error */}
        {geo.error && (
          <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
            <span>⚠️</span> {geo.error}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Map and Metrics Column */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          {/* Map */}
          <div
            className="map-container bg-card rounded-2xl overflow-hidden relative mb-4"
            style={{
              height: 'clamp(400px, 70vh, 700px)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              zIndex: 1
            }}
          >
            <div ref={mapRef} style={{ height: '100%', width: '100%' }} className="rounded-2xl"></div>
          </div>

          {/* Metrics below map */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-card rounded-xl p-4 border shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{metrics.totalVacancies}</p>
                  <p className="text-xs text-muted-foreground">
                    {radiusKm ? t('demandMap.withinKm', { radius: radiusKm }) : t('demandMap.totalVacancies')}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-xl p-4 border shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{metrics.uniqueCities}</p>
                  <p className="text-xs text-muted-foreground">{t('demandMap.cities')}</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-xl p-4 border shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{metrics.avgPerCity}</p>
                  <p className="text-xs text-muted-foreground">{t('demandMap.avgPerCity')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Nearby Jobs list (when origin is set) or City-grouped view (fallback) */}
          <div className="bg-card rounded-2xl shadow-xl border p-4">
            <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              {userOrigin ? t('demandMap.nearbyJobs') : t('demandMap.locations')}
            </h2>

            {userOrigin ? (
              /* Nearby jobs list — sorted by distance */
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {nearbyJobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('demandMap.noJobsInRadius')}
                  </p>
                ) : (
                  nearbyJobs.slice(0, 50).map((vac) => (
                    <button
                      key={vac.id}
                      onClick={() => handleVacatureClick(vac)}
                      className="w-full text-left p-3 rounded-xl border hover:border-blue-300 hover:shadow-sm transition-all group bg-background"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate group-hover:text-blue-600 transition-colors flex items-center gap-1">
                            {vac.title}
                            <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{vac.company || t('demandMap.unknownCompany')}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {vac.distanceKm != null && (
                            <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                              {formatDistance(vac.distanceKm)}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {getSourceName(vac.link)}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
                {nearbyJobs.length > 50 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    {t('demandMap.showingNearby', { shown: 50, total: nearbyJobs.length })}
                  </p>
                )}
              </div>
            ) : (
              /* City-grouped view (original) */
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {groupedByCity.map((city) => (
                  <div key={city.name} className="border rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleCity(city.name)}
                      className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {expandedCities.has(city.name) ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="font-semibold text-foreground">{city.name}</span>
                      </div>
                      <span className="px-2 py-1 bg-gradient-to-r from-blue-600 to-blue-600 text-white text-xs font-semibold rounded-full">
                        {city.totalVacatures}
                      </span>
                    </button>

                    {expandedCities.has(city.name) && (
                      <div className="p-2 space-y-1 bg-background">
                        {city.postcodes.map((pc) => (
                          <button
                            key={pc.key}
                            onClick={() => handlePostcodeClick(pc)}
                            className={`w-full text-left p-2 rounded-lg transition-all text-sm ${selectedLocation?.key === pc.key
                              ? 'bg-blue-100 border border-blue-300'
                              : 'hover:bg-muted border border-transparent'
                              }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3 h-3 text-muted-foreground" />
                                <span className="text-foreground font-medium">
                                  {pc.postcode || pc.location}
                                </span>
                              </div>
                              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                {pc.count}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Data coverage disclaimer */}
          <div className="bg-amber-50/50 rounded-xl border border-amber-200/50 p-3">
            <p className="text-xs text-amber-700 leading-relaxed">
              📊 {t('demandMap.disclaimer')}
            </p>
          </div>
        </div>
      </div>

      {/* Vacancy Details Modal */}
      <AnimatePresence>
        {selectedLocation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedLocation(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto border"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      {selectedLocation.postcode || selectedLocation.location || selectedLocation.city}
                    </h2>
                    <p className="text-muted-foreground mt-1">
                      {t('demandMap.vacanciesCount', { count: selectedLocation.vacatures.length })}
                      {selectedLocation.distanceKm != null && (
                        <span className="ml-2 text-blue-600 font-medium">
                          • {formatDistance(selectedLocation.distanceKm)} {t('demandMap.fromYou')}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedLocation(null)}
                    className="p-2 hover:bg-muted rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
                <div className="space-y-3">
                  {selectedLocation.vacatures.map((vac) => (
                    <div
                      key={vac.id}
                      className="p-4 bg-muted/50 rounded-xl border hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
                      onClick={() => handleVacatureClick(vac)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground mb-1 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                            {vac.title}
                            <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          </h3>
                          <p className="text-sm text-muted-foreground">{vac.company || t('demandMap.unknownCompany')}</p>
                        </div>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-lg flex-shrink-0">
                          {getSourceName(vac.link)}
                        </span>
                      </div>
                      <p className="text-xs text-blue-600 mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink className="w-3 h-3" />
                        {t('demandMap.opensOn', { source: getSourceName(vac.link) })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .postcode-marker {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }

        .postcode-marker img {
          display: none !important;
        }

        .leaflet-marker-icon.postcode-marker {
          background: transparent !important;
          border: none !important;
        }

        .user-location-marker {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }

        .leaflet-marker-shadow {
          display: none !important;
        }

        /* Staggered marker pop-in animation */
        @keyframes marker-pop-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          60% {
            transform: scale(1.15);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        /* Pulsing ring for user location */
        @keyframes pulse-ring {
          0% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5), 0 2px 8px rgba(0,0,0,0.3);
          }
          100% {
            box-shadow: 0 0 0 15px rgba(59, 130, 246, 0), 0 2px 8px rgba(0,0,0,0.3);
          }
        }

        /* Z-index fixes for map elements */
        .map-container {
          z-index: 1;
        }

        .leaflet-popup,
        .leaflet-tooltip,
        .location-popup,
        .marker-tooltip {
          z-index: 1000 !important;
        }

        .leaflet-control-container {
          z-index: 800 !important;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .map-container {
            min-height: 400px !important;
          }
        }

        @media (min-width: 769px) and (max-width: 1024px) {
          .map-container {
            min-height: 500px !important;
          }
        }

        @media (min-width: 1025px) {
          .map-container {
            min-height: 600px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default DemandMap;
