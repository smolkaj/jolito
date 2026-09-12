import { useCallback, useEffect, useRef, useState } from 'react'
import familyLogoUrl from '../../../assets/jolito-family.webp'
import logoUrl from '../../../assets/jolito-welcome.webp'
import sampleAguacateUrl from '../../../assets/sample-aguacate.webp'
import type { AuthUser } from '../../application/ports'
import { starterHeroSampleCards } from '../../application/starter-cards'
import type { SyncStatus } from '../../domain/sync'
import { isWhyJolitoHash } from '../../navigation'
import { AppFooter } from '../AppFooter'
import { Brand } from '../Brand'
import { ConnectionPill } from '../ConnectionPill'
import { EnglishBadge, MexicoFlag } from '../icons'
import { PracticeMenu } from '../PracticeMenu'
import { RedirectAuthNotice } from '../RedirectAuthNotice'

export interface WelcomeViewProps {
  authUser: AuthUser | null
  syncStatus: SyncStatus
  isOnline: boolean
  saveError: string | null
  accountNotice: string | null
  redirectAuthBanner: string | null
  onDismissAccountNotice: () => void
  onDismissRedirectBanner: () => void
  onCopySessionLink?: (() => Promise<boolean> | boolean) | undefined
  onNavigateToDeck: () => void
  onNavigateToCreate: () => void
  onNavigateToGrammar: () => void
  onPractice: () => void
  onOpenSync: () => void
  onOpenFeedback: () => void
  onPlayAudio: (
    text: string,
    locale: 'es-MX' | 'en-US',
    cardSeed?: string,
  ) => void
  welcomeRef?: React.RefObject<HTMLElement | null> | undefined
}

