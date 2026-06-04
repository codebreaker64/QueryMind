/**
 * SourceCard — Link item for the Links tab.
 * Displays as a compact list row with favicon, title, domain, and snippet.
 */
export default function SourceCard({ source, index }) {
  const { title, url, snippet } = source

  let domain = ''
  try {
    const parsed = new URL(url)
    domain = parsed.hostname.replace('www.', '')
  } catch {
    domain = url
  }

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      id={`source-card-${index}`}
      className="
        group flex items-start gap-3.5 p-3.5 rounded-xl
        animate-fade-in-up
        hover:bg-[var(--bg-surface-hover)]
        transition-all duration-200 ease-out cursor-pointer
      "
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Favicon */}
      <div className="w-8 h-8 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center overflow-hidden shrink-0 mt-0.5">
        <img
          src={faviconUrl}
          alt=""
          className="w-4 h-4"
          onError={(e) => { e.target.style.display = 'none' }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--accent-bright)] transition-colors">
            {title || 'Untitled Source'}
          </h3>
          <span className="shrink-0 text-[10px] font-semibold text-[var(--accent-bright)] bg-[var(--accent-glow)] px-1.5 py-0.5 rounded-full">
            {index + 1}
          </span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-1">{domain}</p>
        {snippet && (
          <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">{snippet}</p>
        )}
      </div>

      {/* External link indicator */}
      <svg className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
      </svg>
    </a>
  )
}
