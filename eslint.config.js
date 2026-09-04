import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    // design_handoff_cashu_player enthaelt Entwuerfe, keinen App-Code. Der
    // Handoff sagt ausdruecklich: die HTML-Prototypen und support.js sind
    // Referenz und gehen nicht in die App. Sie halten die Regeln der App
    // deshalb auch nicht ein.
    ignores: ['dist', 'node_modules', 'coverage', 'design_handoff_cashu_player', 'design_handoff_podcast_nav'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022 },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // NR-04: keine Proofs in Konsolenausgaben.
      'no-console': 'error',
    },
  },
  {
    files: ['test/**/*.ts', 'test/**/*.tsx', 'tools/**/*.ts', 'tools/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
);
