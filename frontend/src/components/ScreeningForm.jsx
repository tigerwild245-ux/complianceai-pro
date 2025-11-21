import React, { useState } from 'react';
import axios from 'axios';

// Helper to determine badge color based on risk
const getRiskColor = (level) => {
  switch (level?.toUpperCase()) {
    case 'HIGH': return 'bg-red-100 text-red-800 border-red-200';
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const ScreeningForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    passport: '',
    nationalId: ''
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get API URL from env (Vercel auto-sets this in production)
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleScan = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      // Sending data to your Render Backend
      const response = await axios.post(`${API_URL}/scan`, {
        nameToCheck: formData.name,
        inputDetails: {
          passportNumber: formData.passport,
          nationalId: formData.nationalId
        }
      });

      setResult(response.data);
    } catch (err) {
      console.error("Scan failed", err);
      setError('Screening failed. Please check the connection to the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-lg rounded-lg mt-10">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
        🛡️ Sanction Screening Pro
      </h2>

      {/* --- INPUT FORM --- */}
      <form onSubmit={handleScan} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Full Name (Required)</label>
          <input
            type="text"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g. Osama Bin Laden"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Passport Number (Optional)</label>
            <input
              type="text"
              name="passport"
              value={formData.passport}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="A1234567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">National ID (Optional)</label>
            <input
              type="text"
              name="nationalId"
              value={formData.nationalId}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
            ${loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none`}
        >
          {loading ? 'Analyzing...' : 'Screen Entity'}
        </button>
      </form>

      {/* --- ERROR MESSAGE --- */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded border border-red-200">
          {error}
        </div>
      )}

      {/* --- RESULTS DISPLAY --- */}
      {result && (
        <div className="mt-8 border-t pt-6 animate-fade-in">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Result</h3>
          
          {/* AI Analysis Card */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-xs font-uppercase text-gray-500 tracking-wider">BEST MATCH</span>
                <p className="font-bold text-lg text-gray-900">{result.bestMatch?.name || 'No Match Found'}</p>
                <p className="text-sm text-gray-600">Source: {result.bestMatch?.source || 'N/A'}</p>
              </div>
              
              {result.ai_analysis && (
                <span className={`px-3 py-1 rounded-full text-sm font-bold border ${getRiskColor(result.ai_analysis.risk_level)}`}>
                  {result.ai_analysis.risk_level} RISK
                </span>
              )}
            </div>

            {result.ai_analysis ? (
              <div className="space-y-3 mt-4">
                <div>
                  <span className="font-semibold text-sm text-gray-700">🤖 AI Reasoning:</span>
                  <p className="text-gray-700 mt-1">{result.ai_analysis.reasoning}</p>
                </div>
                
                {result.ai_analysis.bio && (
                  <div className="bg-white p-3 rounded border border-gray-100">
                    <span className="font-semibold text-sm text-gray-700">📖 Entity Bio:</span>
                    <p className="text-gray-600 text-sm mt-1 italic">"{result.ai_analysis.bio}"</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-green-600 font-medium mt-2">No high-risk matches found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreeningForm;