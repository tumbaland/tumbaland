import { useEffect, useState } from 'react';
import { profileApi } from '../services/profileApi';

/**
 * The name account-front's Features page announces a change under. It runs in
 * this same page, so the menu follows the switch without a reload.
 */
export const FEATURES_CHANGED_EVENT = 'tumbaland:features-changed';

/**
 * Whether this person has turned Money on under Profile > Features.
 *
 * Starts, and stays, off until the profile says otherwise: showing it for a
 * moment and then taking it away would put it on a partner's screen for
 * exactly the moment they happened to be looking. Read again for each person
 * who signs in on the device.
 */
export function useShowMoney(userId: string | undefined): { showMoney: boolean } {
  const [showMoney, setShown] = useState(false);

  useEffect(() => {
    setShown(false);
    if (!userId) return;
    let active = true;
    profileApi
      .getShowMoney()
      .then((value) => active && setShown(value))
      .catch(() => {
        // Unreadable: it stays hidden, which is the safe way to be wrong.
      });

    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ showMoney?: boolean }>).detail;
      if (active) setShown(detail?.showMoney === true);
    };
    window.addEventListener(FEATURES_CHANGED_EVENT, onChanged);

    return () => {
      active = false;
      window.removeEventListener(FEATURES_CHANGED_EVENT, onChanged);
    };
  }, [userId]);

  return { showMoney };
}
