"use client";
import "chart.js/auto";
import React, { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Copy,
  Code2,
  Plus,
  Orbit,
  Globe2,
  Layers3,
  Search,
  Bell,
  Heart,
  Check,
  Download,
} from "lucide-react";
import {
  GlassButton,
  MagneticButton,
  Card,
  GlassTextField,
  GlassSlider,
  GlassSwitch,
  GlassChip,
  GlassAvatar,
  GlassAlert,
  GlassDialog,
  GlassDataGrid,
  GlassDataChart,
} from "./ui";
import { GlassCheckbox } from "@galileo/components/Checkbox/Checkbox";
import { GlassRadio } from "@galileo/components/Radio/Radio";
import { Select } from "@galileo/components/Select/Select";
import { GlassAutocomplete } from "@galileo/components/Autocomplete/Autocomplete";
import { GlassTagInput } from "@galileo/components/TagInput/TagInput";
import { GlassMultiSelect } from "@galileo/components/MultiSelect/GlassMultiSelect";
import { GlassDatePicker } from "@galileo/components/DatePicker";
import { GlassDateRangePicker } from "@galileo/components/DateRangePicker/GlassDateRangePicker";
import {
  GlassFormGroup,
  GlassFormControl,
  GlassFormLabel,
  GlassFormHelperText,
} from "@galileo/components/Form";
import { GlassProgress } from "@galileo/components/Progress/Progress";
import { GlassLoader } from "@galileo/components/Loader/Loader";
import { GlassSkeleton } from "@galileo/components/Skeleton/Skeleton";
import { GlassModal } from "@galileo/components/Modal/Modal";
import { GlassDrawer } from "@galileo/components/Drawer/Drawer";
import { Tooltip } from "@galileo/components/Tooltip/Tooltip";
import { GlassBadge } from "@galileo/components/Badge/Badge";
import { GlassRating } from "@galileo/components/Rating/Rating";
import { GlassTabs } from "@galileo/components/GlassTabs/GlassTabs";
import { GlassTabBar } from "@galileo/components/GlassTabBar";
import { GlassPagination } from "@galileo/components/Pagination/Pagination";
import {
  GlassAccordion,
  GlassAccordionSummary,
  GlassAccordionDetails,
} from "@galileo/components/Accordion";
import { GlassBreadcrumbs } from "@galileo/components/Breadcrumbs/Breadcrumbs";
import { GlassTreeView, GlassTreeItem } from "@galileo/components/TreeView";
import { GlassStepper } from "@galileo/components/GlassStepper";
import {
  GlassBottomNavigation,
  BottomNavigationAction,
} from "@galileo/components/BottomNavigation";
import { GlassMenu } from "@galileo/components/Menu/Menu";
import { GlassMenuItem } from "@galileo/components/MenuItem/MenuItem";
import {
  GlassToggleButton,
  GlassToggleButtonGroup,
} from "@galileo/components/ToggleButton";
import { GlassFab } from "@galileo/components/Fab/Fab";
import {
  GlassSpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
} from "@galileo/components/SpeedDial";
import { GlassList, GlassListItem } from "@galileo/components/List";
import {
  GlassTable,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@galileo/components/Table";
import {
  KpiCard,
  GlassPerformanceMetricCard,
  GlassInteractiveKpiCard,
} from "@galileo/components/KpiCard";
import { GlassTimeline } from "@galileo/components/Timeline/GlassTimeline";
import { GlassCarousel } from "@galileo/components/Carousel";
import { GlassMasonry } from "@galileo/components/Masonry";
import { GlassImageViewer } from "@galileo/components/ImageViewer/GlassImageViewer";
import {
  GlassImageList,
  GlassImageListItem,
  GlassImageListItemBar,
} from "@galileo/components/ImageList";
import { GlassCardLink } from "@galileo/components/GlassCardLink/GlassCardLink";
import { GlassTypography } from "@galileo/components/Typography";
import { GlassBox } from "@galileo/components/Box";
import { GlassContainer } from "@galileo/components/Container";
import { GlassPaper } from "@galileo/components/Paper";
import { Grid } from "@galileo/components/Grid";
import { Stack } from "@galileo/components/Stack";
import { Divider } from "@galileo/components/Divider";
import { Link } from "@galileo/components/Link";
import { GlassToolbar } from "@galileo/components/Toolbar";
import { GlassFocusRing } from "@galileo/components/GlassFocusRing";
import {
  FrostedGlass,
  DimensionalGlass,
  HeatGlass,
  WidgetGlass,
  PageGlassContainer,
} from "@galileo/components/surfaces";
import * as Presets from "@galileo/components/GlassPresets";
import { AccessibilitySettings } from "@galileo/components/AccessibilitySettings";
import { GlassThemeSwitcher } from "@galileo/components/ThemeComponents";
import {
  OptimizedGlassContainer,
  PerformanceMonitor,
} from "@galileo/components/Performance";
import { ContextAwareGlass } from "@galileo/components/ContextAwareGlass";
import { DynamicAtmosphere } from "@galileo/components/DynamicAtmosphere";
import {
  AtmosphericBackground,
  ParticleBackground,
} from "@galileo/components/backgrounds";
import {
  VisualFeedback,
  RippleButton,
  FocusIndicator,
  StateIndicator,
} from "@galileo/components/VisualFeedback";
import {
  GlassNavigation,
  ResponsiveNavigation,
  PageTransition,
  ZSpaceAppLayout,
} from "@galileo/components/Navigation";
import {
  GlassCookieConsent,
  GlassGlobalCookieConsent,
  GlassCompactCookieNotice,
} from "@galileo/components/CookieConsent";
import {
  GlassThemeDemo,
  ThemedGlassComponents,
} from "@galileo/components/ThemeComponents";
import { ModularGlassDataChart } from "@galileo/components/DataChart/ModularGlassDataChart";
import ChartWrapper from "@galileo/components/Chart/ChartWrapper";
import {
  CardHeader,
  CardContent,
  CardActions,
} from "@galileo/components/Card/Card";
import { Tabs } from "@galileo/components/Tabs/Tabs";
import { Icon } from "@galileo/components/Icon/Icon";

type Demo = {
  title: string;
  category: string;
  names: string;
  description: string;
  render: () => ReactNode;
  code: string;
};
export const demoCount = 48;
const options = [
  { id: "earth", value: "earth", label: "Earth" },
  { id: "moon", value: "moon", label: "Moon" },
  { id: "mars", value: "mars", label: "Mars" },
];
const rows = [
  { id: 1, name: "Voyager", destination: "Interstellar space", signal: 94 },
  { id: 2, name: "Galileo", destination: "Jupiter", signal: 87 },
  { id: 3, name: "Cassini", destination: "Saturn", signal: 98 },
];
const sourceLink =
  "https://github.com/auraoneai/galileo-glass-ui/tree/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components";

export default function Atlas({
  search,
  notify,
}: {
  search: string;
  notify: (s: string) => void;
}) {
  const [category, setCategory] = useState("All components");
  const [value, setValue] = useState("earth"),
    [rating, setRating] = useState(4),
    [tab, setTab] = useState(0),
    [step, setStep] = useState(1),
    [page, setPage] = useState(1),
    [progress, setProgress] = useState(64),
    [overlay, setOverlay] = useState(""),
    [chart, setChart] = useState<"line" | "bar" | "area">("area");
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [nav, setNav] = useState("earth");
  const [cookie, setCookie] = useState("");
  const demos: Demo[] = [
    {
      title: "Glass navigation",
      category: "Navigation",
      names: "GlassNavigation ResponsiveNavigation",
      description:
        "Full and responsive navigation compositions with active states.",
      code: "<GlassNavigation items={items} activeItem={active} onItemClick={setActive} />",
      render: () => (
        <div className="column">
          <GlassNavigation
            items={options.map((o) => ({ id: o.value, label: o.label }))}
            activeItem={nav}
            onItemClick={setNav}
            compact
            sticky={false}
          />
          <ResponsiveNavigation
            items={options.map((o) => ({ id: o.value, label: o.label }))}
            activeItem={nav}
            onItemClick={setNav}
            compact
            sticky={false}
            mobileBreakpoint={700}
          />
          <span className="muted">Destination: {nav}</span>
        </div>
      ),
    },
    {
      title: "Spatial layouts & transitions",
      category: "Media & layout",
      names: "PageTransition ZSpaceAppLayout",
      description:
        "A miniature layered application shell with a replayable transition.",
      code: "<ZSpaceAppLayout header={<h3>Mission</h3>}><PageTransition locationKey={page}>…</PageTransition></ZSpaceAppLayout>",
      render: () => (
        <div className="mini-layout">
          <ZSpaceAppLayout
            style={{ minHeight: 240, height: 240, background: "#152135" }}
            fixedHeader={false}
            fixedSidebar={false}
            fixedFooter={false}
            header={<span style={{ padding: 12 }}>Mission control</span>}
            sidebar={<span>Orbit</span>}
            sidebarWidth={65}
            contentPadding={18}
          >
            <PageTransition locationKey={page} mode="glass-fade">
              <p>Sector {page}. A new perspective.</p>
            </PageTransition>
            <GlassButton size="small" onClick={() => setPage((p) => p + 1)}>
              Next sector
            </GlassButton>
          </ZSpaceAppLayout>
        </div>
      ),
    },
    {
      title: "Cookie consent patterns",
      category: "Feedback",
      names:
        "CookieConsent GlassCookieConsent GlobalCookieConsent GlassGlobalCookieConsent CompactCookieNotice GlassCompactCookieNotice",
      description:
        "On-demand examples only. These notices store their demo choice locally.",
      code: '<GlassCookieConsent message="Example consent notice" onAccept={onAccept} />',
      render: () => (
        <div className="column">
          <div className="row">
            {["banner", "categories", "compact"].map((c) => (
              <GlassButton key={c} size="small" onClick={() => setCookie(c)}>
                Show {c}
              </GlassButton>
            ))}
          </div>
          <span className="muted small">
            No analytics are installed. Reloading respects the sample notice’s
            stored choice.
          </span>
          {cookie === "banner" && (
            <GlassCookieConsent
              message="Demo notice: would you like to accept example cookies?"
              onAccept={() => {
                setCookie("");
                notify("Demo consent accepted");
              }}
              onDecline={() => {
                setCookie("");
                notify("Demo consent declined");
              }}
            />
          )}
          {cookie === "categories" && (
            <GlassGlobalCookieConsent
              message="Demo: choose cookie categories."
              cookieCategories={[
                {
                  id: "essential",
                  name: "Essential",
                  description: "Required example preferences",
                  required: true,
                },
                {
                  id: "optional",
                  name: "Optional",
                  description: "Optional example preferences",
                },
              ]}
              onAccept={() => {
                setCookie("");
                notify("Demo preferences accepted");
              }}
              onDecline={() => setCookie("")}
              onSave={() => {
                setCookie("");
                notify("Demo preferences saved");
              }}
            />
          )}
          {cookie === "compact" && (
            <GlassCompactCookieNotice
              message="A compact example notice."
              onAccept={() => {
                setCookie("");
                notify("Demo notice accepted");
              }}
              onMoreInfo={() =>
                notify("This is a UI demonstration; no tracking is enabled.")
              }
            />
          )}
        </div>
      ),
    },
    {
      title: "Themed compositions",
      category: "Glass & system",
      names: "GlassThemeDemo ThemedGlassComponents",
      description: "A themed subtree and a compact upstream theme showcase.",
      code: '<ThemedGlassComponents colorMode="dark"><GlassButton>Hello</GlassButton></ThemedGlassComponents>',
      render: () => (
        <GlassThemeDemo
          title="An isolated little universe"
          minimal
          showThemeSwitcher={false}
          customExamples={
            <ThemedGlassComponents colorMode="dark">
              <GlassButton
                onClick={() => notify("Hello from a themed subtree")}
              >
                Hello from a themed subtree
              </GlassButton>
            </ThemedGlassComponents>
          }
        />
      ),
    },
    {
      title: "Modular chart composition",
      category: "Data display",
      names: "ModularGlassDataChart ChartWrapper",
      description:
        "The modular chart implementation inside a reusable chart frame.",
      code: '<ChartWrapper title="Sample telemetry"><ModularGlassDataChart variant="bar" datasets={datasets} /></ChartWrapper>',
      render: () => (
        <ChartWrapper title="Sample telemetry">
          <ModularGlassDataChart
            variant="bar"
            datasets={[
              {
                id: "sample",
                label: "Sample signal",
                data: [45, 72, 58, 94].map((y, i) => ({
                  x: `Sector ${i + 1}`,
                  y,
                })),
              },
            ]}
            height={220}
          />
        </ChartWrapper>
      ),
    },
    {
      title: "Structured cards & classic tabs",
      category: "Media & layout",
      names: "Card CardHeader CardContent CardActions Tabs TabPanel Icon",
      description:
        "Header, content, actions, and the classic child-based tab API.",
      code: '<Card><CardHeader title="Hello, explorer"/><CardContent>…</CardContent><CardActions>…</CardActions></Card>',
      render: () => (
        <Card>
          <CardHeader title="Hello, explorer" avatar={<Icon name="star" />} />
          <CardContent>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              <TabContent label="Mission">
                Explore the component universe.
              </TabContent>
              <TabContent label="Details">
                This uses the classic Tabs API.
              </TabContent>
            </Tabs>
          </CardContent>
          <CardActions>
            <GlassButton size="small" onClick={() => notify("Mission started")}>
              Start mission
            </GlassButton>
          </CardActions>
        </Card>
      ),
    },
    {
      title: "Buttons with personality",
      category: "Inputs",
      names: "Button GlassButton MagneticButton",
      description:
        "Contained, outlined, glass, disabled, and magnetic interactions.",
      code: "<GlassButton onClick={sayHello}>Hello, world</GlassButton>\n<MagneticButton magneticStrength={0.4}>Come closer</MagneticButton>",
      render: () => (
        <div className="row">
          <GlassButton
            onClick={() => notify("Hello, world!")}
            startIcon={<Orbit size={16} />}
          >
            Hello, world
          </GlassButton>
          <GlassButton
            variant="outlined"
            onClick={() => notify("Outlined button clicked")}
          >
            Outlined
          </GlassButton>
          <MagneticButton onClick={() => notify("Magnetic button clicked")}>
            Come closer
          </MagneticButton>
          <GlassButton disabled>Disabled</GlassButton>
        </div>
      ),
    },
    {
      title: "Text fields",
      category: "Inputs",
      names: "TextField GlassTextField",
      description: "Focus, type, and compare input states.",
      code: '<GlassTextField label="Your name" placeholder="Hello, explorer" />',
      render: () => (
        <>
          <GlassTextField
            label="Your name"
            placeholder="Hello, explorer"
            fullWidth
          />
          <GlassTextField
            label="Error state example"
            error
            helperText="A sample validation message"
            placeholder="Try another value"
            fullWidth
          />
        </>
      ),
    },
    {
      title: "Selection controls",
      category: "Inputs",
      names: "Checkbox GlassCheckbox Radio GlassRadio Switch GlassSwitch",
      description: "Small controls with a consistent glass treatment.",
      code: '<GlassCheckbox label="Receive transmissions" defaultChecked />\n<GlassSwitch label="Atmosphere" defaultChecked />',
      render: () => (
        <div className="column">
          <GlassCheckbox label="Receive transmissions" defaultChecked />
          <GlassSwitch label="Atmosphere" defaultChecked />
          <div className="row">
            <GlassRadio
              name="orbit"
              label="Earth"
              checked={value === "earth"}
              onChange={() => setValue("earth")}
            />
            <GlassRadio
              name="orbit"
              label="Moon"
              checked={value === "moon"}
              onChange={() => setValue("moon")}
            />
          </div>
        </div>
      ),
    },
    {
      title: "Sliders & rating",
      category: "Inputs",
      names: "Slider GlassSlider Rating GlassRating",
      description:
        "Drag or use arrow keys to set a value. Rate the experience.",
      code: "<GlassSlider value={value} onChange={setValue} />\n<GlassRating value={rating} onChange={(_, v) => setRating(v ?? 0)} />",
      render: () => (
        <div className="column">
          <GlassSlider
            label="Signal strength"
            value={progress}
            onChange={setProgress}
            valueLabelDisplay="on"
          />
          <GlassRating
            value={rating}
            onChange={(_: React.SyntheticEvent, v: number | null) =>
              setRating(v ?? 0)
            }
            label="Rate Galileo"
            showValue
          />
        </div>
      ),
    },
    {
      title: "Select & autocomplete",
      category: "Inputs",
      names: "Select GlassSelect Autocomplete GlassAutocomplete",
      description: "Choose a destination or search the available options.",
      code: '<Select options={options} value={value} onChange={setValue} />\n<GlassAutocomplete options={options} label="Search destinations" />',
      render: () => (
        <div className="column">
          <Select
            options={options}
            value={value}
            onChange={setValue}
            label="Destination"
            fullWidth
          />
          <GlassAutocomplete
            options={options}
            label="Search destinations"
            fullWidth
          />
        </div>
      ),
    },
    {
      title: "Tags & multiple selections",
      category: "Inputs",
      names: "TagInput GlassTagInput GlassMultiSelect",
      description: "Add tags with Enter and search for multiple destinations.",
      code: '<GlassTagInput label="Mission tags" />\n<GlassMultiSelect options={options} searchable />',
      render: () => (
        <div className="column">
          <GlassTagInput
            label="Mission tags"
            defaultValue={[{ id: "1", label: "exploration" }]}
            fullWidth
          />
          <GlassMultiSelect
            options={options}
            label="Destinations"
            searchable
            fullWidth
          />
        </div>
      ),
    },
    {
      title: "Date & date range",
      category: "Inputs",
      names:
        "DatePicker GlassDatePicker GlassLocalizationProvider GlassDateRangePicker",
      description: "Pick a launch date and an exploration window.",
      code: '<GlassDatePicker label="Launch date" />\n<GlassDateRangePicker label="Exploration window" />',
      render: () => (
        <div className="column">
          <GlassDatePicker label="Launch date" />
          <GlassDateRangePicker label="Exploration window" fullWidth />
        </div>
      ),
    },
    {
      title: "Form composition",
      category: "Inputs",
      names:
        "FormGroup GlassFormGroup FormControl GlassFormControl FormLabel GlassFormLabel FormHelperText GlassFormHelperText",
      description:
        "Labels, related controls, and helper text compose into a form.",
      code: '<GlassFormControl><GlassFormLabel>Mission options</GlassFormLabel>\n  <GlassFormGroup><GlassCheckbox label="Telemetry" /></GlassFormGroup>\n</GlassFormControl>',
      render: () => (
        <GlassFormControl>
          <GlassFormLabel>Mission options</GlassFormLabel>
          <GlassFormGroup>
            <GlassCheckbox label="Telemetry" defaultChecked />
            <GlassCheckbox label="Deep space imagery" />
          </GlassFormGroup>
          <GlassFormHelperText>
            Select the data you want to receive.
          </GlassFormHelperText>
        </GlassFormControl>
      ),
    },
    {
      title: "Toggle buttons",
      category: "Inputs",
      names:
        "ToggleButton GlassToggleButton ToggleButtonGroup GlassToggleButtonGroup",
      description: "A compact, mutually exclusive view selector.",
      code: "<GlassToggleButtonGroup value={value} exclusive onChange={(_,v) => setValue(v)}>…</GlassToggleButtonGroup>",
      render: () => (
        <GlassToggleButtonGroup
          value={value}
          exclusive
          onChange={(_: React.MouseEvent, v: unknown) => {
            if (typeof v === "string") setValue(v);
          }}
        >
          {options.map((o) => (
            <GlassToggleButton key={o.value} value={o.value}>
              {o.label}
            </GlassToggleButton>
          ))}
        </GlassToggleButtonGroup>
      ),
    },
    {
      title: "Alerts & notifications",
      category: "Feedback",
      names: "Alert GlassAlert Snackbar GlassSnackbar",
      description: "Semantic feedback with an actual dismissible toast.",
      code: '<GlassAlert severity="success">Transmission received.</GlassAlert>',
      render: () => (
        <div className="column">
          <GlassAlert severity="success">Transmission received.</GlassAlert>
          <GlassAlert severity="warning">
            Sample warning: signal is weak.
          </GlassAlert>
          <GlassButton
            onClick={() =>
              notify("Transmission received. Hello from the observatory!")
            }
          >
            Send a notification
          </GlassButton>
        </div>
      ),
    },
    {
      title: "Progress & loaders",
      category: "Feedback",
      names: "Progress GlassProgress Loader GlassLoader",
      description: "Determinate progress and waiting indicators.",
      code: '<GlassProgress value={64} showValue />\n<GlassLoader variant="dots" />',
      render: () => (
        <div className="column">
          <GlassProgress value={progress} showValue />
          <div className="row">
            <GlassProgress value={progress} shape="circular" showValue />
            <GlassLoader variant="dots" />
            <GlassLoader variant="pulse" />
          </div>
          <GlassButton
            size="small"
            onClick={() => setProgress((p) => (p + 10) % 101)}
          >
            Advance progress
          </GlassButton>
        </div>
      ),
    },
    {
      title: "Skeleton loading",
      category: "Feedback",
      names: "Skeleton GlassSkeleton",
      description:
        "A content-shaped loading state, shown deliberately as a demo.",
      code: '<GlassSkeleton variant="circular" width={44} height={44} />\n<GlassSkeleton multiline lines={3} />',
      render: () => (
        <div className="column">
          <div className="row">
            <GlassSkeleton variant="circular" width={44} height={44} />
            <GlassSkeleton width="65%" height={20} />
          </div>
          <GlassSkeleton variant="rounded" height={80} width="100%" />
          <GlassSkeleton multiline lines={2} />
        </div>
      ),
    },
    {
      title: "Dialogs, modals & drawers",
      category: "Feedback",
      names: "Dialog GlassDialog Modal GlassModal Drawer GlassDrawer Backdrop",
      description:
        "Open each overlay, then dismiss it with its close control or Escape.",
      code: '<GlassDialog open={open} onClose={() => setOpen(false)} title="Hello, explorer">…</GlassDialog>',
      render: () => (
        <div className="row">
          {["dialog", "modal", "drawer"].map((o) => (
            <GlassButton key={o} onClick={() => setOverlay(o)}>
              Open {o}
            </GlassButton>
          ))}
        </div>
      ),
    },
    {
      title: "Tooltip & focus ring",
      category: "Feedback",
      names: "Tooltip GlassTooltip GlassFocusRing",
      description: "Hover for context and Tab through the focusable control.",
      code: '<Tooltip title="A little context"><GlassButton>Hover me</GlassButton></Tooltip>',
      render: () => (
        <div className="row">
          <Tooltip title="A little context, rendered in glass." variant="glass">
            <GlassButton>Hover me</GlassButton>
          </Tooltip>
          <GlassFocusRing>
            <button
              className="native-button"
              onClick={() =>
                notify("Keyboard focus is part of the experience.")
              }
            >
              Tab to focus me
            </button>
          </GlassFocusRing>
        </div>
      ),
    },
    {
      title: "Tabs & tab bar",
      category: "Navigation",
      names: "Tabs GlassTabs TabPanel GlassTabBar TabBar",
      description: "Switch between content panels and a separate tab bar.",
      code: '<GlassTabs tabs={[{id:"earth",label:"Earth",content:<p>Hello, Earth.</p>}]} />',
      render: () => (
        <>
          <GlassTabs
            tabs={options.map((o) => ({
              id: o.value,
              label: o.label,
              content: (
                <p>Hello from {o.label}. Your selected panel is active.</p>
              ),
            }))}
          />
          <GlassTabBar
            tabs={options.map((o) => ({
              id: o.value,
              value: o.value,
              label: o.label,
            }))}
            activeTab={tab}
            onChange={(_, n) => setTab(n)}
          />
        </>
      ),
    },
    {
      title: "Breadcrumbs & pagination",
      category: "Navigation",
      names: "Breadcrumbs GlassBreadcrumbs Pagination GlassPagination Link",
      description:
        "Context in the hierarchy, and movement through a collection.",
      code: "<GlassPagination count={5} page={page} onChange={(_,p) => setPage(p)} />",
      render: () => (
        <div className="column">
          <GlassBreadcrumbs>
            <Link href="#overview">Observatory</Link>
            <Link href="#components">Components</Link>
            <span>Navigation</span>
          </GlassBreadcrumbs>
          <GlassPagination
            count={5}
            page={page}
            onChange={(_, p) => setPage(p)}
          />
          <span className="muted">Page {page} of 5</span>
        </div>
      ),
    },
    {
      title: "Accordion",
      category: "Navigation",
      names:
        "Accordion GlassAccordion AccordionSummary GlassAccordionSummary AccordionDetails GlassAccordionDetails",
      description: "Expand a section to reveal more detail.",
      code: "<GlassAccordion><GlassAccordionSummary>What is glass?</GlassAccordionSummary>\n<GlassAccordionDetails>Blur, translucency, light.</GlassAccordionDetails></GlassAccordion>",
      render: () => (
        <>
          {["What makes it glass?", "What makes it move?"].map((s, i) => (
            <GlassAccordion key={s}>
              <GlassAccordionSummary>{s}</GlassAccordionSummary>
              <GlassAccordionDetails>
                {i
                  ? "Springs interpolate physical values over time, creating responsive movement."
                  : "Translucent layers, backdrop blur, luminous borders, and dimensional shadows."}
              </GlassAccordionDetails>
            </GlassAccordion>
          ))}
        </>
      ),
    },
    {
      title: "Tree navigation",
      category: "Navigation",
      names: "TreeView GlassTreeView TreeItem GlassTreeItem",
      description: "Expand the solar system and select a destination.",
      code: '<GlassTreeView defaultExpanded={["solar"]}><GlassTreeItem nodeId="solar" label="Solar system">…</GlassTreeItem></GlassTreeView>',
      render: () => (
        <GlassTreeView defaultExpanded={["solar"]}>
          <GlassTreeItem nodeId="solar" label="Solar system">
            <GlassTreeItem nodeId="inner" label="Inner planets">
              <GlassTreeItem nodeId="earth" label="Earth" />
              <GlassTreeItem nodeId="mars" label="Mars" />
            </GlassTreeItem>
            <GlassTreeItem nodeId="outer" label="Outer planets">
              <GlassTreeItem nodeId="jupiter" label="Jupiter" />
            </GlassTreeItem>
          </GlassTreeItem>
        </GlassTreeView>
      ),
    },
    {
      title: "Stepper & bottom navigation",
      category: "Navigation",
      names:
        "GlassStepper BottomNavigation GlassBottomNavigation BottomNavigationAction",
      description:
        "Move through a workflow, then switch navigation destinations.",
      code: "<GlassStepper steps={steps} activeStep={step} onStepClick={setStep} />",
      render: () => (
        <div className="column">
          <GlassStepper
            steps={[
              { id: 0, label: "Imagine" },
              { id: 1, label: "Build" },
              { id: 2, label: "Launch" },
            ]}
            activeStep={step}
            onStepClick={setStep}
          />
          <GlassBottomNavigation
            value={tab}
            onChange={(_, v) => setTab(Number(v))}
            showLabels
          >
            <BottomNavigationAction
              value={0}
              label="Explore"
              icon={<Orbit />}
            />
            <BottomNavigationAction value={1} label="World" icon={<Globe2 />} />
            <BottomNavigationAction
              value={2}
              label="Library"
              icon={<Layers3 />}
            />
          </GlassBottomNavigation>
        </div>
      ),
    },
    {
      title: "Menu & floating actions",
      category: "Navigation",
      names:
        "Menu GlassMenu MenuItem GlassMenuItem Fab GlassFab SpeedDial GlassSpeedDial SpeedDialAction SpeedDialIcon",
      description:
        "A contextual menu, a floating action, and an expandable speed dial.",
      code: "<GlassMenu open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)}>…</GlassMenu>",
      render: () => (
        <div className="row">
          <GlassButton onClick={(e) => setAnchor(e.currentTarget)}>
            Open menu
          </GlassButton>
          <GlassFab
            aria-label="Add greeting"
            onClick={() => notify("Floating action clicked")}
          >
            <Plus />
          </GlassFab>
          <GlassSpeedDial
            ariaLabel="Mission actions"
            icon={<SpeedDialIcon />}
            direction="left"
            style={{ position: "relative" }}
          >
            <SpeedDialAction
              icon={<Heart />}
              tooltipTitle="Save"
              onClick={() => notify("Mission saved in this demo")}
            />
            <SpeedDialAction
              icon={<Copy />}
              tooltipTitle="Copy"
              onClick={() => notify("Copy action selected")}
            />
          </GlassSpeedDial>
        </div>
      ),
    },
    {
      title: "Avatars, badges & chips",
      category: "Data display",
      names: "Avatar GlassAvatar Badge GlassBadge Chip GlassChip",
      description: "Identity, status, and small pieces of metadata.",
      code: "<GlassBadge content={3}><GlassAvatar>G</GlassAvatar></GlassBadge>",
      render: () => (
        <div className="row">
          <GlassBadge content={3}>
            <GlassAvatar>G</GlassAvatar>
          </GlassBadge>
          <GlassAvatar color="success">A</GlassAvatar>
          <GlassChip label="In orbit" color="success" />
          <GlassChip label="Exploration" color="info" />
          <GlassChip
            label="Dismiss me"
            deletable
            onDelete={() => notify("Chip delete callback received")}
          />
        </div>
      ),
    },
    {
      title: "Lists & tables",
      category: "Data display",
      names:
        "List GlassList ListItem GlassListItem Table GlassTable TableHead TableBody TableRow TableCell",
      description: "Structured sample mission data. Values are illustrative.",
      code: "<GlassTable><TableHead><TableRow><TableCell>Mission</TableCell></TableRow></TableHead>…</GlassTable>",
      render: () => (
        <>
          <GlassList>
            <GlassListItem>Transmission received</GlassListItem>
            <GlassListItem>Destination confirmed</GlassListItem>
          </GlassList>
          <GlassTable>
            <TableHead>
              <TableRow>
                <TableCell>Mission</TableCell>
                <TableCell>Destination</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.destination}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </GlassTable>
        </>
      ),
    },
    {
      title: "Sortable data grid",
      category: "Data display",
      names: "GlassDataGrid",
      description: "Click a column heading to sort the sample missions.",
      code: '<GlassDataGrid data={rows} columns={[{id:"name",accessorKey:"name",header:"Mission",sortable:true}]} />',
      render: () => (
        <GlassDataGrid
          data={rows}
          columns={[
            {
              id: "name",
              accessorKey: "name",
              header: "Mission",
              sortable: true,
            },
            {
              id: "destination",
              accessorKey: "destination",
              header: "Destination",
              sortable: true,
            },
            {
              id: "signal",
              accessorKey: "signal",
              header: "Signal",
              sortable: true,
            },
          ]}
        />
      ),
    },
    {
      title: "Interactive charts",
      category: "Data display",
      names: "GlassDataChart DataChart ModularGlassDataChart ChartWrapper",
      description:
        "Switch the visualization. Hover data points for sample values.",
      code: '<GlassDataChart variant="area" datasets={datasets} height={240} />',
      render: () => (
        <>
          <div className="segmented">
            {(["line", "bar", "area"] as const).map((v) => (
              <button
                key={v}
                className={chart === v ? "selected" : ""}
                onClick={() => setChart(v)}
              >
                {v}
              </button>
            ))}
          </div>
          <GlassDataChart
            variant={chart}
            datasets={[
              {
                id: "signal",
                label: "Sample signal",
                data: [42, 65, 48, 86, 72, 93, 81].map((y, i) => ({
                  x: `Day ${i + 1}`,
                  y,
                })),
                style: {
                  lineColor: "#9bbcff",
                  fillColor: "#8bafff",
                  fillOpacity: 0.15,
                },
              },
            ]}
            height={230}
          />
        </>
      ),
    },
    {
      title: "KPI cards",
      category: "Data display",
      names:
        "KpiCard PerformanceMetricCard GlassPerformanceMetricCard InteractiveKpiCard GlassInteractiveKpiCard",
      description: "Three ways to display illustrative summary metrics.",
      code: '<KpiCard title="Sample signal" value="98%" subtitle="Illustrative data" />',
      render: () => (
        <div className="column">
          <KpiCard
            title="Sample signal"
            value="98%"
            subtitle="Illustrative data"
          />
          <GlassPerformanceMetricCard
            title="Sample latency"
            value={24}
            unit="ms"
          />
          <GlassInteractiveKpiCard
            title="Sample discoveries"
            value={42}
            onClick={() => notify("Discovery metric selected")}
          />
        </div>
      ),
    },
    {
      title: "Timeline",
      category: "Data display",
      names: "GlassTimeline",
      description: "An illustrative sequence of mission milestones.",
      code: '<GlassTimeline items={[{id:"1",title:"First hello",date:"2026-10-14"}]} />',
      render: () => (
        <GlassTimeline
          items={[
            {
              id: "1",
              title: "First hello",
              date: "2026-10-14",
              content: "The journey begins.",
            },
            {
              id: "2",
              title: "Into orbit",
              date: "2026-10-15",
              content: "A new perspective.",
            },
            {
              id: "3",
              title: "Signal received",
              date: "2026-10-16",
              content: "Connection established.",
            },
          ]}
          orientation="vertical"
        />
      ),
    },
    {
      title: "Carousel",
      category: "Media & layout",
      names:
        "GlassCarousel CarouselNavigation CarouselIndicators CarouselSlideItem PlayPauseControl",
      description:
        "Navigate three locally generated observatory illustrations.",
      code: "<GlassCarousel height={220}>{slides.map(slide => <img key={slide.src} src={slide.src} alt={slide.alt}/>)}</GlassCarousel>",
      render: () => (
        <GlassCarousel>
          {[0, 1, 2].map((i) => (
            <img
              key={i}
              src={`/scene-${i}.svg`}
              alt={["Orbital geometry", "Lunar horizon", "Solar waves"][i]}
              style={{ width: "100%", height: 220, objectFit: "cover" }}
            />
          ))}
        </GlassCarousel>
      ),
    },
    {
      title: "Image viewer",
      category: "Media & layout",
      names: "GlassImageViewer",
      description: "Zoom, pan, and open the local artwork full screen.",
      code: '<GlassImageViewer image={{src:"/scene-0.svg",alt:"Orbital geometry"}} height={240} />',
      render: () => (
        <GlassImageViewer
          image={{ src: "/scene-0.svg", alt: "Orbital geometry" }}
          height={240}
          width="100%"
        />
      ),
    },
    {
      title: "Image list",
      category: "Media & layout",
      names:
        "ImageList GlassImageList ImageListItem GlassImageListItem ImageListItemBar GlassImageListItemBar",
      description: "A compact gallery with descriptive title bars.",
      code: "<GlassImageList cols={2}><GlassImageListItem>…</GlassImageListItem></GlassImageList>",
      render: () => (
        <GlassImageList cols={2} gap={8}>
          {[0, 1].map((i) => (
            <GlassImageListItem key={i}>
              <img
                src={`/scene-${i}.svg`}
                alt={i ? "Lunar horizon" : "Orbital geometry"}
              />
              <GlassImageListItemBar
                title={i ? "Lunar horizon" : "Orbital geometry"}
              />
            </GlassImageListItem>
          ))}
        </GlassImageList>
      ),
    },
    {
      title: "Masonry layout",
      category: "Media & layout",
      names: "GlassMasonry",
      description:
        "Different content heights in a responsive masonry arrangement.",
      code: "<GlassMasonry items={items} columns={2}>{item => <Card>…</Card>}</GlassMasonry>",
      render: () => (
        <GlassMasonry
          items={[
            { id: "a", height: 90 },
            { id: "b", height: 130 },
            { id: "c", height: 100 },
          ]}
          columns={2}
          gap={10}
        >
          {(item) => (
            <div
              className="masonry-tile"
              style={{ height: Number(item.height) }}
            >
              <Orbit size={24} />
              <span>Sector {item.id}</span>
            </div>
          )}
        </GlassMasonry>
      ),
    },
    {
      title: "Typography & links",
      category: "Media & layout",
      names: "Typography GlassTypography Link GlassCardLink",
      description: "A typographic hierarchy and a composable card link.",
      code: '<GlassTypography variant="h4">A new perspective.</GlassTypography>\n<GlassCardLink title="Upstream" description="Explore the source" link="https://github.com/auraoneai/galileo-glass-ui" />',
      render: () => (
        <>
          <GlassTypography variant="h4">A new perspective.</GlassTypography>
          <GlassTypography variant="body2">
            Every detail tells part of the story.
          </GlassTypography>
          <GlassCardLink
            title="Explore the source"
            description="The Galileo Glass UI repository"
            link="https://github.com/auraoneai/galileo-glass-ui"
            icon={<Code2 />}
          />
        </>
      ),
    },
    {
      title: "Layout primitives",
      category: "Media & layout",
      names:
        "Box GlassBox Container GlassContainer Grid Stack Divider Toolbar GlassToolbar Paper GlassPaper",
      description:
        "Containers, spacing, stacks, grids, dividers, and toolbars.",
      code: "<GlassContainer><Stack spacing={2}><GlassPaper>…</GlassPaper><Divider /></Stack></GlassContainer>",
      render: () => (
        <GlassContainer>
          <Stack spacing={2}>
            <GlassToolbar>
              <Orbit size={18} />
              <span>Mission toolbar</span>
            </GlassToolbar>
            <Divider />
            <Grid container spacing={2}>
              <Grid.Item xs={6}>
                <GlassPaper>
                  <GlassBox p={2}>Left sector</GlassBox>
                </GlassPaper>
              </Grid.Item>
              <Grid.Item xs={6}>
                <GlassPaper>
                  <GlassBox p={2}>Right sector</GlassBox>
                </GlassPaper>
              </Grid.Item>
            </Grid>
          </Stack>
        </GlassContainer>
      ),
    },
    {
      title: "Cards & specialized surfaces",
      category: "Glass & system",
      names:
        "Card GlassCard CardHeader CardContent CardActions FrostedGlass DimensionalGlass HeatGlass WidgetGlass PageGlassContainer",
      description:
        "Compare five real surface treatments over a shared background.",
      code: "<FrostedGlass>Frosted</FrostedGlass>\n<DimensionalGlass>Dimensional</DimensionalGlass>\n<HeatGlass>Heat</HeatGlass>",
      render: () => (
        <div className="surface-grid">
          <FrostedGlass padding={18}>Frosted</FrostedGlass>
          <DimensionalGlass padding={18}>Dimensional</DimensionalGlass>
          <HeatGlass padding={18}>Heat</HeatGlass>
          <WidgetGlass padding={18}>Widget</WidgetGlass>
          <PageGlassContainer padding={18}>Page container</PageGlassContainer>
        </div>
      ),
    },
    {
      title: "Clean, frosted & textured presets",
      category: "Glass & system",
      names: "CleanGlassContainer FrostedGlassContainer TexturedGlassContainer",
      description: "The first three of nine ready-made material presets.",
      code: "<CleanGlassContainer>Clean</CleanGlassContainer>\n<FrostedGlassContainer>Frosted</FrostedGlassContainer>",
      render: () => (
        <div className="surface-grid">
          <Presets.CleanGlassContainer>Clean</Presets.CleanGlassContainer>
          <Presets.FrostedGlassContainer>Frosted</Presets.FrostedGlassContainer>
          <Presets.TexturedGlassContainer>
            Textured
          </Presets.TexturedGlassContainer>
        </div>
      ),
    },
    {
      title: "Subtle, standard & immersive presets",
      category: "Glass & system",
      names:
        "SubtleGlassContainer StandardGlassContainer ImmersiveGlassContainer",
      description: "A progression from a light touch to an enveloping surface.",
      code: "<SubtleGlassContainer>Subtle</SubtleGlassContainer>\n<ImmersiveGlassContainer>Immersive</ImmersiveGlassContainer>",
      render: () => (
        <div className="surface-grid">
          <Presets.SubtleGlassContainer>Subtle</Presets.SubtleGlassContainer>
          <Presets.StandardGlassContainer>
            Standard
          </Presets.StandardGlassContainer>
          <Presets.ImmersiveGlassContainer>
            Immersive
          </Presets.ImmersiveGlassContainer>
        </div>
      ),
    },
    {
      title: "Dashboard, form & modal presets",
      category: "Glass & system",
      names: "DashboardGlassContainer FormGlassContainer ModalGlassContainer",
      description:
        "Task-specific material defaults for common product patterns.",
      code: "<DashboardGlassContainer>Dashboard</DashboardGlassContainer>",
      render: () => (
        <div className="surface-grid">
          <Presets.DashboardGlassContainer>
            Dashboard
          </Presets.DashboardGlassContainer>
          <Presets.FormGlassContainer>Form</Presets.FormGlassContainer>
          <Presets.ModalGlassContainer>Modal</Presets.ModalGlassContainer>
        </div>
      ),
    },
    {
      title: "Context-aware glass",
      category: "Glass & system",
      names: "ContextAwareGlass",
      description: "A surface designed to respond to its surrounding content.",
      code: "<ContextAwareGlass><p>Context makes the material.</p></ContextAwareGlass>",
      render: () => (
        <ContextAwareGlass>
          <div className="sample-surface">
            <Globe2 />
            <p>Context makes the material.</p>
          </div>
        </ContextAwareGlass>
      ),
    },
    {
      title: "Atmosphere & backgrounds",
      category: "Glass & system",
      names: "DynamicAtmosphere AtmosphericBackground ParticleBackground",
      description: "Layered atmospheric effects, isolated inside the preview.",
      code: "<AtmosphericBackground />\n<ParticleBackground />\n<DynamicAtmosphere>…</DynamicAtmosphere>",
      render: () => (
        <div className="background-demo">
          <AtmosphericBackground />
          <ParticleBackground />
          <DynamicAtmosphere />
          <div className="sample-surface">
            <Orbit size={36} />
            <p>Your own little atmosphere.</p>
          </div>
        </div>
      ),
    },
    {
      title: "Visual feedback",
      category: "Feedback",
      names: "VisualFeedback RippleButton FocusIndicator StateIndicator",
      description: "Explicit interaction feedback beyond a plain hover state.",
      code: "<RippleButton onClick={sayHello}>Make a ripple</RippleButton>",
      render: () => (
        <div className="column">
          <RippleButton
            onClick={() => notify("A ripple through the observatory.")}
          >
            Make a ripple
          </RippleButton>
          <VisualFeedback>
            <button
              className="native-button"
              onClick={() => notify("Visual feedback received")}
            >
              Interact with me
            </button>
          </VisualFeedback>
          <FocusIndicator>
            <button className="native-button">Focus indicator</button>
          </FocusIndicator>
          <StateIndicator state="success">Ready</StateIndicator>
        </div>
      ),
    },
    {
      title: "Theme controls",
      category: "Glass & system",
      names: "GlassThemeSwitcher GlassThemeDemo ThemedGlassComponents",
      description:
        "The framework’s theme switcher. Use the app’s sun button for page color mode.",
      code: "<GlassThemeSwitcher />",
      render: () => <GlassThemeSwitcher />,
    },
    {
      title: "Accessibility settings",
      category: "Glass & system",
      names: "AccessibilitySettings AccessibilityProvider",
      description: "Explore Galileo’s motion and accessibility preferences.",
      code: "<AccessibilitySettings />",
      render: () => <AccessibilitySettings />,
    },
    {
      title: "Performance tools",
      category: "Glass & system",
      names: "PerformanceMonitor OptimizedGlassContainer",
      description:
        "An optimized container and the framework’s performance monitor.",
      code: "<OptimizedGlassContainer>…</OptimizedGlassContainer>\n<PerformanceMonitor />",
      render: () => (
        <OptimizedGlassContainer>
          <div className="sample-surface">
            <Layers3 />
            <p>Adaptive glass surface</p>
            <PerformanceMonitor />
          </div>
        </OptimizedGlassContainer>
      ),
    },
  ];
  const categories = [
    "All components",
    "Inputs",
    "Navigation",
    "Feedback",
    "Data display",
    "Media & layout",
    "Glass & system",
  ];
  demos.sort(
    (a, b) => categories.indexOf(a.category) - categories.indexOf(b.category),
  );
  const filtered = demos.filter(
    (d) =>
      (category === "All components" || d.category === category) &&
      `${d.title} ${d.names}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="catalog-toolbar">
        <div className="category-tabs" aria-label="Component categories">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={category === c ? "selected" : ""}
            >
              {c}
            </button>
          ))}
        </div>
        <span>{filtered.length} examples</span>
      </div>
      <div className="demo-grid">
        {filtered.map((demo, i) => (
          <article
            className="demo-card"
            key={demo.title}
            data-demo={demo.title}
          >
            <div className="demo-header">
              <span>{demo.category}</span>
              <span>{String(i + 1).padStart(2, "0")}</span>
            </div>
            <h2>{demo.title}</h2>
            <p>{demo.description}</p>
            <div className="demo-preview">
              <DemoBoundary name={demo.title}>{demo.render()}</DemoBoundary>
            </div>
            <div className="demo-bottom">
              <button
                onClick={() =>
                  setExpandedCode(
                    expandedCode === demo.title ? null : demo.title,
                  )
                }
              >
                <Code2 size={14} />
                {expandedCode === demo.title ? "Hide" : "View"} code
              </button>
              <a href={sourceLink} target="_blank" rel="noreferrer">
                Source <ArrowUpRight size={13} />
              </a>
            </div>
            {expandedCode === demo.title && (
              <pre className="demo-code">{demo.code}</pre>
            )}
          </article>
        ))}
      </div>
      {!filtered.length && (
        <div className="empty-state">
          <Search size={30} />
          <h2>No components found</h2>
          <p>
            Try a name such as “button”, “glass”, or “chart”, or select another
            category.
          </p>
        </div>
      )}
      <GlassDialog
        open={overlay === "dialog"}
        onClose={() => setOverlay("")}
        title="Hello, explorer."
        actions={
          <GlassButton onClick={() => setOverlay("")}>
            Continue exploring
          </GlassButton>
        }
      >
        <p>
          A real Galileo dialog, with a glass backdrop and focus management.
        </p>
      </GlassDialog>
      <GlassModal open={overlay === "modal"} onClose={() => setOverlay("")}>
        <div className="overlay-content">
          <Orbit size={32} />
          <h2>A window into the universe.</h2>
          <p>This is the lower-level glass modal.</p>
          <GlassButton onClick={() => setOverlay("")}>Close modal</GlassButton>
        </div>
      </GlassModal>
      <GlassDrawer
        open={overlay === "drawer"}
        onClose={() => setOverlay("")}
        anchor="right"
        width={340}
      >
        <div className="overlay-content">
          <h2>Mission control</h2>
          <p>A drawer for details, settings, and secondary navigation.</p>
          <GlassSwitch label="Receive signals" defaultChecked />
          <GlassButton onClick={() => setOverlay("")}>Close drawer</GlassButton>
        </div>
      </GlassDrawer>
      <GlassMenu
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
      >
        {["View mission", "Save coordinates", "Copy transmission"].map((t) => (
          <GlassMenuItem
            key={t}
            onClick={() => {
              setAnchor(null);
              notify(`${t} selected`);
            }}
          >
            {t}
          </GlassMenuItem>
        ))}
      </GlassMenu>
    </>
  );
}
class DemoBoundary extends React.Component<
  { children: ReactNode; name: string },
  { error: string | null }
> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <div className="demo-error" role="alert">
        <strong>{this.props.name}: upstream runtime error</strong>
        <p>{this.state.error}</p>
        <button onClick={() => this.setState({ error: null })}>
          Retry example
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

function TabContent({ children }: { label: string; children: ReactNode }) {
  return <div>{children}</div>;
}
