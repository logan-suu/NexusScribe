# Prose-first architecture pilot: stopped after six requests

## Outcome

[Actions run 37096346301](https://github.com/logan-suu/NexusScribe/actions/runs/37096346301), source `77def9cb3a49cd6285e1dac116dace3ffea7f9b3`, ran the frozen [prose-pipeline-v1 protocol](PROSE-PIPELINE-PROTOCOL.md) once. It stopped on the first error, after **6 of at most 9 requests**, with **5 successful stages and 1 complete pair out of 3 planned**. No retries, replacement samples, additional model, top-up, or paid judge were used.

- Mystery: legacy structured generation succeeded; prose-first writing and separate extraction both succeeded
- Warm fantasy: prose-first writing and extraction both succeeded; the following legacy structured-generation request failed `INVALID_MODEL_OUTPUT / INVALID_JSON`
- Slice of life: neither arm called

The failing response reported HTTP 200, finish reason `stop`, nonempty final content and usage. `INVALID_JSON` establishes only that the strict legacy parser could not parse the response as its required JSON object. The raw invalid body was not retained; a specific punctuation/escaping or formatting cause cannot be reconstructed. The legacy contract was not weakened to manufacture a completed run.

All five validated outputs were checkpointed immediately, including both new prose outputs before their respective extraction. They survive in [the evidence directory](history/prose-pipeline-v1/), alongside exact synthetic inputs and complete safe diagnostics. No failed response was reconstructed. The artifact SHA-256 was `b8a14cb107cb412ff63e52e93670ddf3b08510833da520c34ee6d9dae1992950`.

The protocol requires all three pairs before creating its blinded corpus. Consequently no `blind-pairs.json` or unblinding file was produced and **no blinded literary scoring or superiority conclusion is available**. The old context-packaging quality pilot remains separately recorded as zero complete pairs; this new architecture trial must not be pooled with it.

## Calls, reported usage and time

All requests used Go `deepseek-v4.1-flash`, `thinking: {type: disabled}`, no `reasoning_effort`, temperature 0.7, output cap 3,000 and the existing Use balance OFF confirmation. No seed is supplied. Both generation arms received identical story inputs; their system/wire instructions necessarily differ. Extraction is an additional call consuming saved prose and the same context.

| Request | Fixture / stage | Result | Prompt tokens | Output tokens | Total tokens | Service seconds |
|---|---|---|---:|---:|---:|---:|
| 1 | Mystery / legacy writing+memory | Pass | 1,650 | 544 | 2,194 | 6.475 |
| 2 | Mystery / raw prose | Pass | 1,557 | 336 | 1,893 | 4.468 |
| 3 | Mystery / memory extraction | Pass | 1,701 | 464 | 2,165 | 3.710 |
| 4 | Warm fantasy / raw prose | Pass | 1,612 | 551 | 2,163 | 6.228 |
| 5 | Warm fantasy / memory extraction | Pass | 1,938 | 449 | 2,387 | 4.181 |
| 6 | Warm fantasy / legacy writing+memory | Invalid JSON | 1,705 | 910 | 2,615 | 9.320 |
| **All attempted** | | | **10,163** | **3,254** | **13,417** | **34.382** |

Every attempted response reported usage and reasoning tokens of zero. These are provider diagnostics, not independently verified billing or internal-computation measurements. No currency cost is calculated without billing evidence. Failure usage is included, never discarded.

For the sole complete mystery pair, legacy used 2,194 reported total tokens versus **4,058 for prose+extraction**. Its total measured service time was 6.475 seconds versus **8.177 seconds**. New prose became available after its writing stage at 4.468 seconds, but it was shorter than the legacy output and needed another call for memory. The harness inserted an additional eleven-second throttle before extraction; the new two-stage elapsed interval including that gap is about 19.177 seconds. Overall workflow elapsed was **89.426 seconds**, including five throttle gaps, writes and other overhead. Service timings include in-service telemetry writes and exclude throttle/output checkpoint writes.

These tiny, unequal-length, sequential samples are not estimates of stable latency, comparative reliability, quality or per-chapter cost. **No savings claim follows**. The normal UI also retains a separate semantic review call: successful writing+extraction+review is three calls per chapter rather than the former two.

## Structural success is not semantic correctness

Both new prose responses and both extraction responses satisfied their wire/anchor contracts. That establishes neither complete memory nor label entailment. A concrete non-blind inspection found this in the mystery extraction:

- `completed-03.json` staging item 2 (array index 1) says 阿陶催促程岚问点什么，程岚回应先问锁、收费低
- It references paragraph index 0, which contains 阿陶's question; 程岚's reply is in paragraph index 1
- The program-owned quote and offsets correctly reproduce paragraph 0, but the entire event label is not supported by that single quoted paragraph

The following item separately records the reply, so there is also overlapping material. This is a semantic anchoring limitation, not an offset failure. It was not automatically filtered, rewritten, accepted into story memory, or counted as an accurate extraction. The UI exposes the label and full quote for author inspection and explicitly warns that acceptance commits those proposed memories. The current semantic-review request sees prose and confirmed facts, not the extracted labels; it therefore does not automatically detect this label/quote mismatch. This part currently relies on author inspection and the final explicit acceptance, not an automated entailment gate. Current extraction, current prose/fact review, conflict resolution and explicit author acceptance are still required before any event promotion. A later atomic-claim or multi-span evidence design, plus per-event keep/reject controls, deserves a separately scoped improvement. The current snapshot must not be advertised as having solved general memory precision.

Length compliance is another distinct limitation. With the frozen 450–600 Han-character target, mystery legacy has 422 Han characters (515 Unicode characters), mystery raw prose 368 (444 total), and warm-fantasy raw prose 621 (731 total). All three retained prose outputs miss the target range. Mechanical counts and zero exact-sentence repeats are not literary judgments.

## Engineering verification and next boundary

The implementation passed [CI 37096242786](https://github.com/logan-suu/NexusScribe/actions/runs/37096242786): 325 unit/contract tests, seven DOM suites, build, and 32 desktop/mobile Chromium scenarios. Those tests use synthetic/fake providers. The live pilot exercises actual server actions, not the real browser’s complete review/acceptance journey, and makes no automatic memory commits.

The bounded experiment is finished at its stopping condition. Further live batches are not part of this result. Preserve the failure and successful checkpoints; prioritize semantic event granularity and author control before claiming quality gains or scheduling a new literary comparison.

## Subsequent implementation boundary

The preceding findings describe the recorded pilot revision and remain unchanged. The later candidate-selection increment sends original extracted labels and their quotes to the existing reviewer, requires explicit per-candidate keep/reject decisions, and blocks ordinary keep for unknown/unsupported judgments. Reasoned author overrides preserve the original assessment and evidence. This closes a workflow gap without establishing reliable general entailment detection. The new audit has its own [four-call preregistered protocol](MEMORY-SUPPORT-PROTOCOL.md); it does not rerun or complete the literary comparison above.
