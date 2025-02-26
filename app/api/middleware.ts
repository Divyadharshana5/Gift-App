import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Paths that don't require authentication
const publicPaths = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/gifts", // Only GET requests are public
];

// Check if the path is public based on path and method
const isPublic = (path: string, method: string) => {
  if (publicPaths.some((p) => path.startsWith(p))) {
    if (path.startsWith("/api/gifts") && method !== "GET") {
      return false;
    }
    return true;
  }
  return false;
};

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const method = req.method;

  // Skip middleware for public paths
  if (isPublic(path, method)) {
    return NextResponse.next();
  }

  // Check for authenticated session
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || "your-default-secret-key",
  });

  // If no token exists, they are not logged in
  if (!token) {
    // For API routes, return 401
    if (path.startsWith("/api")) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // For page routes, redirect to login
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", encodeURI(req.url));
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
  pages: {
    signIn: "/login",
  },
};
