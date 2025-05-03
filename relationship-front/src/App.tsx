import { useState } from 'react';
import './App.css';

function App() {
  const [contacts] = useState([
    { id: 1, name: 'John Doe', email: 'john@example.com', status: 'Active' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'Inactive' },
    { id: 3, name: 'Mike Johnson', email: 'mike@example.com', status: 'Active' }
  ]);
  
  const [activeFilter, setActiveFilter] = useState('All');
  
  const filteredContacts = activeFilter === 'All' 
    ? contacts 
    : contacts.filter(contact => contact.status === activeFilter);
  
  return (
    <div className="relationship-app">
      <header className="relationship-header">
        <h2>Relationship Management</h2>
      </header>
      
      <main className="relationship-content">
        <div className="filters">
          <button 
            className={activeFilter === 'All' ? 'active' : ''} 
            onClick={() => setActiveFilter('All')}
          >
            All Contacts
          </button>
          <button 
            className={activeFilter === 'Active' ? 'active' : ''} 
            onClick={() => setActiveFilter('Active')}
          >
            Active
          </button>
          <button 
            className={activeFilter === 'Inactive' ? 'active' : ''} 
            onClick={() => setActiveFilter('Inactive')}
          >
            Inactive
          </button>
        </div>
        
        <div className="contacts-list">
          <h3>Contacts ({filteredContacts.length})</h3>
          
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map(contact => (
                <tr key={contact.id}>
                  <td>{contact.name}</td>
                  <td>{contact.email}</td>
                  <td>
                    <span className={`status ${contact.status.toLowerCase()}`}>
                      {contact.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default App;