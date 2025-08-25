import { PubMedRawRSSArticle, PubMedRSSArticle } from "../types";
import { XMLParser } from "fast-xml-parser";
import * as cheerio from "cheerio";

export function parseRawRSSArticle(
  article: PubMedRawRSSArticle
): PubMedRSSArticle {
  const $ = cheerio.load(article["content:encoded"]);
  const elements = $("p");
  const texts: string[] = [];
  let paragraphs: Record<string, string> = {};

  elements.each((i, el) => {
    // Skip first paragraph, it only includes string version of some metadata
    if (i === 0) return;

    const text = $(el).text().trim();

    // Those paragraphs don't include any useful information
    if (
      text === "" ||
      text === "ABSTRACT" ||
      text.startsWith("PMID:") ||
      text.startsWith("DOI:")
    ) {
      return;
    }
    texts.push(text);
  });

  const parseParagraphTitle = (text: string) => {
    const paragraphRegex = /^([A-Z|\s]+):\s*(.*)/;
    const match = text.match(paragraphRegex);
    return match;
  };

  if (parseParagraphTitle(texts[0])) {
    texts.forEach((text) => {
      const match = parseParagraphTitle(text);
      if (match) {
        paragraphs[match[1].trim()] = match[2].trim();
      } else {
        paragraphs[`RAW`] = `${paragraphs[`RAW`] ?? ""} ${text}`;
      }
    });
  } else {
    paragraphs = {
      RAW: texts.join(" "),
    };
  }

  return {
    pmid: article.guid,
    title: article.title,
    paragraphs,
  };
}

export async function parseRSSFeed(rssData: string) {
  const parser = new XMLParser();
  const rss = parser.parse(rssData).rss.channel.item;
  const entries: PubMedRawRSSArticle[] = Array.isArray(rss) ? rss : [rss];

  return entries;
}

export async function parseRSSFeedFromURL(url: string) {
  const rssResponse = await fetch(url);
  const rssData = await rssResponse.text();
  return await parseRSSFeed(rssData);
}

export function isRawEntry(
  entry: PubMedRSSArticle | PubMedRawRSSArticle
): entry is PubMedRawRSSArticle {
  return "guid" in entry;
}
