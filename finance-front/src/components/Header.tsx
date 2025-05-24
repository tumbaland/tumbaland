import React from 'react';

interface HeaderProps {
  onRefresh: () => void;
}

const Header: React.FC<HeaderProps> = ({ onRefresh }) => {
  return (
    <header className="finance-header">
      <h2>Finance Portfolio</h2>
      <button onClick={onRefresh} className="refresh-button">
        Refresh
      </button>
    </header>
  );
};

export default Header;
