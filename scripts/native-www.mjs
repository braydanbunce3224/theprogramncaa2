#!/usr/bin/env node
import { copyFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const client = join(process.cwd(), "native/www/client");
const shell = join(client, "_shell.html");
const index = join(client, "index.html");
if (!existsSync(shell)) {
  console.error("missing native/www/client/_shell.html");
  process.exit(1);
}
let html = readFileSync(shell, "utf8");
html = html.replaceAll("/./assets/", "./assets/");
html = html.replaceAll('href="/favicon.svg"', 'href="./favicon.svg"');
html = html.replaceAll('href="/__grok/', 'href="./__grok/');
html = html.replaceAll('src="/./assets/', 'src="./assets/');
writeFileSync(index, html);
const privacySrc = join(process.cwd(), "public/privacy.html");
if (existsSync(privacySrc)) copyFileSync(privacySrc, join(client, "privacy.html"));
writeFileSync(
  join(client, ".htaccess"),
  `DirectoryIndex index.html
Options -MultiViews
AddType application/javascript .js
AddType text/css .css
AddType image/svg+xml .svg
<IfModule mod_mime.c>
  AddType font/woff2 .woff2
  AddType font/woff .woff
</IfModule>
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  # Serve this folder. Do not forward the domain to grok.me.
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
`,
);
console.log("native www index.html ready");
