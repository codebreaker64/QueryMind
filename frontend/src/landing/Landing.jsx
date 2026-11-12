import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  ArrowDown,
  Search,
  CornerDownLeft,
  Server,
  MonitorSmartphone,
  Sparkles,
  Database,
  Plug,
} from 'lucide-react'
import GoogleSignIn from '../components/GoogleSignIn'
import MoteGlyph from '../components/MoteGlyph'
import './landing.css'

function GithubMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}

const REPO_URL = 'https://github.com/codebreaker64/QueryMind'

const EXAMPLE = {
  question: 'Should a three-person team pick LangGraph or CrewAI for its first agent?',
  searches: [
    { q: 'LangGraph production case studies', found: 6 },
    { q: 'CrewAI vs LangGraph learning curve', found: 5 },
    { q: 'agent framework state persistence', found: 4 },
    { q: 'multi-agent orchestration for small teams', found: 7 },
  ],
  clarify: 'Do you care more about shipping something quickly, or about fine control over every step the agent takes?',
  options: ['Ship quickly', 'Fine control'],
  chosen: 1,
  sources: [
    { n: 1, title: 'LangGraph: low-level orchestration for agents', domain: 'langchain-ai.github.io' },
    { n: 2, title: 'Persistence and human-in-the-loop', domain: 'langchain-ai.github.io' },
    { n: 3, title: 'CrewAI documentation: crews and flows', domain: 'docs.crewai.com' },
  ],
}

const STACK = [
  { icon: MonitorSmartphone, name: 'React + Vite', role: 'Streams the run as it happens' },
  { icon: Server, name: 'FastAPI', role: 'Agent loop over Server-Sent Events' },
  { icon: Search, name: 'Tavily', role: 'Parallel searches, rate-limited' },
  { icon: Sparkles, name: 'Gemma', role: 'Plans, asks and writes, via the Gemini API' },
  { icon: Plug, name: 'MCP server', role: 'Exposes the search tools' },
  { icon: Database, name: 'Redis', role: 'Keeps paused runs so they can resume' },
]

const SCENES = ['hero', 'parallel', 'ask', 'answer', 'stack', 'cta']
const PINNED = ['parallel', 'ask', 'answer']

