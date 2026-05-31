import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  // Dual build. This package has no transitive ESM-only @rello-platform import,
  // so a real CJS build is safe (Guard-Kit §8 lesson 1 / pin-convention §7
  // ESM-only-crash class does NOT apply — there is nothing for require() to fold
  // into a throwing require). dist/index.cjs is what a Milo CJS consumer (P5)
  // require()s; dist/index.js is the ESM entry.
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: "es2020",
  outDir: "dist",
  // Emit the cross-language keyset (dist/compliance-words-keyset.json) after the
  // JS/d.ts bundles land — it imports the built dist/index.js. Guard-Kit §7.
  onSuccess: "node scripts/emit-keyset.mjs",
});
