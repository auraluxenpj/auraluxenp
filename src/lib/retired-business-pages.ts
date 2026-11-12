const RETIRED_BUSINESS_PAGES = ['/admin/pos', '/admin/khata', '/admin/expenses', '/admin/purchases'] as const;

export function isRetiredBusinessPage(pathname: string): boolean {
  return RETIRED_BUSINESS_PAGES.some(path => pathname === path || pathname.startsWith(`${path}/`));
}