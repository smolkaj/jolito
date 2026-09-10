# Practice coherence audit

Grammar and vocabulary should differ in what the learner recalls, not in how a
practice session behaves. This audit compares setup, typed recall, exact/incorrect/
empty answers, references, grading, interruption/resume, completion, and the next
round at 320, 393, 768, 1024, and 1280px.

## Findings and architectural changes

| Surface                            | Inconsistency found                                                                                                                                                                                                 | Shared owner after the audit                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Completion                         | Grammar used a plain, narrow heading and stacked actions; vocabulary used the mascot card, completion hierarchy, and primary/secondary buttons. Grammar also sent learners home instead of offering the next round. | `SessionComplete` owns the mascot, heading, summary, action layout and focus. Both offer the next batch when available and a stable Back home action.  |
| Page structure                     | Grammar returned through a separate page shell, omitting the redirect-auth notice, completion footer and feedback modal wiring.                                                                                     | One practice rendering branch in `App` owns navigation, notices, progress, footer and dialogs. Mode-specific navigation actions remain content inputs. |
| Recall and feedback                | Separate forms used Check versus Reveal answer. Feedback wrappers, focus behavior and audio-unavailable copy differed despite sharing the diff/rating leaves.                                                       | `PracticeCard` owns the form, reveal action, feedback panel, focus, audio notice, ratings and shortcut hints.                                          |
| Keyboard                           | Grammar protected native disclosure/button activation and modifier/repeat/composition input; vocabulary had a separate shortcut listener.                                                                           | `PracticeCard` owns one stable shortcut subscription with pause/resume and teardown. Edit and prompt replay are explicit optional capabilities.        |
| Speech interruption                | Grammar stopped playback on dialogs and exit; the shared audio hook only cancelled a pending reveal timer.                                                                                                          | `useStudyAudio` owns pause, transition and unmount cancellation, including active speech. Grammar-specific cleanup effects are removed.                |
| Completion motion                  | Vocabulary's mascot bobbed indefinitely; grammar had no completion mascot.                                                                                                                                          | One finite entrance animation in the shared completion styling, with reduced-motion support and no ongoing animation after settling.                   |
| Progress, diff and rating controls | Earlier polish shared these leaves but did not enforce the surrounding experience.                                                                                                                                  | `SessionProgress`, `AnswerComparison` and `ReviewGrades` remain shared, composed through one page/card path.                                           |

The architecture uses content slots and explicit capabilities rather than a second
set of grammar controls. Grammar supplies its sentence, translation, accent entry
and conjugation reference. Vocabulary supplies its prompt/direction, optional context
and edit/delete actions. Scheduling and persistence remain in the existing session
hooks; presentation does not choose cards, save grades, or start its own audio engine.

## Intentional differences

- Grammar setup chooses patterns and explains the pretérito; vocabulary starts from
  the learner's deck. Their content-management tasks are different.
- A grammar prompt is an incomplete sentence. Playing its completed sentence before
  reveal would give away the answer, so only vocabulary has prompt replay.
- Grammar requires Spanish accent entry and conjugation references. Vocabulary keeps
  its authored context and card editing. Both use the same reveal and rating workflow.
- Summaries say forms or cards. Guest vocabulary is a demo; grammar progress can be
  practiced locally and synced after sign-in, so its account copy describes progress.
- Home button grouping is outside this audit's implementation and remains deferred
  for the separate discussion requested by the user.

## Escape analysis and prevention

The grammar inconsistencies originated in unmerged PR #275. Earlier reviews and
checks compared isolated screens or leaf controls. Completion and native interaction
behavior lived in independent implementations, allowing them to drift while unit,
accessibility and viewport-fit checks all passed.

The existing vocabulary audio hook was extracted in PR #216 with timer cancellation
but no active-speech/dialog lifecycle. Grammar subsequently supplied its own cleanup,
creating inconsistent interruption behavior. The indefinite completion bob originated
in PR #68. Both predated this grammar PR; this audit closes the inconsistency at their
shared owners.

Browser contracts compare progress/input/rating geometry and completion position,
framing, typography and action styles across both modes at five widths. They audit
accessibility, inspect settled screenshots and assert that completion has no running
animations. The new completion comparison failed against the previous grammar page.

Shared interaction tests exercise typing, native button activation, explicit replay,
modifier/repeat/composition handling, pause → resume with updated callbacks, and
teardown immobility. The audio lifecycle contract failed before shared pause handling,
then covers active speech → interruption → resumed playback → navigation → teardown.
Grammar integration also preserves completion through account/visibility interruptions
and starts the next round with a fresh answer and progress bar. Existing real-cache
neural/offline, accent touch, reference keyboard and background-sync contracts remain.

Future practice modes should compose `PracticeCard` and `SessionComplete` and use the
common page branch. Mode CSS should style learning content, not override shared form,
feedback, grading, completion or navigation geometry. Extend the comparative state
contracts when adding a shared state or capability.
