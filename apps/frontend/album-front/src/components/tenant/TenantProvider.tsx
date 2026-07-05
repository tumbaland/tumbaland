import React, { useState, useCallback, createContext, useContext, useEffect } from 'react';
import { logger } from '@tumbaland/components';

export interface TenantOption {
  id: string;
  name: string;
  type: 'personal' | 'group';
}

// Global tenant context for cross-component communication
interface TenantContextValue {
  selectedTenant: TenantOption | null;
  onTenantChange: (tenant: TenantOption) => void;
  registerTenantChangeListener: (callback: (tenant: TenantOption) => void) => () => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

// Global listeners for tenant changes
const tenantChangeListeners: ((tenant: TenantOption) => void)[] = [];

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [globalTenant, setGlobalTenant] = useState<TenantOption | null>(null);

  const handleTenantChange = useCallback((tenant: TenantOption) => {
    setGlobalTenant(tenant);
    // Notify all registered listeners
    tenantChangeListeners.forEach(listener => {
      try {
        listener(tenant);
      } catch (error) {
        logger.error('Error in tenant change listener', error);
      }
    });
  }, []);

  const registerTenantChangeListener = useCallback((callback: (tenant: TenantOption) => void) => {
    tenantChangeListeners.push(callback);
    
    // Return cleanup function
    return () => {
      const index = tenantChangeListeners.indexOf(callback);
      if (index > -1) {
        tenantChangeListeners.splice(index, 1);
      }
    };
  }, []);

  const contextValue: TenantContextValue = {
    selectedTenant: globalTenant,
    onTenantChange: handleTenantChange,
    registerTenantChangeListener
  };

  return (
    <TenantContext.Provider value={contextValue}>
      {children}
    </TenantContext.Provider>
  );
};

// Hook to listen for tenant changes in components
export const useTenantListener = (callback: (tenant: TenantOption) => void) => {
  const context = useContext(TenantContext);
  
  useEffect(() => {
    if (!context) {
      logger.warn('useTenantListener used outside TenantProvider');
      return;
    }

    return context.registerTenantChangeListener(callback);
  }, [context, callback]);
};

// Hook to get current tenant context
export const useTenantContext = () => {
  const context = useContext(TenantContext);
  return context?.selectedTenant || null;
};
