(() => {
  try {
    const root = document.documentElement
    const language = localStorage.getItem('language')

    if (language === 'ar' || language === 'en') {
      root.lang = language
      root.dir = language === 'ar' ? 'rtl' : 'ltr'
    }

    const theme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const useDark = theme === 'dark' || (theme === 'auto' && prefersDark)
    root.classList.toggle('dark', useDark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', useDark ? '#101113' : '#f5f5f7')
  } catch {
    // Defaults in app.html remain valid when storage is unavailable.
  }
})()
