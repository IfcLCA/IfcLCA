import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define public routes that don't require authentication
const publicRoutes = [
  "/",
  "/sign-in",
  "/sign-up",
  "/terms",
  "/privacy",
  "/cookies",
];

// Define protected routes that require authentication
const protectedRoutes = [
  "/dashboard",
  "/projects",
  "/materials",
  "/settings",
  "/reports",
  "/api/projects",
];

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if it's a protected route
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtectedRoute) {
    if (!userId) {
      // For API routes, return 401
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // For other routes, redirect to sign-in
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("redirect_url", request.url);
      return NextResponse.redirect(signInUrl);
    }

    // Check terms acceptance for non-API routes
    if (!pathname.startsWith("/api/")) {
      const hasAcceptedTerms = request.cookies.get("terms_accepted");
      if (!hasAcceptedTerms) {
        const url = new URL("/", request.url);
        url.searchParams.set("redirect", request.url);
        return NextResponse.redirect(url);
      }
    }
  }

  return NextResponse.next();
});

// Fixed matcher pattern
export const config = {
  matcher: [
    "/",
    "/sign-in",
    "/sign-up",
    "/dashboard/:path*",
    "/projects/:path*",
    "/materials/:path*",
    "/settings/:path*",
    "/reports/:path*",
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
