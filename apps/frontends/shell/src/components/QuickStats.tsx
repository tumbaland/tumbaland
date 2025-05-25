import { type FC } from 'react';

interface StatItem {
  number: string;
  label: string;
}

const statsData: StatItem[] = [
  { number: '2', label: 'Applications' },
  { number: '∞', label: 'Possibilities' },
  { number: '1', label: 'Platform' }
];

const QuickStats: FC = () => {
  return (
    <div className="quick-stats">
      {statsData.map((stat, index) => (
        <div key={index} className="stat-item">
          <span className="stat-number">{stat.number}</span>
          <span className="stat-label">{stat.label}</span>
        </div>
      ))}
    </div>
  );
};

export default QuickStats;
