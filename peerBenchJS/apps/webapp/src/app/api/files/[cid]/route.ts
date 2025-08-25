import { NextRequest, NextResponse } from "next/server";
import { FileService } from "@/services/file.service";
import { withAuth } from "@/middleware";

export const revalidate = 0;

/**
 * Retrieves a test result by CID.
 */
export const GET = withAuth(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ cid: string }> }
  ) => {
    try {
      const cid = (await params).cid;
      const result = await FileService.getFile(cid);

      if (!result) {
        return NextResponse.json(
          { message: "Audit file not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        data: result.content,
        cid,
      });
    } catch (error) {
      console.error("Error fetching test result:", error);
      return NextResponse.json(
        { message: "Internal server error" },
        { status: 500 }
      );
    }
  }
);
