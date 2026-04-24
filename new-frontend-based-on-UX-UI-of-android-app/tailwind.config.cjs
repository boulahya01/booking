module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        neon: '#7c4dff',
        accent: '#ff2d95',
        bg: '#07080b',
        card: '#0f1724'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Arial']
      }
    }
  },
  plugins: []
};
