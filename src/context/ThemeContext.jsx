import { createContext, useCallback, useContext, useEffect, useState } from "react";
import PropTypes from "prop-types";

const ThemeContext = createContext(null);
const STORAGE_KEY = "tabsplit-theme";

function getSystemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveIsDark(theme) {
  return theme === "system" ? getSystemPrefersDark() : theme === "dark";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEY) || "system");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolveIsDark(theme));

    if (theme !== "system") return undefined;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => document.documentElement.classList.toggle("dark", getSystemPrefersDark());
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  const updateTheme = useCallback((next) => {
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme: updateTheme }}>{children}</ThemeContext.Provider>;
}

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
