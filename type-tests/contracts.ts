/** Checked by tsc, never executed. A regression that weakens these contracts makes
 * the corresponding @ts-expect-error unused and fails CI. */
import {createInitialState, saveRevision} from '../src/domain/engine.js';
import type {Draft, PatchOperation, ProjectState} from '../src/domain/types.js';
import type {Workspace} from '../src/storage.js';
import type {ProviderAdapter} from '../src/adapters/provider.js';
import {validateActionOutput} from '../src/adapters/provider.js';

const state: ProjectState = createInitialState();
saveRevision(state, 'ch1', '作者正文', 1);
// @ts-expect-error Revision numbers are not strings.
saveRevision(state, 'ch1', '作者正文', '1');
// @ts-expect-error Canonical status is an explicit lifecycle, not arbitrary UI text.
const invalidStatus: Draft['status'] = 'automatically-approved';
const removal: PatchOperation = {op:'remove_evidence', targetId:'evidence-1'};
// @ts-expect-error Patch operations require their identity and evidence fields.
const missingTarget: PatchOperation = {op:'remove_evidence'};
// @ts-expect-error Unknown operations cannot mutate canonical state.
const unknownOperation: PatchOperation = {op:'delete_everything', targetId:'story'};
const workspace: Workspace = {format:1, serial:0, state, editing:{}, patch:null};
// @ts-expect-error Manuscript buffer values remain strings or undefined.
workspace.editing.ch1 = 42;
declare const provider: ProviderAdapter;
provider.generateProse({project:{idea:'雨后的灯塔'}, chapterIndex:0});
// @ts-expect-error Chapter selection must be an index.
provider.generateProse({chapterIndex:'0'});
declare const externalPayload: unknown;
// @ts-expect-error External JSON is inaccessible until validated.
externalPayload.text;
const prose = validateActionOutput('generateProse', externalPayload);
const text: string = prose.text;
// @ts-expect-error A validated prose result cannot be used as an extraction result.
const entries: {label:string}[] = prose.staging;
void [invalidStatus, removal, missingTarget, unknownOperation, text, entries];

import {createServerProvider} from '../src/adapters/provider.js';
import {validateInput} from '../server/provider.js';
const reviewInterview = validateActionOutput('interview', externalPayload);
// @ts-expect-error Optional interview metadata remains unknown.
const reviewHint: string | undefined = reviewInterview.questions[0].hint;
const reviewLegacy = validateActionOutput('generateChapter', externalPayload);
// @ts-expect-error Legacy chapter identity remains unknown.
const reviewLegacyId: string | undefined = reviewLegacy.chapterId;
const reviewProse = validateActionOutput('generateProse', externalPayload);
const reviewProseId: string = reviewProse.chapterId;
// @ts-expect-error Provider metadata remains unknown.
const reviewProviderId: string = reviewProse.provider.id;
const reviewPlan = validateActionOutput('planStory', externalPayload);
// @ts-expect-error Optional plan metadata remains unknown.
const reviewSchemaVersion: number = reviewPlan.contract.schemaVersion;
// @ts-expect-error Optional outline ID remains unknown until merge.
const reviewOutlineId: string | undefined = reviewPlan.outline[0].id;
const reviewInterpretation = validateActionOutput('interpretRevision', externalPayload);
// @ts-expect-error One array alternative does not establish the other.
reviewInterpretation.suggestedFacts.map((x: unknown) => x);
const reviewStatus = await createServerProvider().getStatus();
// @ts-expect-error Only configured is guaranteed.
const reviewLive: boolean | undefined = reviewStatus.liveEnabled;
const reviewGeneration = validateInput('generateProse', externalPayload);
// @ts-expect-error Unselected outline entries remain unknown.
const reviewOtherId: string = reviewGeneration.project.outline[1].id;
void [reviewHint, reviewLegacyId, reviewProseId, reviewProviderId, reviewSchemaVersion, reviewOutlineId, reviewLive, reviewOtherId];
