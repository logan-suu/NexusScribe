import {readFile} from 'node:fs/promises';
import {assessRevisionUsability} from '../eval/revision-usability.js';

try {
  if (process.argv.length !== 3) throw new Error('Expected one JSON path');
  const input = JSON.parse(await readFile(process.argv[2], 'utf8'));
  if (!Array.isArray(input)) throw new Error('Expected an array of attempt pairs');
  const result = assessRevisionUsability(input);
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'pass') process.exitCode = 2;
} catch {
  console.error('Usage: node --import tsx scripts/score-revision-usability.mjs <paired-scores.json> (valid score pairs required)');
  process.exitCode = 1;
}
