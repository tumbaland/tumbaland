import './App.css';
import { useActivities } from './hooks/useActivities';
import Header from './components/Header';
import ActivitySummary from './components/ActivitySummary';
import ActivitiesTable from './components/ActivitiesTable';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorDisplay from './components/ErrorDisplay';

function App() {
  const { activities, loading, error, fetchActivities, activitySummary } = useActivities();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={fetchActivities} />;
  }

  return (
    <div className="relationship-app">
      <Header onRefresh={fetchActivities} />
      <ActivitySummary summary={activitySummary} />
      <ActivitiesTable activities={activities} />
    </div>
  );
}

export default App;