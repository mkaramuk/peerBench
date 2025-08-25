import { NextRequest, NextResponse } from "next/server";
import { RSSArticleService } from "@/services/rss-article.service";
import { DbRSSArticleInsert } from "@/database/schema";
import { parseRawRSSArticle, parseRSSFeedFromURL } from "../../functions/rss";
import { sleep } from "@peerbench/sdk";

const RSS_FEEDS = {
  oncology:
    "https://pubmed.ncbi.nlm.nih.gov/rss/search/1XIG91fZAX3ez1ouo6foguxJdZAiIKwx7PHcXWSCaNAmA3kcnG/?limit=20&utm_campaign=pubmed-2&fc=20250604100351",
  inguinalHernia:
    "https://pubmed.ncbi.nlm.nih.gov/rss/search/1NIs-Zi-UW0lwLCaJw0LMRgHg7eiQjZZ7IOhz8fFBDX4A7fEIH/?limit=20&utm_campaign=pubmed-2&fc=20250620083822",
  herniatedDisc:
    "https://pubmed.ncbi.nlm.nih.gov/rss/search/1B98O_JcD-BDUF1t6MEW51NPG6tquy_pQWCPnslJIQD99tWc-o/?limit=50&utm_campaign=pubmed-2&fc=20250620114535",
} as const;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  // Fetch all the feeds related with different contexts
  const keys = Object.keys(RSS_FEEDS) as (keyof typeof RSS_FEEDS)[];
  const feeds = await Promise.all(
    keys.map(async (key) => {
      // Sleep for 1-3 seconds to avoid hitting the rate limit
      await sleep(Math.floor(Math.random() * 3_000));
      const feed = await parseRSSFeedFromURL(RSS_FEEDS[key]);
      console.log(`Fetched ${feed.length} articles from ${key}`);

      return {
        category: key,
        url: RSS_FEEDS[key],
        feed,
      };
    })
  );

  // Expand all the feeds into a single array of articles
  const articles = feeds.flatMap(({ category, url, feed }) => {
    return feed.reduce<DbRSSArticleInsert[]>((arr, rawArticle) => {
      const article = parseRawRSSArticle(rawArticle);

      // Skip articles that don't have paragraphs.
      // If `RAW` field is present that means the paragraphs
      // weren't available and only RAW field was present.
      if (article.paragraphs.RAW) {
        return arr;
      }

      arr.push({
        id: rawArticle.guid,
        content: rawArticle,
        sourceURL: url,
        tags: ["pubmed", category],
      });

      return arr;
    }, []);
  });

  // Save raw version of the articles
  const savedRawArticleCount = await RSSArticleService.saveArticles(articles);
  return NextResponse.json({ topics: keys, newArticles: savedRawArticleCount });
}
