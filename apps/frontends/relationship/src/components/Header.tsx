import React from 'react';

interface HeaderProps {
  onRefresh: () => void;
}

const Header: React.FC<HeaderProps> = ({ onRefresh }) => {
  return (
    <header className="relationship-header">
      <h2>Relationship Activities</h2>
      <button onClick={onRefresh} className="refresh-button">
        Refresh
      </button>
    </header>
  );
};

export default Header;
