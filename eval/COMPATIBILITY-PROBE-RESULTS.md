# Transport compatibility: one HTTP 200 response, then stopped

6 October 2026, 18:52 UTC. The separately approved single compatibility probe
returned HTTP 200 with finish_reason `stop` in 4,635 ms. Exactly one provider request
was dispatched, with zero remaining attempts. No retry, B arm, model judge,
literary comparison, prompt adoption, manuscript acceptance or deployment followed.

## Observed result

- Status: `compatible_response`; HTTP 200; finish reason `stop`
- Provider-reported usage: 1,557 prompt + 423 completion = 1,980 total tokens;
  reported reasoning tokens: 0
- Response envelope: 2,116 bytes; 573 content characters
- Content SHA-256: `731c9da59e5019f6ce92264f9da8601d1f04be9f93e5d019656273b6e47ef289`
- Currency cost is unknown. The user's existing Use balance off confirmation was
  carried forward; no fresh provider-console verification is claimed
- No prose, raw provider envelope, hidden reasoning, arbitrary error text,
  headers, provider request/session IDs or credentials were retained

This supports compatibility of the repaired transport contract at this time.
It does not establish that the old missing headers caused the historical HTTP 400:
the previous error body is unavailable, and there was no controlled header-only
comparison. It also says nothing about writing quality, causal continuity,
long-form memory, autonomous novel-writing quality or literary improvement.
Character count alone is not the frozen Han-character/paragraph delivery gate;
prose was deliberately not retained or evaluated.

## Preregistration and execution provenance

- Source: [`f7fb1edf5791458b5f3f2019d55a65fe736713fc`](https://github.com/logan-suu/NexusScribe/commit/f7fb1edf5791458b5f3f2019d55a65fe736713fc)
- Probe: [run 37514607937](https://github.com/logan-suu/NexusScribe/actions/runs/37514607937), first and only attempt
- Exact-source prerequisite: [CI 37513688973](https://github.com/logan-suu/NexusScribe/actions/runs/37513688973), successful before dispatch
- [PR 24](https://github.com/logan-suu/NexusScribe/pull/24), reviewed head
  `3286f40cd4f35c2fa07e5918e8efbb55ec4b3268`, passed independent adversarial
  review, 754 tests, 12 DOM checks, 252 Chromium desktop/mobile cases, build and
  fake-only replay in CI 37512853596. Its Git tree equals the merged source tree
- Frozen F1 baseline A body SHA-256:
  `2b598fa0db1271b0024150b80afab36bf2bb86ae7573dedb5bbe3bb9c664241c`
- Source manifest file SHA-256:
  `ffeebebba464d71e68a31d2873086f69a785e1cc7bc8c2964abe1b38b48a170f`
- The immutable reservation artifact was uploaded before the provider credential
  was introduced; its bytes match the reservation in the final evidence artifact

The request used the shared builder, honest NexusScribe User-Agent, one fresh UUID
session, original endpoint/model/messages/settings, redirect rejection, 120-second
total deadline, 128-KiB success cap and 16-KiB safe-error cap. No prompt field changed.

## Preserved evidence and retirement

[Historical evidence](history/transport-compatibility-20261006/artifact-index.json)
contains the four original files byte-for-byte: reservation, exclusive dispatch,
result, and index. All index hashes and both downloaded ZIP digests were verified.
The original live source runner, workflow, protocol, manifest and tests are copied
byte-for-byte beside them to make the executed source inspectable.

- Final artifact ZIP SHA-256:
  `d6797599da1703504d61f7b88f95b27212c6546c75a1c32e0a63615e33323315`
- Pre-dispatch reservation ZIP SHA-256:
  `4b5522adf306e0f786f234d2f7a54afbe2af205903154af7607c99643ab51c9f`

The current workflow has no runnable job or secret reference. The CLI unconditionally
fails before environment/credential access; exported execution is restricted to
explicitly injected fake transports for offline regression. Old-source reruns,
deleted history or new output directories cannot restore authorization. The older
six-call trial remains retired and its unused five slots remain unavailable.
Main remains at initialization; no release or deployment occurred.

## Next quality experiment, proposal only

A new separately approved causal-continuity comparison could reuse the unchanged
six frozen bodies: F1 A/B, F2 B/A, F3 A/B. Maximum six new requests, 3,000 output
tokens each (18,000 aggregate output-token cap), no retries, and failure or uncertain
assessment stops the sequence. Use new protocol/reservations and fresh isolated
sessions; never reuse this probe's request as a literary baseline or the old trial's
allowance. Keep source/input freezes, masked individual/pairwise close reading,
objective delivery gates and no automatic prompt or manuscript adoption.
This is an offline proposal only. New explicit user approval is required before
any additional live model request, including the first baseline.
