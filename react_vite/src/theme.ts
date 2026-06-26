/**
 * theme.ts
 * 12 Islamic-inspired display themes: 4 dark · 4 medium · 4 light.
 * Each theme injects both layout CSS vars (--bg, --surface, --accent, --text)
 * and component-level vars (--c-*) consumed by resolvedColors() in appConfig.ts.
 */

export interface Theme {
  id: string;
  name: string;
  group: 'dark' | 'medium' | 'light';
  // Layout vars
  bg: string;
  surface: string;
  accent: string;
  text: string;
  // Component-level vars (ClockPanel / PrayerTable via resolvedColors)
  primaryText: string;   // clock digits, highlighted prayer name
  secondaryText: string; // countdown, accent labels
  prayerName: string;    // normal prayer row name
  prayerTime: string;    // adhan / iqamah time columns
  dateText: string;      // gregorian + hijri dates
  tickerText: string;    // scrolling ticker text
  tickerBg: string;      // scrolling ticker bar background
}

export const THEMES: Theme[] = [

  // ── DARK ────────────────────────────────────────────────────────
  {
    id: 'midnight',
    name: 'Midnight Blue',
    group: 'dark',
    bg:           '#0D1B2A',
    surface:      '#16263A',
    accent:       '#00D4AA',
    text:         '#E8F4FD',
    primaryText:  '#FFFFFF',
    secondaryText:'#00D4AA',
    prayerName:   '#B8D4E8',
    prayerTime:   '#B8D4E8',
    dateText:     '#7FA8C4',
    tickerText:   '#00D4AA',
    tickerBg:     '#07121E',
  },
  {
    id: 'emerald',
    name: 'Emerald Forest',
    group: 'dark',
    bg:           '#0A1F0E',
    surface:      '#122B17',
    accent:       '#3DDC84',
    text:         '#E8F5E9',
    primaryText:  '#FFFFFF',
    secondaryText:'#3DDC84',
    prayerName:   '#A8D5B0',
    prayerTime:   '#A8D5B0',
    dateText:     '#6BAF7A',
    tickerText:   '#3DDC84',
    tickerBg:     '#061208',
  },
  {
    id: 'amber',
    name: 'Golden Amber',
    group: 'dark',
    bg:           '#1A1200',
    surface:      '#261A00',
    accent:       '#FFB300',
    text:         '#FFF8E1',
    primaryText:  '#FFFFFF',
    secondaryText:'#FFB300',
    prayerName:   '#E8D08A',
    prayerTime:   '#E8D08A',
    dateText:     '#B8992A',
    tickerText:   '#FFB300',
    tickerBg:     '#0F0A00',
  },
  {
    id: 'crimson',
    name: 'Crimson Night',
    group: 'dark',
    bg:           '#1A0A0E',
    surface:      '#2A1018',
    accent:       '#FF4B6E',
    text:         '#FDE8EC',
    primaryText:  '#FFFFFF',
    secondaryText:'#FF4B6E',
    prayerName:   '#E8B0BC',
    prayerTime:   '#E8B0BC',
    dateText:     '#B87080',
    tickerText:   '#FF4B6E',
    tickerBg:     '#100508',
  },

  // ── MEDIUM ──────────────────────────────────────────────────────
  {
    id: 'sapphire',
    name: 'Sapphire Dusk',
    group: 'medium',
    bg:           '#1A3A6A',
    surface:      '#243E7A',
    accent:       '#64CFFF',
    text:         '#E3F2FD',
    primaryText:  '#FFFFFF',
    secondaryText:'#64CFFF',
    prayerName:   '#B3D9F8',
    prayerTime:   '#B3D9F8',
    dateText:     '#7BBAE0',
    tickerText:   '#64CFFF',
    tickerBg:     '#0D1F3A',
  },
  {
    id: 'forest',
    name: 'Forest Canopy',
    group: 'medium',
    bg:           '#1A3A1E',
    surface:      '#243E28',
    accent:       '#69F0AE',
    text:         '#E8F5E9',
    primaryText:  '#FFFFFF',
    secondaryText:'#69F0AE',
    prayerName:   '#B2DEB8',
    prayerTime:   '#B2DEB8',
    dateText:     '#78B880',
    tickerText:   '#69F0AE',
    tickerBg:     '#0D1F10',
  },
  {
    id: 'plum',
    name: 'Royal Plum',
    group: 'medium',
    bg:           '#2D1B52',
    surface:      '#3D2868',
    accent:       '#D98FFF',
    text:         '#F3E5FF',
    primaryText:  '#FFFFFF',
    secondaryText:'#D98FFF',
    prayerName:   '#DDBAEE',
    prayerTime:   '#DDBAEE',
    dateText:     '#A878CC',
    tickerText:   '#D98FFF',
    tickerBg:     '#160D30',
  },
  {
    id: 'copper',
    name: 'Copper Dusk',
    group: 'medium',
    bg:           '#4A2010',
    surface:      '#5E2C18',
    accent:       '#FFA040',
    text:         '#FFF0E0',
    primaryText:  '#FFFFFF',
    secondaryText:'#FFA040',
    prayerName:   '#F0C89A',
    prayerTime:   '#F0C89A',
    dateText:     '#C08050',
    tickerText:   '#FFA040',
    tickerBg:     '#280E00',
  },

  // ── LIGHT ───────────────────────────────────────────────────────
  {
    id: 'pearl',
    name: 'Pearl Mosque',
    group: 'light',
    bg:           '#FAFAF2',
    surface:      '#FFFFFF',
    accent:       '#B07A00',
    text:         '#1A1200',
    primaryText:  '#1A1200',
    secondaryText:'#B07A00',
    prayerName:   '#3A2A00',
    prayerTime:   '#3A2A00',
    dateText:     '#7A6020',
    tickerText:   '#FFE082',
    tickerBg:     '#2E1E00',
  },
  {
    id: 'sky',
    name: 'Sky Serenity',
    group: 'light',
    bg:           '#EEF5FC',
    surface:      '#FFFFFF',
    accent:       '#1055A8',
    text:         '#071830',
    primaryText:  '#071830',
    secondaryText:'#1055A8',
    prayerName:   '#0A2550',
    prayerTime:   '#0A2550',
    dateText:     '#3A5888',
    tickerText:   '#90CAFF',
    tickerBg:     '#0A1E42',
  },
  {
    id: 'garden',
    name: 'Garden Bloom',
    group: 'light',
    bg:           '#F0F8F0',
    surface:      '#FFFFFF',
    accent:       '#1B6B2A',
    text:         '#071A07',
    primaryText:  '#071A07',
    secondaryText:'#1B6B2A',
    prayerName:   '#0F3018',
    prayerTime:   '#0F3018',
    dateText:     '#3A7040',
    tickerText:   '#A5D6A7',
    tickerBg:     '#0D2E10',
  },
  {
    id: 'rose',
    name: 'Rose Dawn',
    group: 'light',
    bg:           '#FEF2F4',
    surface:      '#FFFFFF',
    accent:       '#A0173A',
    text:         '#2E050E',
    primaryText:  '#2E050E',
    secondaryText:'#A0173A',
    prayerName:   '#5A1020',
    prayerTime:   '#5A1020',
    dateText:     '#8A3848',
    tickerText:   '#FFAAB8',
    tickerBg:     '#3E0A14',
  },
];

