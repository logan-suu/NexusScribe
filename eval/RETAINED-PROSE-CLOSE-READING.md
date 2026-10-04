# Retained prose: non-blind close reading

## Scope and conclusion

This is an assistant qualitative review of the actual retained [prose-pipeline-v1 outputs](history/prose-pipeline-v1/), read with their arm labels and [results](PROSE-PIPELINE-RESULTS.md) visible. It is **not blinded, independent human evidence, an aggregate quality score, or a replacement for the unfinished comparison**. No new model calls were made. The historical pilot remains one complete pair out of three planned, with no successive generated-and-accepted chapter chain.

The three retained texts show readable small-scene writing, distinct character gestures and mostly preserved explicit constraints. They also show cross-boundary replay, a clear copy-edit error and length noncompliance. They do not establish superior prose-first literary quality or multi-chapter continuity.

## Mystery: two retained versions

**Voice and action work.** Legacy gives 程岚 practical competence through “钥匙得往上提一点”, followed by a visible failed attempt; “写的是‘不知道’” carries her dry humor. Prose-first uses occupational details well: she declines a paper clip, uses watchmaking tweezers and stores scraps in an empty watch case. “是纸” fits her evasive brevity. 阿陶 remains impatient without becoming aggressive in either version.

**Continuation is weaker than isolated-scene fluency.** The supplied prior passage already contains “你总得问点什么” and “先问这锁，收费低”. Legacy replays the exchange in paragraph 3; prose-first replays it across paragraphs 1–2. Neither marks a recollection or gives the repetition a new dramatic purpose. The hearing-and-lock setup also restarts familiar material. This reads partly as rewriting the preceding passage rather than advancing from it. The recorded zero exact-sentence repetitions only describes repetition inside each output; it misses this cross-boundary problem.

**Both have a causal scene and the requested ending.** Legacy moves from a failed lock attempt to inspection, discovery and tomorrow's inquiry. Prose-first adds fresh scratches and a concise discovery. Both leave the sender unknown and decide to ask the administrator. Legacy's final hanging keys sustain the unresolved physical obstacle.

**Specific editorial defects remain.** Prose-first contains “一个半个数字”, an unedited construction. Its newly introduced deposit slip supplies convenient leverage without setup. Legacy's “和那封信隔着一层布” leaves the envelope's location unclear after the prior passage placed it under a repair mat; an unshown move is possible, so this is a missing bridge rather than a proven contradiction. Both accumulate atmospheric similes, sometimes doing work that the discovery itself could carry.

**Do not turn ambiguity into a false violation.** Prose-first's “是车票？” is a question about ticket-like scraps, answered with “是纸”. This does not establish that 阿陶 knows the hidden envelope's contents. “左耳那侧什么也没有，只有她自己的呼吸” has confusing sensory phrasing but is not an unambiguous assertion that the deaf ear hears external sound. Neither text unmistakably leaves 程岚's limited viewpoint.

Sources: [legacy prose](history/prose-pipeline-v1/completed-01.json), [prose-first prose](history/prose-pipeline-v1/completed-02.json), and their exact prior passage in [inputs](history/prose-pipeline-v1/inputs.json).

## Warm fantasy: one retained version

**Warmth is strongest when expressed through action.** 米禾 puts bread beside the cloud and explains “不是给你吃的” and “有个东西挨着，比较不冷”. This is specific, awkward and caring. The boss's temperature check, safe placement and cleaning instructions express concern through practical rules, matching the requested voice.

**The scene progresses, but overexplains and repeats.** Closing the shop leads to safe warmth, the cloud settling and remaining work. The boss restates the already supplied fire limitation. “一点不烫的暖” returns, and tapping the darkest tray with “这个也算” largely reenacts the prior passage. These can function as motifs or reminders, but a continuation needs a reason for repeating the beat. Repeated soft comparisons risk the sweetness the brief asks to restrain.

**The cloud's decision is less definite than 米禾's.** Settling suggests acceptance, while the explicit decision at the ending belongs to 米禾. A small unmistakable choice by the cloud could meet the goal without explanatory narration. The scene does not show harmless contact with open flame or claim that the cleaning promise is fulfilled. The storm has not arrived; the boss's prediction of its timing remains attributed speech.

Source: [warm-fantasy prose](history/prose-pipeline-v1/completed-04.json). No valid legacy counterpart was retained, so there is no paired literary comparison for this fixture.

## Measurable delivery and next criteria

All three meet the 4–7 paragraph request. All miss the frozen 450–600 Han-character target: legacy mystery 422 (28 short), prose-first mystery 368 (82 short), and prose-first warm fantasy 621 (21 over). Length is a contract result, not a literary score. The shorter mystery output cannot establish faster delivery of equivalent prose.

The smallest supported improvements are explicit separation of preceding accepted text, current scene and future plans; a clear continuation boundary; advisory cross-boundary replay checks; and exact length diagnostics that preserve the original draft rather than silently truncate or retry it. Preserve underlying source prose and avoid forcing every remembered fact into exposition.

A separately preregistered future test should use an actual chain in which each chapter consumes the exact preceding accepted output. Judge each chapter's new causal change, distinct voice, earned ending, length, physical continuity, knowledge boundaries and unresolved commitments with quoted evidence. Distinguish failures from uncertainty and deliberate motifs. Keep prose judgments separate from memory support and workflow success. Even a successful small chain would demonstrate bounded feasibility, not whole-novel quality or architectural superiority.
