export interface NavigationItem {
  label: string;
  path: string;
  onClick?: () => void;
}

export const navigationItems: Omit<NavigationItem, 'onClick'>[] = [
  {
    label: 'Albums',
    path: '/albums'
  },
  {
    label: 'Collage',
    path: '/collage'
  }
];

export const createNavigationItems = (navigate: (path: string) => void): NavigationItem[] => {
  return navigationItems.map(item => ({
    ...item,
    onClick: () => navigate(item.path)
  }));
};
