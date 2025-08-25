import { db } from "@/database/client";
import { filesTable } from "@/database/schema";
import { FileTypeType } from "@/types/file-type";
import { eq, desc, and, count, inArray } from "drizzle-orm";

export class FileService {
  static async getFile(cid: string) {
    const [result] = await db
      .select()
      .from(filesTable)
      .where(eq(filesTable.cid, cid));

    return result;
  }

  static async getFiles(options: {
    page?: number;
    pageSize?: number;
    cid?: string;
    types?: FileTypeType[];
    uploaderId?: string;
  }) {
    const { page = 1, pageSize = 10, cid, types, uploaderId } = options;
    const offset = (page - 1) * pageSize;
    const conditions = [];

    if (cid) {
      conditions.push(eq(filesTable.cid, cid));
    }
    if (types) {
      conditions.push(inArray(filesTable.type, types));
    }
    if (uploaderId) {
      conditions.push(eq(filesTable.uploaderId, uploaderId));
    }

    let query = db
      .select({
        cid: filesTable.cid,
        sha256: filesTable.sha256,
        type: filesTable.type,
        uploaderId: filesTable.uploaderId,
        uploadedAt: filesTable.createdAt,
      })
      .from(filesTable)
      .orderBy(desc(filesTable.createdAt))
      .limit(pageSize)
      .offset(offset)
      .$dynamic();

    let totalCountQuery = db
      .select({ count: count() })
      .from(filesTable)
      .$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
      totalCountQuery = totalCountQuery.where(and(...conditions));
    }

    const [results, totalResult] = await Promise.all([query, totalCountQuery]);

    return {
      results,
      total: totalResult[0]?.count ?? 0,
    };
  }
}

export type GetFilesOptions = Parameters<(typeof FileService)["getFiles"]>[0];

export type FileListItem = Awaited<
  ReturnType<(typeof FileService)["getFiles"]>
>["results"][number];
