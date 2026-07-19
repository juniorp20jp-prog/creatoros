import { NextRequest, NextResponse } from "next/server";

import { defaultLocale, locales } from "./i18n/config";

function hasLocale(pathname: string) {
  return locales.some(
    (locale) =>
      pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (hasLocale(pathname)) {
    return NextResponse.next();
  }

  const savedLocale = request.cookies.get("creatoros-locale")?.value;

  const locale = locales.includes(savedLocale as (typeof locales)[number])
    ? savedLocale
    : defaultLocale;

  request.nextUrl.pathname = `/${locale}${pathname}`;

  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};