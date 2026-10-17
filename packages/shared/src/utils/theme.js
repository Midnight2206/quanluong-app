import { STORAGE_KEYS } from "@/constants/storageKeys";

const DARK_MODE = "dark";
const HIGH_CONTRAST = "high";

/** Accent palettes defined in index.css (`html[data-accent]`); first = default. */
export const ACCENTS = [
  { id: "teal", label: "Xanh ngọc", swatch: "hsl(171 73% 28%)" },
  { id: "blue", label: "Xanh dương", swatch: "hsl(217 85% 42%)" },
  { id: "green", label: "Xanh lá", swatch: "hsl(145 63% 27%)" },
  { id: "olive", label: "Xanh lính", swatch: "hsl(78 38% 27%)" },
  { id: "rose", label: "Hồng", swatch: "hsl(346 72% 42%)" },
  { id: "amber", label: "Hổ phách", swatch: "hsl(28 92% 30%)" },
];
const ACCENT_IDS = ACCENTS.map((a) => a.id);
const DEFAULT_ACCENT = ACCENT_IDS[0];

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode / storage full: theme still applies for this page
  }
};

export const getStoredTheme = () => (read(STORAGE_KEYS.theme) === DARK_MODE ? DARK_MODE : "light");

export const getStoredAccent = () => {
  const accent = read(STORAGE_KEYS.accent);
  return ACCENT_IDS.includes(accent) ? accent : DEFAULT_ACCENT;
};

export const getStoredHighContrast = () => read(STORAGE_KEYS.contrast) === HIGH_CONTRAST;

export const applyTheme = (theme) => {
  document.documentElement.classList.toggle(DARK_MODE, theme === DARK_MODE);
  write(STORAGE_KEYS.theme, theme);
};

export const applyAccent = (accent) => {
  const next = ACCENT_IDS.includes(accent) ? accent : DEFAULT_ACCENT;
  document.documentElement.dataset.accent = next;
  write(STORAGE_KEYS.accent, next);
  return next;
};

export const applyHighContrast = (enabled) => {
  const root = document.documentElement;
  if (enabled) root.dataset.contrast = HIGH_CONTRAST;
  else delete root.dataset.contrast;
  write(STORAGE_KEYS.contrast, enabled ? HIGH_CONTRAST : "");
  return Boolean(enabled);
};

export const initializeTheme = () => {
  const theme = getStoredTheme();
  applyTheme(theme);
  applyAccent(getStoredAccent());
  applyHighContrast(getStoredHighContrast());
  return theme;
};

/** Inline <script> for root layouts: restores theme before first paint (no flash, no reset on reload). */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage,r=document.documentElement;if(s.getItem(${JSON.stringify(
  STORAGE_KEYS.theme,
)})==="dark")r.classList.add("dark");var a=s.getItem(${JSON.stringify(STORAGE_KEYS.accent)});if(${JSON.stringify(
  ACCENT_IDS,
)}.indexOf(a)>-1)r.dataset.accent=a;if(s.getItem(${JSON.stringify(STORAGE_KEYS.contrast)})==="high")r.dataset.contrast="high"}catch(e){}})()`;
