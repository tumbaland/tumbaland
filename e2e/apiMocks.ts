import { Page } from '@playwright/test';

/**
 * Backend stand-ins for the frontend smoke suite. Every mocked service is
 * answered from here so the specs assert on what the apps render, not on
 * whether a backend happens to be running.
 */
const user = {
  id: 'user-e2e',
  email: 'test.user@example.com',
  name: 'Test User',
  firstName: 'Test',
  lastName: 'User',
  picture: ''
};

const group = {
  _id: 'group-e2e',
  name: 'E2E Group',
  description: '',
  members: [{ email: user.email, role: 'owner' }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

const activityType = {
  _id: 'activity-type-e2e',
  name: 'Quality Time',
  slug: 'quality-time',
  color: '#2563eb',
  valueType: 'number',
  isActive: true,
  sortOrder: 1
};

export async function installApiMocks(page: Page) {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (isMockedBackendHost(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseFor(url))
      });
      return;
    }

    await route.continue();
  });
}

function isMockedBackendHost(url: URL): boolean {
  const mockedPorts = new Set(['4001', '4002', '4003', '5001', '5003', '5005', '5006']);
  return ['localhost', '127.0.0.1'].includes(url.hostname) && mockedPorts.has(url.port);
}

function responseFor(url: URL): unknown {
  const path = url.pathname;

  if (path === '/auth/verify') {
    return { success: true, authenticated: true, user };
  }
  if (path === '/auth/profile') {
    return { success: true, user };
  }
  if (path === '/auth/logout') {
    return { success: true };
  }
  if (path === '/api/todo/random') {
    return { todo: 'Write end-to-end tests' };
  }
  if (path === '/logs') {
    return { success: true };
  }

  if (url.port === '4002' && path === '/api/statistics') {
    return { success: true, data: albumStatistics() };
  }
  if (url.port === '4001' && path.startsWith('/api/statistics')) {
    return relationshipStatistics(path);
  }

  return apiResponseFor(path);
}

function apiResponseFor(path: string): unknown {
  if (path === '/api/groups/mine') {
    return { success: true, data: [group] };
  }
  if (path === '/api/groups/mine/ids') {
    return { success: true, data: [group._id] };
  }
  if (path.startsWith('/api/groups/')) {
    return { success: true, data: group };
  }

  if (path === '/api/plans') {
    return {
      success: true,
      plans: [
        {
          _id: 'plan-free',
          code: 'free',
          name: 'Free',
          description: 'A starter plan for smoke tests',
          priceMonthlyCents: 0,
          priceYearlyCents: 0,
          features: ['Smoke tested'],
          isActive: true
        }
      ]
    };
  }
  if (path === '/api/subscriptions/me') {
    return { subscription: null };
  }
  if (path === '/api/subscriptions/mine') {
    return { subscriptions: [] };
  }
  if (path === '/api/payments/mine') {
    return { payments: [] };
  }

  if (path === '/api/dashboard') {
    return { success: true, data: financeDashboard() };
  }
  if (path.startsWith('/api/asset-classes')) {
    return { success: true, data: [] };
  }
  if (path.startsWith('/api/holdings')) {
    return { success: true, data: [] };
  }
  if (path.startsWith('/api/snapshots')) {
    return { success: true, data: [] };
  }
  if (path.startsWith('/api/tracked-tickers')) {
    return { success: true, data: [] };
  }
  if (path.startsWith('/api/ticker-price-history')) {
    return { success: true, data: [] };
  }

  if (path === '/api/dashboard-settings') {
    return { success: true, data: { highlightTypeIds: [], hiddenTypeIds: [] } };
  }
  if (path === '/api/activity-types') {
    return {
      success: true,
      data: {
        types: [activityType],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 }
      }
    };
  }
  if (path === '/api/activities/recent-summary') {
    return { success: true, data: { [activityType.slug]: { '1months': { activities: [] } } } };
  }
  if (path === '/api/albums') {
    return { success: true, data: { albums: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } } };
  }
  if (path === '/api/collages') {
    return { success: true, data: [] };
  }
  if (path === '/api/photos') {
    return { success: true, data: { photos: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } } };
  }
  if (path === '/api/photos/memories') {
    return { success: true, data: { date: '2026-01-01', totalPhotos: 0, years: [] } };
  }
  if (path === '/api/photos/recent') {
    return { success: true, data: { photos: [] } };
  }

  return { success: true, data: [] };
}

function financeDashboard() {
  return {
    kpis: {
      netWorth: 0,
      asOf: null,
      monthChange: 0,
      monthChangePct: 0,
      yearChange: 0,
      yearChangePct: 0,
      totalGain: 0,
      totalGainPct: 0
    },
    netWorthHistory: [],
    allocation: [],
    assetColors: {},
    holdings: null
  };
}

function albumStatistics() {
  return {
    overview: {
      totalAlbums: 0,
      totalPhotos: 0,
      totalStorage: 0,
      averagePhotoSize: 0
    },
    timeSeries: {
      albumsCreated: [],
      photosUploaded: []
    },
    tags: [],
    groups: [],
    // Required by AlbumStatistics and returned by the real /api/statistics —
    // omitting it crashed DashboardPage on statistics.albums.map().
    albums: []
  };
}

function relationshipStatistics(path: string): unknown {
  if (path === '/api/statistics/milestones') {
    return { success: true, data: { since: null, daysTogether: null, recent: [], upcoming: [] } };
  }
  if (path === '/api/statistics/streaks') {
    return {
      success: true,
      data: {
        currentStreak: 0,
        longestStreak: 0,
        longestStreakStart: null,
        longestStreakEnd: null,
        totalLoggedDays: 0,
        lastEntryDate: null,
        daysSinceLastEntry: null,
        types: []
      }
    };
  }
  if (path === '/api/statistics/monthly-hours') {
    return { success: true, data: [], generatedAt: new Date(0).toISOString() };
  }
  if (path === '/api/statistics/monthly-stats') {
    return { success: true, data: [], generatedAt: new Date(0).toISOString() };
  }
  if (path === '/api/statistics/monthly-activity-breakdown') {
    return { success: true, data: [], generatedAt: new Date(0).toISOString() };
  }
  if (path === '/api/statistics/weekly-heatmap') {
    return { success: true, data: [], generatedAt: new Date(0).toISOString() };
  }
  if (path === '/api/statistics/cumulative-timeline') {
    return { success: true, data: [], generatedAt: new Date(0).toISOString() };
  }

  return {
    success: true,
    data: {
      totalHours: 0,
      totalActivities: 0,
      firstEntryDate: null,
      daysSinceFirstEntry: 0,
      types: []
    },
    timeframe: 'all',
    generatedAt: new Date(0).toISOString()
  };
}
