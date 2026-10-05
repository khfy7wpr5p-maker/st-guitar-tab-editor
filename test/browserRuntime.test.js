import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import {
  GUITAR_TAB_EDITOR_ARTIFACT,
  GUITAR_TAB_EDITOR_BROWSER_CONTRACT,
  GUITAR_TAB_EDITOR_BROWSER_VERSION,
  GUITAR_TAB_EDITOR_MANIFEST,
  GUITAR_TAB_EDITOR_RUNTIME_GLOBAL,
  GUITAR_TAB_EDITOR_RUNTIME_VERSION,
  buildBrowserRuntime,
} from '../scripts/build-browser-runtime.js';

await buildBrowserRuntime();

const bundlePath = new URL(`../dist/browser/${GUITAR_TAB_EDITOR_ARTIFACT}`, import.meta.url);
const manifestPath = new URL(`../dist/browser/${GUITAR_TAB_EDITOR_MANIFEST}`, import.meta.url);

async function readArtifact() {
  return {
    bundle: await readFile(bundlePath),
    manifest: JSON.parse(await readFile(manifestPath, 'utf8')),
  };
}

test('GTAB-09A browser artifact is self-contained and integrity-described', async () => {
  const { bundle, manifest } = await readArtifact();
  assert.equal(manifest.contract, GUITAR_TAB_EDITOR_BROWSER_CONTRACT);
  assert.equal(manifest.version, GUITAR_TAB_EDITOR_BROWSER_VERSION);
  assert.equal(manifest.runtimeVersion, GUITAR_TAB_EDITOR_RUNTIME_VERSION);
  assert.deepEqual(manifest.bundler, { package: 'esbuild', version: '0.28.2', license: 'MIT' });
  assert.equal(manifest.artifact, GUITAR_TAB_EDITOR_ARTIFACT);
  assert.equal(manifest.format, 'iife');
  assert.equal(manifest.target, 'es2022');
  assert.equal(manifest.global, GUITAR_TAB_EDITOR_RUNTIME_GLOBAL);
  assert.equal(manifest.externalImports, 0);
  for (const field of [
    'networkCapable',
    'persistenceCapable',
    'rendererAuthority',
    'sourceMutationAuthority',
    'serverRevisionAuthority',
    'approvalAuthority',
    'publicationAuthority',
  ]) {
    assert.equal(manifest[field], false, `${field} must stay disabled`);
  }
  assert.equal(manifest.bytes, bundle.byteLength);
  assert.equal(manifest.sha256, createHash('sha256').update(bundle).digest('hex'));
});

test('GTAB-09A bundle exposes only the frozen teacher TAB core runtime', async () => {
  const { bundle } = await readArtifact();
  const context = vm.createContext({});
  vm.runInContext(bundle.toString('utf8'), context, { filename: GUITAR_TAB_EDITOR_ARTIFACT });

  const runtime = context[GUITAR_TAB_EDITOR_RUNTIME_GLOBAL];
  assert.ok(runtime);
  assert.equal(runtime.runtimeVersion, GUITAR_TAB_EDITOR_RUNTIME_VERSION);
  for (const method of [
    'inspectMusicXml',
    'createSourceSession',
    'createTabAssignmentDocument',
    'createKeyboardController',
    'createFixedSixStringRows',
    'positionToMidi',
    'validatePositionForEvent',
    'serializeGuitarTabMusicXml',
  ]) {
    assert.equal(typeof runtime[method], 'function', `${method} must be exported`);
  }
  assert.equal(Object.isFrozen(runtime), true);
  assert.equal(Object.isFrozen(runtime.profile), true);
  assert.equal(runtime.profile.networkCapable, false);
  assert.equal(runtime.profile.persistenceCapable, false);
  assert.equal(runtime.profile.rendererAuthority, false);
  assert.equal(runtime.profile.sourceMutationAuthority, false);
  assert.equal(runtime.profile.approvalAuthority, false);
  assert.equal(runtime.profile.publicationAuthority, false);

  const descriptor = Object.getOwnPropertyDescriptor(context, GUITAR_TAB_EDITOR_RUNTIME_GLOBAL);
  assert.equal(descriptor?.writable, false);
  assert.equal(descriptor?.configurable, false);
  assert.throws(
    () => vm.runInContext(bundle.toString('utf8'), context),
    /ST_GUITAR_TAB_EDITOR_RUNTIME_ALREADY_DEFINED/,
  );
});
