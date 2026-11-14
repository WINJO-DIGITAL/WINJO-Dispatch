import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

// Next's own flat presets: core web vitals (react, react-hooks, next) and
// typescript-eslint.
const eslintConfig = [
  { ignores: ['.next/', 'node_modules/', 'next-env.d.ts', 'public/driver/sw.js', 'supabase/functions/'] },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // React Compiler checks: report without blocking until each screen is fixed.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/static-components': 'warn',
      'react/no-unescaped-entities': 'off',
    },
  },
]

export default eslintConfig
