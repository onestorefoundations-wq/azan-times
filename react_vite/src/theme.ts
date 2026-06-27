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
  {
    id: 'obsidian',
    name: 'Obsidian Black',
    group: 'dark',
    bg:           '#000000',
    surface:      '#0A0A0A',
    accent:       '#00E5FF',
    text:         '#E0E0E0',
    primaryText:  '#FFFFFF',
    secondaryText:'#00E5FF',
    prayerName:   '#A0A0A0',
    prayerTime:   '#E0E0E0',
    dateText:     '#808080',
    tickerText:   '#00E5FF',
    tickerBg:     '#050505',
  },
  {
    id: 'amethyst',
    name: 'Deep Amethyst',
    group: 'dark',
    bg:           '#170B29',
    surface:      '#22113D',
    accent:       '#D27DFF',
    text:         '#F0E6FF',
    primaryText:  '#FFFFFF',
    secondaryText:'#D27DFF',
    prayerName:   '#C7A3FF',
    prayerTime:   '#C7A3FF',
    dateText:     '#9A73D1',
    tickerText:   '#D27DFF',
    tickerBg:     '#0E061A',
  },
  {
    id: 'neon',
    name: 'Neon Pulse',
    group: 'dark',
    bg:           '#070712',
    surface:      '#0F0F20',
    accent:       '#FF00FF',
    text:         '#E8E8FF',
    primaryText:  '#FFFFFF',
    secondaryText:'#FF00FF',
    prayerName:   '#00FFFF',
    prayerTime:   '#00FFFF',
    dateText:     '#FF6FFF',
    tickerText:   '#00FF41',
    tickerBg:     '#001A0D',
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
  {
    id: 'ocean',
    name: 'Oceanic Teal',
    group: 'medium',
    bg:           '#0F4C5C',
    surface:      '#156173',
    accent:       '#F9A03F',
    text:         '#E5F5F8',
    primaryText:  '#FFFFFF',
    secondaryText:'#F9A03F',
    prayerName:   '#B4E1EA',
    prayerTime:   '#B4E1EA',
    dateText:     '#88C5D3',
    tickerText:   '#F9A03F',
    tickerBg:     '#093642',
  },
  {
    id: 'sunset',
    name: 'Sunset Horizon',
    group: 'medium',
    bg:           '#5E2750',
    surface:      '#7A3366',
    accent:       '#FF9F1C',
    text:         '#FCE7F3',
    primaryText:  '#FFFFFF',
    secondaryText:'#FF9F1C',
    prayerName:   '#F9C2D4',
    prayerTime:   '#F9C2D4',
    dateText:     '#D78FA6',
    tickerText:   '#FF9F1C',
    tickerBg:     '#3D1733',
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
  {
    id: 'sand',
    name: 'Desert Sand',
    group: 'light',
    bg:           '#F5EBE1',
    surface:      '#FFFFFF',
    accent:       '#D47A43',
    text:         '#3E2A1E',
    primaryText:  '#3E2A1E',
    secondaryText:'#D47A43',
    prayerName:   '#6A4F3D',
    prayerTime:   '#6A4F3D',
    dateText:     '#8C7462',
    tickerText:   '#E6935C',
    tickerBg:     '#E3D3C3',
  },
  {
    id: 'mint',
    name: 'Mint Frost',
    group: 'light',
    bg:           '#F2FCF7',
    surface:      '#FFFFFF',
    accent:       '#10B981',
    text:         '#1E293B',
    primaryText:  '#1E293B',
    secondaryText:'#10B981',
    prayerName:   '#475569',
    prayerTime:   '#475569',
    dateText:     '#64748B',
    tickerText:   '#34D399',
    tickerBg:     '#D1FAE5',
  },
  {
    id: 'superpower',
    name: 'Superpower White',
    group: 'light',
    bg:           '#F7F7F2',
    surface:      '#FFFFFF',
    accent:       '#C8F53C',
    text:         '#1A1A1A',
    primaryText:  '#1A1A1A',
    secondaryText:'#6B7280',
    prayerName:   '#2D3748',
    prayerTime:   '#2D3748',
    dateText:     '#9CA3AF',
    tickerText:   '#1A1A1A',
    tickerBg:     '#ECFCCB',
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
