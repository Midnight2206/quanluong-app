import { STORAGE_KEYS } from "@/constants/storageKeys";

const DARK_MODE = "dark";
const LIGHT_MODE = "light";

export const getStoredTheme = () => {
  const storedTheme = localStorage.getItem(STORAGE_KEYS.theme);
  return storedTheme === DARK_MODE ? DARK_MODE : LIGHT_MODE;
};

export const applyTheme = (theme) => {
  const root = document.documentElement;
  root.classList.toggle(DARK_MODE, theme === DARK_MODE);
  localStorage.setItem(STORAGE_KEYS.theme, theme);
};

export const initializeTheme = () => {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
};

export const toggleTheme = () => {
  const nextTheme = getStoredTheme() === DARK_MODE ? LIGHT_MODE : DARK_MODE;
  applyTheme(nextTheme);
  return nextTheme;
};

