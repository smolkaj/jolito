export const legalUpdated = 'September 8, 2026'

export function LegalContent({
  onOpenFeedback,
}: {
  onOpenFeedback?: (() => void) | undefined
}) {
  return (
    <>
      <p>
        Your words are yours. No ads, no marketing trackers, no selling your
        data.
      </p>
      <p>
        <small>
          Updated {legalUpdated}. Privacy notice / Aviso de privacidad.
        </small>
      </p>
      <section className="privacy-section">
        <h3>1. The demo vs. your account</h3>
        <p>
          Try the sample cards without signing up. Creating a personal deck uses
          an email account. Cards and progress stay on your device for offline
          practice and sync when you connect. A card waiting for sign-in is also
          kept on this browser until saved or removed.
        </p>
        <p>
          Browser storage keeps your cards, sign-in session and downloaded
          pronunciation audio. Clearing site data removes those local copies.
          Signing out removes the local deck; downloaded audio may remain on the
          device.
        </p>
      </section>
      <section className="privacy-section">
        <h3>2. What we collect</h3>
        <p>
          <strong>Your account:</strong> your email, cards and review progress
          let us sign you in and sync your deck using Supabase. Your email is
          also used to identify your account and answer support requests, never
          for unsolicited marketing.
        </p>
        <p>
          <strong>Pronunciation:</strong> words played or prepared for playback
          go through Cloudflare to Microsoft’s online speech service. Audio is
          downloaded to your browser for later offline use. Device voices may be
          used when online speech is unavailable. Avoid putting sensitive
          personal information in practice cards.
        </p>
        <p>
          <strong>Feedback:</strong> your message, account email if signed in,
          and basic app/browser details help us understand problems. Feedback is
          stored in Supabase and a notification is sent to our support inbox
          through our email provider. We do not attach your deck or sign-in
          links.
        </p>
        <p>
          <strong>Service operation:</strong> Cloudflare hosts Jolito. Hosting,
          authentication and email providers process technical information such
          as IP addresses and service logs to deliver and secure the service.
          Processing may take place outside Mexico. Our cloud storage uses
          access controls; it is not end-to-end encrypted.
        </p>
      </section>
      <section className="privacy-section">
        <h3>3. Data export &amp; account deletion</h3>
        <p>
          Export your deck under{' '}
          <strong>Manage deck → Backup &amp; export</strong>. Choose{' '}
          <strong>Cloud sync → Delete cloud account &amp; data</strong> to
          remove your account, cloud deck and account-linked feedback from the
          active database.
        </p>
        <p>
          We keep account data while your account is open. Feedback is kept
          while needed for support; we review it for deletion regularly. Support
          emails and provider security logs have separate retention and are not
          erased by the account button. Ask us to remove support correspondence
          too. Recovery backups expire separately; deleted data must be removed
          again before a restored backup is put back into service. Offline
          copies on other devices and files you exported remain under your
          control.
        </p>
        <p>
          You can request access, correction, cancellation or objection (your
          ARCO rights), limit use or disclosure, or withdraw consent by emailing{' '}
          <a href="mailto:a@joli.to">a@joli.to</a>. Tell us which account and
          what you would like changed. We verify ownership using your account
          email and request only the information needed to handle your request.
          We respond within the applicable legal deadlines; necessary account
          processing is required to provide sync.
        </p>
      </section>
      <section className="privacy-section">
        <h3>4. Open source &amp; contact</h3>
        <p>
          Jolito is operated by <a href="https://smolka.st">Steffen Smolka</a>{' '}
          in Mexico City, Mexico. Contact us by email,{' '}
          <a
            href="/#/feedback"
            onClick={
              onOpenFeedback
                ? (event) => {
                    event.preventDefault()
                    onOpenFeedback()
                  }
                : undefined
            }
          >
            directly in the app
          </a>
          , or <a href="https://github.com/smolkaj/jolito/issues">on GitHub</a>.
          Please email private account details rather than posting them
          publicly.
        </p>
        <p>
          We publish changes here with an updated date. If a change requires
          fresh consent, we ask before applying it.
        </p>
      </section>
      <details className="privacy-section" id="terms">
        <summary>Using Jolito</summary>
        <p>
          Jolito is a free language-practice project. Your cards belong to you;
          you give us permission to store, sync and pronounce them to provide
          the app. Only import material you have permission to use. The app’s
          open-source license does not change the rights in your content.
        </p>
        <p>
          Be kind: no harassment, unlawful content, spam or attempts to disrupt
          the service. We may limit abusive use. If your local law requires a
          parent or guardian to agree to your use, involve them before creating
          an account.
        </p>
        <p>
          Translations and pronunciation can be imperfect. Jolito is a learning
          aid, and availability can change. Keep a deck export for safekeeping.
          You can stop using Jolito and delete your account at any time. Nothing
          here removes rights that applicable law gives you.
        </p>
      </details>
      <details className="privacy-section" id="credits">
        <summary>Made with a little help</summary>
        <p>
          Jolito’s code is{' '}
          <a href="https://github.com/smolkaj/jolito/blob/main/LICENSE">
            Apache-2.0
          </a>
          . Our dictionary adapts definitions and word forms from{' '}
          <a href="https://en.wiktionary.org">
            English Wiktionary contributors
          </a>
          , extracted by <a href="https://kaikki.org">Kaikki / Wiktextract</a>.
          Look up an entry on Wiktionary for its contributors and history.
        </p>
        <p>
          Word frequency information comes from{' '}
          <a href="https://github.com/hermitdave/FrequencyWords">
            Hermit Dave’s FrequencyWords
          </a>
          , using OpenSubtitles data. These dictionary adaptations are shared
          under{' '}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/">
            CC BY-SA 4.0
          </a>
          : attribution and the same license apply when sharing adaptations. We
          filter, shorten and combine definitions and compact word forms. See{' '}
          <a href="/dict/NOTICE.txt">dictionary credits and source details</a>.{' '}
          Individual <a href="/dict/sources.html">entry source pages</a> are
          listed too.
        </p>
        <p>
          The{' '}
          <a href="https://github.com/ateliertriay/bricolage">
            Bricolage Grotesque
          </a>{' '}
          font is by Mathieu Triay and contributors, under the{' '}
          <a href="/fonts/OFL.txt">SIL Open Font License 1.1</a>. Thank you to
          the open-source projects that make Jolito possible.
        </p>
      </details>
    </>
  )
}
