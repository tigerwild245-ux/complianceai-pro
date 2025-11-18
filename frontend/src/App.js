import React, { useState } from 'react';
import './App.css';
import ResultList from './components/ResultList';

function App() {
  const [name, setName] = useState('');
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

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
      setResults({ matches: [], analysis: 'An error occurred during screening.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-center text-gray-800 mb-2">ComplianceAI Pro</h1>
          <p className="text-center text-gray-600 mb-8">AI-Powered Sanction Screening Tool</p>
          <form onSubmit={handleScreening} className="bg-white p-6 rounded-lg shadow-md">
            <label htmlFor="name-input" className="block text-sm font-medium text-gray-700 mb-2">Name to Screen</label>
            <div className="flex gap-2">
              <input
                id="name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-grow p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., John Doe"
              />
              <button type="submit" disabled={isLoading} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                {isLoading ? 'Screening...' : 'Screen'}
              </button>
            </div>
          </form>
          <ResultList results={results} inputName={name} />
        </div>
      </div>
    </div>
  );
}

export default App;
