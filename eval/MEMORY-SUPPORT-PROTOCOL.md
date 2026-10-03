# Memory support audit v1: frozen, maximum four review calls

## Question and boundary

Can the existing chapter-review call identify lack of support for the complete original candidate label when restricted to that candidate's exact quote? This is a small adversarial implementation pilot, not a semantic-accuracy benchmark, independent truth verification, literary comparison, or cost-saving claim.

One run only, in GitHub Actions attempt 1, after offline checks and independent review. Maximum four requests, one existing `reviewChapter` call per fixture, no prose generation or extraction. No retries or replacement samples. Stop at the first transport, timeout, schema, persistence, or protocol error. A semantically wrong but structurally valid judgment is recorded and does not trigger a retry. Never automatically accept memory.

Use only the existing Actions secret and Go endpoint `https://opencode.ai/zen/go/v1`, model `deepseek-v4.1-flash`, thinking disabled, no reasoning_effort, temperature 0.7, 3,000 output-token cap, eleven-second minimum gap. Use balance remains OFF. No alternate models, paid judges, new credentials, top-ups, or user manuscript data.

## Fixed inputs and expectations

`memory-support-fixtures.mjs` fixes the order and eleven labels before dispatch:

1. Retained real synthetic-pilot counterexample: the original combined question/reply label cites only paragraph zero; the reply itself is in paragraph one. Reuse the saved prose and extraction verbatim. Expected combined label not supported; original reply label expected supported as an editorial judgment. Its word “回应” is interpretive: the isolated quote establishes speech but does not itself show the preceding conversational turn, so a conservative unknown is a reasonable disagreement rather than an unequivocal model error. The original label is not rewritten.
2. Multi-claim and time: a combined two-paragraph event and a wrong-day assertion are not supported; the direct placement assertion is supported.
3. Belief and negation: unproven suspicion as world fact and negation reversal are not supported; accurately attributed suspicion is supported.
4. Embedded instruction and ambiguous identity: nonexistent key and named identities unsupported by pronouns are not supported; the description of the note's instruction is supported. Embedded commands are story data.

`not_supported` accepts `unsupported` or `unknown` as a conservative non-keep judgment; the actual status and explanation are always retained. Missing entries are counted separately, mapped to unknown by the application, and do not count as a successful explicit assessment. Positive predictions on the clear negative fixtures are false support relative to the preregistered labels. Rejected/unknown positive fixtures are expectation mismatches; the retained reply’s interpretive relationship must be reported separately rather than called an unequivocal model error. This fixed set is deliberately constructed and unblinded, so counts must not be generalized to precision, recall, or normal writing.

## Evidence and reporting

Persist exact synthetic inputs and expectations before the first request. Preserve each validated response immediately and safe diagnostics for every attempted request, including failures. Allowlisted artifacts: inputs.json, diagnostics.json, completed-01.json through completed-04.json. Preserve reported prompt/output/total/reasoning counts where available; missing counts stay unknown. Record request-body SHA-256, source commit, run ID and elapsed time without credentials, headers, raw invalid responses, hidden reasoning, or private error bodies. A failed stage cannot erase an earlier checkpoint. A running prepared checkpoint may already have dispatched; hard interruption leaves its accounting explicitly uncertain until a final complete/stopped record exists. An interrupted request is not called free. Do not derive currency cost from token counts.

Freeze protocol, fixtures, harness and offline-test hashes in memory-support-manifest.json before dispatch. Report all judgments, missing checks, false supports and mismatches, including a disappointing result. The normal product adds candidate judgments to its existing third call; there is no fourth routine call. Longer inputs/outputs may increase consumption. Exact quotes and explicit author decisions constrain promotion but cannot guarantee model entailment judgments or story truth.
