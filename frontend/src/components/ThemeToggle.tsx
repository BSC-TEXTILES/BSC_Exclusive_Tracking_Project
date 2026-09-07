import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../lib/theme'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      className={`relative inline-flex items-center h-7 w-14 rounded-full transition-colors duration-500 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 focus:ring-offset-surface shrink-0 ${
        isDark
          ? 'bg-gradient-to-r from-indigo-600 to-purple-700 shadow-lg shadow-purple-500/25'
          : 'bg-gradient-to-r from-amber-400 to-orange-500 shadow-lg shadow-orange-400/25'
      } ${className}`}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* Track background icons */}
      <span className="absolute inset-0 flex items-center justify-between px-1.5">
        <Sun className="w-3.5 h-3.5 text-white/60" />
        <Moon className="w-3.5 h-3.5 text-white/60" />
      </span>

      {/* Sliding knob */}
      <span
        className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)] ${
          isDark ? 'translate-x-7' : 'translate-x-0'
        }`}
      >
        {isDark ? (
          <Moon className="w-3 h-3 text-purple-700" />
        ) : (
          <Sun className="w-3 h-3 text-orange-500" />
        )}
      </span>
    </button>
  )
}
