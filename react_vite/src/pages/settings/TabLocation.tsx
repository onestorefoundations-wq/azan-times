import { useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MasjidProfile } from '../../core/appConfig';
import {
  NumberField,
  OutlineButton,
  SettingsDropdown,
  SettingsFormField,
  SettingsFormRow,
  SettingsTabScaffold,
  TextInput,
  useTheme,
} from './helpers';

const pinIcon = L.divIcon({
  html: '<div style="font-size:32px;line-height:1">📍</div>',
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

interface Place {
  displayName: string;
  lat: number;
  lon: number;
}

/**
 * getCurrentPosition's own messages are written for a browser on a phone
 * ("User denied Geolocation"), and say nothing about what to do next. On the TV
 * boxes this runs on, the usual failure is not a refusal at all: the box has no
 * location hardware to ask, which is why the manifest marks hardware.location
 * as not required. Each case names the way out instead.
 */
function geolocationMessage(e: GeolocationPositionError): string {
  switch (e.code) {
    case e.PERMISSION_DENIED:
      return 'Location permission was refused. Allow it in Android Settings → Apps → Masjid Display → Permissions, or set the location from the map below instead.';
    case e.POSITION_UNAVAILABLE:
      return 'No location service answered. Most TV boxes have no GPS — use “Select from Map” below to search for the masjid by name, or type the coordinates in by hand.';
    case e.TIMEOUT:
      return 'Locating timed out after 15 seconds. Indoors that usually means no signal reaches the device — use “Select from Map” below instead.';
    default:
      return `Could not get location: ${e.message}`;
  }
}

function ClickHandler({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  map.setView([lat, lon], map.getZoom());
  return null;
}

export default function TabLocation({
  profile,
  onChange,
}: {
  profile: MasjidProfile;
  onChange: (p: MasjidProfile) => void;
}) {
  const t = useTheme();
  const [showMap, setShowMap] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);

  const lat = profile.latitude;
  const lon = profile.longitude;

  const setLatLon = (la: number, lo: number) =>
    onChange({ ...profile, latitude: la, longitude: lo });

  const getLocation = () => {
    setErr(null);
    setNote(null);

    // Some older WebViews leave navigator.geolocation off entirely rather than
    // failing the call. Without this the button would throw instead of
    // explaining itself.
    if (!navigator.geolocation) {
      setErr(
        'This device has no location service at all. Use “Select from Map” below to search for the masjid by name, or type the coordinates in by hand.',
      );
      return;
    }

    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = +pos.coords.latitude.toFixed(6);
        const lo = +pos.coords.longitude.toFixed(6);
        setLatLon(la, lo);
        setGpsBusy(false);

        // Show the fix on the map rather than only as two numbers: a wrong
        // reading -- a box geolocating by IP lands in the wrong city -- is
        // obvious on a map and invisible as decimals. The map needs tiles from
        // the network, so offline it stays closed and the note says why.
        const online = typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
        setShowMap(online);
        const accuracy = Math.round(pos.coords.accuracy);
        const found = `Found ${la}, ${lo}${Number.isFinite(accuracy) ? ` (±${accuracy} m)` : ''}.`;
        setNote(
          online
            ? `${found} Check the pin below — tap the map to correct it.`
            : `${found} The map needs internet to show it, so check the coordinates by hand.`,
        );
      },
      (e) => {
        setGpsBusy(false);
        setErr(geolocationMessage(e));
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const search = async (q: string) => {
    setQuery(q);
    if (q.length < 3) {
      setResults([]);
      return;
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
      );
      const data = await res.json();
      setResults(
        (data as any[]).map((d) => ({ displayName: d.display_name, lat: +d.lat, lon: +d.lon })),
      );
    } catch {
      setResults([]);
    }
  };

  return (
    <SettingsTabScaffold title="Location & Calculation">
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <OutlineButton onClick={gpsBusy ? undefined : getLocation} style={{ color: t.accentTeal, borderColor: t.accentTeal }}>
          {gpsBusy ? 'Getting location…' : '📍 Get My Location'}
        </OutlineButton>
        <OutlineButton onClick={() => setShowMap((v) => !v)}>{showMap ? '🗺️ Hide Map' : '🗺️ Select from Map'}</OutlineButton>
      </div>

      {err && (
        <div style={{ color: t.accentRed, fontSize: 12, lineHeight: 1.5, marginBottom: 8 }}>{err}</div>
      )}
      {note && (
        <div style={{ color: t.accentTeal, fontSize: 12, lineHeight: 1.5, marginBottom: 8 }}>
          {note}
        </div>
      )}

      {showMap && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <TextInput value={query} placeholder="🔍 Search for a city or mosque..." onChange={(e) => search(e.target.value)} />
            {results.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  zIndex: 1000,
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: t.bgSurface,
                  border: `1px solid ${t.borderSubtle}`,
                  borderRadius: 8,
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
              >
                {results.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setLatLon(+r.lat.toFixed(6), +r.lon.toFixed(6));
                      setResults([]);
                      setQuery(r.displayName);
                    }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: t.textPrimary }}
                  >
                    {r.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ height: 240, borderRadius: 10, overflow: 'hidden' }}>
            <MapContainer center={[lat, lon]} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
              <Marker position={[lat, lon]} icon={pinIcon} />
              <ClickHandler onPick={(la, lo) => setLatLon(+la.toFixed(6), +lo.toFixed(6))} />
              <Recenter lat={lat} lon={lon} />
            </MapContainer>
          </div>
        </div>
      )}

      <SettingsFormRow
        left={
          <SettingsFormField label="Latitude">
            <NumberField
              value={lat}
              fallback={0}
              min={-90}
              max={90}
              decimals
              onCommit={(n) => onChange({ ...profile, latitude: n })}
            />
          </SettingsFormField>
        }
        right={
          <SettingsFormField label="Longitude">
            <NumberField
              value={lon}
              fallback={0}
              min={-180}
              max={180}
              decimals
              onCommit={(n) => onChange({ ...profile, longitude: n })}
            />
          </SettingsFormField>
        }
      />

      <SettingsFormField label="Timezone ID" helpText="IANA timezone, e.g. Europe/London, Asia/Riyadh, America/New_York">
        <TextInput value={profile.timezoneId} placeholder="e.g. Asia/Riyadh" onChange={(e) => onChange({ ...profile, timezoneId: e.target.value.trim() })} />
      </SettingsFormField>

      <SettingsDropdown
        label="Calculation Method"
        value={profile.calculationMethod}
        onChange={(v) => onChange({ ...profile, calculationMethod: v })}
        options={[
          { value: 'UmmAlQura', label: 'Umm Al-Qura (Saudi Arabia)' },
          { value: 'MoonsightingCommittee', label: 'Moonsighting Committee' },
          { value: 'NorthAmerica', label: 'ISNA (North America)' },
          { value: 'Muslim_World_League', label: 'Muslim World League (MWL)' },
          { value: 'Egyptian', label: 'Egyptian General Authority' },
          { value: 'Karachi', label: 'University of Islamic Sciences, Karachi' },
        ]}
      />

      <SettingsDropdown
        label="Asr Juristic Method"
        value={profile.asrJuristicMethod}
        onChange={(v) => onChange({ ...profile, asrJuristicMethod: v })}
        options={[
          { value: 'Standard', label: "Standard (Shafi'i, Maliki, Hanbali)" },
          { value: 'Hanafi', label: 'Hanafi (Later Asr time)' },
        ]}
      />
    </SettingsTabScaffold>
  );
}
