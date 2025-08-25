import { type NextRequest, NextResponse } from "next/server";
import { EvaluationService } from "@/services/evaluation.service";
import { withAuth } from "@/middleware";
import { z } from "zod";
import { type AuthResult } from "@/utils/auth";

export const revalidate = 0;

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  uploaderId: z.string().optional(),
  providerId: z.number().optional(),
  offerId: z.number().optional(),
  minScore: z.number().optional(),
  maxScore: z.number().optional(),
});

const uploadSchema = z.object({
  auditFiles: z.array(
    z.object({
      commitHash: z.string(),
      content: z.string(),
    })
  ),
});

async function getHandler(request: NextRequest) {
  try {
    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const validationResult = querySchema.safeParse(searchParams);

    if (!validationResult.success) {
      return NextResponse.json(
        { message: validationResult.error.errors[0].message },
        { status: 400 }
      );
    }

    const result = await EvaluationService.getEvaluationsList({
      page: validationResult.data.page,
      pageSize: validationResult.data.pageSize,
      uploaderId: validationResult.data.uploaderId,
      providerId: validationResult.data.providerId,
      offerId: validationResult.data.offerId,
      minScore: validationResult.data.minScore,
      maxScore: validationResult.data.maxScore,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching paginated test results:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

async function postHandler(request: NextRequest, _: unknown, auth: AuthResult) {
  try {
    const body = await request.json();
    const validation = uploadSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          message: `Invalid request data: ${JSON.stringify(
            validation.error.issues
          )}`,
        },
        { status: 400 }
      );
    }

    // Save all test results using the service
    await EvaluationService.saveForestAIEvaluations({
      auditFiles: validation.data.auditFiles,
      uploaderId: auth.userId,
    });

    return NextResponse.json({
      message: "Test results uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading test results:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
