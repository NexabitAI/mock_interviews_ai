import { NextResponse } from "next/server";

export async function POST() {
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    // domain: ".yourdomain.com", // include ONLY if you set it at login
  });
  return res;
}
