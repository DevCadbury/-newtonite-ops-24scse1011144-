import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken, sessionCookieOptions, COOKIE_NAME } from "@/lib/auth";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, passwordHash: true },
  });

  // Constant-time comparison to prevent timing attacks
  const hash = user?.passwordHash ?? "$2b$10$invalidhashfortimingreasons";
  const valid = await bcrypt.compare(password, hash);

  if (!user || !valid) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const token = await signToken({
    sub: user.id,
    name: user.name,
    email: user.email,
  });

  const opts = sessionCookieOptions();
  const response = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email },
  });
  response.cookies.set(COOKIE_NAME, token, opts);
  return response;
}
