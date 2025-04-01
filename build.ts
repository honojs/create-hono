import { build } from 'esbuild'

const b = () =>
  build({
    bundle: true,
    entryPoints: ['./src/index.ts'],
    banner: {
      js: '#!/usr/bin/env node --input-type=module',
    },
    platform: 'node',
    outfile: 'bin',
    format: 'esm',
    // For debug
    minify: false,
  })

Promise.all([b()])
