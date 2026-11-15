# Local release check: can a beginner write a usable revision request?

This is an offline pilot for the revision brief helper. It tests the instruction the author writes, not the prose a model generates. No participant study or model run has been performed by adding this protocol.

1. Recruit at least eight consenting first-time fiction writers. Use mock/offline mode with fictional scenes only. Ask participants not to enter private manuscripts or identifying data. Do not send their text to an external model.
2. Give each participant one free-text task and one guided task. Allocate at least two independent participants to each first-attempt combination: free A, free B, guided A and guided B. Then use the other interface and scene. Do not allow copying instructions between tasks or coaching on the rubric.
3. Start timing after the participant reads the scene and task. Stop on the participant's final submission, including preview and append for the helper. Keep timeouts or abandoned attempts visible in study notes; do not silently drop or replace them to obtain a pass.
4. Assign anonymous attempt codes. Normalize interface-inserted labels and whitespace before providing the instruction to the scorer; preserve author-entered intent and boundaries. Score without device, interface, timing or order metadata. If scoring disagreements arise, resolve and record them before unblinding.
5. Give one point when each requirement is actionable, exact, and uncontradicted. Mark an explicit demand to undo any required constraint separately as a contradiction. Missing information earns no point. Do not infer intent from the scenario alone.

| Scene | Outcome | Continuity | Voice/detail | Still unknown |
| --- | --- | --- | --- | --- |
| A: Mei waits in a closed station office after the clerk has already stamped her ticket. She speaks tersely and still holds a brass button. | Show Mei boarding the last train, not merely rushing for it. | Start after the stamp; do not repeat it. | Keep Mei's short replies and the brass button. | Do not identify who slid the warning note under the door. |
| B: Ren stands on a foggy pier after the ferryman has already untied the boat. Ren asks indirect questions and is holding a folded paper crane. | Show Ren reaching the far shore, not just pushing off. | Start after the rope is untied; do not repeat it. | Keep indirect questions and the folded crane. | Do not explain who lit the empty lighthouse. |

After scoring, join the attempt codes to order, interface and seconds. Keep the join table and raw instructions private. Run the scorer on an array of pairs. Each attempt has this shape:

```json
{
  "interface": "guided",
  "stage": "first",
  "task": "a",
  "seconds": 61,
  "score": {"outcome": true, "continuity": true, "voice": true, "protectedUnknown": false},
  "contradiction": false
}
```

`node --import tsx scripts/score-revision-usability.mjs <paired-scores.json>`

The pilot threshold is predeclared: balanced first-attempt groups, more guided wins than losses on paired four-point scores, at least 75% complete guided attempts, no guided contradictions and a median guided/free completion-time ratio no greater than 1.25. The CLI returns 0 for pass, 2 for insufficient data or revise, and 1 for invalid input. Report attrition and sample composition separately; the scorer cannot verify participant identity, consent, adherence, scorer independence or representative sampling. A threshold pass is a directional pilot signal, not a quality guarantee. Use a fresh scene to check transfer before making broader claims.

## Other release checks

- Match the exact candidate commit to green type, unit, DOM, build and Chromium desktop/mobile checks. Verify both a clean source launch and compiled frontend/gateway launch without provider credentials.
- Exercise the complete author flow and local recovery: interview, plan, draft, edit, review, explicit acceptance, reload, export and import. No loss of accepted text, no implicit memory promotion, no unresolved launch- or data-loss blockers.
- Measure live-provider reliability and prose quality independently on the exact candidate, only when permitted and within verified spend bounds. Require no observed critical continuity violations in that bounded sample; do not reuse older passing engineering checks as prose evidence.
- These are local single-author checks. An internet-hosted release requires separate authentication, isolation, data durability and abuse/cost controls.
