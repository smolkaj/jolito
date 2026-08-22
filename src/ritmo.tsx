import { FormEvent, useEffect, useRef, useState } from 'react'
import { createCards } from './application/create-cards'
import type { AppServices } from './application/ports'
import { starterCards } from './application/starter-cards'
import type { Card } from './domain/card'
import { compareAnswer } from './domain/answer'

type Grade = 'Again' | 'Hard' | 'Good' | 'Easy'

function Diff({ typed, expected }: { typed: string; expected: string }) {
  const comparison = compareAnswer(typed, expected)

  return (
    <p className="answer-diff" aria-label="Answer comparison">
      {comparison.expected.map((token, index) => (
        <span className={token.status} key={`${token.value}-${index}`}>
          {token.value}{' '}
        </span>
      ))}
      {comparison.extra.map((token, index) => (
        <span className="extra" key={`${token}-${index}`}>
          {token}{' '}
        </span>
      ))}
    </p>
  )
}

export function App({ services }: { services: AppServices }) {
  const [cards, setCards] = useState<Card[]>(() => [
    ...(services.cards.load() ?? starterCards),
  ])
  const [view, setView] = useState<'welcome' | 'create' | 'review'>('welcome')
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const reviewCards = cards.length > 0 ? cards : starterCards
  const card = reviewCards[index % reviewCards.length]!

  useEffect(() => {
    services.cards.save(cards)
  }, [cards, services.cards])
  useEffect(() => {
    if (view !== 'review') return
    input.current?.focus()
    services.speaker.speak(
      card.prompt,
      card.direction === 'es-en' ? 'es-MX' : 'en-US',
    )
  }, [view, card, services.speaker])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (view !== 'review') return
      if (event.code === 'Space' && document.activeElement !== input.current) {
        event.preventDefault()
        services.speaker.speak(
          card.prompt,
          card.direction === 'es-en' ? 'es-MX' : 'en-US',
        )
      }
      const grades: Grade[] = ['Again', 'Hard', 'Good', 'Easy']
      const gradeForKey = grades[Number(event.key) - 1]
      if (revealed && gradeForKey) grade(gradeForKey)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function reveal(event?: FormEvent) {
    event?.preventDefault()
    if (!revealed) {
      setRevealed(true)
      services.speaker.speak(
        card.answer,
        card.direction === 'es-en' ? 'en-US' : 'es-MX',
      )
    }
  }
  function grade(grade: Grade) {
    void grade
    setIndex((current) => (current + 1) % reviewCards.length)
    setAnswer('')
    setRevealed(false)
  }
  function createCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const field = (name: string): string => {
      const value = form.get(name)
      return typeof value === 'string' ? value.trim() : ''
    }
    const spanish = field('spanish')
    const english = field('english')
    const bidirectional = form.get('bidirectional') === 'on'
    if (!spanish || !english) return
    const next = createCards(
      { spanish, english, bidirectional },
      { clock: services.clock, ids: services.ids },
    )
    if (next.length === 0) return
    setCards((old) => [...next, ...old])
    setIndex(0)
    setView('review')
    setAnswer('')
    setRevealed(false)
  }

  if (view === 'welcome')
    return (
      <main className="welcome shell">
        <nav>
          <div className="brand">
            <i>R</i> Ritmo
          </div>
          <button className="quiet" onClick={() => setView('review')}>
            Review
          </button>
        </nav>
        <section className="hero">
          <p className="eyebrow">YOUR SPANISH, IN RHYTHM</p>
          <h1>
            Make the words
            <br />
            you meet <em>stick.</em>
          </h1>
          <p className="lede">
            Beautiful, spoken flash cards for the Spanish you actually want to
            use.
          </p>
          <button className="primary" onClick={() => setView('create')}>
            Create your first card <span>→</span>
          </button>
          <p className="hint">
            Your cards stay available, even when you’re offline.
          </p>
        </section>
        <div className="hero-art" aria-hidden="true">
          <div className="sun" />
          <div className="arch">
            <span>¡Hola!</span>
          </div>
          <div className="plant">
            <b />
            <b />
            <b />
          </div>
        </div>
      </main>
    )

  if (view === 'create')
    return (
      <main className="shell create-page">
        <nav>
          <button className="brand back" onClick={() => setView('welcome')}>
            <i>R</i> Ritmo
          </button>
          <button className="quiet" onClick={() => setView('review')}>
            Review
          </button>
        </nav>
        <section className="create-card">
          <p className="eyebrow">NEW CARD</p>
          <h1>What do you want to remember?</h1>
          <p>Make it yours. Ritmo will take care of the rest.</p>
          <form onSubmit={createCard}>
            <label>
              Spanish <span>Mexican Spanish</span>
              <input
                autoFocus
                name="spanish"
                defaultValue="¿Me lo puede poner para llevar?"
              />
            </label>
            <label>
              English <span>Suggested</span>
              <input name="english" defaultValue="Could you make it to go?" />
            </label>
            <label className="check">
              <input name="bidirectional" type="checkbox" defaultChecked />
              <span>Make a reverse card too</span>
              <small>English → Spanish</small>
            </label>
            <details>
              <summary>
                Context <small>Optional</small>
              </summary>
              <p>
                A polite way to ask for food or drinks to take away in Mexico.
                Literally: “Can you put it for me to take?”
              </p>
            </details>
            <button className="primary" type="submit">
              Save both cards <span>→</span>
            </button>
          </form>
        </section>
      </main>
    )

  return (
    <main className="shell review-page">
      <nav>
        <button className="brand back" onClick={() => setView('welcome')}>
          <i>R</i> Ritmo
        </button>
        <p className="progress">
          {Math.min(index + 1, reviewCards.length)}{' '}
          <span>/ {reviewCards.length}</span>
        </p>
        <button className="quiet" onClick={() => setView('create')}>
          + New card
        </button>
      </nav>
      <section className="study">
        <div className="visual">
          <div className="takeaway">
            <div className="bag" />
            <div className="cup" />
            <div className="steam">⌇⌇</div>
          </div>
        </div>
        <div className="prompt-row">
          <p className="eyebrow">
            {card.direction === 'es-en'
              ? 'SPANISH → ENGLISH'
              : 'ENGLISH → SPANISH'}
          </p>
          <button
            className="audio"
            aria-label="Play prompt audio"
            title="Play prompt audio"
            onClick={() =>
              services.speaker.speak(
                card.prompt,
                card.direction === 'es-en' ? 'es-MX' : 'en-US',
              )
            }
          >
            ⌁
          </button>
        </div>
        <h1 className="prompt">{card.prompt}</h1>
        <form onSubmit={reveal}>
          <input
            ref={input}
            className="response"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer…"
            disabled={revealed}
          />
          <button className="submit" type="submit">
            {revealed ? 'Answer revealed' : 'Reveal answer ↵'}
          </button>
        </form>
        {revealed && (
          <div className="reveal">
            <div className="reveal-heading">
              <p>Expected answer</p>
              <button
                className="audio"
                aria-label="Play answer audio"
                onClick={() =>
                  services.speaker.speak(
                    card.answer,
                    card.direction === 'es-en' ? 'en-US' : 'es-MX',
                  )
                }
              >
                ⌁
              </button>
            </div>
            <Diff typed={answer} expected={card.answer} />
            <p className="context">
              A polite way to ask for something to take away in Mexico.
            </p>
            <div className="grades">
              {(['Again', 'Hard', 'Good', 'Easy'] as Grade[]).map((item, i) => (
                <button
                  className={item.toLowerCase()}
                  onClick={() => grade(item)}
                  key={item}
                >
                  <kbd>{i + 1}</kbd>
                  {item}
                  <small>{['< 1 min', '2 days', '5 days', '10 days'][i]}</small>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
