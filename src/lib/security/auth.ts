import { cookies } from "next/headers";
import { compare, hash } from "bcryptjs";
import { SESSION_COOKIE, SESSION_MAX_LIFETIME_MS, SESSION_TTL_MS } from "@/lib/security/constants";
import { createToken, sha256 } from "@/lib/security/hash";
import { prisma } from "@/lib/prisma";

export async function hashPassword(password: string) {
  return hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

export async function createSession(userId: string) {
  const token = createToken();
  const tokenHash = sha256(token);
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      lastSeenAt: new Date(now),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: {
        tokenHash: sha256(token),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  const session = await prisma.session.findFirst({
    where: {
      tokenHash: sha256(token),
      revokedAt: null,
    },
    include: {
      user: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  if (!session || !session.user.isActive) {
    return null;
  }

  const now = new Date();
  const absoluteExpiry = new Date(session.createdAt.getTime() + SESSION_MAX_LIFETIME_MS);
  if (session.expiresAt <= now || absoluteExpiry <= now) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: now },
    }).catch(() => null);
    cookieStore.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(0),
    });
    return null;
  }

  // Refresh session window at 4-hour cadence while honoring absolute 7-day max.
  const shouldRefresh =
    !session.lastSeenAt || (now.getTime() - session.lastSeenAt.getTime()) >= SESSION_TTL_MS;
  if (shouldRefresh) {
    const nextExpiry = new Date(Math.min(now.getTime() + SESSION_TTL_MS, absoluteExpiry.getTime()));
    await prisma.session.update({
      where: {
        id: session.id,
      },
      data: {
        lastSeenAt: now,
        expiresAt: nextExpiry,
      },
    });
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: nextExpiry,
    });
  }

  return session.user;
}
