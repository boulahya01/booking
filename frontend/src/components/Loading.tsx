import React from 'react'
import './Loading.css'

export default function Loading({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="loading-root" role="status" aria-live="polite">
      <div className="spinner-dots" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="dot" style={{ ['--i' as any]: i } as React.CSSProperties} />
        ))}
      </div>
      <div className="loading-text">{text}</div>
    </div>
  )
}
