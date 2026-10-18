const THEME_KEY = "app:theme";
const DARK_MODE = "dark";
const LIGHT_MODE = "light";

export const getStoredTheme = () => {
  const storedTheme = localStorage.getItem(THEME_KEY);
  return storedTheme === DARK_MODE ? DARK_MODE : LIGHT_MODE;
};

export const applyTheme = (theme) => {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === DARK_MODE);
  localStorage.setItem(THEME_KEY, theme);
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
