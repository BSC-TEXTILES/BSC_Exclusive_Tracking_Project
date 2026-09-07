import { useTheme } from './theme'

export function useChartTheme() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return {
    textColor: isDark ? '#94a3b8' : '#64748b',
    gridColor: isDark ? '#1e293b' : '#e2e8f0',
    tooltipBg: isDark ? '#1e293b' : '#ffffff',
    tooltipBorder: isDark ? '#334155' : '#e2e8f0',
    tooltipText: isDark ? '#e2e8f0' : '#334155',
    cursorFill: isDark ? 'rgba(56,189,248,0.06)' : '#f0f9ff',
  }
}
