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

const incompleteReasons = ['timeout', 'abandoned', 'technical', 'withdrawn', 'not-started'] as const;
type IncompleteReason = typeof incompleteReasons[number];
type ObservedAttempt =
  | {status: 'completed'; seconds: number; score: RevisionScore; contradiction: boolean}
  | {status: 'incomplete'; reason: IncompleteReason};
export type RevisionPilot = Readonly<{
  mode: 'participants' | 'rehearsal';
  /** Freeze the anonymous allocation roster before collecting observations. */
  allocation: {id: string; firstInterface: RevisionInterface; firstTask: 'a' | 'b'}[];
  observations: {id: string; attempts: [ObservedAttempt, ObservedAttempt]}[];
}>;

/** Joined data only. Never expose row IDs, raw instructions or participant identity in the report. */
export function assessRevisionPilot(pilot: RevisionPilot) {
  const invalid = (): never => { throw Error('Invalid pilot allocation or observations.'); };
  if (!pilot || !['participants', 'rehearsal'].includes(pilot.mode)
    || !Array.isArray(pilot.allocation) || !Array.isArray(pilot.observations)) invalid();
  const roster = new Map<string, RevisionPilot['allocation'][number]>();
  for (const row of pilot.allocation) {
    if (!row || !/^p[0-9]{3,6}$/.test(row.id)
      || !['free', 'guided'].includes(row.firstInterface)
      || !['a', 'b'].includes(row.firstTask) || roster.has(row.id)) invalid();
    roster.set(row.id, row);
  }
  const results = new Map<string, [ObservedAttempt, ObservedAttempt]>();
  for (const row of pilot.observations) {
    if (!row || !roster.has(row.id) || results.has(row.id)
      || !Array.isArray(row.attempts) || row.attempts.length !== 2) invalid();
    results.set(row.id, row.attempts);
  }
  const arm = () => ({assigned: 0, completed: 0,
    incomplete: {timeout: 0, abandoned: 0, technical: 0, withdrawn: 0, 'not-started': 0, unreported: 0}});
  const arms = {free: arm(), guided: arm()};
  const pairs: RevisionPair[] = [];
  const allocationBalance = {freeA: 0, freeB: 0, guidedA: 0, guidedB: 0};
  for (const [id, row] of roster) {
    const key = `${row.firstInterface}${row.firstTask === 'a' ? 'A' : 'B'}` as keyof typeof allocationBalance;
    allocationBalance[key]++;
    const observations = results.get(id);
    const attempts: RevisionAttempt[] = [];
    for (const index of [0, 1] as const) {
      const ui = index === 0 ? row.firstInterface : row.firstInterface === 'free' ? 'guided' : 'free';
      const task = index === 0 ? row.firstTask : row.firstTask === 'a' ? 'b' : 'a';
      const counter = arms[ui];
      counter.assigned++;
      if (!observations) { counter.incomplete.unreported++; continue; }
      const attempt = observations[index];
      if (!attempt) invalid();
      if (attempt.status === 'incomplete') {
        if (!incompleteReasons.includes(attempt.reason)) invalid();
        counter.incomplete[attempt.reason]++;
      } else if (attempt.status === 'completed') {
        if (!Number.isFinite(attempt.seconds) || attempt.seconds <= 0
          || typeof attempt.contradiction !== 'boolean'
          || dimensions.some(key => typeof attempt.score?.[key] !== 'boolean')) invalid();
        counter.completed++;
        attempts.push({interface:ui,stage:index === 0 ? 'first' : 'second',task,
          seconds:attempt.seconds,score:attempt.score,contradiction:attempt.contradiction});
      } else invalid();
    }
    if (attempts.length === 2) pairs.push([attempts[0]!, attempts[1]!]);
  }
  const {status: pairedStatus, ...paired} = assessRevisionUsability(pairs);
  const incompletePairs = roster.size - pairs.length;
  // Do not let favorable complete-case results stand in for missing participants.
  const status = pilot.mode === 'rehearsal' ? 'rehearsal-only'
    : incompletePairs > 0 ? 'inconclusive-attrition' : pairedStatus;
  return {status, allocated: roster.size, allocationBalance, incompletePairs, arms, paired} as const;
}
