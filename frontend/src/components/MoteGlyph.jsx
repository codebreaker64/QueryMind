/**
 * Flat 2D Mote, used where the 3D model would be overkill:
 * the wordmark, chat avatars and the clarifying-question dialog.
 */
export default function MoteGlyph({ size = 24, mood = 'happy', className = '', title }) {
  const id = `mote-${size}-${mood}`
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <radialGradient id={`${id}-body`} cx="50%" cy="68%" r="62%">
          <stop offset="0%" stopColor="#ffd98a" />
          <stop offset="60%" stopColor="#ffb257" />
          <stop offset="100%" stopColor="#f2883a" />
        </radialGradient>
      </defs>
      <path d="M24 9c0-3 1.5-5.5 4.5-5.5" fill="none" stroke="#f2a24e" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="29.5" cy="3.8" r="2.6" fill="#ffe1a0" />
      <path
        d="M24 9.5c8.6 0 15.5 9.6 15.5 19.6 0 8.3-6.9 13.4-15.5 13.4S8.5 37.4 8.5 29.1C8.5 19.1 15.4 9.5 24 9.5Z"
        fill={`url(#${id}-body)`}
      />
      <ellipse cx="7.8" cy="31" rx="3" ry="2.3" fill="#f59a46" />
      <ellipse cx="40.2" cy="31" rx="3" ry="2.3" fill="#f59a46" />
      {mood === 'curious' ? (
        <>
          <ellipse cx="19.6" cy="25" rx="2.3" ry="3" fill="#1b120c" />
          <ellipse cx="28.4" cy="24" rx="2.6" ry="3.4" fill="#1b120c" />
          <path d="M21.5 31.5c1.6.9 3.4.9 5 0" fill="none" stroke="#1b120c" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="19.8" cy="25" rx="2.3" ry="3" fill="#1b120c" />
          <ellipse cx="28.2" cy="25" rx="2.3" ry="3" fill="#1b120c" />
          <path d="M21.2 30.5c1.7 1.6 3.9 1.6 5.6 0" fill="none" stroke="#1b120c" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
      <circle cx="20.6" cy="23.9" r=".8" fill="#fff" />
      <circle cx="29" cy="23.9" r=".8" fill="#fff" />
      <ellipse cx="15.6" cy="29.6" rx="2.2" ry="1.3" fill="#ff7f7a" opacity=".45" />
      <ellipse cx="32.4" cy="29.6" rx="2.2" ry="1.3" fill="#ff7f7a" opacity=".45" />
    </svg>
  )
}
