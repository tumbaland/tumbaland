import { useEffect, useState } from 'react';

interface NavigatorWithDeviceHints extends Navigator {
  deviceMemory?: number;
  connection?: {
    effectiveType?: string;
  };
}

interface WindowWithLegacyBrowserFlags extends Window {
  opera?: string;
  MSStream?: unknown;
}

// Hook to detect mobile devices and reduced motion preference
export function usePerformanceOptimizations() {
  const [isMobile, setIsMobile] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isLowEndDevice, setIsLowEndDevice] = useState(false);

  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      const legacyWindow = window as WindowWithLegacyBrowserFlags;
      const ua = navigator.userAgent || navigator.vendor || legacyWindow.opera || '';
      const mobile = window.innerWidth < 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      setIsMobile(mobile);
      setIsIOS(/iPad|iPhone|iPod/.test(ua) && !legacyWindow.MSStream);
    };

    // Check for reduced motion preference
    const checkReducedMotion = () => {
      setPrefersReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };

    // Check for low-end device (older devices, low memory, etc.)
    const checkLowEndDevice = () => {
      const ua = navigator.userAgent.toLowerCase();
      const deviceNavigator = navigator as NavigatorWithDeviceHints;
      const isOldAndroid = /android [2-6]/.test(ua);
      const isOldIOS = /iPhone OS [1-9]|iPad.*OS [1-9]/.test(ua);
      const hasLowMemory = deviceNavigator.deviceMemory !== undefined && deviceNavigator.deviceMemory < 4;
      const isSlowConnection =
        deviceNavigator.connection?.effectiveType === 'slow-2g' ||
        deviceNavigator.connection?.effectiveType === '2g';

      setIsLowEndDevice(isOldAndroid || isOldIOS || hasLowMemory || isSlowConnection);
    };

    checkMobile();
    checkReducedMotion();
    checkLowEndDevice();

    window.addEventListener('resize', checkMobile);
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaQuery.addEventListener('change', checkReducedMotion);

    return () => {
      window.removeEventListener('resize', checkMobile);
      mediaQuery.removeEventListener('change', checkReducedMotion);
    };
  }, []);

  return { isMobile, prefersReducedMotion, isIOS, isLowEndDevice };
}
