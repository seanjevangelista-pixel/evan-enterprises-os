#!/usr/bin/env node
// Sends finished clips from a ShortsFlow session to Buffer (Instagram, Facebook, TikTok,
// YouTube Shorts, LinkedIn) through the Evan Enterprises OS API.
//
// Works on a ShortsFlow session folder OR any folder of finished videos (for example a Google Drive
// folder synced to your Mac). Without a metadata.json it uses each file name as the title, and picks up
// captions from an optional captions.json in the same folder: [{ "file": "a.mp4", "title": "...",
// "description": "caption text", "tags": ["entrepreneur", "ecommerce"] }].
//
//   node post-clips.mjs SESSION_DIR            drafts in Buffer (nothing goes live)
//   node post-clips.mjs SESSION_DIR --send     add every clip to each channel's Buffer queue
//   node post-clips.mjs SESSION_DIR --send --start 2026-12-01T10:00 --every 180
//                                              schedule clip 1 at 10:00, clip 2 at 13:00, ...
//   --long      full-length videos: YouTube (regular video), Facebook and LinkedIn only
//   --dry-run   show what would happen, send nothing      --only 1,3   just clips 1 and 3
//   --force     post clips again that were already sent   (otherwise posted.json skips them)
//
// For each clip: upload the mp4 to your Supabase media bucket, then call
// /api/integrations?action=buffer&sub=publish-clip with the public link.
//
// Settings (environment, or a .social.env file next to this script / in ~/clipping-studio):
//   INTERNAL_API_KEY  the same value you set in Vercel
//   SITE_URL          default https://evan-enterprises-os.vercel.app
//
// Needs Node 18+. No packages to install.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MAX_BYTES = 300 * 1024 * 1024; // Instagram Reels limit, the tightest of the five networks

function loadEnvFile(p) {
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnvFile(path.join(here, '.social.env'));
loadEnvFile(path.join(os.homedir(), 'clipping-studio', '.social.env'));

export function hashtags(tags, limit = 5) {
  const out = [];
  for (const t of tags || []) {
    const tag = '#' + String(t).replace(/[^\p{L}\p{N}]/gu, '');
    if (tag.length > 1 && !out.some(o => o.toLowerCase() === tag.toLowerCase())) out.push(tag);
    if (out.length >= limit) break;
  }
  return out.join(' ');
}

export function buildCaption(item) {
  const body = (item.description || item.title || '').trim();
  const tags = hashtags(item.tags);
  return tags ? `${body}\n\n${tags}` : body;
}

export function parseArgs(argv) {
  const a = { target: null, send: false, dryRun: false, force: false, long: false, start: null, every: 180, only: null };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--send') a.send = true;
    else if (v === '--dry-run') a.dryRun = true;
    else if (v === '--force') a.force = true;
    else if (v === '--long') a.long = true;
    else if (v === '--start') a.start = argv[++i];
    else if (v === '--every') a.every = parseInt(argv[++i], 10);
    else if (v === '--only') a.only = String(argv[++i]).split(',').map(n => parseInt(n, 10));
    else if (!v.startsWith('--') && !a.target) a.target = v;
    else throw new Error(`Unknown option: ${v}`);
  }
  if (!a.target) throw new Error('Give the session folder (or its metadata.json).');
  if (a.start && Number.isNaN(Date.parse(a.start))) throw new Error('--start must look like 2026-12-01T10:00');
  if (!(a.every > 0)) throw new Error('--every must be a number of minutes');
  if (a.start && !a.send) throw new Error('--start only makes sense with --send (drafts are not scheduled).');
  return a;
}

