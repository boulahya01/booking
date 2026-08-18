module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          light: 'var(--primary-light)',
          dark: 'var(--primary-dark)',
          hover: 'var(--primary-hover)',
          gradient: 'var(--primary-gradient)'
        },
        surface: {
          DEFAULT: 'var(--surface)',
          raised: 'var(--surface-raised)',
          'level-1': 'var(--surface-level-1)',
          'level-2': 'var(--surface-level-2)'
        },
        text: {
          DEFAULT: 'var(--text)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          inverse: 'var(--text-inverse)'
        },
        border: {
          DEFAULT: 'var(--border)',
          light: 'var(--border-light)'
        },
        success: {
          DEFAULT: 'var(--success)',
          light: 'var(--success-light)'
        },
        warning: {
          DEFAULT: 'var(--warning)',
          light: 'var(--warning-light)'
        },
        danger: {
          DEFAULT: 'var(--danger)',
          light: 'var(--danger-light)'
        },
        info: {
          DEFAULT: 'var(--info)',
          light: 'var(--info-light)'
        },
        bg: 'var(--bg)'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Arial'],
        serif: ['Georgia', 'Times New Roman', 'serif']
      },
      spacing: {
        'safe-bottom': 'var(--safe-area-inset-bottom, 0)',
        'safe-top': 'var(--safe-area-inset-top, 0)'
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        primary: 'var(--shadow-primary)'
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        full: 'var(--radius-full)'
      }
    }
  },
  plugins: [require('@tailwindcss/forms')]
};
