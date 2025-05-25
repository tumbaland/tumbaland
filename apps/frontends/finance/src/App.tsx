import React from 'react';
import './App.css';
import { useAssets } from './hooks/useAssets';
import Header from './components/Header';
import PortfolioSummary from './components/PortfolioSummary';
import AssetsTable from './components/AssetsTable';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorDisplay from './components/ErrorDisplay';

function App() {
  const { assets, loading, error, fetchAssets, portfolioSummary } = useAssets();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={fetchAssets} />;
  }

  return (
    <div className="finance-app">
      <Header onRefresh={fetchAssets} />
      <PortfolioSummary summary={portfolioSummary} />
      <AssetsTable assets={assets} />
    </div>
  );
}

export default App;