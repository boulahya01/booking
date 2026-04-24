import { FiMoon, FiSun } from 'react-icons/fi'
import { useTheme } from '../context/ThemeContext'
import '../styles/ThemeToggle.css'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <FiMoon size={20} />
      ) : (
        <FiSun size={20} />
      )}
    </button>
  )
}
