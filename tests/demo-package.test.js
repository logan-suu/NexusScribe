import test from 'node:test';
import assert from 'node:assert/strict';
import {demoStart, demoCanonBlocked, MANUAL, CANON, CONFLICT} from '../demo/fictional-project.mjs';
import {parseBackup, importBackup} from '../src/storage.js';
import * as engine from '../src/domain/engine.js';

test('fictional sample starts offline and can be imported, locally classified, accepted and propagated without model advice', () => {
  const backup = parseBackup(JSON.stringify(demoStart()));
  assert.equal(backup.providerMode, 'template');
  assert.equal(backup.state.facts.length, 0);
  let s = importBackup({format:1, serial:0, state:engine.createInitialState(), editing:{}, patch:null}, backup, ()=>'demo-import').state;
  const id = s.chapters[0].id;
  assert.equal(s.chapters[0].text, MANUAL);
  s = engine.commitPatch(s, engine.proposeCustomPatch(s, id, {intent:'local_prose'}));
  s = engine.stageManualDraft(s, id);
  s = engine.reviewDraft(s, s.drafts[0].id);
  s = engine.acceptDraft(s, s.drafts[0].id);
  assert.equal(s.chapters[0].status, 'ACCEPTED');
  assert.equal(s.drafts[0].modelReview, null);
  assert.equal(s.events.length, 0);
  assert.equal(engine.getContext(s).sources.find(x=>x.chapterId===id).text, MANUAL);
});

test('fictional Canon sample cannot turn local structural review into semantic acceptance', () => {
  const backup = parseBackup(JSON.stringify(demoCanonBlocked()));
  assert.equal(backup.providerMode, 'template');
  let s = backup.state;
  assert.equal(s.facts[0].label, CANON);
  assert.equal(s.chapters[0].text, CONFLICT);
  s = engine.stageManualDraft(s, s.chapters[0].id);
  s = engine.reviewDraft(s, s.drafts[0].id);
  assert.throws(()=>engine.acceptDraft(s, s.drafts[0].id), /模型审查|语义/);
  assert.equal(s.chapters[0].status, 'PLANNED');
  assert.equal(s.events.length, 0);
});
