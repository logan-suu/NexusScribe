# Multi-chapter v1: stopped at eight calls; support false positive retained

## Outcome

The [single live run 37173894618](https://github.com/logan-suu/NexusScribe/actions/runs/37173894618), attempt 1, tested `eb7b8826aa9a0ab360073bdaf69fe1c07000531b` under its [frozen protocol](https://github.com/logan-suu/NexusScribe/blob/eb7b8826aa9a0ab360073bdaf69fe1c07000531b/eval/MULTICHAPTER-PROTOCOL.md). It made **eight requests**, retained eight structurally valid outputs and stopped at the chapter-2 first-candidate audit. No ninth request, retry, alternate candidate audit, author override or chapter-3 generation occurred. The unused four-call capacity is not permission for another batch.

**The three-chapter acceptance criterion failed. More importantly, chapter 1 received a false `supported` judgment.** Its scripted acceptance is not semantic success. Both generated chapters also missed both requested length and paragraph bounds. This is neither a writing-quality pass nor evidence of reliable isolated support review.

## Two different audit findings

### Call 4: unsupported detail was accepted as reasonable inference

The chapter-1 first extracted label includes “寄存室第三排柜子前” and “确认锁未被打开过”. Its own quote describes the lock and cabinet number but does not contain the third-row location. That detail occurs in another paragraph which was **not sent** to the isolated auditor.

The [audit response](history/multichapter-v1/completed-04.json) explicitly acknowledges that the quoted paragraph omits the location, calls it “合理具体化”, evaluates the “核心断言”, and still returns `supported`. This violates the frozen requirement to support the **entire original label using only its own quote**. It also turns the character's “锁没动过” into a stronger claim about whether the lock was ever opened; attribution and historical scope deserve separate scrutiny.

This is not the earlier supplied-evidence borrowing channel. Isolation worked at the request boundary, but the model still relaxed the criterion internally. The earlier four-fixed-case success does not generalize to this case. The request, label, quote, explanation and positive status remain unchanged as a [regression counterexample](multichapter-counterexamples.json).

The fixed synthetic selection rule kept this candidate and explicitly accepted chapter 1 through the UI. That demonstrates the risk: an advisory model false positive enabled ordinary keep. The later, predetermined author amendment created a new chapter-1 revision, so the runtime excluded this old-source event from chapter-2 context while preserving its historical record. Stale-source filtering did not retrospectively make the original judgment correct.

### Call 8: the own-quote mismatch was correctly rejected

The chapter-2 first label says 许宁 and 阿青 arrived at 8:45 and found the door barred. Its [own quoted paragraph](history/multichapter-v1/request-08.json) names only 许宁. The following paragraph says 阿青 arrived earlier. The [isolated result](history/multichapter-v1/completed-08.json) returns `unsupported`, correctly identifying the absent companion-arrival evidence.

The protocol stopped immediately after durably preserving that result. The final saved browser workspace shows the chapter-2 draft still `IN_REVIEW`, with no author memory decisions and no acceptance; its chapter record remains `PLANNED` at revision 1. The audit attempt is still pending in that last UI snapshot because the harness stopped before the response was attached by the client; do not describe the retained negative result as a completed UI judgment. Chapter 3 remains planned. The original application permits deliberate rejection and further author choices; this protocol's first-candidate stop rule is not proof that the application has no continuation route.

## What the partial chain establishes

- Chapter 1 prose was saved, extracted, reviewed and accepted through visible controls under the fixed synthetic selection rule
- A fixed author sentence about the broken bell was appended and explicitly committed in template mode, making zero model calls
- Requests 5–7 contained the exact accepted chapter-1 text plus that amendment and the new confirmed fact
- The old chapter-1 selected event remained historical and was excluded from current context because its source revision was stale
- Chapter-2 prose, extraction and whole review were saved before the eighth-call stop
- Real chapter-2-memory propagation into chapter 3 was **not observed**; only the separate mocked browser preflight covered that full chain

Transport/structure success, author acceptance, model support judgments and literary quality are distinct outcomes.

## Non-blind prose assessment

An assistant close-read both retained prose outputs with the fixture, results and stage identities visible. This is not a blinded comparison, independent human evaluation or statistical quality estimate.

| Output | Han characters | Paragraphs | Frozen request |
| --- | ---: | ---: | --- |
| Chapter 1 | 591 | 8 | 350–500 Han; 4–7 paragraphs |
| Chapter 2 | 691 | 8 | 350–500 Han; 4–7 paragraphs |

Both fail both bounds. Counts use Unicode `Script=Han` and the application's paragraph segmentation. The deliberate author sentence is excluded from generated-output counts; amended chapter 1 has 607 Han characters and nine paragraphs. No text was padded, truncated, edited to pass, regenerated or replaced.

There are useful scene-level qualities. Tweezers and a box formerly holding a watch hairspring connect action to 许宁's trade. “那就问清楚为什么不肯” conveys practical resolve; 阿青's “明天呢？” conveys impatience; the administrator expresses concern through rules. Chapter 2 genuinely advances to the next morning's inquiry rather than replaying the discovery. The 8:45 arrival is early for the nine-o'clock plan, not a time contradiction.

The strongest concrete prose defect is physical visibility. Chapter 1 closes the paper box and secures it with a rubber band. Chapter 2 says the administrator “没让许宁打开，只隔着盒壁端详” the scraps' positions and shapes, without establishing a transparent opening. Custody is maintained, but the inspection is not physically supported. The whole-chapter review returned an empty issue list and missed this problem.

Repeated bag-lifting, nearly identical box-against-bag endings and decorative rain imagery make the continuation formulaic and contribute to excess length. The administrator's delay has a possible explanation in boxed records, but why retrieval must wait until tomorrow is thinly motivated.

Neither output explicitly gives 许宁 left-ear hearing, reveals the ticket to 阿青, identifies the sender or opens the cabinet. Chapter 2 uses knocking and contains no ringing bell. The added fact was transmitted, but omission of a bell does not prove that the amendment caused the model's choice. General sound descriptions do not contradict unilateral deafness. The final appointment remains unresolved; its later fulfillment was not observed.

## Usage and timing

Same Go endpoint and `deepseek-v4.1-flash`, thinking disabled, temperature 0.7, maximum 3,000 output tokens per request, sequential eleven-second throttle, existing credential and Use balance OFF confirmation. No model/key/balance change or automatic retry.

| Call | Action | Prompt | Completion | Total | Transport time |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | Chapter-1 prose | 2,125 | 523 | 2,648 | 5.695 s |
| 2 | Chapter-1 extraction | 2,398 | 352 | 2,750 | 4.418 s |
| 3 | Chapter-1 review | 2,551 | 342 | 2,893 | 3.562 s |
| 4 | Chapter-1 audit | 459 | 165 | 624 | 2.178 s |
| 5 | Chapter-2 prose | 2,799 | 626 | 3,425 | 6.897 s |
| 6 | Chapter-2 extraction | 3,177 | 436 | 3,613 | 4.101 s |
| 7 | Chapter-2 review | 3,328 | 642 | 3,970 | 5.382 s |
| 8 | Chapter-2 audit | 443 | 72 | 515 | 1.561 s |
| Total | | 17,280 | 3,158 | 20,438 | |

All eight responses reported reasoning tokens zero, with no missing usage fields. These are provider counters, not independently verified billing. Currency cost is unknown. Harness elapsed time was 115.200 seconds, including throttles, UI and persistence overhead; setup time is separate. These unequal short samples establish no latency, cost or quality advantage.

## Evidence, engineering gates and next boundary

Original artifact `11291849353` has ZIP SHA-256 `d593f8b04bf8f0cc044517e737dd7214aa39a8476d558e03a2efd49ae3471f72`. The [artifact index](history/multichapter-v1/artifact-index.json) records hashes for all 22 original files. Eighteen normalized synthetic JSON inputs/outputs/diagnostics are retained byte-for-byte in [history](history/multichapter-v1/). Full synthetic workspace checkpoints and screenshots remain in the original downloaded artifact and Actions' seven-day retention; they are not committed as project backups or images. The [tested source manifest](history/multichapter-v1/source-manifest.json) is preserved separately from later maintenance.

Independent review reproduced all eight request hashes using unchanged provider serialization with fake transport, verified output hashes/accounting, parsed the final backup and confirmed that no ninth stage was dispatched. [Exact preflight CI 37173592286](https://github.com/logan-suu/NexusScribe/actions/runs/37173592286) passed 487 tests, nine DOM suites, build, 106 desktop/mobile browser cases and the exact twelve-stage harness with fake transport. That mocked evidence is separate from this failed real-provider run. An earlier CI caught the hidden mobile backup export button; its responsive fix passed the rerun.

After the live result, support badges were clarified as fallible **model judgments**, with the demonstrated missing-detail false positive called out. The consumed live CLI was retired; credential-free CI replay remains available. These maintenance changes do not alter the recorded outputs or cure semantic support reliability.

The highest-priority next design is deterministic quote-derived memory, with free paraphrases visibly unverified and requiring explicit author attestation. Preserve both counterexamples and provide deliberate reject-and-continue flows without hidden calls or retries. More prompt variants alone are not an adequate acceptance strategy. Manual-authored chapter acceptance remains tracked separately in [issue 10](https://github.com/logan-suu/NexusScribe/issues/10). No additional live batch is authorized by this result.
