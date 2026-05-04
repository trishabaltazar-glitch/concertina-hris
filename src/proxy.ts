import { NextRequest, NextResponse } from "next/server";
import { auth } from "./auth";

// Protect all routes under /admin, /leaves, /timesheets, and the root / dashboard
const protectedRoutes = ["/", "/timesheets", "/leaves", "/admin/leaves"];

export default auth((req) => {
    const { nextUrl } = req;
    const isLoggedIn = !!req.auth;

    const isProtectedRoute = protectedRoutes.some(route =>
        nextUrl.pathname === route || nextUrl.pathname.startsWith(`${route}/`)
    );

    if (!isLoggedIn && isProtectedRoute) {
        if (nextUrl.pathname === "/login") {
            return; // already on login page
        }
        const redirectUrl = new URL("/login", nextUrl.origin);
        redirectUrl.searchParams.set("callbackUrl", nextUrl.pathname);
        return NextResponse.redirect(redirectUrl);
    }

    // Redirect users who are already logged in away from the login page
    if (isLoggedIn && nextUrl.pathname === "/login") {
        return NextResponse.redirect(new URL("/", nextUrl.origin));
    }

    // Role-based protection for /admin routes
    if (isLoggedIn && nextUrl.pathname.startsWith("/admin")) {
        const userRole = (req.auth?.user as any)?.role;
        
        // 1. Block regular employees entirely from /admin
        if (userRole !== "ADMIN" && userRole !== "MANAGER") {
            return NextResponse.redirect(new URL("/", nextUrl.origin));
        }

        // 2. Strict Supervisor (MANAGER) Restrictions
        // Managers handle team tasks (Leaves, Reports, Schedules), but NOT global system settings.
        if (userRole === "MANAGER") {
            const restrictedManagerRoutes = ["/admin/holidays", "/admin/announcements"];
            const isRestricted = restrictedManagerRoutes.some(route => 
                nextUrl.pathname === route || nextUrl.pathname.startsWith(`${route}/`)
            );
            
            if (isRestricted) {
                return NextResponse.redirect(new URL("/", nextUrl.origin));
            }
        }
    }

    return;
});

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
