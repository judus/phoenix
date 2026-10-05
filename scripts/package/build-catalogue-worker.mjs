import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

export async function buildCatalogueWorker (outfile) {
  await build({
    bundle: true,
    entryPoints: [fileURLToPath(new URL('../catalogue/refresh.mjs', import.meta.url))],
    format: 'esm',
    legalComments: 'none',
    logLevel: 'warning',
    // jsonc-parser exposes both ESM and UMD. The UMD factory hides relative
    // require calls from the bundler; select its ESM entry for a standalone worker.
    mainFields: ['module', 'main'],
    outfile,
    platform: 'node',
    target: 'node24'
  })
}
