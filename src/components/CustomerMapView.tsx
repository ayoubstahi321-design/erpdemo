import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Customer } from '../types';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface CustomerMapViewProps {
  customers: Customer[];
  onClose: () => void;
}

export default function CustomerMapView({ customers, onClose }: CustomerMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const withGPS = customers.filter(c => c.latitude != null && c.longitude != null);

    const map = L.map(containerRef.current, {
      center: [33.5731, -7.5898],
      zoom: 12,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const bounds: [number, number][] = [];

    withGPS.forEach(c => {
      const lat = c.latitude!;
      const lng = c.longitude!;
      bounds.push([lat, lng]);

      const popup = `
        <div style="min-width:160px">
          <strong style="font-size:13px">${c.name}</strong><br/>
          <span style="font-size:11px;color:#64748b">${[c.address, c.city].filter(Boolean).join(', ') || ''}</span><br/>
          <span style="font-size:11px">${c.phone || ''}</span><br/>
          <div style="display:flex;gap:4px;margin-top:6px">
            <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank"
              style="padding:3px 8px;background:#3b82f6;color:white;border-radius:4px;font-size:11px;font-weight:bold;text-decoration:none">Maps</a>
            <a href="https://waze.com/ul?ll=${lat},${lng}&navigate=yes" target="_blank"
              style="padding:3px 8px;background:#06b6d4;color:white;border-radius:4px;font-size:11px;font-weight:bold;text-decoration:none">Waze</a>
          </div>
        </div>
      `;

      L.marker([lat, lng]).addTo(map).bindPopup(popup);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className="flex-1" style={{ minHeight: 420 }} />
  );
}
