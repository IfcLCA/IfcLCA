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
  "/site.webmanifest",
  "/robots.txt",
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
  const { pathname } = request.nextUrl;

  // Allow public routes - check these FIRST before calling auth()
  if (
    publicRoutes.some((route) => pathname === route || pathname.startsWith(route + "/"))
  ) {
    return NextResponse.next();
  }

  // Get auth only for routes that need it
  const { userId } = await auth();

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

// Matcher pattern - exclude static files and Next.js internals
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, manifests, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest|xml|txt)$).*)",
  ],
};
