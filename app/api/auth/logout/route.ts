import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/sign-in", req.url), {
    status: 303,
  });
  res.cookies.set("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    // domain: ".yourdomain.com", // include ONLY if you also set it at login
  });
  return res;
}
