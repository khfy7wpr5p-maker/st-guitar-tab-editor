import { createKeyboardController } from '../editor/keyboardController.js';
import { createFixedSixStringRows } from '../ui/fixedSixStringView.js';
import {
  GUITAR_PITCH_POLICY,
  STANDARD_TUNING,
  createSourceSession,
  createTabAssignmentDocument,
  inspectMusicXml,
  positionToMidi,
  serializeGuitarTabMusicXml,
  validatePositionForEvent,
} from '../index.js';

export const GUITAR_TAB_EDITOR_RUNTIME_VERSION = '1.0.0';
export const GUITAR_TAB_EDITOR_RUNTIME_GLOBAL = 'STGuitarTabEditorRuntime';

function createBrowserSourceSession(xmlText, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Source session options must be an object.');
  }
  return createSourceSession(xmlText, {
    ...options,
    guitarPitchPolicy: options.guitarPitchPolicy ?? GUITAR_PITCH_POLICY.STANDARD_GUITAR_WRITTEN,
  });
}

export function createBrowserEditorRuntime() {
  const profile = Object.freeze({
    networkCapable: false,
    persistenceCapable: false,
    rendererAuthority: false,
    sourceMutationAuthority: false,
    serverRevisionAuthority: false,
    approvalAuthority: false,
    publicationAuthority: false,
  });

  return Object.freeze({
    runtimeVersion: GUITAR_TAB_EDITOR_RUNTIME_VERSION,
    profile,
    GUITAR_PITCH_POLICY,
    STANDARD_TUNING,
    inspectMusicXml,
    createSourceSession: createBrowserSourceSession,
    createTabAssignmentDocument,
    createKeyboardController,
    createFixedSixStringRows,
    positionToMidi,
    validatePositionForEvent,
    serializeGuitarTabMusicXml,
  });
}

const target = globalThis;
if (Object.prototype.hasOwnProperty.call(target, GUITAR_TAB_EDITOR_RUNTIME_GLOBAL)) {
  throw new Error('ST_GUITAR_TAB_EDITOR_RUNTIME_ALREADY_DEFINED');
}

Object.defineProperty(target, GUITAR_TAB_EDITOR_RUNTIME_GLOBAL, {
  value: createBrowserEditorRuntime(),
  writable: false,
  configurable: false,
  enumerable: true,
});
