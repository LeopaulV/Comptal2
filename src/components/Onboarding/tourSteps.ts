import { TourStep } from '../../types/onboarding';

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    route: '/dashboard',
    target: null,
    titleKey: 'onboarding.tour.welcome.title',
    bodyKey: 'onboarding.tour.welcome.body',
  },
  {
    id: 'language',
    route: '/parametre?tab=general',
    target: 'onb-language',
    titleKey: 'onboarding.tour.language.title',
    bodyKey: 'onboarding.tour.language.body',
  },
  {
    id: 'window-mode',
    route: '/parametre?tab=general',
    target: 'onb-window-mode',
    titleKey: 'onboarding.tour.windowMode.title',
    bodyKey: 'onboarding.tour.windowMode.body',
  },
  {
    id: 'profile',
    route: '/parametre?tab=profiles',
    target: 'onb-profile-create',
    titleKey: 'onboarding.tour.profile.title',
    bodyKey: 'onboarding.tour.profile.body',
  },
  {
    id: 'account',
    route: '/parametre?tab=accounts',
    target: 'onb-account-create',
    titleKey: 'onboarding.tour.account.title',
    bodyKey: 'onboarding.tour.account.body',
  },
  {
    id: 'category',
    route: '/parametre?tab=categories',
    target: 'onb-category-create',
    titleKey: 'onboarding.tour.category.title',
    bodyKey: 'onboarding.tour.category.body',
  },
  {
    id: 'upload',
    route: '/upload',
    target: 'onb-upload-dropzone',
    titleKey: 'onboarding.tour.upload.title',
    bodyKey: 'onboarding.tour.upload.body',
  },
  {
    id: 'edition',
    route: '/edition',
    target: 'onb-edition-table',
    titleKey: 'onboarding.tour.edition.title',
    bodyKey: 'onboarding.tour.edition.body',
  },
  {
    id: 'dashboard',
    route: '/dashboard',
    target: 'onb-dashboard-header',
    titleKey: 'onboarding.tour.dashboard.title',
    bodyKey: 'onboarding.tour.dashboard.body',
  },
];

export const TOUR_STEP_COUNT = TOUR_STEPS.length;
