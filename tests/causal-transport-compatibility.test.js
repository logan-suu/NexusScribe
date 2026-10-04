import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from '../scripts/inspect-causal-transport.mjs';
test('offline diagnostic reproduces known missing explicit transport headers without network',async()=>{const r=await inspect();assert.equal(r.realNetworkCalls,0);assert.equal(r.fakeTransportCalls,2);assert.equal(r.endpointIdentical,true);assert.equal(r.nonMessageSettingsIdentical,true);assert.deepEqual(r.transportDifferences.missingExplicitHeaders,['user-agent','x-opencode-session']);assert.equal(r.transportDifferences.priorSessionIsUuid,true);assert.equal(r.transportDifferences.priorUserAgent,'NexusScribe-demo/0.1');assert.equal(r.errorBodyRetained,false);assert.deepEqual(r.safeFailureMetadata.usage,{});});
