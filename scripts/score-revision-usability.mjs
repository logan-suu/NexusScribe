import {readFile} from 'node:fs/promises';
import {assessRevisionPilot} from '../eval/revision-usability.js';

try {
  if (process.argv.length !== 3) throw new Error('Expected one JSON path');
  const input = JSON.parse(await readFile(process.argv[2], 'utf8'));

  const result = assessRevisionPilot(input);
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'pass') process.exitCode = 2;
} catch {
  console.error('Usage: node --import tsx scripts/score-revision-usability.mjs <pilot.json> (valid pilot roster and observations required)');
  process.exitCode = 1;
}
