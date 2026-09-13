# P05 signup browser anomaly

The first automated browser click after `browser_fill_form` navigated to `/sign-up?` and cleared the fields rather than invoking the React submission handler. No browser console error was present. This may be a cloud-browser event-simulation issue or an application hydration/form behavior issue; it is not treated as passed. The API signup path was already verified independently in P01/P03. The form will be retested using explicit input events/keyboard submission and local HTTP evidence before P05 completion.
