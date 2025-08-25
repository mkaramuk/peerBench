import { type NextRequest, NextResponse } from "next/server";
import { PromptSetService } from "@/services/promptset.service";
import { z } from "zod";
import { withAuth } from "@/middleware";
import { type AuthResult } from "@/utils/auth";

export const revalidate = 0;

const querySchema = z.object({
  ownerId: z.string().optional(),
  page: z.coerce.number().optional().default(0),
  pageSize: z.coerce.number().optional().default(100),
});

async function getHandler(request: NextRequest) {
  // Validate the request parameters
  const searchParams = request.nextUrl.searchParams;
  const validation = querySchema.safeParse({
    ownerId: searchParams.get("ownerId") || undefined,
    page: searchParams.get("page") || undefined,
    pageSize: searchParams.get("pageSize") || undefined,
  });

  if (!validation.success) {
    return NextResponse.json(
      { message: validation.error.message, error: validation.error.issues },
      { status: 400 }
    );
  }

  // Get the prompt sets
  const promptSets = await PromptSetService.getPromptSetList({
    ownerId: validation.data.ownerId,
    page: validation.data.page,
    pageSize: validation.data.pageSize,
  });

  // Return the prompt sets as JSON
  return NextResponse.json(promptSets);
}

// Body schema for creating a new prompt set
const bodySchema = z.object({
  title: z.string().min(3),
  description: z.string().default("N/A"),
});

async function postHandler(request: NextRequest, _: unknown, auth: AuthResult) {
  // Validate the request body
  const body = await request.json();
  const validation = bodySchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { message: validation.error.message },
      { status: 400 }
    );
  }

  // Create a new prompt set
  const promptSet = await PromptSetService.createNewPromptSet({
    title: validation.data.title,
    description: validation.data.description,
    ownerId: auth.userId,
  });

  return NextResponse.json(promptSet);
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
