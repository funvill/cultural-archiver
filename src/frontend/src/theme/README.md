Theme system

This folder contains a tiny runtime theme system used by the frontend.

Files
- `theme.ts` - exports `Theme`, `defaultMaterialTheme`, and `applyTheme(theme)`.

How it works
- At app startup `main.ts` calls `applyTheme(defaultMaterialTheme)` which writes CSS variables to `:root`.
- CSS uses variables like `--md-primary`, `--md-on-primary`, `--md-background`, etc. There are fallbacks in `style.css`.

How to change the theme
1. Edit `defaultMaterialTheme` in `src/theme/theme.ts` to change colors.
2. Or create a new theme object and call `applyTheme(myTheme)` before `app.mount('#app')` in `main.ts`.

Example: add a dark theme toggle

In a component you can import `applyTheme` and call it with your alternate palette. For persistent user preference, store the choice in localStorage and apply on startup before mounting the app.

Multiple themes

`theme.ts` now exports a `themes` map and a helper `applyThemeByName(name)`.

Available theme names:

- `material` (default)
- `bauhaus` (high-contrast, bold Bauhaus-inspired palette)

Examples

Apply by name (recommended for simple toggles):

```ts
import { applyThemeByName } from './theme/theme';

// Apply the bauhaus theme
applyThemeByName('bauhaus');
```

Apply by object (for custom palettes):

```ts
import { applyTheme } from './theme/theme';

applyTheme({ primary: '#123456', onPrimary: '#fff' });
```

Persistent user preference

Save the selected theme name to `localStorage` and apply it early in `main.ts` before mounting the app so the UI doesn't flash the default palette on load.

