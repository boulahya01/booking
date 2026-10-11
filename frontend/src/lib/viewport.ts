/** One viewport owner for keyboard-safe overlays and form scrolling. No render loop. */
export function observeViewport(): () => void {
  const root = document.documentElement
  const viewport = window.visualViewport
  let frame = 0
  let restingHeight = window.innerHeight
  let restingWidth = window.innerWidth

  function update() {
    frame = 0
    const active = document.activeElement
    const editing = active instanceof HTMLElement && active.matches('input:not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]')
    const height = viewport?.height ?? window.innerHeight
    const top = viewport?.offsetTop ?? 0
    if (!editing || Math.abs(restingWidth - window.innerWidth) > 80) {
      restingHeight = window.innerHeight
      restingWidth = window.innerWidth
    }
    // Pinch zoom is not a keyboard; leave the browser's zoom/pan behavior intact.
    const unzoomed = Math.abs((viewport?.scale ?? 1) - 1) < .05
    const keyboard = editing && unzoomed && restingHeight - height > 150
    root.style.setProperty('--visual-height', `${height}px`)
    root.style.setProperty('--visual-top', `${top}px`)
    root.toggleAttribute('data-keyboard-open', keyboard)
    if (keyboard && active instanceof HTMLElement) {
      const rect = active.getBoundingClientRect()
      if (rect.bottom > top + height - 16 || rect.top < top + 16) {
        active.scrollIntoView({ block: 'nearest', behavior: 'instant' })
      }
    }
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update) }
  viewport?.addEventListener('resize', schedule)
  viewport?.addEventListener('scroll', schedule)
  window.addEventListener('resize', schedule)
  document.addEventListener('focusin', schedule)
  document.addEventListener('focusout', schedule)
  update()
  return () => {
    cancelAnimationFrame(frame)
    viewport?.removeEventListener('resize', schedule)
    viewport?.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    document.removeEventListener('focusin', schedule)
    document.removeEventListener('focusout', schedule)
    root.removeAttribute('data-keyboard-open')
    root.style.removeProperty('--visual-height')
    root.style.removeProperty('--visual-top')
  }
}
