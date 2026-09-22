import { accountApi } from './accountApi';
import { profileService } from './profileService';

/**
 * The parts of Tumbaland a person has turned on for themselves.
 *
 * Only Money so far. It is off by default: a couple's app should not put one
 * person's finances in the menu the other one looks at.
 */
export interface Features {
  showMoney: boolean;
}

/**
 * Announced on `window` after a change, so the shell, which runs this app in
 * the same page, redraws its menu without a reload. The shell listens for the
 * same name in its useShowMoney hook.
 */
export const FEATURES_CHANGED_EVENT = 'tumbaland:features-changed';

export const featuresService = {
  async get(): Promise<Features> {
    const json = await accountApi.get<{ user?: { showMoney?: boolean } }>('/auth/profile');
    return { showMoney: json?.user?.showMoney === true };
  },

  async setShowMoney(showMoney: boolean): Promise<Features> {
    const result = await profileService.updateProfile({ showMoney });
    const features = { showMoney: (result.user as { showMoney?: boolean }).showMoney === true };
    window.dispatchEvent(new CustomEvent<Features>(FEATURES_CHANGED_EVENT, { detail: features }));
    return features;
  }
};
