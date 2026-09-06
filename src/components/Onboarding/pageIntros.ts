import { PageIntro } from '../../types/onboarding';

export const PAGE_INTROS: Record<string, PageIntro> = {
  '/finance-global': {
    route: '/finance-global',
    titleKey: 'onboarding.pageIntro.financeGlobal.title',
    bodyKey: 'onboarding.pageIntro.financeGlobal.body',
  },
  '/previsionnel': {
    route: '/previsionnel',
    titleKey: 'onboarding.pageIntro.previsionnel.title',
    bodyKey: 'onboarding.pageIntro.previsionnel.body',
  },
  '/facturation': {
    route: '/facturation',
    titleKey: 'onboarding.pageIntro.facturation.title',
    bodyKey: 'onboarding.pageIntro.facturation.body',
  },
  '/clients': {
    route: '/clients',
    titleKey: 'onboarding.pageIntro.clients.title',
    bodyKey: 'onboarding.pageIntro.clients.body',
  },
  '/dons': {
    route: '/dons',
    titleKey: 'onboarding.pageIntro.dons.title',
    bodyKey: 'onboarding.pageIntro.dons.body',
  },
  '/registre': {
    route: '/registre',
    titleKey: 'onboarding.pageIntro.registre.title',
    bodyKey: 'onboarding.pageIntro.registre.body',
  },
};

export const PAGE_INTRO_ANCHOR = 'page-intro-anchor';

export function pageIntroForPath(pathname: string): PageIntro | null {
  return PAGE_INTROS[pathname] ?? null;
}
