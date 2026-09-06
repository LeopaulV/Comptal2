// Types du didacticiel interactif et des présentations de page.

export interface TourStep {
  id: string;
  route: string;
  target: string | null;
  titleKey: string;
  bodyKey: string;
}

export interface PageIntro {
  route: string;
  titleKey: string;
  bodyKey: string;
}

export interface OnboardingProgress {
  tourCompleted: boolean;
  seenPageIntros: string[];
}

export function parseTourRoute(route: string): { pathname: string; search: string } {
  const q = route.indexOf('?');
  if (q === -1) {
    return { pathname: route, search: '' };
  }
  return { pathname: route.slice(0, q), search: `?${route.slice(q + 1)}` };
}

export function locationMatchesTourRoute(
  route: string,
  pathname: string,
  search: string
): boolean {
  const expected = parseTourRoute(route);
  if (pathname !== expected.pathname) {
    return false;
  }
  if (!expected.search) {
    return true;
  }
  const expectedParams = new URLSearchParams(expected.search);
  const actualParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const [key, value] of expectedParams.entries()) {
    if (actualParams.get(key) !== value) {
      return false;
    }
  }
  return true;
}
