import { useEffect, useRef, useState, useCallback } from 'react';
import { X, MapPin, Navigation, Loader2, Search, AlertCircle, Hash } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon (broken with bundlers)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const CASA_LAT = 33.5731;
const CASA_LNG = -7.5898;

export interface ResolvedLocation {
  lat: number;
  lng: number;
  address?: string;
  city?: string;
}

interface MapPickerProps {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  customerName: string;
  onConfirm: (location: ResolvedLocation) => void;
  onClear: () => void;
  onClose: () => void;
}

interface SearchResult {
  lat: string;
  lon: string;
  display_name: string;
}

// Remove Arabic/RTL characters that break PDF rendering
function latinOnly(str: string): string {
  return str
    .replace(/[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g, '')
    .replace(/[‎‏‪-‮⁦-⁩]/g, '') // bidirectional control chars
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function reverseGeocode(lat: number, lng: number): Promise<{ address: string; city: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`,
      { headers: { 'User-Agent': 'azmol-stockerp/1.0' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    const street = [a.road, a.house_number].filter(Boolean).map(latinOnly).join(' ');
    const neighbourhood = latinOnly(a.neighbourhood || a.suburb || a.quarter || '');
    const address = [street, neighbourhood].filter(Boolean).join(', ') || latinOnly(data.display_name?.split(',')[0] || '');
    const city = latinOnly(a.city || a.town || a.village || a.county || '');
    return { address, city };
  } catch {
    return null;
  }
}

async function forwardGeocode(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=es&countrycodes=ma`,
      { headers: { 'User-Agent': 'azmol-stockerp/1.0' } }
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function checkGeoPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state as 'granted' | 'denied' | 'prompt';
  } catch {
    return 'unknown';
  }
}

// Parse "33.5731, -7.5898" or "33.5731 -7.5898" or "33.5731,-7.5898"
function parseCoords(input: string): { lat: number; lng: number } | null {
  const clean = input.trim().replace(/\s+/g, ' ');
  const match = clean.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export default function MapPicker({ latitude, longitude, customerName, onConfirm, onClear, onClose }: MapPickerProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pending, setPending] = useState<ResolvedLocation | null>(
    latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null
  );
  const [resolving, setResolving] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsBlocked, setGpsBlocked] = useState(false);

  // Manual coordinates input
  const [showCoordsInput, setShowCoordsInput] = useState(false);
  const [coordsRaw, setCoordsRaw] = useState('');
  const [coordsError, setCoordsError] = useState('');

  const placePin = useCallback(async (lat: number, lng: number, map: L.Map) => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng]).addTo(map);
    }
    setPending({ lat, lng });
    setResolving(true);
    const resolved = await reverseGeocode(lat, lng);
    setResolving(false);
    setPending({ lat, lng, address: resolved?.address, city: resolved?.city });
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initLat = latitude ?? CASA_LAT;
    const initLng = longitude ?? CASA_LNG;

    const map = L.map(containerRef.current, {
      center: [initLat, initLng],
      zoom: latitude != null ? 16 : 13,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    if (latitude != null && longitude != null) {
      markerRef.current = L.marker([latitude, longitude]).addTo(map);
    }

    map.on('click', (e: L.LeafletMouseEvent) => {
      placePin(e.latlng.lat, e.latlng.lng, map);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowResults(false);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.trim().length < 3) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await forwardGeocode(value);
      setSearchResults(results);
      setShowResults(true);
      setSearching(false);
    }, 600);
  };

  const handleSelectResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setShowResults(false);
    setSearchQuery('');
    setSearchResults([]);
    if (mapRef.current) {
      mapRef.current.setView([lat, lng], 16);
      placePin(lat, lng, mapRef.current);
    }
  };

  const handleLocateMe = async () => {
    if (!navigator.geolocation) { alert('Tu navegador no soporta geolocalización'); return; }
    const perm = await checkGeoPermission();
    if (perm === 'denied') { setGpsBlocked(true); return; }
    setGpsLoading(true);
    setGpsBlocked(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        mapRef.current?.setView([lat, lng], 16);
        if (mapRef.current) placePin(lat, lng, mapRef.current);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) setGpsBlocked(true);
        else alert('No se pudo obtener tu ubicación.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleCoordsSubmit = () => {
    setCoordsError('');
    const parsed = parseCoords(coordsRaw);
    if (!parsed) {
      setCoordsError('Formato inválido. Ejemplo: 33.5731, -7.5898');
      return;
    }
    setShowCoordsInput(false);
    setCoordsRaw('');
    if (mapRef.current) {
      mapRef.current.setView([parsed.lat, parsed.lng], 16);
      placePin(parsed.lat, parsed.lng, mapRef.current);
    }
  };

  const handleConfirm = () => {
    if (pending) onConfirm(pending);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-3">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-bold text-slate-800 text-sm">{customerName || 'Client'}</p>
              <p className="text-xs text-slate-500">Recherchez l'adresse ou cliquez sur la carte</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 py-2 border-b border-slate-100 relative">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            {searching ? (
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />
            ) : (
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
            )}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              placeholder="Rechercher une adresse, quartier, ville..."
              className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchResults([]); setShowResults(false); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {showResults && searchResults.length > 0 && (
            <div className="absolute left-4 right-4 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
              {searchResults.map((r, i) => (
                <button key={i} onClick={() => handleSelectResult(r)}
                  className="w-full text-left px-3 py-2.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 border-b border-slate-100 last:border-0 flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                  <span className="line-clamp-2">{r.display_name}</span>
                </button>
              ))}
            </div>
          )}
          {showResults && searchResults.length === 0 && !searching && searchQuery.length >= 3 && (
            <div className="absolute left-4 right-4 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 px-3 py-3 text-xs text-slate-500 text-center">
              No se encontraron resultados
            </div>
          )}
        </div>

        {/* Manual coordinates input */}
        {showCoordsInput && (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
            <p className="text-xs text-slate-600 mb-1.5">
              Abre <strong>Google Maps</strong>, mantén pulsado en el punto → copia las coordenadas que aparecen abajo
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={coordsRaw}
                onChange={(e) => { setCoordsRaw(e.target.value); setCoordsError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleCoordsSubmit()}
                placeholder="33.5731, -7.5898"
                autoFocus
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
              <button onClick={handleCoordsSubmit}
                className="px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700">
                Ir
              </button>
              <button onClick={() => { setShowCoordsInput(false); setCoordsRaw(''); setCoordsError(''); }}
                className="px-3 py-2 bg-slate-200 text-slate-600 text-xs rounded-lg hover:bg-slate-300">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {coordsError && <p className="text-xs text-red-500 mt-1">{coordsError}</p>}
          </div>
        )}

        {/* GPS blocked notice */}
        {gpsBlocked && !showCoordsInput && (
          <div className="mx-4 mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800">
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <AlertCircle className="w-3.5 h-3.5" /> GPS bloqueado en Chrome
            </div>
            <p className="text-amber-700">Ve a <strong>Configuración de Chrome → Privacidad → Configuración del sitio → Ubicación</strong> y permite este sitio. O usa el buscador o pega coordenadas de Google Maps.</p>
          </div>
        )}

        {/* Map */}
        <div ref={containerRef} className="flex-1" style={{ minHeight: 260 }} />

        {/* Resolved address preview */}
        {pending && (
          <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 text-xs text-blue-800 flex items-center gap-2 min-h-[36px]">
            {resolving ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Obteniendo dirección...</>
            ) : (
              <>
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {[pending.address, pending.city].filter(Boolean).join(' — ') || `${pending.lat.toFixed(5)}, ${pending.lng.toFixed(5)}`}
                </span>
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 gap-2 flex-wrap">
          <div className="flex gap-2">
            <button onClick={handleLocateMe} disabled={gpsLoading}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-50 border border-blue-200 disabled:opacity-50">
              {gpsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
              GPS
            </button>
            <button
              onClick={() => { setShowCoordsInput(v => !v); setGpsBlocked(false); }}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border ${showCoordsInput ? 'bg-slate-700 text-white border-slate-700' : 'text-slate-600 hover:text-slate-800 border-slate-200 hover:bg-slate-50'}`}
            >
              <Hash className="w-3.5 h-3.5" />
              Coordenadas
            </button>
          </div>
          <div className="flex gap-2 ml-auto">
            {(latitude != null || pending) && (
              <button onClick={() => { onClear(); onClose(); }}
                className="text-xs font-semibold text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 border border-red-200">
                Borrar
              </button>
            )}
            <button onClick={handleConfirm} disabled={!pending || resolving}
              className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-4 py-2 rounded-lg">
              Enregistrer la position
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