export default function Landing({ onLogin }) {
  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [webgl, setWebgl] = useState(() => {
    try {
      const c = document.createElement('canvas')
      return !!(c.getContext('webgl2') || c.getContext('webgl'))
    } catch {
      return false
    }
  })

  // ── Three.js stage + GSAP scroll choreography ─────────────
  useEffect(() => {
    let disposed = false
    let cleanup = () => {}
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const canWebgl = webgl

    Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
      canWebgl ? import('./scene.js') : Promise.resolve(null),
    ]).then(([{ gsap }, { ScrollTrigger }, sceneMod]) => {
      if (disposed) return
      gsap.registerPlugin(ScrollTrigger)
      const root = rootRef.current
      const setWarm = (w) => root.style.setProperty('--warm', w.toFixed(3))

      let scene = null
      if (sceneMod && stageRef.current) {
        try {
          scene = sceneMod.createLandingScene(stageRef.current, { reducedMotion: reduced, onWarm: setWarm })
        } catch {
          setWebgl(false)
        }
      }

      const sections = SCENES.map((name) => root.querySelector(`[data-scene="${name}"]`))
      const isNarrow = () => window.innerWidth / window.innerHeight < 0.85 || window.innerWidth <= 860

      // Scenes that hold still for a beat so their story can play out.
      // Each pinned scene drives its own beats from the pin's progress.
      const chipsEls = gsap.utils.toArray('.qm-chip', root)
      const askCard = root.querySelector('.qm-ask-card')
      const buildPins = () => {
        if (reduced) {
          chipsEls.forEach((c) => c.classList.add('is-done'))
          askCard.classList.add('is-answered')
          return
        }
        const citeTl = gsap
          .timeline({ paused: true })
          .fromTo('.qm-cite, .qm-source', { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, ease: 'back.out(2)', stagger: 0.08 })
        const beats = {
          parallel: (p) => chipsEls.forEach((c, i) => c.classList.toggle('is-done', p > 0.12 + i * 0.16)),
          ask: (p) => askCard.classList.toggle('is-answered', p > 0.4),
          answer: (p) => citeTl.progress(gsap.utils.clamp(0, 1, (p - 0.05) / 0.6)),
        }
        // On narrow screens the cards are taller than a pinned screen allows,
        // so the same beats play across the section's normal scroll instead.
        const narrow = isNarrow()
        for (const name of PINNED) {
          ScrollTrigger.create({
            trigger: `[data-scene="${name}"]`,
            ...(narrow ? { start: 'top 30%', end: 'bottom 85%' } : { start: 'top top', end: '+=55%', pin: true }),
            onUpdate: (st) => beats[name](st.progress),
            onLeave: () => beats[name](1),
            onLeaveBack: () => beats[name](0),
          })
        }
      }
      let pinCtx = gsap.context(buildPins, root)

      // On wide screens, anchor Mote and its copies to the real layout:
      // the copies line up with the search chips, and Mote peeks over each card.
      const resolvePresets = () => {
        const base = scene.presets
        if (isNarrow()) return base
        const vw = window.innerWidth
        const vh = window.innerHeight
        const nx = (px) => px / vw - 0.5
        const ny = (py) => 0.5 - py / vh
        const rel = (el, sec) => {
          const r = el.getBoundingClientRect()
          const t = sec.getBoundingClientRect().top
          return { left: r.left, right: r.right, top: r.top - t, bottom: r.bottom - t, width: r.width, height: r.height }
        }
        const out = { ...base }

        const par = root.querySelector('[data-scene="parallel"]')
        const chips = [...par.querySelectorAll('.qm-chip')].map((c) => rel(c, par))
        const copy = rel(par.querySelector('.qm-copy'), par)
        if (chips.length) {
          const mid = (chips[0].top + chips[chips.length - 1].bottom) / 2
          out.parallel = {
            ...base.parallel,
            x: nx(copy.right + (chips[0].left - copy.right) * 0.38),
            y: ny(mid),
            minis: base.parallel.minis.map((m, i) => {
              const c = chips[i] || chips[chips.length - 1]
              return { x: nx(c.left - 40), y: ny(c.top + c.height / 2 + 4), s: 0.12 }
            }),
          }
        }

        const ask = root.querySelector('[data-scene="ask"]')
        const card = rel(ask.querySelector('.qm-ask-card'), ask)
        out.ask = { ...base.ask, x: nx(card.left + card.width * 0.8), y: ny(card.top - vh * 0.075), s: 0.55 }
        out.ask.minis = out.ask.minis.map(() => ({ x: out.ask.x, y: out.ask.y, s: 0 }))

        const ans = root.querySelector('[data-scene="answer"]')
        const acard = rel(ans.querySelector('.qm-answer-card'), ans)
        out.answer = { ...base.answer, x: nx(acard.right - acard.width * 0.1), y: ny(acard.top - vh * 0.025), s: 0.4 }
        out.answer.minis = out.answer.minis.map(() => ({ x: out.answer.x, y: out.answer.y, s: 0 }))
        return out
      }

      // Mote's journey: each section hands the stage over to the next,
      // finishing as the section reaches the top of the screen.
      const buildStageFor = () => {
        if (!scene) {
          // Without WebGL, still let the light warm up for the answer section.
          sections.forEach((sec, i) => {
            if (i === 0) return
            const warm = [0, 0.15, 0.1, 1, 0.3, 0.45]
            ScrollTrigger.create({
              trigger: sec,
              start: 'top 80%',
              end: 'top top',
              scrub: true,
              onUpdate: (st) => setWarm(warm[i - 1] + (warm[i] - warm[i - 1]) * st.progress),
            })
          })
          return
        }
        const presets = resolvePresets()
        Object.assign(scene.stage, sceneMod.flatten(presets.hero))
        sections.forEach((sec, i) => {
          if (i === 0) return
          const from = sceneMod.flatten(presets[SCENES[i - 1]])
          const to = sceneMod.flatten(presets[SCENES[i]])
          if (reduced) {
            ScrollTrigger.create({
              trigger: sec,
              start: 'top 55%',
              onEnter: () => Object.assign(scene.stage, to),
              onLeaveBack: () => Object.assign(scene.stage, from),
            })
          } else {
            gsap.fromTo(scene.stage, from, {
              ...to,
              ease: 'power2.inOut',
              immediateRender: false,
              scrollTrigger: { trigger: sec, start: 'top 85%', end: 'top top', scrub: 0.9 },
            })
          }
        })
      }
      let stageCtx = gsap.context(buildStageFor, root)

      const buildAnims = () => {
        if (reduced) return

        // Hero copy arrives once; everything else is tied to scroll.
        gsap.from('.qm-hero [data-reveal]', {
          y: 24,
          opacity: 0,
          duration: 1.1,
          ease: 'expo.out',
          stagger: 0.08,
        })

        // Parallel search: chips fan out in sequence (they resolve during the pin).
        const chips = gsap.utils.toArray('.qm-chip')
        gsap.fromTo(
          chips,
          { x: 48, opacity: 0, filter: 'blur(6px)' },
          {
            x: 0,
            opacity: 1,
            filter: 'blur(0px)',
            ease: 'expo.out',
            stagger: 0.12,
            scrollTrigger: { trigger: '[data-scene="parallel"]', start: 'top 55%', end: 'top top', scrub: 0.6 },
          }
        )

        // Clarifying question: the card lands, then an answer is picked.
        gsap.fromTo(
          '.qm-ask-card',
          { y: 60, opacity: 0, rotate: -1.5 },
          {
            y: 0,
            opacity: 1,
            rotate: 0,
            ease: 'expo.out',
            scrollTrigger: { trigger: '[data-scene="ask"]', start: 'top 60%', end: 'top top', scrub: 0.6 },
          }
        )

        // Answer: the card unfolds as the light comes up (citations land during the pin).
        gsap.fromTo(
          '.qm-answer-card',
          { y: 60, opacity: 0, clipPath: 'inset(0 0 100% 0 round 28px)' },
          {
            y: 0,
            opacity: 1,
            clipPath: 'inset(0 0 0% 0 round 28px)',
            ease: 'expo.out',
            scrollTrigger: { trigger: '[data-scene="answer"]', start: 'top 60%', end: 'top top', scrub: 0.6 },
          }
        )

        // Stack: the pipeline draws left to right.
        gsap.fromTo(
          '.qm-stack-step',
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.1,
            ease: 'expo.out',
            scrollTrigger: { trigger: '[data-scene="stack"]', start: 'top 70%', end: 'top 25%', scrub: 0.6 },
          }
        )
        gsap.fromTo(
          '.qm-stack-line',
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: 'none',
            scrollTrigger: { trigger: '[data-scene="stack"]', start: 'top 65%', end: 'top 20%', scrub: 0.6 },
          }
        )
      }
      let ctx = gsap.context(buildAnims, root)

      // Pins and anchored positions depend on layout, so rebuild them after a resize settles.
      let resizeTimer = 0
      const onResize = () => {
        clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => {
          const y = window.scrollY
          ctx.revert()
          stageCtx.revert()
          pinCtx.revert()
          window.scrollTo(0, 0)
          pinCtx = gsap.context(buildPins, root)
          stageCtx = gsap.context(buildStageFor, root)
          ctx = gsap.context(buildAnims, root)
          ScrollTrigger.refresh()
          window.scrollTo(0, y)
        }, 250)
      }
      window.addEventListener('resize', onResize)

      cleanup = () => {
        window.removeEventListener('resize', onResize)
        clearTimeout(resizeTimer)
        ctx.revert()
        stageCtx.revert()
        pinCtx.revert()
        scene?.dispose()
      }
    })

    return () => {
      disposed = true
      cleanup()
    }
    // Runs once: the scene owns its own lifecycle after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const doLogin = async (credential) => {
    setBusy(true)
    setError(null)
    try {
      await onLogin(credential, pending)
    } catch (err) {
      setError(err?.message || 'Sign-in failed. Please try again.')
      setBusy(false)
    }
  }

  const submitQuestion = (e) => {
    e.preventDefault()
    const q = question.trim()
    if (!q) return
    setPending(q)
  }

  const scrollTo = (id) => {
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  return (
    <div className="qm-landing" ref={rootRef}>
      <div className="qm-stage" ref={stageRef} aria-hidden="true">
        {!webgl && <img className="qm-stage-fallback" src="/mote.png" alt="" />}
      </div>
      <div className="qm-warmth" aria-hidden="true" />

      <header className="qm-nav">
        <a href="#top" className="qm-wordmark" aria-label="QueryMind home">
          <MoteGlyph size={30} />
          <span>QueryMind</span>
        </a>
        <nav className="qm-nav-links" aria-label="Primary">
          <a href="#how">How it works</a>
          <a href="#stack">Under the hood</a>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="qm-nav-icon">
            <GithubMark size={18} />
            <span>GitHub</span>
          </a>
          <button type="button" className="qm-btn qm-btn-ghost" onClick={() => scrollTo('start')}>
            Sign in
          </button>
        </nav>
      </header>

      <main>
        {/* ── Hero ── */}
        <section id="top" data-scene="hero" className="qm-section qm-hero">
          <div className="qm-hero-copy">
            <h1 data-reveal>
              Ask the hard question.
              <span>Mote does the reading.</span>
            </h1>
            <p className="qm-lede" data-reveal>
              QueryMind is a research agent. It searches the web in parallel, stops to check with you when your
              question could mean two things, and hands back an answer where every claim links to its source.
            </p>

            {!pending ? (
              <form className="qm-composer" onSubmit={submitQuestion} data-reveal>
                <label htmlFor="qm-question" className="qm-visually-hidden">
                  Your research question
                </label>
                <textarea
                  id="qm-question"
                  rows={2}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) submitQuestion(e)
                  }}
                  placeholder="What do you want to find out?"
                />
                <button type="submit" className="qm-btn qm-btn-primary" disabled={!question.trim()}>
                  Start research
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              </form>
            ) : (
              <div className="qm-handoff" role="group" aria-label="Choose how to continue">
                <p className="qm-handoff-q">
                  <CornerDownLeft size={16} aria-hidden="true" />
                  <span>{pending}</span>
                </p>
                <p className="qm-handoff-hint">Mote is ready. Sign in to save this to your history, or just start.</p>
                <div className="qm-handoff-actions">
                  <GoogleSignIn onCredential={(r) => doLogin(r.credential)} width={260} />
                  <button type="button" className="qm-btn qm-btn-secondary" disabled={busy} onClick={() => doLogin(null)}>
                    Continue without an account
                  </button>
                  <button type="button" className="qm-link" onClick={() => setPending(null)}>
                    Edit question
                  </button>
                </div>
                {error && (
                  <p className="qm-error" role="alert">
                    {error}
                  </p>
                )}
              </div>
            )}

            <button type="button" className="qm-scroll-hint" onClick={() => scrollTo('how')} data-reveal>
              <ArrowDown size={16} aria-hidden="true" />
              Watch a run, step by step
            </button>
          </div>
        </section>

        {/* ── Parallel search ── */}
        <section id="how" data-scene="parallel" className="qm-section qm-split">
          <div className="qm-copy">
            <h2>It splits up to read faster.</h2>
            <p>
              Your question becomes several focused searches that run at the same time, so a broad topic does not
              mean a long wait.
            </p>
            <figure className="qm-example-q">
              <figcaption>Example question</figcaption>
              <blockquote>{EXAMPLE.question}</blockquote>
            </figure>
          </div>
          <ul className="qm-chips" aria-label="Searches running in parallel">
            {EXAMPLE.searches.map((s) => (
              <li className="qm-chip" key={s.q}>
                <Search size={16} aria-hidden="true" />
                <span className="qm-chip-q">{s.q}</span>
                <span className="qm-chip-status">
                  <span className="qm-chip-busy">Searching</span>
                  <span className="qm-chip-done">{s.found} sources</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Human in the loop ── */}
        <section data-scene="ask" className="qm-section qm-split qm-split-reverse">
          <div className="qm-copy">
            <h2>It asks before it guesses.</h2>
            <p>
              When a goal can be read two ways, the agent pauses and asks you. Your answer steers the rest of the run,
              which picks up exactly where it stopped.
            </p>
          </div>
          <div className="qm-ask-card" role="group" aria-label="Example clarifying question">
            <div className="qm-ask-head">
              <MoteGlyph size={36} mood="curious" />
              <span>Quick question before I go on</span>
            </div>
            <p className="qm-ask-q">{EXAMPLE.clarify}</p>
            <div className="qm-ask-options">
              {EXAMPLE.options.map((o, i) => (
                <span key={o} className={`qm-ask-option ${i === EXAMPLE.chosen ? 'is-chosen' : ''}`}>
                  {o}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Cited answer ── */}
        <section data-scene="answer" className="qm-section qm-split">
          <div className="qm-answer-card">
            <p className="qm-answer-label">Answer</p>
            <p className="qm-answer-text">
              For fine control, LangGraph is the stronger fit. It models the agent as an explicit graph, so every step
              and retry is something you define and can inspect
              <sup className="qm-cite">1</sup>. Its checkpointing lets a run stop for human input and resume later
              <sup className="qm-cite">2</sup>. CrewAI gets a role-based team running sooner, but hides more of the
              control flow<sup className="qm-cite">3</sup>.
            </p>
            <ol className="qm-sources">
              {EXAMPLE.sources.map((s) => (
                <li key={s.n} className="qm-source">
                  <span className="qm-source-n">{s.n}</span>
                  <span className="qm-source-title">{s.title}</span>
                  <span className="qm-source-domain">{s.domain}</span>
                </li>
              ))}
            </ol>
            <p className="qm-example-note">Example run, shortened for this page.</p>
          </div>
          <div className="qm-copy">
            <h2>Every claim comes with receipts.</h2>
            <p>
              Answers are written from what the searches actually found. Each claim carries a numbered citation, and
              the sources stay beside the answer so you can check any of them.
            </p>
          </div>
        </section>

        {/* ── Under the hood ── */}
        <section id="stack" data-scene="stack" className="qm-section qm-stack">
          <h2>Built like a real agent, not a demo.</h2>
          <p className="qm-stack-lede">
            A FastAPI agent loop streams every step to the browser. Searches fan out concurrently behind a semaphore,
            and a paused run is saved so it can resume after you answer.
          </p>
          <div className="qm-stack-flow">
            <span className="qm-stack-line" aria-hidden="true" />
            <ol>
              {STACK.map(({ icon: StepIcon, name, role }) => (
                <li className="qm-stack-step" key={name}>
                  <span className="qm-stack-icon">
                    <StepIcon size={20} aria-hidden="true" />
                  </span>
                  <strong>{name}</strong>
                  <span>{role}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Call to action ── */}
        <section id="start" data-scene="cta" className="qm-section qm-cta">
          <h2>Ready when you are.</h2>
          <p>Sign in to keep your research history, or jump straight in without an account.</p>
          <div className="qm-cta-actions">
            <GoogleSignIn onCredential={(r) => doLogin(r.credential)} width={280} />
            <button type="button" className="qm-btn qm-btn-secondary" disabled={busy} onClick={() => doLogin(null)}>
              Continue without an account
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
          {error && !pending && (
            <p className="qm-error" role="alert">
              {error}
            </p>
          )}
        </section>
      </main>

      <footer className="qm-footer">
        <span className="qm-wordmark qm-wordmark-sm">
          <MoteGlyph size={22} />
          QueryMind
        </span>
        <span>Mote is modelled by hand in Three.js.</span>
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
      </footer>
    </div>
  )
}
