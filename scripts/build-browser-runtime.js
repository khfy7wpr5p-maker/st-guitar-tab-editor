import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

export const GUITAR_TAB_EDITOR_BROWSER_CONTRACT = 'ST_GUITAR_TAB_EDITOR_BROWSER_BUNDLE';
export const GUITAR_TAB_EDITOR_BROWSER_VERSION = '1.0.0';
export const GUITAR_TAB_EDITOR_RUNTIME_VERSION = '1.0.0';
export const GUITAR_TAB_EDITOR_RUNTIME_GLOBAL = 'STGuitarTabEditorRuntime';
export const GUITAR_TAB_EDITOR_ARTIFACT = 'st-guitar-tab-editor.runtime.js';
export const GUITAR_TAB_EDITOR_MANIFEST = 'st-guitar-tab-editor.runtime.manifest.json';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const outDir = path.join(repoRoot, 'dist', 'browser');
const outFile = path.join(outDir, GUITAR_TAB_EDITOR_ARTIFACT);
const manifestFile = path.join(outDir, GUITAR_TAB_EDITOR_MANIFEST);

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

export async function buildBrowserRuntime() {
  await mkdir(outDir, { recursive: true });

  const result = await build({
    entryPoints: [path.join(repoRoot, 'src', 'runtime', 'browserEditorRuntime.js')],
    outfile: outFile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2022'],
    minify: true,
    sourcemap: false,
    legalComments: 'eof',
    metafile: true,
    logLevel: 'warning',
  });

  const externalImports = Object.values(result.metafile.outputs)
    .flatMap((output) => output.imports)
    .filter((entry) => entry.external === true);
  if (externalImports.length !== 0) {
    throw new Error(`Guitar TAB Editor browser bundle contains external imports: ${JSON.stringify(externalImports)}`);
  }

  const artifact = await readFile(outFile);
  const text = artifact.toString('utf8');
  const forbiddenTokens = [
    'node:',
    'fetch(',
    'XMLHttpRequest',
    'WebSocket',
    'EventSource',
    'navigator.sendBeacon',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'document.cookie',
  ];
  for (const token of forbiddenTokens) {
    if (text.includes(token)) {
      throw new Error(`Guitar TAB Editor browser bundle contains forbidden capability token: ${token}`);
    }
  }
  if (!text.includes(GUITAR_TAB_EDITOR_RUNTIME_GLOBAL)) {
    throw new Error('Guitar TAB Editor browser bundle does not expose the required runtime global.');
  }

  const manifest = Object.freeze({
    contract: GUITAR_TAB_EDITOR_BROWSER_CONTRACT,
    version: GUITAR_TAB_EDITOR_BROWSER_VERSION,
    runtimeVersion: GUITAR_TAB_EDITOR_RUNTIME_VERSION,
    bundler: Object.freeze({ package: 'esbuild', version: '0.28.2', license: 'MIT' }),
    artifact: GUITAR_TAB_EDITOR_ARTIFACT,
    format: 'iife',
    target: 'es2022',
    global: GUITAR_TAB_EDITOR_RUNTIME_GLOBAL,
    externalImports: 0,
    networkCapable: false,
    persistenceCapable: false,
    rendererAuthority: false,
    sourceMutationAuthority: false,
    serverRevisionAuthority: false,
    approvalAuthority: false,
    publicationAuthority: false,
    bytes: artifact.byteLength,
    sha256: sha256(artifact),
  });

  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return Object.freeze({ artifact: outFile, manifest: manifestFile, metadata: manifest });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildBrowserRuntime();
  console.log(`GTAB-09A browser runtime: PASS (${result.metadata.bytes} bytes, sha256 ${result.metadata.sha256})`);
}
