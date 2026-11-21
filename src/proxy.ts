import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("ekanban_session")?.value;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path) || pathname.startsWith("/api/auth/login");

  if (!token && !isPublic) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads/).*)"],
};
