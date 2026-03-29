## Inspiration
Unidad was inspired by how difficult it can be for non-native speakers to complete complex forms (immigration, government, licensing, etc.) where a single mistranslation can derail the entire submission. We wanted an assistant that doesn’t just “chat”—it reliably turns raw scraped form fields into an easy-to-fill table in the user’s language, then uses the browser extension to inject and submit the form automatically.

## What it does
Unidad:
- Receives form field data from the Dante browser extension (and the user’s filled answers).
- Uses “Habla” to translate field prompts into the user’s language (and later translate user answers back to English).
- Uses “Linda” to reorder/organize questions so the user can fill them efficiently.
- Renders an inline table in the UNIDAD chat UI where users complete all fields at once.
- Packages the final English answers for injection back into the real form, then submits it via the extension.
- Shows agent-branded loading/processing states (DANTE/HABLA/LINDA) so users understand when each pipeline stage is running.

## How we built it
- **Frontend (UNIDAD chat UI)**: A Next.js `UnidadChat` experience that listens for “form submitted” events, shows agent status bubbles, and renders the fillable inline table.
- **Backend APIs**:
  - `POST /api/form-fields/process`: Stateless ingestion endpoint that runs the translation + reorder pipeline and returns JSON ready for the table.
  - `GET /api/form-submission/activity`: Authenticated fallback polling endpoint for cases where realtime payloads omit fields.
- **Agent pipeline** (LLM sub-agents):
  - **HABLA**: bulk translation (field questions to target language; answers back to English).
  - **LINDA**: strict JSON “sorting node” that reorders translated fields into a form-friendly order.
  - **UNIDAD orchestrator**: coordinates ingestion vs. reversal phases and returns either `formQuestions` for rendering or `injectPayload` for injection.
- **Browser extension (Dante)**:
  - Scans and captures form configuration + field selectors.
  - Sends form fields and answers to the Unidad API.
  - Polls for “fill-ready” payload and injects answers into the real form.

## Challenges we ran into
- **Realtime payload size limits**: the realtime broadcast could omit `formFields` for large pages, which meant the UI sometimes didn’t have enough data to render the table. We fixed this by adding a DB-backed hydration fallback using `activity` polling with a `submissionId`.
- **Keeping the UI in sync with async agent stages**: multiple pipeline steps happen in sequence (DANTE → HABLA → LINDA). We had to ensure the table appears only after the JSON pipeline completes and that agent bubbles show accurate “loading” vs “done” states.
- **Strict JSON handling**: HABLA and LINDA are designed to output machine-consumable JSON only; we added parsing/validation safeguards so the UI doesn’t break on malformed outputs.

## Accomplishments that we're proud of
- A working end-to-end flow: **scan form → translate + reorder → user fills table → translate back → inject + submit**.
- A user-friendly chat experience with clear stage indicators using agent-branded bubbles and loading animations.
- Robustness improvements: when realtime misses or omits data, the UI can still recover and render the correct table using a backend hydration path.

## What we learned
- “Assistants” for form-filling need more than language quality—they need **deterministic data flow** and **UI-state correctness**.
- Splitting responsibilities into small, specialized steps (translation vs. sorting vs. injection) makes the system easier to debug and more reliable.
- For real-time pipelines, building fallback mechanisms (DB hydration + polling) is essential.

## What's next for Unidad
- Improve field-type support (more robust handling of checkbox/radio/select patterns, validations, and edge-case input types).
- Add richer UX:
  - progress indicators tied to pipeline phases,
  - per-row confidence hints,
  - “review before submit” mode.
- Strengthen reliability:
  - better reconciliation when selectors change,
  - retry strategies for agent JSON parsing,
  - more observability around pipeline timings and failures.
- Expand beyond immigration forms into additional form categories and languages with better localization defaults.

