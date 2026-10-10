# Security notes

Audited on 2026-10-10. No authentication, database, payment processing, or private API is implemented in this repository. Contact links hand off to the visitor's own email, phone or messaging application. No submitted contact data is sent to an application server.

Next.js and its ESLint configuration are pinned to security patch 16.3.8; Sharp and source-map-js are patched in the lockfile. The serve preview server uses a scoped compression override for patched 1.8.2. 

The remaining npm audit finding is [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), braces stack exhaustion through malicious nested glob patterns. The five reported packages are one transitive development-tool chain through eslint-config-next, fast-glob and micromatch, not five independent vulnerabilities. There is no published patched braces release as of this audit. Glob patterns in this app are repository-controlled; no web request is forwarded to these tools. Do not run lint/build tools against untrusted repository content in a privileged environment. Keep the audit enabled so a future compatible patch is detected. Downgrading the Next.js ESLint config to version 14 is not a safe automatic remediation.

This is a static export: Next.js response headers are not used by static hosts. public/_headers is copied to out/_headers for the documented Cloudflare Pages deployment. It denies framing and plugins, restricts base URLs, and sets MIME, referrer and browser-permission headers. Local serve does not apply Cloudflare _headers rules.

Environment files are ignored by Git. Browser-exposed NEXT_PUBLIC_ and VITE_ variables must contain only public configuration. Ignore rules do not remove any previously committed files; the working tree and full fetched history were scanned separately.
