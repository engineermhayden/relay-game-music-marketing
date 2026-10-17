"use client";
import { useEffect, useState, type CSSProperties } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Orbit,
  Layers3,
  FlaskConical,
  Globe2,
  BookOpen,
  Github,
  Command,
  Search,
  Sun,
  Moon,
  Sparkles,
  Box,
  MousePointer2,
  Accessibility,
  ChevronRight,
  Menu,
  X,
  Check,
  Copy,
  RotateCcw,
} from "lucide-react";
import {
  ThemeProvider,
  usePreferences,
  GlassButton,
  MagneticButton,
  Card,
  GlassSlider,
  GlassSwitch,
  GlassChip,
  GlassSnackbar,
} from "./ui";
import dynamic from "next/dynamic";
const demoCount = 48;
const Atlas = dynamic(() => import("./atlas"), {
  loading: () => (
    <div className="empty-state">Opening the component atlas...</div>
  ),
});
import World from "./world";
import {
  FrostedGlass,
  DimensionalGlass,
  HeatGlass,
} from "@galileo/components/surfaces";
import {
  AccessibilityProvider,
  useAccessibility,
} from "@galileo/components/AccessibilityProvider";
import { GlassLocalizationProvider } from "@galileo/components/DatePicker/GlassLocalizationProvider";
import { createDateFnsAdapter } from "@galileo/components/DatePicker/adapters/dateFnsAdapter";
const dateAdapter = createDateFnsAdapter();
import { AnimationProvider } from "@galileo/contexts/AnimationContext";

type View = "overview" | "components" | "playground" | "world" | "about";
const navigation = [
  { id: "overview", label: "Overview", icon: Orbit },
  { id: "components", label: "Component atlas", icon: Layers3 },
  { id: "playground", label: "Glass laboratory", icon: FlaskConical },
  { id: "world", label: "Hello, world", icon: Globe2 },
  { id: "about", label: "Why Galileo?", icon: BookOpen },
] as const;

