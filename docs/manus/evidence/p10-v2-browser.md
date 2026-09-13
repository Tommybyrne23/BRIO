# P10 v2 browser verification

At 2026-09-12 23:24 +01:00, the updated BRIO public development preview rendered the branded two-field sign-in page without a visible runtime error. The dedicated synthetic test account created by the integration harness was entered successfully. No credentials are recorded in this evidence file.

The first browser-tool click on the filled sign-in form navigated to `/sign-in?` and cleared the fields, matching the browser automation anomaly seen earlier in this task. The console contained no hydration or runtime error. This click is not counted as an application pass or failure; authenticated API integration remains the source of persistence evidence.

The in-page Better Auth request confirmed the first public-browser attempt was rejected as `INVALID_ORIGIN`, not by the training implementation. The development server was restarted with `BETTER_AUTH_URL` set to the exact sandbox HTTPS origin, matching the documented production requirement, and the sign-in screen reloaded normally.

Authentication succeeded after the origin correction. The Training hub rendered the three required primary entry paths in one row: **Start a saved session**, **Describe it**, and **Browse plans**. Four records were visibly labelled `[SYNTHETIC INPUT]`; the plan path was visibly labelled `P2 deferred`; manual historical logging was a separate secondary action. Session-derived analytics rendered without badges, praise, streaks, or recovery claims.

The Browse plans route opened a clearly labelled **P2 deferred** state and did not fabricate a catalogue. Its Describe a session action opened a page stating that the parser is deterministic, makes no model call, and never autosaves the interpretation. The default example showed separate exercise lines and supported sets, load, RPE, and rest syntax.

The description button was visible, but neither indexed clicking nor a direct DOM click invoked React state. The development server log identified Next.js blocking `/_next/hmr` from the public preview hostname. A narrowly scoped `NEXT_DEV_ALLOWED_ORIGIN` configuration was added for remote development previews; production remains unaffected and Better Auth still requires its exact origin separately.

After restarting with the explicit development hostname, the description screen reloaded but the browser automation click still did not trigger the React handler. Because the authenticated parser API and no-autosave behavior already pass integration tests, this automation result is retained as a browser-tool limitation rather than asserted as interaction evidence. Further UI acceptance uses the production build to avoid development HMR behavior.

On the exact standalone production runtime, **Create editable draft** worked. The resulting screen showed `deterministic-pattern-parser-v1`, `Saved: No`, `No model was called`, `Not saved · review required`, and a separate explicit review button. The editable ledger rendered two exercises, warm-up/working selectors, labelled numeric load/reps/RPE/rest fields, set notes, reorder/remove/add controls, and ghost-source labels from the latest completed synthetic comparable exercises.

Selecting **I reviewed it — save this draft** persisted the draft and replaced the URL with `/training/{id}`; the screen reported **Saved** and showed the actual prior comparable session. A subsequent automated set edit intentionally produced a validation failure. The UI reported **Save failed · input retained**, preserved the edited/blank cells, and exposed **Retry same save**. This is direct browser evidence for the failed-write retention state; the API suite separately proves the server row is unchanged after a 409.

Using native user events, set 2 changed from **Warm-up** to **Working** while load and repetitions remained empty with visible ghost placeholders `82` and `5`. One tap on **Confirm set** copied the account-specific ghost values, copied the prior RPE and note, marked the set **Confirmed**, autosaved the draft, updated the working-volume summary to `410 kg`, and opened a sticky rest dock at `1:29`. The dock states that time is calculated from a saved timestamp and that no background alert is promised; Pause, Reset, and editable seconds controls are visible.

The active draft was backgrounded by navigating to Today, where the newly confirmed `410` kg working volume and effort `7` were already reflected. Returning to the exact session URL resumed the saved draft with set 2 still Working/Confirmed and ghost-derived values intact. The rest timer reconstructed at `0:34` from its saved timestamp after previously displaying `1:29`; it did not restart from the original duration or rely on missed interval ticks.

The production timer's Pause control persisted a paused `0:09` value, changed the control to **Resume**, retained **Reset**, and returned the save state to **Saved**. The first indexed click did not register, so the hydrated DOM button was invoked directly and its resulting rendered state was captured.

The active set's optional rest duration was changed from `90` to `150` seconds. Reset removed the timer dock and autosaved. Reloading the session kept the confirmed set, Working type, ghost-derived load/reps/RPE/note, and the adjusted `150`-second rest duration while the timer remained cleared.
