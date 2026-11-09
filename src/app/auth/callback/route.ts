import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const token = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const client = await db();
  const result = code
    ? await client.auth.exchangeCodeForSession(code)
    : token && ["invite", "recovery"].includes(type ?? "")
      ? await client.auth.verifyOtp({
          token_hash: token,
          type: type as "invite" | "recovery",
        })
      : { error: true };
  if (result.error)
    return NextResponse.redirect(new URL("/login?error=session", request.url));
  return NextResponse.redirect(new URL("/auth/password", request.url));
}
