"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Globe2,
  ArrowUpRight,
  MapPin,
  Radio,
  RefreshCw,
  Send,
  Database,
  X,
} from "lucide-react";
import {
  GlassButton,
  GlassTextField,
  GlassAvatar,
  GlassChip,
  GlassAlert,
  GlassDialog,
  GlassDataGrid,
} from "./ui";
import type { Greeting } from "@/lib/validation";
const cities = [
  { city: "Denver", latitude: 39.7392, longitude: -104.9903 },
  { city: "London", latitude: 51.5072, longitude: -0.1276 },
  { city: "Tokyo", latitude: 35.6895, longitude: 139.6917 },
  { city: "Florence", latitude: 43.7696, longitude: 11.2558 },
  { city: "Cape Town", latitude: -33.9249, longitude: 18.4241 },
  { city: "São Paulo", latitude: -23.5505, longitude: -46.6333 },
  { city: "Sydney", latitude: -33.8688, longitude: 151.2093 },
  { city: "San Francisco", latitude: 37.7749, longitude: -122.4194 },
];
export default function World({ notify }: { notify: (s: string) => void }) {
  const [greetings, setGreetings] = useState<Greeting[]>([]),
    [stats, setStats] = useState({ total: 0, cities: 0 }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [radius, setRadius] = useState("21000"),
    [origin, setOrigin] = useState(0),
    [search, setSearch] = useState(""),
    [view, setView] = useState<"cards" | "table">("cards");
  const [open, setOpen] = useState(false),
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState(""),
    [name, setName] = useState(""),
    [message, setMessage] = useState("Hello, world!"),
    [city, setCity] = useState(0),
    [selected, setSelected] = useState<Greeting | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          radius,
          latitude: String(cities[origin].latitude),
          longitude: String(cities[origin].longitude),
          search,
        });
        const response = await fetch(`/api/greetings?${params}`, {
          signal: abort.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setGreetings(data.greetings);
        setStats(data.stats);
      } catch (e) {
        if (!abort.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Unable to load greetings.",
          );
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [radius, origin, search, refresh]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/greetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, message, ...cities[city] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setOpen(false);
      setName("");
      setMessage("Hello, world!");
      setRefresh((v) => v + 1);
      notify("Your hello is on the map. Saved to PostgreSQL.");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <div className="world-heading">
        <div className="page-heading">
          <div className="eyebrow">A SMALL MESSAGE. A BIG WORLD.</div>
          <h1>Hello from everywhere.</h1>
          <p>
            A living guestbook, connected by coordinates.
            <br />
            Leave a little hello. Discover how close the world can feel.
          </p>
        </div>
        <GlassButton startIcon={<PlusIcon />} onClick={() => setOpen(true)}>
          Add your hello
        </GlassButton>
      </div>
      <div className="world-metrics">
        <div>
          <Radio size={19} />
          <strong>{stats.total}</strong>
          <span>hellos in the world</span>
        </div>
        <div>
          <MapPin size={19} />
          <strong>{stats.cities}</strong>
          <span>connected cities</span>
        </div>
        <div>
          <Database size={19} />
          <strong>PostGIS</strong>
          <span>real spatial queries</span>
        </div>
      </div>
      <section className="panel world-map">
        <div className="panel-heading">
          <span>
            <Globe2 size={16} /> THE HELLO NETWORK
          </span>
          <span className="muted">Equirectangular coordinate view</span>
        </div>
        <svg
          viewBox="0 0 1000 480"
          role="img"
          aria-label="Greeting coordinates across the world"
        >
          <defs>
            <radialGradient id="mapGlow">
              <stop stopColor="#547fc0" stopOpacity=".16" />
              <stop offset="1" stopColor="#547fc0" stopOpacity="0" />
            </radialGradient>
            <pattern
              id="mapGrid"
              width="55.55"
              height="53.33"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M55.55 0H0V53.33"
                fill="none"
                stroke="currentColor"
                strokeOpacity=".1"
              />
            </pattern>
          </defs>
          <rect width="1000" height="480" fill="url(#mapGlow)" />
          <rect width="1000" height="480" fill="url(#mapGrid)" />
          <g
            fill="currentColor"
            fillOpacity=".09"
            stroke="currentColor"
            strokeOpacity=".13"
            strokeWidth="1.3"
          >
            <path d="M70 100L130 68 190 68 220 95 260 105 285 140 260 163 235 156 220 187 190 195 173 225 145 202 120 170 90 150Z" />
            <path d="M240 222L285 228 320 262 305 306 277 355 259 391 245 351 231 302 214 267Z" />
            <path d="M460 95L493 78 530 90 544 116 524 146 500 150 482 131 455 134Z" />
            <path d="M460 161L500 145 545 163 567 209 545 265 514 308 490 274 480 237 448 196Z" />
            <path d="M538 92L590 65 675 64 740 88 810 81 876 123 849 151 799 158 773 205 734 214 695 191 660 217 624 178 588 153 551 154Z" />
            <path d="M786 293L837 277 878 301 887 341 852 363 800 350 775 326Z" />
            <path d="M300 60L338 45 365 67 341 96 315 91Z" />
            <path d="M0 448L130 430 270 440 470 425 650 437 810 421 1000 444V480H0Z" />
          </g>
          {greetings.map((g) => {
            const x = ((g.longitude + 180) / 360) * 1000,
              y = ((90 - g.latitude) / 180) * 480;
            return (
              <g
                key={g.id}
                className="map-marker"
                role="button"
                tabIndex={0}
                aria-label={`${g.name} in ${g.city}`}
                onClick={() => setSelected(g)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(g);
                  }
                }}
              >
                <circle cx={x} cy={y} r={13} fill="#91bcff" opacity=".12" />
                <circle
                  cx={x}
                  cy={y}
                  r={5}
                  fill="#acccff"
                  stroke="#fff"
                  strokeWidth="1.5"
                />
                <title>
                  {g.city}: {g.message}
                </title>
              </g>
            );
          })}
        </svg>
        <div className="map-bottom">
          <span>
            <span className="status-dot" />{" "}
            {loading
              ? "Finding signals…"
              : `${greetings.length} matching greetings`}
          </span>
          <span>Click a point to read its hello</span>
        </div>
      </section>
      <div className="world-filters">
        <label>
          Distance from
          <select
            aria-label="Distance origin"
            value={origin}
            onChange={(e) => setOrigin(Number(e.target.value))}
          >
            {cities.map((c, i) => (
              <option key={c.city} value={i}>
                {c.city}
              </option>
            ))}
          </select>
        </label>
        <label>
          Within
          <select
            aria-label="Search radius"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
          >
            <option value="21000">Anywhere on Earth</option>
            <option value="1000">1,000 km</option>
            <option value="5000">5,000 km</option>
            <option value="10000">10,000 km</option>
          </select>
        </label>
        <label className="world-search">
          Find a hello
          <input
            aria-label="Search greetings"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, city, or message…"
          />
        </label>
        <button
          className="icon-button"
          aria-label="Refresh greetings"
          onClick={() => setRefresh((v) => v + 1)}
        >
          <RefreshCw size={18} />
        </button>
        <div className="segmented">
          <button
            className={view === "cards" ? "selected" : ""}
            onClick={() => setView("cards")}
          >
            Cards
          </button>
          <button
            className={view === "table" ? "selected" : ""}
            onClick={() => setView("table")}
          >
            Data grid
          </button>
        </div>
      </div>
      <div className="section-heading">
        <h2>
          Signals from the world{" "}
          <span className="muted small">{greetings.length}</span>
        </h2>
        <span className="muted small">
          Seed greetings are illustrative · distances are calculated
        </span>
      </div>
      {error ? (
        <GlassAlert severity="error">
          {error}{" "}
          <button onClick={() => setRefresh((v) => v + 1)}>Retry</button>
        </GlassAlert>
      ) : loading ? (
        <div className="empty-state" role="status">
          Listening for signals…
        </div>
      ) : greetings.length === 0 ? (
        <div className="empty-state">
          <Globe2 size={32} />
          <h2>No hellos in this orbit yet.</h2>
          <p>
            Widen the distance, clear your search, or send the first greeting.
          </p>
          <GlassButton onClick={() => setOpen(true)}>
            Add your hello
          </GlassButton>
        </div>
      ) : view === "table" ? (
        <div className="panel">
          <GlassDataGrid
            data={greetings}
            columns={[
              {
                id: "name",
                accessorKey: "name",
                header: "Explorer",
                sortable: true,
              },
              {
                id: "city",
                accessorKey: "city",
                header: "City",
                sortable: true,
              },
              { id: "message", accessorKey: "message", header: "Hello" },
              {
                id: "distance",
                accessorKey: "distance",
                header: "Distance (km)",
                sortable: true,
              },
            ]}
          />
        </div>
      ) : (
        <div className="greeting-grid">
          {greetings.map((g) => (
            <article className="greeting-card" key={g.id}>
              <div className="row">
                <GlassAvatar size="small">{g.name.slice(0, 1)}</GlassAvatar>
                <div>
                  <strong>{g.name}</strong>
                  <span className="greeting-city">{g.city}</span>
                </div>
                <span className="greeting-distance">
                  {Math.round(g.distance).toLocaleString()} km
                </span>
              </div>
              <p>“{g.message}”</p>
              <div className="greeting-bottom">
                <span>
                  {g.latitude.toFixed(2)}°, {g.longitude.toFixed(2)}°
                </span>
                <span>{g.seeded ? "Sample hello" : "Community hello"}</span>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="spatial-note">
        <Database size={14} /> Distances use <code>ST_Distance</code> on
        geography. Radius filtering uses <code>ST_DWithin</code> and a GiST
        index. Showing up to 200 recent matches.
      </p>
      <GlassDialog
        open={open}
        onClose={() => {
          if (!saving) setOpen(false);
        }}
        title="A hello goes a long way."
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={save} className="greeting-form">
          <p>Pick a city and send a little signal into the world.</p>
          <GlassTextField
            id="greeting-name"
            label="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
          />
          <label className="field-label" htmlFor="greeting-city">
            Your city
          </label>
          <select
            id="greeting-city"
            value={city}
            onChange={(e) => setCity(Number(e.target.value))}
          >
            {cities.map((c, i) => (
              <option key={c.city} value={i}>
                {c.city}
              </option>
            ))}
          </select>
          <label className="field-label" htmlFor="greeting-message">
            Your hello
          </label>
          <textarea
            id="greeting-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={240}
            rows={3}
            required
          />
          <span className="muted small">
            {message.length}/240 · Saved in your local PostGIS database
          </span>
          {saveError && <GlassAlert severity="error">{saveError}</GlassAlert>}
          <GlassButton
            type="submit"
            isLoading={saving}
            loadingText="Sending…"
            disabled={
              !name.trim() ||
              name.trim().length > 60 ||
              !message.trim() ||
              saving
            }
            startIcon={<Send size={15} />}
          >
            Send hello
          </GlassButton>
          <button
            type="button"
            className="text-button"
            disabled={saving}
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
        </form>
      </GlassDialog>
      <GlassDialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Hello from ${selected.city}` : ""}
        actions={
          <GlassButton onClick={() => setSelected(null)}>
            Back to the world
          </GlassButton>
        }
      >
        <p className="selected-message">“{selected?.message}”</p>
        <p>— {selected?.name}</p>
        <span className="muted">
          {selected?.distance.toLocaleString()} km from {cities[origin].city}
        </span>
      </GlassDialog>
    </>
  );
}
function PlusIcon() {
  return (
    <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>
      +
    </span>
  );
}
