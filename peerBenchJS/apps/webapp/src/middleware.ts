import { MaybePromise } from "@peerbench/sdk";
import { authenticateRequest, type AuthResult } from "@/utils/auth";
import { updateSession } from "./utils/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export function withAuth<T, K>(
  handler: (req: NextRequest, params: K, auth: AuthResult) => MaybePromise<T>
) {
  return async (req: NextRequest, params: K) => {
    const authResult = await authenticateRequest(req);

    if (authResult.error) {
      return NextResponse.json(
        { message: authResult.error.message },
        { status: authResult.error.status }
      );
    }

    return handler(req, params, authResult);
  };
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/ (all API routes)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
