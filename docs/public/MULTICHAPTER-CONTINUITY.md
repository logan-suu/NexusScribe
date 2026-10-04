# Multi-chapter continuation and recovery

## What changes

The next writer context carries a bounded projection of author-selected accepted event memory, alongside the unchanged full manuscript sources. Each projected item keeps its selection kind, fallible assessment and precise source anchor. Schema 3 distinguishes text-only excerpts, explicitly author-attested unverified paraphrases and historical unverified selections; model support is advisory only. See [the current selection boundary](QUOTE-GROUNDED-MEMORY.md). Rejected labels do not enter this auxiliary representation; rejecting a label does **not** delete or negate what the accepted prose says.

Only selections whose original candidate, decision and exact current source still agree can enter the projection. Editing or replacing a source chapter makes its earlier selected events ineligible until newly established. Stored event history and earlier prose versions remain intact. Context diagnostics report exclusions and capacity omissions; missing projected memory never means that an event is false or that nothing important happened. The projection is limited to 100 entries and 16 KiB, separately from the server's unchanged overall request limit.

Source entries distinguish accepted manuscript, planning content and unaccepted manuscript. Chapter order is explicit. Custom-project story time is unspecified rather than the demo's fixed scene time. A fixed continuation instruction distinguishes already-written action from future plans and asks for new consequential action rather than unmarked replay. These changes improve input structure; they do not prove the model will obey it or write better prose.

## Chapter-local work and saved results

Custom-project candidate cards now belong to the selected chapter. The candidate heading and final acceptance confirmation identify that chapter. Other chapters' cards reappear when their chapter is selected; their drafts and history are not deleted.

Current paid extraction and whole-chapter review results remain available in the current window if a storage write fails, as prose generation and isolated audits already did. Export the current content or retry saving locally. Retrying storage does not issue another model request. A browser close before recovery can still lose an unsaved in-memory result; the warning remains visible and browser storage is not an off-device backup. Cancellation and late-response guards remain in force.

## Refreshing an older candidate

A new context format, an earlier-chapter edit or a story-state change invalidates pending candidate authority. It must not silently approve old prose against new evidence, but it should not require buying the same prose again.

The explicit **更新参考上下文** action opens a confirmation explaining that prose will remain unchanged and may now conflict with the current story. Confirmation archives old authority, binds the saved candidate to the current clean sources and invalidates extraction, review and memory choices. The author must then request fresh extraction and review and choose memories again. Refreshing itself makes no model call. It never applies automatically on load, import or navigation, and cannot turn an accepted or rejected candidate back into an active one.

## Evidence and limits

- Regression coverage uses synthetic providers and retained fictional prose; it tests routing, provenance, stale-state rejection, cancellation, recovery and import, not model correctness
- The [retained prose close reading](../../eval/RETAINED-PROSE-CLOSE-READING.md) is non-blind and finds concrete replay, copy-editing and length problems; it does not establish an architecture winner
- The separately bounded [multi-chapter protocol](../../eval/MULTICHAPTER-PROTOCOL.md) must be read with its recorded result. Passing software tests or finishing provider calls is not a literary-quality pass
- Complete recall, event deduplication, automatic repair of downstream chapters, general semantic accuracy and long-novel scalability remain unproven
- Existing storage, server lifetime-call limits, per-request output bounds and explicit author acceptance remain unchanged

## First real run and warning maintenance

The [recorded live result](../../eval/MULTICHAPTER-RESULTS.md) failed the three-chapter criterion after eight calls and retained a chapter-1 false positive. Current support labels explicitly say they are model judgments that may be wrong, and describe the observed missing-detail failure. The mobile backup export control remains visible on narrow screens after hosted CI exposed its earlier absence. These engineering fixes do not repair general semantic support reliability. The next safety boundary should use deterministic quote-derived memory and explicit author attestation for paraphrases, rather than treating another model-positive result as verified evidence.
