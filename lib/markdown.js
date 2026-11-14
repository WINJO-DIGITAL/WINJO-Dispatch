'use strict';
// A small, strict markdown-to-HTML converter for the platform's own legal documents. It supports
// only what those documents use: # headings, paragraphs, - bullets, 1. numbered lists, tables,
// --- rules, **bold** and `code`. Every character of text is HTML-escaped first, so a document can
// never add markup. Not a general markdown engine.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

/** Convert markdown text to HTML. Headings get ids (for links) from their text. */
function render(md) {
  const lines = String(md).replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^(#{1,3}) +(.+)$/))) {
      const n = m[1].length;
      out.push(`<h${n} id="${slugify(m[2])}">${inline(m[2])}</h${n}>`); i++;
    } else if (/^---+$/.test(line.trim())) {
      out.push('<hr>'); i++;
    } else if (line.trim().startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++]);
      const isSep = (r) => cells(r).every((c) => /^:?-{3,}:?$/.test(c));
      const body = rows.filter((r) => !isSep(r));
      const [head, ...rest] = body;
      const hc = cells(head);
      const headEmpty = hc.every((c) => !c);
      out.push(`<table>${headEmpty ? '' : `<thead><tr>${hc.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`}<tbody>${rest.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    } else if (/^[-*] +/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*] +/.test(lines[i])) items.push(lines[i++].replace(/^[-*] +/, ''));
      out.push(`<ul>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`);
    } else if (/^[0-9]+\. +/.test(line)) {
      const items = [];
      while (i < lines.length && /^[0-9]+\. +/.test(lines[i])) items.push(lines[i++].replace(/^[0-9]+\. +/, ''));
      out.push(`<ol>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</ol>`);
    } else {
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,3} |---+$|\||[-*] |[0-9]+\. )/.test(lines[i])) para.push(lines[i++].trim());
      out.push(`<p>${inline(para.join(' '))}</p>`);
    }
  }
  return out.join('\n');
}

/** The markdown split at "## " headings: [{ title, body }]. Text before the first one has title ''. */
function sections(md) {
  const out = [{ title: '', lines: [] }];
  for (const l of String(md).replace(/\r/g, '').split('\n')) {
    const m = l.match(/^## +(.+)$/);
    if (m) out.push({ title: m[1], lines: [l] }); else out[out.length - 1].lines.push(l);
  }
  return out.map((s) => ({ title: s.title, body: s.lines.join('\n') }));
}

module.exports = { render, sections, esc, inline };
