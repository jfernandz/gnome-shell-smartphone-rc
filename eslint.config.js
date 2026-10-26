import js from '@eslint/js';
import globals from 'globals';

const gjsGlobals = {
    ARGV: 'readonly', imports: 'readonly', print: 'readonly', printerr: 'readonly',
    log: 'readonly', logError: 'readonly', console: 'readonly',
    TextEncoder: 'readonly', TextDecoder: 'readonly',
};

export default [
    {ignores: ['node_modules/', 'dist/', '.venv/']},
    {
        files: ['**/*.{js,mjs}'],
        ...js.configs.recommended,
        languageOptions: {ecmaVersion: 2022, sourceType: 'module'},
        linterOptions: {reportUnusedDisableDirectives: 'error'},
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': ['error', {argsIgnorePattern: '^_', caughtErrors: 'none'}],
            'eqeqeq': ['error', 'always', {null: 'ignore'}],
            'no-implicit-coercion': 'error',
        },
    },
    {
        files: ['*.js', 'preferences/**/*.js', 'app/*.js', 'scripts/**/*.js', 'tests/*-fixture.js', 'tests/*-native.mjs'],
        ignores: ['eslint.config.js', 'tests/shell-security-native.mjs', 'tests/install-zip-native.mjs', 'tests/network-soak.mjs', 'tests/run-isolated-native.mjs'],
        languageOptions: {globals: gjsGlobals},
    },
    {
        files: ['extension.js', 'focus.js', 'input.js', 'scripts/reload.js', 'scripts/install-zip.js'],
        languageOptions: {globals: {global: 'readonly'}},
    },
    {files: ['app/web/**/*.js'], languageOptions: {globals: globals.browser}},
    {
        files: ['eslint.config.js', 'tests/**/*.test.js', 'tests/cookie-browser.mjs', 'tests/browser-accessibility.mjs', 'tests/shell-security-native.mjs', 'tests/install-zip-native.mjs', 'tests/network-soak.mjs', 'tests/run-isolated-native.mjs'],
        languageOptions: {globals: globals.node},
    },
];
