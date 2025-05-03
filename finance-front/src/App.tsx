import { useState } from 'react';
import './App.css';

function App() {
  const [balance, setBalance] = useState(1000);
  
  const addMoney = () => {
    setBalance(prev => prev + 100);
  };
  
  return (
    <div className="finance-app">
      <header className="finance-header">
        <h2>Finance Application</h2>
      </header>
      
      <main className="finance-content">
        <div className="balance-card">
          <h3>Current Balance</h3>
          <p className="balance-amount">${balance.toFixed(2)}</p>
          <button onClick={addMoney} className="add-button">Add $100</button>
        </div>
        
        <div className="transactions">
          <h3>Recent Transactions</h3>
          <ul className="transaction-list">
            <li>Grocery Store <span>-$45.30</span></li>
            <li>Salary Deposit <span>+$1200.00</span></li>
            <li>Electric Bill <span>-$75.40</span></li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export default App;