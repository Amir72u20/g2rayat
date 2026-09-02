import { build } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "dist-standalone");

rmSync(outDir, { recursive: true, force: true });

await build({
  configFile: false,
  root,
  plugins: [viteReact(), tailwindcss()],
  resolve: {
    alias: { "@": join(root, "src") },
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  build: {
    outDir,
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    sourcemap: false,
    minify: true,
    rollupOptions: {
      input: join(root, "standalone.html"),
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "kader.js",
        chunkFileNames: "kader.js",
        assetFileNames: "kader[extname]",
      },
    },
  },
});

const files = readdirSync(outDir);
const jsName = files.find((f) => f.endsWith(".js"));
const cssName = files.find((f) => f.endsWith(".css"));
if (!jsName) throw new Error("standalone js missing");

const js = readFileSync(join(outDir, jsName), "utf8").replace(/<\/script/gi, "<\\/script");
const css = cssName ? readFileSync(join(outDir, cssName), "utf8") : "";

const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0c0d10">
<title>کادر</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Vazirmatn:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
${css}
</style>
</head>
<body>
<div id="root"></div>
<script>
${js}
</script>
</body>
</html>
`;

const dests = [join(root, "public", "kader.html"), join(root, "artifacts", "kader.html")];
mkdirSync(join(root, "public"), { recursive: true });
mkdirSync(join(root, "artifacts"), { recursive: true });
for (const dest of dests) writeFileSync(dest, html);
console.log("wrote", dests.map((d) => d.replace(root + "/", "")).join(", "), "bytes", html.length);
