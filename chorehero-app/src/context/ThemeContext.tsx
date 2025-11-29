import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import { COLORS } from '../utils/constants';

export type AppTheme = {
  name: 'customer' | 'hero' | 'custom';
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    background: string;
    surface: string;
    border: string;
    text: {
      primary: string;
      secondary: string;
      disabled: string;
      inverse: string;
      muted: string;
    };
  };
};

export const CUSTOMER_THEME: AppTheme = {
  name: 'customer',
  colors: {
    ...COLORS,
    primary: '#00BFA6',
  },
};

export const HERO_THEME: AppTheme = {
  name: 'hero',
  colors: {
    ...COLORS,
    primary: '#F59E0B',
  },
};

type ThemeContextValue = {
  theme: AppTheme;
  setTheme: (next: AppTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider = ({ initialTheme, children }: { initialTheme?: AppTheme; children: ReactNode }) => {
  const [theme, setTheme] = useState<AppTheme>(initialTheme ?? HERO_THEME);
  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};




