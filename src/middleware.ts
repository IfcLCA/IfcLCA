import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define protected routes
const protectedRoutes = createRouteMatcher([
  "/api/projects/(.*)", // Protect all project API routes
  "/dashboard(.*)",
  "/projects(.*)",
  "/materials(.*)",
  "/settings(.*)",
  "/reports(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  console.log("Middleware processing:", {
    path: req.nextUrl.pathname,
    method: req.method,
  });

  const { userId } = await auth();

  // Handle API routes
  if (req.nextUrl.pathname.startsWith("/api/")) {
    if (!userId) {
      console.log("Unauthorized API access attempt");
      return NextResponse.json(
        { error: "Please sign in to continue" },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // Handle protected routes
  if (protectedRoutes(req)) {
    if (!userId) {
      return auth.redirectToSignIn({ returnBackUrl: req.url });
    }

    // Check terms acceptance for non-API routes
    const hasAcceptedTerms = req.cookies.get("terms_accepted");
    if (!hasAcceptedTerms) {
      const url = new URL("/", req.url);
      url.searchParams.set("redirect", req.url);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
