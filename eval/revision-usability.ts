/** Aggregate a small paired usability pilot after blinded review. No prose is stored here. */
export type RevisionInterface = 'free' | 'guided';
export type RevisionScore = Readonly<{
  outcome: boolean;
  continuity: boolean;
  voice: boolean;
  protectedUnknown: boolean;
}>;
export type RevisionAttempt = Readonly<{
  interface: RevisionInterface;
  stage: 'first' | 'second';
  task: 'a' | 'b';
  seconds: number;
  score: RevisionScore;
  /** True if the instruction contradicts an explicit requirement, even if it mentions it. */
  contradiction: boolean;
}>;
export type RevisionPair = readonly [RevisionAttempt, RevisionAttempt];

const dimensions = ['outcome', 'continuity', 'voice', 'protectedUnknown'] as const;
const score = (attempt: RevisionAttempt) => dimensions.filter(key => attempt.score[key]).length;

export function assessRevisionUsability(pairs: readonly RevisionPair[]) {
  const balance = {freeA: 0, freeB: 0, guidedA: 0, guidedB: 0};
  const totals = {wins: 0, ties: 0, losses: 0, guidedComplete: 0, guidedContradictions: 0};
  const ratios: number[] = [];

  for (const [first, second] of pairs) {
    if (!first || !second || first.stage !== 'first' || second.stage !== 'second'
      || first.interface === second.interface || first.task === second.task
      || [first, second].some(attempt =>
        !['free', 'guided'].includes(attempt.interface) || !['a', 'b'].includes(attempt.task)
        || !Number.isFinite(attempt.seconds) || attempt.seconds <= 0
        || typeof attempt.contradiction !== 'boolean'
        || dimensions.some(key => typeof attempt.score?.[key] !== 'boolean'))) {
      throw new Error('Expected two valid attempts, with distinct tasks and interfaces in order.');
    }
    const firstKey = `${first.interface}${first.task === 'a' ? 'A' : 'B'}` as keyof typeof balance;
    balance[firstKey]++;
    const guided = first.interface === 'guided' ? first : second;
    const free = first.interface === 'free' ? first : second;
    const delta = score(guided) - score(free);
    totals[delta > 0 ? 'wins' : delta < 0 ? 'losses' : 'ties']++;
    if (guided.contradiction) totals.guidedContradictions++;
    if (score(guided) === dimensions.length && !guided.contradiction) totals.guidedComplete++;
    ratios.push(guided.seconds / free.seconds);
  }

  ratios.sort((a, b) => a - b);
  const half = Math.floor(ratios.length / 2);
  const medianTimeRatio = !ratios.length ? null : ratios.length % 2
    ? ratios[half]! : (ratios[half - 1]! + ratios[half]!) / 2;
  const cells = Object.values(balance);
  const eligible = Math.min(...cells) >= 2 && Math.max(...cells) - Math.min(...cells) <= 1;
  const status = !eligible ? 'insufficient'
    : totals.guidedContradictions === 0
      && totals.wins > totals.losses
      && totals.guidedComplete / pairs.length >= 0.75
      && medianTimeRatio !== null && medianTimeRatio <= 1.25 ? 'pass' : 'revise';
  return {status, participants: pairs.length, balance, ...totals, medianTimeRatio} as const;
}
