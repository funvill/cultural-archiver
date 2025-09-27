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
  // Navigation-specific colors
  navLink?: string;
  navLinkHover?: string;
  navBorder?: string;
  navActive?: string;
  navActiveBackground?: string;
  // Utility colors
  textMuted?: string;
  textSubtle?: string;
  hoverBackground?: string;
  // Icon hover effects
  iconHover?: string;
  iconHoverBackground?: string;
  navIconHover?: string;
  navIconHoverBackground?: string;
  // Content area colors
  contentBackground?: string;
  cardBackground?: string;
  cardBorder?: string;
  sectionBorder?: string;
  // Form and input colors  
  inputBackground?: string;
  inputBorder?: string;
  inputText?: string;
  placeholderText?: string;
  // Button variants
  buttonSecondary?: string;
  buttonSecondaryHover?: string;
  buttonOutline?: string;
  buttonOutlineHover?: string;
  // Badge and tag colors
  tagBackground?: string;
  tagText?: string;
  badgeBackground?: string;
  badgeText?: string;
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

  // Navigation-specific variables
  setCssVar('--md-nav-link', theme.navLink);
  setCssVar('--md-nav-link-hover', theme.navLinkHover);
  setCssVar('--md-nav-border', theme.navBorder);
  setCssVar('--md-nav-active', theme.navActive);
  setCssVar('--md-nav-active-background', theme.navActiveBackground);

  // Utility variables
  setCssVar('--md-text-muted', theme.textMuted);
  setCssVar('--md-text-subtle', theme.textSubtle);
  setCssVar('--md-hover-background', theme.hoverBackground);

  // Icon hover variables
  setCssVar('--md-icon-hover', theme.iconHover);
  setCssVar('--md-icon-hover-background', theme.iconHoverBackground);
  setCssVar('--md-nav-icon-hover', theme.navIconHover);
  setCssVar('--md-nav-icon-hover-background', theme.navIconHoverBackground);

  // Content area variables
  setCssVar('--md-content-background', theme.contentBackground);
  setCssVar('--md-card-background', theme.cardBackground);
  setCssVar('--md-card-border', theme.cardBorder);
  setCssVar('--md-section-border', theme.sectionBorder);

  // Form and input variables
  setCssVar('--md-input-background', theme.inputBackground);
  setCssVar('--md-input-border', theme.inputBorder);
  setCssVar('--md-input-text', theme.inputText);
  setCssVar('--md-placeholder-text', theme.placeholderText);

  // Button variant variables
  setCssVar('--md-button-secondary', theme.buttonSecondary);
  setCssVar('--md-button-secondary-hover', theme.buttonSecondaryHover);
  setCssVar('--md-button-outline', theme.buttonOutline);
  setCssVar('--md-button-outline-hover', theme.buttonOutlineHover);

  // Badge and tag variables
  setCssVar('--md-tag-background', theme.tagBackground);
  setCssVar('--md-tag-text', theme.tagText);
  setCssVar('--md-badge-background', theme.badgeBackground);
  setCssVar('--md-badge-text', theme.badgeText);

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
  // Navigation-specific
  navLink: '#1e88e5',
  navLinkHover: '#1565c0',
  navBorder: '#e5e7eb',
  navActive: '#1e88e5',
  navActiveBackground: '#dbeafe',
  // Utility colors
  textMuted: '#6b7280',
  textSubtle: '#9ca3af',
  hoverBackground: 'rgba(255, 255, 255, 0.1)', // Semi-transparent white for better contrast on primary
  // Icon hover effects
  iconHover: '#1e88e5', // Blue fill on hover
  iconHoverBackground: 'rgba(30, 136, 229, 0.1)', // Light blue background
  navIconHover: '#FF0000', 
  navIconHoverBackground: 'rgba(255, 255, 255, 0.15)', // Semi-transparent white background
  // Content area colors
  contentBackground: '#f9fafb',
  cardBackground: '#ffffff',
  cardBorder: '#e5e7eb',
  sectionBorder: '#f3f4f6',
  // Form and input colors
  inputBackground: '#ffffff',
  inputBorder: '#d1d5db',
  inputText: '#111827',
  placeholderText: '#6b7280',
  // Button variants
  buttonSecondary: '#f3f4f6',
  buttonSecondaryHover: '#e5e7eb',
  buttonOutline: 'transparent',
  buttonOutlineHover: '#f3f4f6',
  // Badge and tag colors
  tagBackground: '#f3f4f6',
  tagText: '#374151',
  badgeBackground: '#dbeafe',
  badgeText: '#1e40af',
};

