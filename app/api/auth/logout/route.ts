import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Always redirect to production sign-in
  const res = NextResponse.redirect("https://prepwisebot.pro/sign-in", {
    status: 303,
  });

  // Clear session cookie
  res.cookies.set("session", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res;
}