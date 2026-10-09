import zasadyJavaScript from '@eslint/js';
import globalneNazwy from 'globals';
import zasadyTypeScript from 'typescript-eslint';

export default zasadyTypeScript.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'] },
  zasadyJavaScript.configs.recommended,
  ...zasadyTypeScript.configs.recommended,
  { files: ['**/*.ts'], languageOptions: { globals: globalneNazwy.node } },
);