export default defaultMaterialTheme;

// -- Multiple theme support -------------------------------------------------

// -- Bauhaus theme -------------------------------------------------

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
  // Navigation-specific
  navLink: '#e63946',
  navLinkHover: '#b22234',
  navBorder: '#e5e7eb',
  navActive: '#e63946',
  navActiveBackground: '#fef2f2',
  // Utility colors
  textMuted: '#6b7280',
  textSubtle: '#9ca3af',
  hoverBackground: '#fef2f2',
  // Icon hover effects
  iconHover: '#e63946', // Deep red fill on hover
  iconHoverBackground: 'rgba(230, 57, 70, 0.1)', // Light red background
  navIconHover: '#ffffff', // White fill for nav icons
  navIconHoverBackground: 'rgba(255, 255, 255, 0.15)', // Semi-transparent white background
  // Content area colors
  contentBackground: '#fffbeb',
  cardBackground: '#ffffff',
  cardBorder: '#f5c400',
  sectionBorder: '#fef3c7',
  // Form and input colors
  inputBackground: '#ffffff',
  inputBorder: '#f5c400',
  inputText: '#111827',
  placeholderText: '#6b7280',
  // Button variants
  buttonSecondary: '#fef3c7',
  buttonSecondaryHover: '#f5c400',
  buttonOutline: 'transparent',
  buttonOutlineHover: '#fef3c7',
  // Badge and tag colors
  tagBackground: '#fef3c7',
  tagText: '#92400e',
  badgeBackground: '#fef2f2',
  badgeText: '#b91c1c',
};


// -- Vancouver theme -------------------------------------------------

export const VancouverTheme: Theme = {
  "primary": "#0284c7",          // sky-600
  "primaryVariant": "#0369a1",
  "secondary": "#10b981",        // emerald-500
  "secondaryVariant": "#047857",
  "background": "#f0fdfa",       // teal-50
  "surface": "#ffffff",
  "error": "#dc2626",            // red-600
  "success": "#16a34a",          // green-600
  "warning": "#f97316",          // orange-500
  "onPrimary": "#ffffff",
  "onSecondary": "#ffffff",
  "onSuccess": "#ffffff",
  "onWarning": "#111827",
  "onBackground": "#0f172a",     // slate-900
  "onSurface": "#0f172a",
  "onError": "#ffffff",
  // Navigation-specific
  navLink: '#0284c7',
  navLinkHover: '#0369a1',
  navBorder: '#a7f3d0',
  navActive: '#0284c7',
  navActiveBackground: '#e0f2fe',
  // Utility colors
  textMuted: '#64748b',
  textSubtle: '#94a3b8',
  hoverBackground: '#f0f9ff',
  // Icon hover effects
  iconHover: '#0284c7', // Sky blue fill on hover
  iconHoverBackground: 'rgba(2, 132, 199, 0.1)', // Light sky blue background
  navIconHover: '#ffffff', // White fill for nav icons
  navIconHoverBackground: 'rgba(255, 255, 255, 0.15)', // Semi-transparent white background
  // Content area colors
  contentBackground: '#f0f9ff',
  cardBackground: '#ffffff',
  cardBorder: '#a7f3d0',
  sectionBorder: '#ecfdf5',
  // Form and input colors
  inputBackground: '#ffffff',
  inputBorder: '#a7f3d0',
  inputText: '#0f172a',
  placeholderText: '#64748b',
  // Button variants
  buttonSecondary: '#ecfdf5',
  buttonSecondaryHover: '#d1fae5',
  buttonOutline: 'transparent',
  buttonOutlineHover: '#f0f9ff',
  // Badge and tag colors
  tagBackground: '#ecfdf5',
  tagText: '#064e3b',
  badgeBackground: '#e0f2fe',
  badgeText: '#0c4a6e',
};


