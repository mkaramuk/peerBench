import { db } from "@/database/client";
import { DbRSSArticleInsert, rssArticlesTable } from "@/database/schema";
import { Transaction } from "@/types/db";
import { desc, eq, inArray } from "drizzle-orm";

export class RSSArticleService {
  static async saveArticles(
    articles: DbRSSArticleInsert[],
    options: {
      tx?: Transaction;
    } = {}
  ) {
    const inserted = await (options.tx || db)
      .insert(rssArticlesTable)
      .values(articles)
      .onConflictDoNothing()
      .returning({ id: rssArticlesTable.id });

    return inserted.length;
  }

  static async markAsProcessed(
    articleIds: string[],
    options: {
      tx?: Transaction;
    } = {}
  ) {
    await (options.tx || db)
      .update(rssArticlesTable)
      .set({
        isProcessed: true,
      })
      .where(inArray(rssArticlesTable.id, articleIds));
  }

  static async getUnprocessedArticles() {
    const articles = await db
      .select()
      .from(rssArticlesTable)
      .where(eq(rssArticlesTable.isProcessed, false))
      .orderBy(desc(rssArticlesTable.createdAt))
      .limit(100);

    return articles;
  }
}
