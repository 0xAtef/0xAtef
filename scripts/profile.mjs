/** Refresh README art with Node 18+: node scripts/profile.mjs [--offline] */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const user = '0xAtef';
const source = `https://github.com/users/${user}/contributions`;
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const dayMs = 86400000;

export function parseContributions(html, end) {
  const tips = new Map();
  for (const match of html.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/g)) {
    const id = match[1].match(/\bfor="([^"]+)"/)?.[1];
    const label = match[2].replace(/<[^>]*>/g, '').trim();
    const count = /^No contributions on /.test(label) ? 0 : Number(label.match(/^([\d,]+) contributions? on /)?.[1].replaceAll(',', ''));
    if (id && Number.isInteger(count)) tips.set(id, count);
  }
  const start = new Date(Date.parse(end) - 364 * dayMs).toISOString().slice(0, 10);
  const days = [];
  for (const match of html.matchAll(/<td\b[^>]*data-date="\d{4}-\d{2}-\d{2}"[^>]*>/g)) {
    const attrs = Object.fromEntries([...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    if (attrs['data-date'] < start || attrs['data-date'] > end) continue;
    const count = tips.get(attrs.id);
    const level = Number(attrs['data-level']);
    if (count === undefined || !Number.isInteger(level) || level < 0 || level > 4) throw new Error('GitHub calendar format changed: missing count or level. Existing assets preserved.');
    days.push({ date: attrs['data-date'], count, level });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  if (days.length !== 365 || days.some((d, i) => i && Date.parse(d.date) - Date.parse(days[i - 1].date) !== dayMs)) {
    throw new Error(`Expected 365 consecutive days; received ${days.length}. Existing assets preserved.`);
  }
  return { user, source, updated: end, days };
}

export function summarize(days) {
  let longest = 0, run = 0;
  for (const day of days) { run = day.count ? run + 1 : 0; longest = Math.max(longest, run); }
  // An unfinished today does not break yesterday's streak.
  let index = days.length - 1;
  if (!days[index]?.count) index--;
  let current = 0;
  while (index >= 0 && days[index--].count) current++;
  return { total: days.reduce((sum, d) => sum + d.count, 0), active: days.filter(d => d.count).length, busiest: days.reduce((a, b) => b.count > a.count ? b : a), longest, current };
}

const colors = ['#182322', '#10583d', '#138448', '#23bc62', '#4aeb88'];
const shade = (color, factor) => '#' + color.slice(1).match(/../g).map(c => Math.round(parseInt(c, 16) * factor).toString(16).padStart(2, '0')).join('');
function text(x, y, value, size = 13, fill = '#9ba9ac', extra = '') {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${escape(value)}</text>`;
}
function frame(height, title, description, content, width = 1000) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${escape(title)}</title><desc id="desc">${escape(description)}</desc>
<style>text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-variant-numeric:tabular-nums}</style>
<rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="18" fill="#0d1315" stroke="#293438"/>
${content.join('\n')}</svg>\n`.replace(/#[\da-f]{6}/gi, color => {
    const [r,g,b] = color.slice(1).match(/../g).map(c => parseInt(c,16));
    const value = Math.round(.2126*r + .7152*g + .0722*b).toString(16).padStart(2,'0');
    return '#' + value.repeat(3);
  });
}
function positions(days) {
  const offset = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
  return days.map((day, i) => ({ ...day, week: Math.floor((i + offset) / 7), row: (i + offset) % 7 }));
}
function legend(x, y) {
  return text(x, y + 9, 'Less', 11) + colors.map((c, i) => `<rect x="${x + 34 + i * 15}" y="${y}" width="10" height="10" rx="2" fill="${c}"/>`).join('') + text(x + 115, y + 9, 'More', 11);
}

export function renderSkyline(snapshot, { compact = false } = {}) {
  const stats = summarize(snapshot.days);
  const days = positions(snapshot.days);
  const max = stats.busiest.count;
  const content = compact ? [
    text(24, 29, 'Contribution skyline', 16, '#dce7e6'),
    text(456, 29, `@${snapshot.user}`, 14, '#9ba9ac', 'text-anchor="end"'),
    text(24, 78, stats.total.toLocaleString('en-US'), 40, '#4aeb88', 'font-weight="650"'),
    text(24, 103, 'contributions over 365 days', 15),
  ] : [text(34, 36, 'Contribution skyline', 17, '#dce7e6'),
    text(34, 80, stats.total.toLocaleString('en-US'), 38, '#4aeb88', 'font-weight="650"'), text(34, 103, 'contributions in the past 365 days', 13),
    text(960, 36, `@${snapshot.user}`, 13, '#dce7e6', 'text-anchor="end"'),
    text(966, 490, `${snapshot.days[0].date} — ${snapshot.updated}`, 11, '#9ba9ac', 'text-anchor="end"')];
  const stat = (x, value, label) => { content.push(text(x, compact ? 145 : 82, value, compact ? 25 : 27, '#e3efec', 'font-weight="600"'), text(x, compact ? 168 : 104, label, compact ? 14 : 13)); };
  stat(compact ? 24 : 510, stats.active, 'active days'); stat(compact ? 180 : 665, `${stats.longest} days`, 'longest streak'); stat(compact ? 340 : 830, stats.busiest.count, 'busiest day');
  if (!compact) content.push('<path d="M34 130H966" stroke="#293438"/>');
  if (compact) content.push('<g transform="translate(-35 98) scale(.5)">');
  // Paint rear cells first so nearer towers occlude them correctly.
  for (const day of [...days].sort((a, b) => (a.week * 3.25 - a.row * 5) - (b.week * 3.25 - b.row * 5))) {
    const x = 120 + day.week * 15 + day.row * 8;
    const y = 215 + day.week * 3.25 - day.row * 5;
    const h = day.count ? 5 + Math.sqrt(day.count / max) * 96 : 1.5;
    const points = [[x,y],[x+7,y-4.3],[x+20.5,y-1.4],[x+13.5,y+2.9]];
    const p = points.map(([a,b]) => [a, b-h]);
    const poly = (pts, fill) => `<polygon points="${pts.map(v=>v.map(n=>n.toFixed(2)).join(',')).join(' ')}" fill="${fill}"/>`;
    content.push(`<g><title>${day.date}: ${day.count} contributions</title>`,
      poly([p[0],p[3],points[3],points[0]], shade(colors[day.level], .57)),
      poly([p[3],p[2],points[2],points[3]], shade(colors[day.level], .8)), poly(p, colors[day.level]), '</g>');
  }
  if (compact) content.push('</g>');
  let lastMonth = '', lastLabelWeek = -4;
  for (const day of days.filter(d => !compact && d.row === 6)) {
    const month = day.date.slice(0, 7);
    if (month !== lastMonth) {
      if (day.week - lastLabelWeek >= 3 && (day.week > 0 || Number(day.date.slice(8)) <= 14)) {
        content.push(text(165 + day.week * 15, 215 + day.week * 3.25 + 18, new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-US', {month:'short', timeZone:'UTC'}), 11));
        lastLabelWeek = day.week;
      }
      lastMonth = month;
    }
  }
  if (compact) content.push(
    text(24, 319, snapshot.days[0].date, 13), text(456, 319, snapshot.updated, 13, '#9ba9ac', 'text-anchor="end"'),
    '<path d="M24 336H456" stroke="#293438"/>',
    text(24, 363, `Snapshot · ${snapshot.updated}`, 14),
    text(24, 385, 'Activity shared on my public GitHub profile.', 13),
  );
  else content.push('<path d="M34 442H966" stroke="#293438"/>', text(34, 470, `Snapshot · ${snapshot.updated}`, 13), text(34, 490, 'Public profile activity, including private counts when shared on GitHub.', 12), legend(815, 467));
  return frame(compact ? 406 : 514, `${snapshot.user} contribution skyline`, `${stats.total} contributions. ${stats.active} active days. Longest streak ${stats.longest} days. Snapshot ${snapshot.updated}.`, content, compact ? 480 : 1000);
}

async function main() {
  const offline = process.argv.includes('--offline');
  let snapshot;
  if (offline) snapshot = JSON.parse(await readFile(resolve(root, 'assets/contributions.json'), 'utf8'));
  else {
    const response = await fetch(source, { headers: { 'User-Agent': '0xAtef-profile-art', Accept: 'text/html' }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}. Existing assets preserved.`);
    const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    snapshot = parseContributions(await response.text(), today);
  }
  const skyline = renderSkyline(snapshot);
  await mkdir(resolve(root, 'assets'), {recursive:true});
  await writeFile(resolve(root, 'assets/contribution-skyline.svg'), skyline);
  await writeFile(resolve(root, 'assets/contribution-skyline-mobile.svg'), renderSkyline(snapshot, {compact:true}));
  if (!offline) await writeFile(resolve(root, 'assets/contributions.json'), JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`Rendered ${snapshot.days.length} days, ${summarize(snapshot.days).total} contributions, snapshot ${snapshot.updated}. No Actions required.`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
