import { ThemePresetId } from '../types/grid';

export interface ThemePalette {
  canvas: string;
  surface: string;
  subtle: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  shadowColor: string;
}

export interface ThemePresetDefinition {
  id: ThemePresetId;
  name: string;
  subtitle: string;
  isComic: boolean;
  borderRadius: string;
  defaultAccent: string;
  day: ThemePalette;
  night: ThemePalette;
}

export const THEME_PRESETS: ThemePresetDefinition[] = [
  {
    id: 'pixel-arcade',
    name: 'Mob Arcade',
    subtitle: 'Sky daylight & crimson pixel ink',
    isComic: true,
    borderRadius: '12px',
    defaultAccent: '#E3242B',
    day: {
      canvas: '#EAF6FF',
      surface: '#FFFFFF',
      subtle: '#D8ECFC',
      border: '#141923',
      textPrimary: '#141923',
      textSecondary: '#42526B',
      shadowColor: '#141923',
    },
    night: {
      canvas: '#0B111E',
      surface: '#131C2E',
      subtle: '#1C2942',
      border: '#5271A3',
      textPrimary: '#F1F6FF',
      textSecondary: '#9CB2CF',
      shadowColor: '#05080F',
    },
  },
  {
    id: 'meadow-sprint',
    name: 'Meadow Sprint',
    subtitle: 'Fresh grass greens & crisp frames',
    isComic: true,
    borderRadius: '14px',
    defaultAccent: '#2E9E4E',
    day: {
      canvas: '#F1FAF2',
      surface: '#FFFFFF',
      subtle: '#DCF0DF',
      border: '#16261B',
      textPrimary: '#16261B',
      textSecondary: '#415E48',
      shadowColor: '#16261B',
    },
    night: {
      canvas: '#0D1610',
      surface: '#152219',
      subtle: '#1E3224',
      border: '#4CE87A',
      textPrimary: '#EDF9EF',
      textSecondary: '#9BC1A5',
      shadowColor: '#040906',
    },
  },
  {
    id: 'kaiju-comic',
    name: 'Manga Pop',
    subtitle: 'Cream panels & bold ink borders',
    isComic: true,
    borderRadius: '16px',
    defaultAccent: '#72EC68',
    day: {
      canvas: '#FFF9E6',
      surface: '#FFFFFF',
      subtle: '#EFE7CE',
      border: '#141418',
      textPrimary: '#141418',
      textSecondary: '#47443B',
      shadowColor: '#141418',
    },
    night: {
      canvas: '#101512',
      surface: '#19211C',
      subtle: '#232F28',
      border: '#72EC68',
      textPrimary: '#FFF9E6',
      textSecondary: '#B3C2B7',
      shadowColor: '#000000',
    },
  },
  {
    id: 'warm-tactile',
    name: 'Warm Sandstone',
    subtitle: 'Soft rounded tactile paper cards',
    isComic: false,
    borderRadius: '24px',
    defaultAccent: '#2563EB',
    day: {
      canvas: '#FAF7F2',
      surface: '#FFFFFF',
      subtle: '#F2EDE4',
      border: '#E2DBD0',
      textPrimary: '#1C1917',
      textSecondary: '#78716C',
      shadowColor: 'rgba(28, 25, 23, 0.08)',
    },
    night: {
      canvas: '#0B0F17',
      surface: '#121826',
      subtle: '#1C2536',
      border: '#263145',
      textPrimary: '#F8FAFC',
      textSecondary: '#94A3B8',
      shadowColor: 'rgba(0, 0, 0, 0.35)',
    },
  },
];

export const ACCENT_SWATCHES = [
  { name: 'Arcade Red', hex: '#E3242B' },
  { name: 'Ectoplasm', hex: '#36D96B' },
  { name: 'Sky Blue', hex: '#2596EB' },
  { name: 'Meadow', hex: '#2E7D4F' },
  { name: 'Sunset Gold', hex: '#F59E0B' },
  { name: 'Pixel Ink', hex: '#141923' },
];

export function normalizeHex(input: string): string | null {
  const cleaned = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const expanded = cleaned
      .split('')
      .map((c) => c + c)
      .join('');
    return `#${expanded.toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toUpperCase()}`;
  }
  return null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const norm = normalizeHex(hex) || '#E3242B';
  const raw = norm.slice(1);
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

export function getContrastForeground(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return lum > 0.36 ? '#141418' : '#FFFFFF';
}

export function shadeHex(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const nr = clamp(r * factor);
  const ng = clamp(g * factor);
  const nb = clamp(b * factor);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function normalizePresetAndMode(
  id?: ThemePresetId,
  mode?: 'light' | 'dark'
): { preset: ThemePresetDefinition; mode: 'light' | 'dark' } {
  if (id === 'kaiju-night') {
    return {
      preset: THEME_PRESETS.find((p) => p.id === 'kaiju-comic') || THEME_PRESETS[0],
      mode: mode || 'dark',
    };
  }
  if (id === 'midnight-slate') {
    return {
      preset: THEME_PRESETS.find((p) => p.id === 'warm-tactile') || THEME_PRESETS[0],
      mode: mode || 'dark',
    };
  }
  const preset = THEME_PRESETS.find((p) => p.id === id) || THEME_PRESETS[0];
  return { preset, mode: mode === 'dark' ? 'dark' : 'light' };
}

export function getPresetById(id?: ThemePresetId): ThemePresetDefinition {
  return normalizePresetAndMode(id).preset;
}

export function applyThemeToDocument(
  themePresetId: ThemePresetId,
  accentHex: string,
  themeMode: 'light' | 'dark' = 'light'
) {
  const { preset, mode } = normalizePresetAndMode(themePresetId, themeMode);
  const isDark = mode === 'dark';
  const palette = isDark ? preset.night : preset.day;
  const validAccent = normalizeHex(accentHex) || preset.defaultAccent;
  const contrastFg = getContrastForeground(validAccent);
  const hoverAccent = isDark ? shadeHex(validAccent, 1.1) : shadeHex(validAccent, 0.9);
  const softAccent = hexToRgba(validAccent, isDark ? 0.22 : 0.16);

  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  root.style.setProperty('--bg-canvas', palette.canvas);
  root.style.setProperty('--bg-surface', palette.surface);
  root.style.setProperty('--bg-subtle', palette.subtle);
  root.style.setProperty('--border-subtle', palette.border);
  root.style.setProperty('--text-primary', palette.textPrimary);
  root.style.setProperty('--text-secondary', palette.textSecondary);
  root.style.setProperty('--accent', validAccent);
  root.style.setProperty('--accent-hover', hoverAccent);
  root.style.setProperty('--accent-soft', softAccent);
  root.style.setProperty('--accent-contrast', contrastFg);

  // Pixel/Comic vs Soft card geometry tokens
  root.style.setProperty('--card-border-width', preset.isComic ? '2px' : '1px');
  root.style.setProperty(
    '--card-shadow',
    preset.isComic
      ? `4px 4px 0px ${palette.shadowColor}`
      : `0 2px 12px -4px ${palette.shadowColor}`
  );
  root.style.setProperty(
    '--card-shadow-sm',
    preset.isComic
      ? `2px 2px 0px ${palette.shadowColor}`
      : `0 1px 4px -1px ${palette.shadowColor}`
  );
  root.style.setProperty('--card-radius', preset.borderRadius);

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', isDark ? palette.surface : palette.canvas);
  }
}
