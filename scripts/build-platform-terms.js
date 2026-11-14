#!/usr/bin/env node
'use strict';
// Builds platform-terms.html (the page an applicant reads before accepting) from the legal
// documents in docs/legal. Run: npm run build:terms. A test fails if the committed page is out of
// step with the documents, so the page can never drift from what the applicant accepted.
//
// Left out of the public page on purpose: the contract's worked example for another business
// (a named person's address and phone), its "fill in before first use" checklist and its build
// notes. Nothing in the documents is reworded here.

const fs = require('fs');
const path = require('path');
const { render, sections, esc } = require('../lib/markdown');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, 'docs', 'legal', f), 'utf8');

const OMIT_TOP = [/^Fill in before first use$/i, /^Notes on how this was built/i, /^What the owner must fill in or check before use/i];

/** The agreement as published: without the worked example and the internal notes. */
function contractForPage(md) {
  const secs = sections(md).filter((s) => !OMIT_TOP.some((re) => re.test(s.title)));
  return secs.map((s) => {
    if (!/^Order Details/i.test(s.title)) return s.body;
    // Keep the heading and the blank template; drop the "### EV Exec ..." worked example.
    const parts = s.body.split(/^(?=### )/m);
    return parts.filter((p) => !/^### EV Exec/i.test(p)).join('');
  }).join('\n');
}

/** A document without its internal-only sections. */
function omitInternal(md) { return sections(md).filter((s) => !OMIT_TOP.some((re) => re.test(s.title))).map((s) => s.body).join('\n'); }

function titleOf(md) { return (md.match(/^# +(.+)$/m) || [, ''])[1]; }

function build() {
  const contract = read('operator-contract.md');
  const resp = read('operator-responsibilities.md');
  const data = read('operator-data-terms.md');
  const docs = [
    { id: 'agreement', md: contractForPage(contract) },
    { id: 'schedule-a', md: omitInternal(resp) },
    { id: 'data-terms', md: omitInternal(data) },
  ];
  const toc = docs.map((d) => `<li><a href="#${d.id}">${esc(titleOf(d.md))}</a></li>`).join('');
  const body = docs.map((d) => `<section class="doc" id="${d.id}">\n${render(d.md)}\n</section>`).join('\n');
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Operator Services Agreement and related terms</title>
<link rel="stylesheet" href="/public/css/fonts.css">
<link rel="stylesheet" href="/public/css/platform.css">
</head>
<body class="legal">
<header class="bar"><a class="mark" href="/signup">Winjo Digital</a></header>
<main>
<p class="crumb"><a href="/signup">Back to the application</a></p>
<h1 class="doc-title">The terms you accept when you apply</h1>
<p class="lede">Three documents make up the agreement. They are published here exactly as written in the platform's records, and a copy of what you accepted (and when) is kept with your application.</p>
<ol class="toc">${toc}</ol>
${body}
</main>
</body>
</html>
`;
}

module.exports = { build, contractForPage };
if (require.main === module) {
  fs.writeFileSync(path.join(ROOT, 'platform-terms.html'), build());
  console.log('Wrote platform-terms.html');
}
