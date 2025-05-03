// Utility functions for loading microfrontends
export interface MicroFrontend {
  mount: (elementId: string) => void;
  unmount: () => void;
}

export type MicroFrontendType = 'finance' | 'relationship';

// Track mounted containers to handle cleanup properly
const mountedContainers: Map<string, HTMLDivElement> = new Map();

export const getMicroFrontendUrl = (type: MicroFrontendType, isDev: boolean): string => {
  // In development, we load from local dev servers
  if (isDev) {
    switch (type) {
      case 'finance':
        return 'http://localhost:3001/src/main.tsx';
      case 'relationship':
        return 'http://localhost:3002/src/main.tsx';
      default:
        throw new Error(`Unknown microfrontend type: ${type}`);
    }
  }
  
  // In production, we load from built modules
  switch (type) {
    case 'finance':
      return '/finance-front/dist/finance-app.js';
    case 'relationship':
      return '/relationship-front/dist/relationship-app.js';
    default:
      throw new Error(`Unknown microfrontend type: ${type}`);
  }
};

// Cache loaded microfrontends to avoid reloading
const microfrontendCache: Record<MicroFrontendType, MicroFrontend | null> = {
  finance: null,
  relationship: null
};

// Safely unmount a specific microfrontend
export const unmountMicrofrontend = (containerId: string): void => {
  const container = document.getElementById(containerId);
  if (container) {
    // Remove all children from the container
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }
  
  // Remove from tracked containers
  mountedContainers.delete(containerId);
};

// Safely unmount all microfrontends
export const unmountAllMicrofrontends = (): void => {
  // Get a list of all container IDs to unmount
  const containerIds = Array.from(mountedContainers.keys());
  
  // Unmount each one
  containerIds.forEach(containerId => {
    unmountMicrofrontend(containerId);
  });
};

export const loadAndMountMicrofrontend = async (
  type: MicroFrontendType,
  containerId: string,
  isDev: boolean = import.meta.env.DEV
): Promise<void> => {
  try {
    // First, unmount any existing app in this container
    unmountMicrofrontend(containerId);
    
    // Prepare the container
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container element with id "${containerId}" not found`);
      return;
    }
    
    // Create an isolated sub-container for the microfrontend
    const subContainer = document.createElement('div');
    subContainer.id = `${containerId}-content`;
    subContainer.style.width = '100%';
    subContainer.style.height = '100%';
    
    // Append the sub-container to the main container
    container.appendChild(subContainer);
    
    // Track this container
    mountedContainers.set(containerId, subContainer);
    
    // Load the microfrontend module
    let module = microfrontendCache[type];
    
    if (!module) {
      const modulePath = getMicroFrontendUrl(type, isDev);
      
      // Dynamic import with Vite ignore to prevent build-time analysis
      const importedModule = await import(/* @vite-ignore */ modulePath);
      
      // Cache the loaded module
      module = importedModule as MicroFrontend;
      microfrontendCache[type] = module;
    }
    
    if (module && module.mount) {
      // Mount the microfrontend to the sub-container
      module.mount(`${containerId}-content`);
    }
  } catch (error) {
    console.error(`Error loading ${type} microfrontend:`, error);
  }
};