// -- DarkGallery theme -------------------------------------------------

export const DarkGalleryTheme: Theme = {
  "primary": "#6366f1",          // indigo-500
  "primaryVariant": "#4338ca",
  "secondary": "#f43f5e",        // rose-500
  "secondaryVariant": "#9f1239",
  "background": "#111827",       // gray-900
  "surface": "#1f2937",          // gray-800
  "error": "#ef4444",            // red-500
  "success": "#22c55e",          // green-500
  "warning": "#eab308",          // yellow-500
  "onPrimary": "#ffffff",
  "onSecondary": "#ffffff",
  "onSuccess": "#111827",
  "onWarning": "#111827",
  "onBackground": "#f9fafb",     // gray-50
  "onSurface": "#f9fafb",
  "onError": "#ffffff",
  // Navigation-specific
  navLink: '#6366f1',
  navLinkHover: '#818cf8',
  navBorder: '#374151',
  navActive: '#6366f1',
  navActiveBackground: '#312e81',
  // Utility colors
  textMuted: '#9ca3af',
  textSubtle: '#6b7280',
  hoverBackground: '#374151',
  // Icon hover effects
  iconHover: '#6366f1', // Indigo fill on hover
  iconHoverBackground: 'rgba(99, 102, 241, 0.1)', // Light indigo background
  navIconHover: '#ffffff', // White fill for nav icons
  navIconHoverBackground: 'rgba(255, 255, 255, 0.1)', // Semi-transparent white background
  // Content area colors
  contentBackground: '#0f172a',
  cardBackground: '#1f2937',
  cardBorder: '#374151',
  sectionBorder: '#4b5563',
  // Form and input colors
  inputBackground: '#1f2937',
  inputBorder: '#4b5563',
  inputText: '#f9fafb',
  placeholderText: '#9ca3af',
  // Button variants
  buttonSecondary: '#374151',
  buttonSecondaryHover: '#4b5563',
  buttonOutline: 'transparent',
  buttonOutlineHover: '#374151',
  // Badge and tag colors
  tagBackground: '#374151',
  tagText: '#d1d5db',
  badgeBackground: '#312e81',
  badgeText: '#c7d2fe',
};

// -- EarthyCultural theme -------------------------------------------------

export const EarthyCulturalTheme: Theme = 
{
  "primary": "#d97706",          // amber-700
  "primaryVariant": "#92400e",  
  "secondary": "#065f46",        // emerald-800
  "secondaryVariant": "#064e3b",
  "background": "#fdfcf9",       // warm off-white
  "surface": "#ffffff",
  "error": "#b91c1c",            // red-700
  "success": "#15803d",          // green-700
  "warning": "#facc15",          // yellow-400
  "onPrimary": "#ffffff",
  "onSecondary": "#ffffff",
  "onSuccess": "#ffffff",
  "onWarning": "#111827",
  "onBackground": "#1f2937",     // gray-800
  "onSurface": "#1f2937",
  "onError": "#ffffff",
  // Navigation-specific
  navLink: '#d97706',
  navLinkHover: '#92400e',
  navBorder: '#f3e8d3',
  navActive: '#d97706',
  navActiveBackground: '#fef3c7',
  // Utility colors
  textMuted: '#78716c',
  textSubtle: '#a8a29e',
  hoverBackground: '#fef7ed',
  // Icon hover effects
  iconHover: '#d97706', // Amber fill on hover
  iconHoverBackground: 'rgba(217, 119, 6, 0.1)', // Light amber background
  navIconHover: '#ffffff', // White fill for nav icons
  navIconHoverBackground: 'rgba(255, 255, 255, 0.15)', // Semi-transparent white background
  // Content area colors
  contentBackground: '#fefcf9',
  cardBackground: '#ffffff',
  cardBorder: '#e7e5e4',
  sectionBorder: '#f5f5f4',
  // Form and input colors
  inputBackground: '#ffffff',
  inputBorder: '#e7e5e4',
  inputText: '#1f2937',
  placeholderText: '#78716c',
  // Button variants
  buttonSecondary: '#f5f5f4',
  buttonSecondaryHover: '#e7e5e4',
  buttonOutline: 'transparent',
  buttonOutlineHover: '#fef7ed',
  // Badge and tag colors
  tagBackground: '#f5f5f4',
  tagText: '#57534e',
  badgeBackground: '#fef3c7',
  badgeText: '#92400e',
}

