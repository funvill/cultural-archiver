export type Theme = {
  primary: string;
  primaryVariant?: string;
  secondary?: string;
  success?: string;
  warning?: string;
  secondaryVariant?: string;
  background?: string;
  surface?: string;
  error?: string;
  onPrimary?: string;
  onSecondary?: string;
  onSuccess?: string;
  onWarning?: string;
  onBackground?: string;
  onSurface?: string;
  onError?: string;
};

const setCssVar = (name: string, value: string | undefined): void => {
  if (!value) return;
  try {
    document.documentElement.style.setProperty(name, value);
  } catch (e) {
    // ignore in non-browser environments
  }
};

export function applyTheme(theme: Theme): void {
  // Map theme fields to CSS variables
  setCssVar('--md-primary', theme.primary);
  setCssVar('--md-primary-variant', theme.primaryVariant);
  setCssVar('--md-secondary', theme.secondary);
  setCssVar('--md-secondary-variant', theme.secondaryVariant);
  setCssVar('--md-background', theme.background);
  setCssVar('--md-surface', theme.surface);
  setCssVar('--md-error', theme.error);
  setCssVar('--md-on-primary', theme.onPrimary);
  setCssVar('--md-on-secondary', theme.onSecondary);
  setCssVar('--md-success', theme.success);
  setCssVar('--md-on-success', theme.onSuccess);
  setCssVar('--md-warning', theme.warning);
  setCssVar('--md-on-warning', theme.onWarning);
  setCssVar('--md-on-background', theme.onBackground);
  setCssVar('--md-on-surface', theme.onSurface);
  setCssVar('--md-on-error', theme.onError);

  // Update mobile browser theme color meta tag if present
  try {
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (meta && theme.primary) meta.content = theme.primary;
  } catch (e) {
    // ignore
  }
}

// A sensible default inspired by Material blue/neutral tokens
export const defaultMaterialTheme: Theme = {
  primary: '#1e88e5', // blue 600
  primaryVariant: '#1565c0',
  secondary: '#8e24aa', // purple 600
  secondaryVariant: '#6a1b9a',
  background: '#f8fafc', // gray-50 / near white
  surface: '#ffffff',
  error: '#b00020',
  success: '#16a34a', // green-600
  warning: '#f59e0b', // amber-500
  onPrimary: '#ffffff',
  onSecondary: '#ffffff',
  onSuccess: '#ffffff',
  onWarning: '#111827',
  onBackground: '#111827', // gray-900
  onSurface: '#111827',
  onError: '#ffffff',
};

export default defaultMaterialTheme;

// -- Multiple theme support -------------------------------------------------
export const bauhausTheme: Theme = {
  // Bauhaus-inspired bold primary colors
  primary: '#e63946', // deep red
  primaryVariant: '#b22234',
  secondary: '#f4d35e', // warm yellow
  secondaryVariant: '#f5c400',
  background: '#ffffff',
  surface: '#ffffff',
  error: '#d7263d',
  success: '#2a9d8f',
  warning: '#f4d35e',
  onPrimary: '#ffffff',
  onSecondary: '#111827',
  onSuccess: '#ffffff',
  onWarning: '#111827',
  onBackground: '#111827',
  onSurface: '#111827',
  onError: '#ffffff',
};

export const themes: Record<string, Theme> = {
  material: defaultMaterialTheme,
  bauhaus: bauhausTheme,
};

export type ThemeName = keyof typeof themes;

/**
 * Apply a theme by name. No-op if name not found.
 */
export function applyThemeByName(name: ThemeName | string): void {
  const t = (themes as Record<string, Theme>)[name];
  if (t) applyTheme(t);
}

