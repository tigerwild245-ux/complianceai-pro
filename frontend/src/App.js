import React, { useState } from 'react';
import './App.css';
import ResultList from './components/ResultList';
import AuditDashboard from './components/AuditDashboard';

function App() {
  const [name, setName] = useState('');
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  const handleScreening = async (e) => {
    e.preventDefault();
    if (!name) return;
    setIsLoading(true);
    setResults(null);

    try {
      const response = await fetch('/api/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Screening failed:', error);
      setResults({ matches: [], analysis: 'An error occurred during screening.', riskScore: 0 });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-800">ComplianceAI Pro</h1>
              <p className="text-gray-600">AI-Powered Sanction Screening Tool</p>
            </div>
            <button
              onClick={() => setShowDashboard(!showDashboard)}
              className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700"
            >
              {showDashboard ? 'Hide Dashboard' : 'Show Dashboard'}
            </button>
          </div>

          {/* Screening Form */}
          <form onSubmit={handleScreening} className="bg-white p-6 rounded-lg shadow-md mb-8">
            <label htmlFor="name-input" className="block text-sm font-medium text-gray-700 mb-2">
              Name to Screen
            </label>
            <div className="flex gap-2">
              <input
                id="name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-grow p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., John Doe"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isLoading ? 'Screening...' : 'Screen'}
              </button>
            </div>
          </form>

          {/* Results Section */}
          {results && <ResultList results={results} inputName={name} />}

          {/* Dashboard Section */}
          {showDashboard && <AuditDashboard />}
        </div>
      </div>
    </div>
  );
}

export default App;