const STORAGE_KEY = 'masjid_theme';
const DEFAULT_ID  = 'midnight';

export function getTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY) ?? DEFAULT_ID;
  return THEMES.find((t) => t.id === saved) ?? THEMES[0];
}

export function setTheme(id: string): void {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  localStorage.setItem(STORAGE_KEY, theme.id);
  applyTheme(theme);
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme.id;

  // Layout-level vars (TvDisplay, index.css)
  root.style.setProperty('--bg',      theme.bg);
  root.style.setProperty('--surface', theme.surface);
  root.style.setProperty('--accent',  theme.accent);
  root.style.setProperty('--text',    theme.text);

  // Component-level vars (read by resolvedColors() in appConfig.ts)
  root.style.setProperty('--c-primary',     theme.primaryText);
  root.style.setProperty('--c-secondary',   theme.secondaryText);
  root.style.setProperty('--c-prayer-name', theme.prayerName);
  root.style.setProperty('--c-prayer-time', theme.prayerTime);
  root.style.setProperty('--c-date',        theme.dateText);
  root.style.setProperty('--c-ticker',      theme.tickerText);
  root.style.setProperty('--c-ticker-bg',   theme.tickerBg);
}

/** Call once on app startup to restore the persisted theme. */
export function initTheme(): void {
  applyTheme(getTheme());
}
