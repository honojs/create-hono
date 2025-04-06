import { build } from 'esbuild'

const b = () =>
  build({
    bundle: true,
    entryPoints: ['./src/index.ts'],
    banner: {
      js: '#!/usr/bin/env node',
    },
    platform: 'node',
    target: 'es2022', // compatible with Node 18
    outfile: 'bin',
    format: 'esm',
    // For debug
    minify: false,
  })

Promise.all([b()])
