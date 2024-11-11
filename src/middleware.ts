import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const protectedRoutes = createRouteMatcher([
  "/dashboard(.*)",
  "/forum(.*)",
  "/projects(.*)",
  "/materials(.*)",
  "/settings(.*)",
  "/reports(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  if (userId) {
    const hasAcceptedTerms = req.cookies.get("terms_accepted");
    const isProtected = protectedRoutes(req);

    if (!hasAcceptedTerms && isProtected) {
      const url = new URL("/", req.url);
      url.searchParams.set("redirect", req.url);
      return NextResponse.redirect(url);
    }
  }

  if (!userId && protectedRoutes(req)) {
    return auth.redirectToSignIn({ returnBackUrl: req.url });
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
