import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Phase 1 legacy-compat: timeline.html relied on Babel's const->var transpile.
// useCallback dep arrays reference functions declared later in App.jsx, which
// throws TDZ under proper ES modules. Applying block-scoping plugin in dev keeps
// the legacy behavior so we can land the Vite shell without rewriting the
// entire ~5000-line App() body. Phases 2-4 will fix individual modules.
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['@babel/plugin-transform-block-scoping'],
      },
    }),
  ],
  server: { port: 19999, strictPort: true, host: '127.0.0.1' },
  build: { sourcemap: true, target: 'es2020' },
});
