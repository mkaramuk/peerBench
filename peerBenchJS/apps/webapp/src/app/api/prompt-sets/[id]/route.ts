import { withAuth } from "@/middleware";
import { PromptSetService } from "@/services/promptset.service";
import { NextRequest, NextResponse } from "next/server";

export const revalidate = 0;

export const GET = withAuth(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const id = (await params).id;
    const promptSet = await PromptSetService.getPromptSet({ id: Number(id) });

    return NextResponse.json(promptSet);
  }
);
