import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, "../public/data/upcoming-events.json");
const now = new Date();
const today = now.toISOString().slice(0, 10);

const sources = {
  fomc: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
  fedCalendar: "https://www.federalreserve.gov/newsevents/calendar.htm",
  bojMeetings: "https://www.boj.or.jp/en/mopo/mpmsche_minu/",
  bojSpeeches: "https://www.boj.or.jp/en/about/press/index.htm",
  treasury:
    "https://home.treasury.gov/policy-issues/financing-the-government/quarterly-refunding/most-recent-quarterly-refunding-documents"
};

const monthNumbers = new Map(
  ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month, index) => [
    month.toLowerCase(),
    index + 1
  ])
);

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "global-liquidity-monitor/1.0 (public research dashboard)" },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`${url} failed: ${response.status}`);
  return response.text();
}

function cleanHtml(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function isoDate(year, monthName, day) {
  const month = monthNumbers.get(monthName.slice(0, 3).toLowerCase());
  if (!month) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addEvent(events, event) {
  if (!event.date || event.date < today) return;
  events.push(event);
}

function parseFomc(html, events) {
  const sections = [...html.matchAll(/<h4><a[^>]*>(20\d{2}) FOMC Meetings<\/a><\/h4>([\s\S]*?)(?=<h4><a[^>]*>20\d{2} FOMC Meetings|$)/g)];
  for (const [, yearText, section] of sections) {
    const year = Number(yearText);
    for (const match of section.matchAll(/fomc-meeting__month[^>]*><strong>([^<]+)<\/strong><\/div>\s*<div class="fomc-meeting__date[^>]*>([^<]+)<\/div>/g)) {
      const month = cleanHtml(match[1]);
      const days = cleanHtml(match[2]).replace("*", "").match(/\d+/g)?.map(Number) ?? [];
      const startDate = isoDate(year, month, days[0]);
      const endDate = isoDate(year, month, days.at(-1));
      addEvent(events, {
        id: `fomc-${startDate}`,
        date: startDate,
        endDate,
        region: "美国",
        category: "议息会议",
        importance: "high",
        title: "FOMC 利率决议",
        detail: match[2].includes("*") ? "公布利率决定、声明及经济预测" : "公布利率决定与政策声明",
        source: "Federal Reserve",
        sourceUrl: sources.fomc
      });
    }
  }
}

function parseBojMeetings(html, events) {
  const year = Number(html.match(/<h2[^>]*>(20\d{2})<\/h2>/)?.[1] ?? now.getUTCFullYear());
  const table = html.match(new RegExp(`<h2[^>]*>${year}<\\/h2>([\\s\\S]*?)<h2`, "i"))?.[1] ?? html;
  for (const row of table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const firstCell = row[1].match(/<td[^>]*>([\s\S]*?)<\/td>/)?.[1];
    if (!firstCell) continue;
    const text = cleanHtml(firstCell);
    const dateMatch = text.match(/([A-Z][a-z]+)\.?\s+(\d{1,2})[^,]*,\s*(\d{1,2})/);
    if (!dateMatch) continue;
    const startDate = isoDate(year, dateMatch[1], Number(dateMatch[2]));
    const endDate = isoDate(year, dateMatch[1], Number(dateMatch[3]));
    addEvent(events, {
      id: `boj-mpm-${startDate}`,
      date: startDate,
      endDate,
      region: "日本",
      category: "议息会议",
      importance: "high",
      title: "BOJ 金融政策决议",
      detail: "会议结束后公布政策决定；行长通常举行记者会",
      source: "Bank of Japan",
      sourceUrl: sources.bojMeetings
    });
  }
}

function parseBojSpeeches(html, events) {
  const section = html.match(/Scheduled Dates of Upcoming Speeches([\s\S]*?)(?=<h2|<!-- \[END\] CONTENT_2)/)?.[1] ?? "";
  for (const row of section.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => cleanHtml(match[1]));
    const dateMatch = cells[0]?.match(/([A-Z][a-z]+)\.?\s+(\d{1,2}),\s*(20\d{2})/);
    if (!dateMatch || cells.length < 3) continue;
    const date = isoDate(Number(dateMatch[3]), dateMatch[1], Number(dateMatch[2]));
    addEvent(events, {
      id: `boj-speech-${date}-${cells[1].toLowerCase().replace(/\W+/g, "-")}`,
      date,
      region: "日本",
      category: "官员讲话",
      importance: /,\s*Governor$/i.test(cells[1]) ? "high" : "medium",
      title: cells[1],
      detail: cells[2],
      source: "Bank of Japan",
      sourceUrl: sources.bojSpeeches
    });
  }
}

function parseFedSpeeches(html, events, year, monthName, sourceUrl) {
  const chunks = html.split(/<div class="panel panel-unstyled/).slice(1);
  for (const chunk of chunks) {
    if (!/Speech - /i.test(chunk)) continue;
    const speaker = cleanHtml(chunk.match(/Speech - ([\s\S]*?)<\/p>/i)?.[1] ?? "");
    const title = cleanHtml(chunk.match(/calendar__title[^>]*><em>([\s\S]*?)<\/em>/i)?.[1] ?? "");
    const dayMatches = [...chunk.matchAll(/<p>\s*(\d{1,2})\s*<\/p>/g)];
    const day = Number(dayMatches.at(-1)?.[1]);
    if (!speaker || !title || !day) continue;
    const date = isoDate(year, monthName, day);
    addEvent(events, {
      id: `fed-speech-${date}-${speaker.toLowerCase().replace(/\W+/g, "-")}`,
      date,
      region: "美国",
      category: "官员讲话",
      importance: /Chair(?! for Supervision)|Chairman/i.test(speaker) ? "high" : "medium",
      title: speaker,
      detail: title,
      source: "Federal Reserve",
      sourceUrl
    });
  }
}

function parseTreasury(html, events) {
  const description = cleanHtml(html.match(/<meta property="og:description" content="([^"]+)"/)?.[1] ?? "");
  const dates = [...description.matchAll(/next release is scheduled for ([A-Z][a-z]+) (\d{1,2}), (20\d{2})/gi)];
  const titles = ["财政部季度融资预估", "美债季度再融资声明"];
  for (let index = 0; index < Math.min(2, dates.length); index += 1) {
    const date = isoDate(Number(dates[index][3]), dates[index][1], Number(dates[index][2]));
    addEvent(events, {
      id: `treasury-refunding-${index}-${date}`,
      date,
      region: "美国",
      category: "美债供给",
      importance: "high",
      title: titles[index],
      detail: index === 0 ? "更新未来一个季度的市场化借款需求" : "公布券种、期限与发行规模安排",
      source: "U.S. Treasury",
      sourceUrl: sources.treasury
    });
  }
}

async function main() {
  const events = [];
  const failures = [];
  const jobs = [
    [sources.fomc, parseFomc],
    [sources.bojMeetings, parseBojMeetings],
    [sources.bojSpeeches, parseBojSpeeches],
    [sources.treasury, parseTreasury]
  ];

  for (let offset = 0; offset < 3; offset += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    const year = date.getUTCFullYear();
    const monthName = date.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
    const url = `https://www.federalreserve.gov/newsevents/${year}-${monthName.toLowerCase()}.htm`;
    jobs.push([url, (html, target) => parseFedSpeeches(html, target, year, monthName, url)]);
  }

  await Promise.all(
    jobs.map(async ([url, parser]) => {
      try {
        parser(await fetchText(url), events);
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    })
  );

  const uniqueEvents = [...new Map(events.map((event) => [event.id, event])).values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 12);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), timezone: "Asia/Shanghai", events: uniqueEvents, failures }, null, 2)}\n`
  );
  console.log(`Wrote ${outputPath} (${uniqueEvents.length} events)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
