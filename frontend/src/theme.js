import { createTheme } from '@mui/material/styles'

/**
 * Design tokens from the Stitch design system (docs/stitch: DESIGN.md).
 * Everything visual should reference these or the MUI theme below.
 */
export const tokens = {
  canvas: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceLow: '#EFF4FF',
  surfaceContainer: '#E6EEFF',
  surfaceHigh: '#DEE9FC',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  borderSubtle: '#F3F4F6',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  primary: '#1565C0',
  primaryDark: '#0D47A1',
  primarySubtle: '#EFF6FF',
  primaryFixed: '#D6E3FF',
  onPrimaryFixed: '#001B3D',
  gridLine: '#9CA3AF',
  gridTick: '#C2C6D4',
  gridFrame: '#111827',
}

const fontFamily = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: tokens.primary, dark: tokens.primaryDark, light: '#5E92F3', contrastText: '#FFFFFF' },
    secondary: { main: '#006591', contrastText: '#FFFFFF' },
    error: { main: '#DC2626', light: '#FEE2E2', dark: '#991B1B' },
    warning: { main: '#D97706', light: '#FEF3C7', dark: '#92400E' },
    success: { main: '#16A34A', light: '#DCFCE7', dark: '#166534' },
    info: { main: '#0EA5E9', light: '#E0F2FE', dark: '#0369A1' },
    background: { default: tokens.canvas, paper: tokens.surface },
    text: { primary: tokens.textPrimary, secondary: tokens.textSecondary },
    divider: tokens.border,
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily,
    fontSize: 13,
    h4: { fontSize: 24, fontWeight: 600, lineHeight: '32px', letterSpacing: '-0.01em' },
    h5: { fontSize: 20, fontWeight: 600, lineHeight: '28px' },
    h6: { fontSize: 18, fontWeight: 600, lineHeight: '24px' },
    subtitle1: { fontSize: 16, fontWeight: 600, lineHeight: '22px' },
    subtitle2: { fontSize: 14, fontWeight: 600, lineHeight: '20px' },
    body1: { fontSize: 14, lineHeight: '20px', letterSpacing: '0.01em' },
    body2: { fontSize: 13, lineHeight: '18px', letterSpacing: '0.01em' },
    caption: { fontSize: 11, fontWeight: 500, lineHeight: '14px', letterSpacing: '0.03em' },
    overline: { fontSize: 11, fontWeight: 600, lineHeight: '16px', letterSpacing: '0.06em' },
    button: { fontSize: 13, fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: tokens.canvas },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: `1px solid ${tokens.border}`, backgroundImage: 'none' },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: { boxShadow: '0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.05)' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { boxShadow: '0px 10px 24px -4px rgba(0,0,0,0.18)' },
      },
    },
    MuiAppBar: { defaultProps: { elevation: 0 } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 4, minHeight: 36, paddingLeft: 14, paddingRight: 14 },
        sizeSmall: { minHeight: 32 },
        outlined: {
          borderColor: tokens.borderStrong,
          color: tokens.textPrimary,
          '&:hover': { backgroundColor: '#F3F4F6', borderColor: '#9CA3AF' },
        },
      },
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 4 } } },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          fontSize: 13,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.borderStrong },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#9CA3AF' },
        },
        input: { paddingTop: 8.5, paddingBottom: 8.5 },
      },
    },
    MuiInputAdornment: {
      styleOverrides: { root: { color: tokens.textSecondary, '& .MuiSvgIcon-root': { fontSize: 18 } } },
    },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 0, fontSize: 11 } } },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 4, height: 22, fontSize: 11, fontWeight: 700, letterSpacing: '0.02em' },
        label: { paddingLeft: 8, paddingRight: 8 },
        sizeSmall: { height: 20, fontSize: 10.5 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { padding: '8px 12px', borderBottom: `1px solid ${tokens.border}`, fontSize: 13 },
        head: {
          backgroundColor: tokens.canvas,
          color: tokens.textSecondary,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          height: 36,
          whiteSpace: 'nowrap',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: { root: { '&:hover td': { backgroundColor: '#F1F5F9' } } },
    },
    MuiTabs: { styleOverrides: { indicator: { height: 2 } } },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, fontSize: 14, minHeight: 48, paddingLeft: 20, paddingRight: 20 },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: 13,
          padding: '4px 12px',
          borderColor: tokens.borderStrong,
          '&.Mui-selected': { backgroundColor: tokens.primarySubtle, color: tokens.primary },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 4, fontSize: 13 },
        message: { fontSize: 13 },
      },
    },
    MuiAccordion: {
      defaultProps: { disableGutters: true },
      styleOverrides: { root: { '&::before': { display: 'none' } } },
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { fontSize: 12, backgroundColor: '#27313F' } },
    },
    MuiLinearProgress: { styleOverrides: { root: { borderRadius: 2, height: 4 } } },
  },
})

export default theme