async function api(base, key, qs, body) {
  const r = await fetch(`${base}/api/integrations?${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-key': key },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok && !d.results) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

async function upload(base, key, file) {
  const filename = path.basename(file).replace(/[^\w.-]+/g, '_');
  const contentType = /\.(mov|qt)$/i.test(file) ? 'video/quicktime' : 'video/mp4';
  const sign = await api(base, key, 'action=media&sub=sign', { filename, contentType });
  const fd = new FormData();
  fd.append('cacheControl', '3600');
  fd.append('', new Blob([fs.readFileSync(file)], { type: contentType }));
  const put = await fetch(sign.signedUrl, { method: 'PUT', body: fd });
  if (!put.ok) throw new Error(`Upload failed (HTTP ${put.status}): ${(await put.text()).slice(0, 200)}`);
  return sign.publicUrl;
}

// A ShortsFlow session has metadata.json. A plain folder of videos doesn't, so build the list from the
// files and any captions.json beside them.
export function loadItems(target) {
  if (!fs.existsSync(target)) throw new Error(`Folder not found: ${target}`);
  const isDir = fs.statSync(target).isDirectory();
  const metaPath = isDir ? path.join(target, 'metadata.json') : target;
  const dir = path.dirname(metaPath);
  if (fs.existsSync(metaPath)) return { dir, items: JSON.parse(fs.readFileSync(metaPath, 'utf8')) };
  if (!isDir) throw new Error(`Not found: ${target}`);
  const capPath = path.join(dir, 'captions.json');
  const caps = fs.existsSync(capPath) ? JSON.parse(fs.readFileSync(capPath, 'utf8')) : [];
  const items = fs.readdirSync(dir)
    .filter(f => /\.(mp4|mov|m4v)$/i.test(f) && !f.startsWith('.'))
    .sort()
    .map(f => {
      const cap = caps.find(c => c.file === f) || {};
      const nice = f.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      return { file: f, title: cap.title || nice, description: cap.description || cap.title || nice, tags: cap.tags || [] };
    });
  return { dir, items };
}

export async function main(argv) {
  const a = parseArgs(argv);
  const base = (process.env.SITE_URL || 'https://evan-enterprises-os.vercel.app').replace(/\/$/, '');
  const key = process.env.INTERNAL_API_KEY;
  if (!key && !a.dryRun) throw new Error('INTERNAL_API_KEY is not set. Put it in .social.env (see setup notes) or export it.');

  const { dir, items } = loadItems(a.target);
  if (!items.length) throw new Error(`No videos (.mp4 / .mov) found in ${dir}.`);
  const ledgerPath = path.join(dir, 'posted.json');
  const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : {};
  const mode = !a.send ? 'drafts in Buffer' : a.start ? 'scheduled' : 'added to the Buffer queue';
  console.log(`${items.length} clip(s) in ${dir} -> ${mode}${a.dryRun ? ' (dry run)' : ''}`);

  let failed = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const n = i + 1;
    if (a.only && !a.only.includes(n)) continue;
    const label = `#${n} ${item.file}`;
    const file = path.join(dir, item.file || '');
    if (!fs.existsSync(file)) { console.log(`${label}: file missing, skipped`); failed++; continue; }
    const size = fs.statSync(file).size;
    if (!a.long && size > MAX_BYTES) { console.log(`${label}: ${(size / 1048576).toFixed(0)} MB is over Instagram's 300 MB limit, skipped`); failed++; continue; }
    if (ledger[item.file]?.ok && !a.force) { console.log(`${label}: already posted, skipped (use --force to post again)`); continue; }

    const due = a.start ? new Date(Date.parse(a.start) + i * a.every * 60000).toISOString() : null;
    const payload = {
      caption: buildCaption(item),
      title: (item.title || '').slice(0, 100) || undefined,
      ...(a.long ? { kind: 'long' } : {}),
      ...(a.send ? {} : { draft: true }),
      ...(due ? { mode: 'customScheduled', due_at: due } : {}),
    };
    if (a.dryRun) { console.log(`${label}: would post "${item.title || ''}"${due ? ' at ' + due : ''}`); continue; }

    try {
      // Reuse the upload if an earlier run got that far but publishing failed.
      const prev = a.force ? undefined : ledger[item.file];
      const url = prev?.url || await upload(base, key, file);
      // A rerun only retries the channels that failed, so the ones that worked aren't posted twice.
      const kept = (prev?.results || []).filter(r => r.ok && r.channel_id);
      const retry = (prev?.results || []).filter(r => !r.ok && r.channel_id).map(r => r.channel_id);
      ledger[item.file] = { url, ok: false, results: kept };
      const d = await api(base, key, 'action=buffer&sub=publish-clip', { ...payload, video_url: url, ...(retry.length && kept.length ? { channel_ids: retry } : {}) });
      const results = [...kept, ...(d.results || [])];
      const bad = (d.results || []).filter(r => !r.ok);
      for (const r of d.results || []) console.log(`${label}: ${r.ok ? 'ok ' : 'FAIL'} ${r.service} (${r.channel})${r.ok ? '' : ' - ' + r.error}`);
      ledger[item.file] = { url, ok: bad.length === 0, at: new Date().toISOString(), results };
      if (bad.length) failed++;
    } catch (e) {
      console.log(`${label}: FAILED - ${e.message}`);
      failed++;
    }
    fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
  }
  console.log(failed ? `Done with ${failed} problem(s). Fix them and run the same command again; finished clips are skipped.` : 'Done.');
  return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(c => process.exit(c), e => { console.error('Error: ' + e.message); process.exit(2); });
}
