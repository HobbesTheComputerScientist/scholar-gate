import { createHmac, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "rc_local_session";

type LocalUser = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
};

type LocalAuthStore = {
  users: Map<string, LocalUser>;
};

const globalForAuth = globalThis as typeof globalThis & {
  __researchCoachAuth?: LocalAuthStore;
};

function authStore(): LocalAuthStore {
  if (!globalForAuth.__researchCoachAuth) {
    globalForAuth.__researchCoachAuth = { users: new Map() };
  }
  return globalForAuth.__researchCoachAuth;
}

function secret() {
  return process.env.LOCAL_AUTH_SECRET ?? "dev-only-not-for-production";
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 32).toString("hex");
}

export function createLocalUser(email: string, password: string): LocalUser {
  const normalized = email.trim().toLowerCase();
  for (const user of authStore().users.values()) {
    if (user.email === normalized) {
      throw new Error("An account with that email already exists.");
    }
  }
  const id = randomUUID();
  const passwordHash = `${id}:${hashPassword(password, id)}`;
  const user: LocalUser = {
    id,
    email: normalized,
    passwordHash,
    displayName: normalized.split("@")[0] ?? "student",
  };
  authStore().users.set(id, user);
  return user;
}

export function verifyLocalUser(email: string, password: string): LocalUser {
  const normalized = email.trim().toLowerCase();
  const user = [...authStore().users.values()].find(
    (row) => row.email === normalized,
  );
  if (!user) {
    throw new Error("Invalid email or password.");
  }
  const expected = hashPassword(password, user.id);
  const actual = user.passwordHash.split(":")[1] ?? "";
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(actual, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Invalid email or password.");
  }
  return user;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function serializeLocalSession(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId }), "utf8").toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

export function parseLocalSession(token: string | undefined): string | null {
  if (!token) {
    return null;
  }
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { userId?: string };
    return data.userId ?? null;
  } catch {
    return null;
  }
}

export async function setLocalSessionCookie(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE, serializeLocalSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearLocalSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE);
}

export async function readLocalUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return parseLocalSession(cookieStore.get(COOKIE)?.value);
}

export function getLocalUser(userId: string): LocalUser | null {
  return authStore().users.get(userId) ?? null;
}
