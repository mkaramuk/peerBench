import { PromptSetService } from "@/services/promptset.service";
import { NextResponse } from "next/server";
import { withAuth } from "@/middleware";

export const revalidate = 0;

async function getHandler() {
  const promptSetInfo = await PromptSetService.getAllPromptSetsInfo();

  return NextResponse.json(promptSetInfo);
}

export const GET = withAuth(getHandler);
