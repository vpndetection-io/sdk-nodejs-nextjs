import { lib, typeChecked } from "@mslmio/eslint-config";

export default [
  { ignores: ["dist/**", "node_modules/**", "spec/**", "integration/**", "test/edge/**", "src/generated/**", "**/*.gen.ts"] },
  ...lib,
  typeChecked(import.meta.dirname),
  {
    // The README's apiKey: process.env pattern is what a test proves; the suite is not the library.
    files: ["test/**"],
    rules: { "mslmio/no-lib-process-env": "off" },
  },
];