export function WelcomeView({
  authUser,
  syncStatus,
  isOnline,
  saveError,
  accountNotice,
  redirectAuthBanner,
  onDismissAccountNotice,
  onDismissRedirectBanner,
  onCopySessionLink,
  onNavigateToDeck,
  onNavigateToCreate,
  onNavigateToGrammar,
  onPractice,
  onOpenSync,
  onOpenFeedback,
  onPlayAudio,
  welcomeRef,
}: WelcomeViewProps) {
  const localRef = useRef<HTMLElement>(null)
  const mainRef = welcomeRef ?? localRef
  const [activeSampleSide, setActiveSampleSide] = useState<
    'spanish' | 'english'
  >('spanish')
  const [samplePlaying, setSamplePlaying] = useState(false)
  const sampleTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (sampleTimerRef.current !== null) {
        window.clearTimeout(sampleTimerRef.current)
      }
    }
  }, [])

  const playSampleAudio = useCallback(
    (side: 'spanish' | 'english') => {
      if (sampleTimerRef.current !== null) {
        window.clearTimeout(sampleTimerRef.current)
      }
      setSamplePlaying(true)
      const sample = starterHeroSampleCards[side]
      onPlayAudio(sample.text, sample.locale, sample.cardSeed)
      sampleTimerRef.current = window.setTimeout(() => {
        setSamplePlaying(false)
        sampleTimerRef.current = null
      }, 1200)
    },
    [onPlayAudio],
  )

  const onSampleCardClick = useCallback(
    (side: 'spanish' | 'english') => {
      if (activeSampleSide !== side) {
        setActiveSampleSide(side)
      }
      playSampleAudio(side)
    },
    [activeSampleSide, playSampleAudio],
  )

  return (
    <main ref={mainRef} className="welcome-page" tabIndex={0}>
      <div className="welcome-panel welcome-intro">
        <nav className="topbar" aria-label="Main navigation">
          <Brand />
          <div className="nav-actions" data-nosnippet>
            <button className="text-button" onClick={onNavigateToDeck}>
              Manage deck
            </button>
            <ConnectionPill
              authUser={authUser}
              syncStatus={syncStatus}
              isOnline={isOnline}
              onClick={onOpenSync}
            />
          </div>
        </nav>
        {saveError && (
          <p className="storage-save-error" role="alert">
            {saveError}
          </p>
        )}
        <RedirectAuthNotice
          message={accountNotice ?? redirectAuthBanner}
          onDismiss={() => {
            onDismissAccountNotice()
            onDismissRedirectBanner()
          }}
          onCopySessionLink={onCopySessionLink}
        />
        <section className="welcome-hero">
          <div className="welcome-hero-main">
            <div className="hero-copy">
              <img
                src={logoUrl}
                alt=""
                aria-hidden="true"
                className="welcome-mascot-img"
              />
              <h1>
                Make the words <br />
                you meet <em>stick.</em>
              </h1>
              <p className="lede">
                Create beautiful, spoken flashcards.
                <br />
                Practice them at your rhythm.
              </p>
              <div className="hero-actions" data-nosnippet>
                <button className="primary-button" onClick={onNavigateToCreate}>
                  Create a card <span aria-hidden="true">→</span>
                </button>
                <PracticeMenu
                  onCards={onPractice}
                  onGrammar={onNavigateToGrammar}
                />
              </div>
            </div>
            <div className="hero-visual" data-nosnippet>
              {/* English Card (concise meaning) */}
              <button
                type="button"
                className={`sample-card sample-card-en ${activeSampleSide === 'english' ? 'is-foreground' : 'is-background'} ${samplePlaying && activeSampleSide === 'english' ? 'is-playing' : ''}`}
                onClick={() => onSampleCardClick('english')}
                aria-label={
                  activeSampleSide === 'english'
                    ? `Play pronunciation for English card: ${starterHeroSampleCards.english.text}`
                    : `Show English card: ${starterHeroSampleCards.english.text}`
                }
              >
                <div className="sample-card-header">
                  <span className="sample-badge">
                    <EnglishBadge /> ENGLISH
                  </span>
                  <span className="sample-listen-hint" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M5 9v6h4l5 4V5L9 9H5Zm11.5-.5a5 5 0 0 1 0 7M18.8 6a8.2 8.2 0 0 1 0 12" />
                    </svg>
                  </span>
                </div>
                <div className="sample-card-body">
                  <div className="sample-illustration" aria-hidden="true">
                    <img
                      src={sampleAguacateUrl}
                      alt=""
                      className="sample-art-image"
                    />
                  </div>
                  <p className="sample-phrase">
                    {starterHeroSampleCards.english.text}
                  </p>
                </div>
              </button>
              {/* Mexican Spanish Card */}
              <button
                type="button"
                className={`sample-card sample-card-es ${activeSampleSide === 'spanish' ? 'is-foreground' : 'is-background'} ${samplePlaying && activeSampleSide === 'spanish' ? 'is-playing' : ''}`}
                onClick={() => onSampleCardClick('spanish')}
                aria-label={
                  activeSampleSide === 'spanish'
                    ? `Play pronunciation for Mexican Spanish card: ${starterHeroSampleCards.spanish.text}`
                    : `Show Mexican Spanish card: ${starterHeroSampleCards.spanish.text}`
                }
              >
                <div className="sample-card-header">
                  <span className="sample-badge">
                    <MexicoFlag /> MEXICAN SPANISH
                  </span>
                  <span className="sample-listen-hint" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M5 9v6h4l5 4V5L9 9H5Zm11.5-.5a5 5 0 0 1 0 7M18.8 6a8.2 8.2 0 0 1 0 12" />
                    </svg>
                  </span>
                </div>
                <div className="sample-card-body">
                  <div className="sample-illustration" aria-hidden="true">
                    <img
                      src={sampleAguacateUrl}
                      alt=""
                      className="sample-art-image"
                    />
                  </div>
                  <p className="sample-phrase">
                    {starterHeroSampleCards.spanish.text}
                  </p>
                </div>
              </button>
            </div>
          </div>
          <div className="welcome-hero-footer">
            <div className="welcome-hero-footer-spacer" aria-hidden="true" />
            <a
              href="#why-jolito"
              className="hero-scroll-cue"
              onClick={(e) => {
                e.preventDefault()
                if (window.location.hash !== '#why-jolito') {
                  window.history.pushState(
                    { view: 'welcome' },
                    '',
                    '#why-jolito',
                  )
                }
                document.getElementById('why-jolito')?.scrollIntoView()
              }}
              aria-label="Scroll down to explore Why Jolito"
            >
              <span className="scroll-cue-text">Why Jolito?</span>
              <span className="scroll-cue-arrow" aria-hidden="true">
                ↓
              </span>
            </a>
            <AppFooter onOpenFeedback={onOpenFeedback} showPrivacy={false} />
          </div>
        </section>
      </div>
      <section
        className="welcome-panel welcome-why"
        id="why-jolito"
        aria-labelledby="why-jolito-title"
      >
        <div className="why-inner">
          <div className="why-family-hero">
            <img
              src={familyLogoUrl}
              alt="The Jolito family: German dad, Mexican mom, and twin Gexican toddlers"
              className="why-family-img"
              loading="lazy"
              decoding="async"
            />
          </div>

          <div className="why-header">
            <p className="eyebrow why-eyebrow">BORN IN MEXICO CITY</p>
            <h2 id="why-jolito-title">Why another flashcard app?</h2>
          </div>

          <div className="why-story">
            <p>
              In July 2026, my wife <em>(Mexican)</em>, our twins{' '}
              <em>(Gexican)</em>, and I <em>(German)</em> moved to Mexico City.
              I started learning Spanish at the{' '}
              <a
                href="https://ihmexico.mx/"
                target="_blank"
                rel="noopener noreferrer"
              >
                International House in Condesa
              </a>
              . The classes were fantastic—but memorizing vocabulary?{' '}
              <strong>My archenemy.</strong> The absolute worst part of learning
              a new language!
            </p>
            <p>
              I built Jolito to make memorization something to look forward to:{' '}
              <strong>fast, tactile, immersive</strong>. Jolito uses{' '}
              <a
                href="https://en.wikipedia.org/wiki/Spaced_repetition"
                target="_blank"
                rel="noopener noreferrer"
              >
                spaced repetition
              </a>{' '}
              to game your memory—<strong>legally!</strong> It resurfaces words
              just before you forget them, so they stick almost effortlessly.
            </p>
            <p className="why-resolution">
              I am glad to report:{' '}
              <strong>Memorization and I have become friends!</strong>
            </p>
          </div>

          <div className="why-actions">
            <button
              type="button"
              className="primary-button why-start-button"
              onClick={() => {
                if (isWhyJolitoHash(window.location.hash)) {
                  window.history.pushState({ view: 'welcome' }, '', '#/')
                }
                mainRef.current?.scrollTo({ top: 0 })
              }}
            >
              Start learning <span aria-hidden="true">↑</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