// -- HighContrast DEBUG theme -------------------------------------------------

export const HighContrastDebugTheme: Theme = {
  "primary": "#ff1493",          // hot pink - very obvious
  "primaryVariant": "#dc143c",   // crimson
  "secondary": "#00ff00",        // lime green - highly visible
  "secondaryVariant": "#32cd32", // lime green variant
  "background": "#ffa500",       // orange - can't miss it
  "surface": "#ffff00",          // bright yellow - stands out
  "error": "#ff0000",            // pure red
  "success": "#00ffff",          // cyan - unusual choice
  "warning": "#ff4500",          // orange-red - different from background
  "onPrimary": "#2e003e",        // dark purple instead of black
  "onSecondary": "#4a1a00",      // dark brown instead of black
  "onSuccess": "#003366",        // dark blue instead of black
  "onWarning": "#ffffcc",        // light yellow instead of white 
  "onBackground": "#330066",     // dark purple instead of black
  "onSurface": "#663300",        // dark brown instead of black
  "onError": "#ffccff",          // light pink instead of white
  // Navigation-specific
  "navLink": "#9400d3",          // violet - easy to spot links
  "navLinkHover": "#4b0082",     // indigo - darker violet on hover
  "navBorder": "#ff69b4",        // hot pink - different from primary
  "navActive": "#8a2be2",        // blue-violet for active states
  "navActiveBackground": "#dda0dd", // plum background for active
  // Utility colors
  "textMuted": "#8b008b",        // dark magenta for muted text
  "textSubtle": "#9370db",       // medium slate blue for subtle text
  "hoverBackground": "#e6e6fa",  // lavender for hover backgrounds
  // Icon hover effects
  "iconHover": "#ff1493",        // Hot pink fill on hover
  "iconHoverBackground": "rgba(255, 20, 147, 0.2)", // Light hot pink background
  "navIconHover": "#ffff00",     // Bright yellow fill for nav icons
  "navIconHoverBackground": "rgba(255, 255, 0, 0.2)", // Light yellow background
  // Content area colors
  "contentBackground": "#f0e68c", // khaki - distinct content area
  "cardBackground": "#87ceeb",   // sky blue - cards stand out
  "cardBorder": "#4682b4",       // steel blue - card borders
  "sectionBorder": "#20b2aa",    // light sea green - section dividers
  // Form and input colors
  "inputBackground": "#ffd700",  // gold - input fields obvious
  "inputBorder": "#b8860b",      // dark goldenrod - input borders
  "inputText": "#4a1a00",        // dark brown - input text (no black)
  "placeholderText": "#8b4513",  // saddle brown - placeholder text (no white/gray)
  // Button variants
  "buttonSecondary": "#40e0d0",  // turquoise - secondary buttons
  "buttonSecondaryHover": "#00ced1", // dark turquoise on hover
  "buttonOutline": "#da70d6",    // orchid - outline buttons
  "buttonOutlineHover": "#ba55d3", // medium orchid on hover
  // Badge and tag colors
  "tagBackground": "#98fb98",    // pale green - tag backgrounds
  "tagText": "#006400",          // dark green - tag text
  "badgeBackground": "#ffd1dc",  // pink - badge backgrounds
  "badgeText": "#8b0000",        // dark red - badge text
};

export const themes: Record<string, Theme> = {
  material: defaultMaterialTheme,
  bauhaus: bauhausTheme,
  Vancouver: VancouverTheme,
  DarkGallery: DarkGalleryTheme,
  EarthyCultural: EarthyCulturalTheme,
  HighContrastDebug: HighContrastDebugTheme,
};

export type ThemeName = keyof typeof themes;

/**
 * Apply a theme by name. No-op if name not found.
 */
export function applyThemeByName(name: ThemeName | string): void {
  const t = (themes as Record<string, Theme>)[name];
  if (t) applyTheme(t);
}