export default function Observatory() {
  const [light, setLight] = useState(false);
  return (
    <ThemeProvider
      initialColorMode="dark"
      forceColorMode={light ? "light" : "dark"}
      respectSystemPreference={false}
    >
      <GlassLocalizationProvider adapter={dateAdapter}>
        <AccessibilityProvider>
          <Shell light={light} setLight={setLight} />
        </AccessibilityProvider>
      </GlassLocalizationProvider>
    </ThemeProvider>
  );
}
function Shell({
  light,
  setLight,
}: {
  light: boolean;
  setLight: (v: boolean) => void;
}) {
  const [view, setView] = useState<View>("overview");
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(false);
  const { reducedMotion, setReducedMotion } = useAccessibility();
  const go = (next: View) => {
    setView(next);
    setMobile(false);
    window.location.hash = next;
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.slice(1);
      if (navigation.some((n) => n.id === hash)) setView(hash as View);
    };
    sync();
    window.addEventListener("hashchange", sync);
    fetch("/api/health")
      .then((r) => setOnline(r.ok))
      .catch(() => setOnline(false));
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("catalog-search")?.focus();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  return (
    <AnimationProvider value={{ disableAnimation: reducedMotion }}>
      <div
        className={`app ${light ? "light" : ""} ${reducedMotion ? "reduced-motion" : ""}`}
      >
        <a className="skip" href="#main">
          Skip to content
        </a>
        <aside className={`sidebar ${mobile ? "open" : ""}`}>
          <a className="brand" href="#overview" onClick={() => go("overview")}>
            <img src="/orbit.svg" alt="" width="38" height="38" />
            <span>
              galileo<span className="brand-sub">GLASS OBSERVATORY</span>
            </span>
          </a>
          <button
            className="mobile-close icon-button"
            onClick={() => setMobile(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
          <div className="workspace-tag">
            <span className="status-dot" /> Interactive showcase <span>01</span>
          </div>
          <p className="nav-caption">EXPLORE THE SYSTEM</p>
          <nav aria-label="Main navigation">
            {navigation.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => go(id)}
                className={`nav-item ${view === id ? "active" : ""}`}
                aria-current={view === id ? "page" : undefined}
              >
                <Icon size={18} />
                {label}
                {id === "components" ? (
                  <span className="nav-count">{demoCount}</span>
                ) : (
                  view === id && (
                    <ChevronRight size={14} className="nav-arrow" />
                  )
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-note">
            <div className="mini-orbit">
              <Orbit size={24} />
            </div>
            <h4>A little less ordinary.</h4>
            <p>
              Explore the space between beautiful design and natural
              interaction.
            </p>
            <button onClick={() => go("playground")}>
              Enter the laboratory <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="sidebar-bottom">
            <a
              href="https://github.com/auraoneai/galileo-glass-ui"
              target="_blank"
              rel="noreferrer"
            >
              <Github size={16} /> Upstream source <ArrowUpRight size={13} />
            </a>
            <div className="version">
              GALILEO GLASS UI <span>v1.0.28</span>
            </div>
          </div>
        </aside>
        {mobile && (
          <button
            className="mobile-backdrop"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          />
        )}
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="mobile-toggle icon-button"
                onClick={() => setMobile(true)}
                aria-label="Open navigation"
              >
                <Menu size={20} />
              </button>
              <span>Observatory</span>
              <ChevronRight size={14} />
              <strong>{navigation.find((n) => n.id === view)?.label}</strong>
            </div>
            <div className="top-actions">
              <label className="search">
                <Search size={15} />
                <input
                  id="catalog-search"
                  placeholder="Find a component…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    if (e.target.value) go("components");
                  }}
                />
                <kbd>⌘ K</kbd>
              </label>
              <button
                className="icon-button"
                onClick={() => setLight(!light)}
                aria-label={
                  light ? "Switch to dark theme" : "Switch to light theme"
                }
              >
                {light ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              <span className="avatar-small">G</span>
            </div>
          </header>
          <main id="main">
            {view === "overview" && <Overview go={go} notify={setToast} />}
            {view === "components" && (
              <>
                <PageHeading
                  eyebrow="THE COMPONENT ATLAS"
                  title="Small pieces. Infinite possibilities."
                  description="Real Galileo components. Working controls. Explore the collection, inspect the source, and make it your own."
                />
                <Atlas search={search} notify={setToast} />
              </>
            )}
            {view === "playground" && (
              <>
                <PageHeading
                  eyebrow="EXPERIMENT 01 / MATERIAL & MOTION"
                  title="Make yourself a little glass."
                  description="Tune the material. Feel the spring. See what changes when the interface has a little depth."
                />
                <Laboratory notify={setToast} />
              </>
            )}
            {view === "world" && <World notify={setToast} />}
            {view === "about" && <About go={go} />}
            <footer>
              <span>
                <span className={`status-dot ${online ? "" : "offline"}`} />
                {online ? "PostGIS connected" : "PostGIS unavailable"}
              </span>
              <span>TypeScript · Next.js · Docker Compose</span>
              <button onClick={() => setReducedMotion(!reducedMotion)}>
                <Accessibility size={14} />
                {reducedMotion ? "Reduced motion on" : "Reduce motion"}
              </button>
            </footer>
          </main>
        </div>
        <GlassSnackbar
          open={!!toast}
          message={toast}
          severity="success"
          position="bottom-right"
          autoHideDuration={4000}
          onClose={() => setToast("")}
        />
      </div>
    </AnimationProvider>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
function Overview({
  go,
  notify,
}: {
  go: (v: View) => void;
  notify: (s: string) => void;
}) {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="tiny-star">✧</span> A NEW PERSPECTIVE ON UI
          </div>
          <h1>
            Hello, world.
            <br />
            <span>Meet glass.</span>
          </h1>
          <p>
            A living playground for Galileo Glass UI.
            <br />
            Beautiful surfaces. Physical interactions.
            <br />A whole universe of components to explore.
          </p>
          <div className="hero-actions">
            <GlassButton
              size="large"
              onClick={() => go("components")}
              endIcon={<ArrowRight size={16} />}
            >
              Explore components
            </GlassButton>
            <button className="text-button" onClick={() => go("playground")}>
              Try the playground <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="hero-tags">
            <span>React + TypeScript</span>
            <i />
            <span>Open source</span>
            <i />
            <span>Built to interact</span>
          </div>
        </div>
        <div
          className="hero-art"
          aria-label="An abstract orbital glass sculpture"
        >
          <div className="star-field" />
          <div className="planet-glow" />
          <div className="orbital-ring ring-one" />
          <div className="orbital-ring ring-two" />
          <div className="planet">
            <div className="planet-grid" />
            <div className="planet-core" />
          </div>
          <div className="floating-tag tag-one">
            <span className="status-dot" /> glassSurface()
            <small>TRANSPARENCY + DEPTH</small>
          </div>
          <div className="floating-tag tag-two">
            <Sparkles size={17} />
            <span>
              Looks like glass.
              <br />
              <strong>Feels alive.</strong>
            </span>
          </div>
          <span className="art-coordinate">
            37° 46′ N &nbsp; / &nbsp; EXPLORING THE POSSIBLE
          </span>
        </div>
      </section>
      <section className="stat-strip">
        {[
          [demoCount.toString(), "Interactive demo groups"],
          ["9", "Glass surface presets"],
          ["3", "Services. One command."],
          ["∞", "Ways to say hello"],
        ].map(([value, label]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>
      <div className="section-heading">
        <div>
          <div className="eyebrow">NOT JUST A PRETTY SURFACE</div>
          <h2>Designed to be experienced.</h2>
        </div>
        <button className="text-button" onClick={() => go("about")}>
          Why Galileo? <ArrowUpRight size={16} />
        </button>
      </div>
      <section className="feature-grid">
        <article className="feature-card material-feature">
          <div className="feature-visual glass-stack">
            <div />
            <div />
            <div>
              <Layers3 size={28} />
            </div>
          </div>
          <div className="feature-label">01 / MATERIAL</div>
          <h3>Depth you can feel.</h3>
          <p>
            Frosted surfaces, soft reflections, and luminous edges. A coherent
            visual language across your interface.
          </p>
          <button onClick={() => go("playground")}>
            Shape the material <ArrowRight size={16} />
          </button>
        </article>
        <article className="feature-card motion-feature">
          <div className="feature-visual motion-orbit">
            <div className="orbit-line" />
            <MagneticButton
              onClick={() =>
                notify(
                  "Hello, explorer. That’s a real Galileo magnetic button.",
                )
              }
            >
              <MousePointer2 size={24} />
            </MagneticButton>
            <span>HOVER. CLICK. FEEL IT.</span>
          </div>
          <div className="feature-label">02 / MOTION</div>
          <h3>A natural response.</h3>
          <p>
            Spring motion and magnetic interactions give the interface weight,
            momentum, and personality.
          </p>
          <button onClick={() => go("playground")}>
            Play with physics <ArrowRight size={16} />
          </button>
        </article>
        <article className="feature-card world-feature">
          <div className="feature-visual world-preview">
            <Globe2 size={102} strokeWidth={0.65} />
            <div className="hello-pill">
              こんにちは <span>↗</span>
            </div>
            <div className="hello-pill second">
              Hello, world <span>✧</span>
            </div>
          </div>
          <div className="feature-label">03 / CONNECTION</div>
          <h3>Hello from everywhere.</h3>
          <p>
            Leave a greeting on the world. Real PostgreSQL persistence, with
            distance powered by PostGIS.
          </p>
          <button onClick={() => go("world")}>
            Say hello <ArrowRight size={16} />
          </button>
        </article>
      </section>
      <section className="preview-band">
        <div>
          <div className="eyebrow">A SMALL TASTE OF THE SYSTEM</div>
          <h2>
            Ordinary controls.
            <br />
            Extraordinary character.
          </h2>
          <p>Everything here is a real, interactive Galileo component.</p>
          <button className="text-button" onClick={() => go("components")}>
            Open the component atlas <ArrowRight size={16} />
          </button>
        </div>
        <div className="control-preview">
          <div className="row">
            <GlassButton
              onClick={() =>
                notify("Hello, world! Your first glass interaction.")
              }
              startIcon={<Sparkles size={15} />}
            >
              Hello, world
            </GlassButton>
            <GlassChip label="Ready to explore" color="success" />
          </div>
          <GlassSlider label="A little more atmosphere" defaultValue={64} />
          <GlassSwitch label="Let there be glass" defaultChecked />
          <code>crafted with @galileo</code>
        </div>
      </section>
    </>
  );
}
function Laboratory({ notify }: { notify: (s: string) => void }) {
  const [blur, setBlur] = useState(18),
    [opacity, setOpacity] = useState(18),
    [glow, setGlow] = useState(35),
    [stiffness, setStiffness] = useState(180),
    [damping, setDamping] = useState(16),
    [tint, setTint] = useState("#91afff"),
    [variant, setVariant] = useState<"frosted" | "dimensional" | "heat">(
      "frosted",
    );
  const Surface =
    variant === "frosted"
      ? FrostedGlass
      : variant === "heat"
        ? HeatGlass
        : DimensionalGlass;
  const surfaceName =
    variant === "frosted"
      ? "FrostedGlass"
      : variant === "heat"
        ? "HeatGlass"
        : "DimensionalGlass";
  const code = `<${surfaceName}\n  style={{ backdropFilter: 'blur(${blur}px)',\n    background: '${tint}${Math.round(
    opacity * 2.55,
  )
    .toString(16)
    .padStart(
      2,
      "0",
    )}' }}\n>\n  <MagneticButton physicsOptions={{\n    stiffness: ${stiffness}, dampingRatio: ${(damping / (2 * Math.sqrt(stiffness))).toFixed(2)}\n  }}>Hello, world</MagneticButton>\n</${surfaceName}>`;
  return (
    <div className="lab-layout">
      <section className="panel lab-stage">
        <div className="panel-heading">
          <span>
            <FlaskConical size={16} /> LIVE MATERIAL PREVIEW
          </span>
          <GlassChip label="Interactive" size="small" color="info" />
        </div>
        <div className="lab-scene">
          <div className="scene-orb one" />
          <div className="scene-orb two" />
          <Surface
            className="material-card"
            padding={32}
            style={{
              width: "min(340px,90%)",
              padding: 32,
              borderRadius: 24,
              backdropFilter: `blur(${blur}px)`,
              background: `${tint}${Math.round(opacity * 2.55)
                .toString(16)
                .padStart(2, "0")}`,
              boxShadow: `0 0 ${glow * 2}px ${tint}25`,
              border: "1px solid #ffffff40",
            }}
          >
            <div className="sample-mark">
              <Orbit size={28} />
            </div>
            <div className="eyebrow">YOUR LITTLE UNIVERSE</div>
            <h2>Hello, world.</h2>
            <p>
              Move closer. Watch the light.
              <br />
              Give the button a little nudge.
            </p>
            <MagneticButton
              key={`${stiffness}-${damping}`}
              physicsOptions={{
                stiffness,
                dampingRatio: damping / (2 * Math.sqrt(stiffness)),
              }}
              onClick={() => notify("A hello with a little momentum.")}
            >
              Make a connection <ArrowUpRight size={16} />
            </MagneticButton>
          </Surface>
        </div>
        <div className="stage-caption">
          <MousePointer2 size={14} /> Hover the card and magnetic button to feel
          the interaction.
        </div>
      </section>
      <section className="panel lab-controls">
        <div className="panel-heading">
          THE MATERIAL EDITOR
          <button
            className="icon-button"
            aria-label="Reset material"
            onClick={() => {
              setBlur(18);
              setOpacity(18);
              setGlow(35);
              setStiffness(180);
              setDamping(16);
              setTint("#91afff");
              setVariant("frosted");
            }}
          >
            <RotateCcw size={15} />
          </button>
        </div>
        <label className="field-label">Surface treatment</label>
        <div className="segmented">
          {(["frosted", "dimensional", "heat"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVariant(v)}
              className={v === variant ? "selected" : ""}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="slider-field">
          <label>
            Blur <b>{blur}px</b>
          </label>
          <GlassSlider value={blur} onChange={setBlur} max={40} />
        </div>
        <div className="slider-field">
          <label>
            Opacity <b>{opacity}%</b>
          </label>
          <GlassSlider value={opacity} onChange={setOpacity} min={5} max={90} />
        </div>
        <div className="slider-field">
          <label>
            Glow <b>{glow}%</b>
          </label>
          <GlassSlider value={glow} onChange={setGlow} />
        </div>
        <label className="field-label">Tint</label>
        <div className="swatches">
          {["#91afff", "#bca4f6", "#6edac8", "#efb890"].map((c) => (
            <button
              key={c}
              style={{ background: c }}
              aria-label={`Use ${c} tint`}
              aria-pressed={tint === c}
              onClick={() => setTint(c)}
            >
              {tint === c && <Check size={15} />}
            </button>
          ))}
        </div>
        <hr />
        <label className="field-label">MAGNETIC SPRING</label>
        <div className="slider-field">
          <label>
            Stiffness <b>{stiffness}</b>
          </label>
          <GlassSlider
            value={stiffness}
            onChange={setStiffness}
            min={50}
            max={400}
          />
        </div>
        <div className="slider-field">
          <label>
            Damping <b>{damping}</b>
          </label>
          <GlassSlider value={damping} onChange={setDamping} min={5} max={40} />
        </div>
      </section>
      <section className="panel code-panel">
        <div className="panel-heading">
          <span>YOUR RECIPE / TSX</span>
          <button
            className="text-button"
            onClick={() => {
              navigator.clipboard
                .writeText(code)
                .then(() => notify("Recipe copied to clipboard."))
                .catch(() => notify("Select the recipe below to copy it."));
            }}
          >
            <Copy size={14} /> Copy recipe
          </button>
        </div>
        <pre>{code}</pre>
      </section>
    </div>
  );
}
function About({ go }: { go: (v: View) => void }) {
  return (
    <>
      <PageHeading
        eyebrow="BEYOND HELLO WORLD"
        title="A distinctive material. A physical response."
        description="Galileo’s appeal is the combination: a glass design language, a spring-based interaction system, and a broad React component collection."
      />
      <div className="about-grid">
        {[
          [
            Layers3,
            "A visual system, not a single effect",
            "Shared glass surfaces, borders, glow, and themes carry through forms, navigation, charts, and overlays. The material editor makes the differences tangible.",
          ],
          [
            MousePointer2,
            "Motion is part of the toolkit",
            "Magnetism, springs, gestures, and spatial hooks live alongside UI components. The magnetic buttons here use Galileo’s own physics implementation.",
          ],
          [
            Accessibility,
            "Preferences belong in the experience",
            "The framework exposes reduced-motion, contrast, and transparency preferences. This app includes a reduced-motion switch and respects operating-system motion settings.",
          ],
          [
            Box,
            "TypeScript all the way through",
            "Typed React props and composable components fit into a Next.js application. PostGIS and Docker Compose are additions made for this showcase.",
          ],
        ].map(([Icon, title, description]) => {
          const I = Icon as typeof Layers3;
          return (
            <article className="panel about-card" key={String(title)}>
              <I size={26} />
              <h2>{String(title)}</h2>
              <p>{String(description)}</p>
            </article>
          );
        })}
      </div>
      <section className="panel honest-note">
        <div className="eyebrow">AN HONEST LOOK AT THE TRADEOFFS</div>
        <h2>Explore the potential. Inspect the implementation.</h2>
        <p>
          The documented npm package was unavailable during setup, so this app
          includes the MIT-licensed source at commit <code>1474e6d</code>. Its
          package declares 1.0.28; an internal version constant still says
          1.0.23. The upstream source has inconsistent types and a few
          compatibility issues. Local patches are recorded in{" "}
          <code>vendor/galileo/PROVENANCE.md</code>.
        </p>
        <p>
          Large glass layers and animated effects can be expensive on
          lower-powered devices. Some controls need additional accessibility
          work before use in a production product. The data grid’s upstream drag
          feature is experimental. This showcase uses sorting and makes no
          blanket performance or accessibility certification claims.
        </p>
        <div className="row">
          <GlassButton onClick={() => go("components")}>
            Inspect the components <ArrowRight size={15} />
          </GlassButton>
          <a
            className="text-button"
            href="https://github.com/auraoneai/galileo-glass-ui"
            target="_blank"
            rel="noreferrer"
          >
            Read the upstream source <ArrowUpRight size={15} />
          </a>
        </div>
      </section>
      <section className="architecture">
        <span>
          Browser
          <br />
          <strong>Galileo + React</strong>
        </span>
        <ArrowRight />
        <span>
          Application
          <br />
          <strong>Next.js + TypeScript</strong>
        </span>
        <ArrowRight />
        <span>
          Spatial persistence
          <br />
          <strong>PostgreSQL + PostGIS</strong>
        </span>
      </section>
    </>
  );
}
