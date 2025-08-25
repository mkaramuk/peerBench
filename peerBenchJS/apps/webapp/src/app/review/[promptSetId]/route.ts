import { getPromptIds } from "@/actions/getPromptIds";
import { NextResponse } from "next/server";

export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function GET(
  request: Request,
  options: { params: Promise<{ promptSetId: string }> }
) {
  const params = await options.params;
  const promptIds = await getPromptIds(parseInt(params.promptSetId));

  if (promptIds.length === 0) {
    // If no prompts found, redirect to dashboard
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect to the first prompt
  return NextResponse.redirect(
    new URL(`/review/${params.promptSetId}/${promptIds[0]}`, request.url)
  );
}
