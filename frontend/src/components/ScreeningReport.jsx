import React from 'react';
// NOTE: If you don't have lucide-react, you can remove the Icon components 
// or use your existing icon set. This code assumes standard React patterns.
import { FileText, Cpu, AlertTriangle, ShieldCheck } from 'lucide-react'; 

const ScreeningReport = ({ data, isLoading }) => {
  
  // 1. Loading State
  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-sm animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
          <div className="h-32 bg-gray-100 rounded"></div>
          <div className="h-32 bg-gray-100 rounded"></div>
        </div>
        <div className="mt-4 text-center text-gray-500 font-medium">
          🤖 Starting AI analysis...
        </div>
      </div>
    );
  }

  // 2. Safety Check: If API fails or returns empty data
  if (!data) {
    return null;
  }

  // Destructure safely with defaults
  const { 
    analysis = "No analysis available.", 
    bio = null, 
    matches = [], 
    riskLevel = "MODERATE" 
  } = data;

  const isCritical = riskLevel === 'CRITICAL';

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-6 font-sans">
      
      {/* --- RISK HEADER --- */}
      {isCritical ? (
        <div className="bg-red-50 border-l-4 border-red-600 p-4 flex items-center justify-between rounded-r shadow-sm">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="text-red-600 h-6 w-6" />
            <div>
              <h2 className="text-red-800 font-bold text-lg">CRITICAL RISK LEVEL</h2>
              <p className="text-red-700 text-sm">{matches.length} matches identified</p>
            </div>
          </div>
          <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded uppercase tracking-wide">
            Review Required
          </span>
        </div>
      ) : (
        <div className="bg-green-50 border-l-4 border-green-600 p-4 flex items-center space-x-3 rounded-r shadow-sm">
          <ShieldCheck className="text-green-600 h-6 w-6" />
          <div>
            <h2 className="text-green-800 font-bold text-lg">NO CRITICAL RISKS</h2>
            <p className="text-green-700 text-sm">Routine screening complete</p>
          </div>
        </div>
      )}

      {/* --- ANALYSIS CARD (Existing) --- */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Cpu className="text-indigo-600 h-5 w-5" />
          <h3 className="text-lg font-bold text-gray-800">Screening Advanced Analysis</h3>
        </div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          AUTOMATED INTELLIGENCE ASSESSMENT
        </p>
        <div className="bg-gray-50 p-4 rounded border border-gray-100 text-gray-700 leading-relaxed">
          {analysis}
        </div>
      </div>

      {/* --- BIO CARD (The Fix) --- */}
      {/* Conditional Rendering: Only shows if 'bio' exists in API response */}
      {bio && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-2 mb-4">
            <FileText className="text-blue-600 h-5 w-5" />
            <h3 className="text-lg font-bold text-gray-800">Subject Biography</h3>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            GENERATED CONTEXT
          </p>
          <div className="bg-blue-50 p-4 rounded border border-blue-100 text-gray-800 leading-relaxed">
            {bio}
          </div>
        </div>
      )}

      {/* --- MATCH DETAILS (Existing) --- */}
      <div className="pt-2">
        <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center">
          <span className="mr-2">↗</span> Enhanced Match Details
        </h3>
        {matches.length === 0 && (
            <p className="text-gray-400 italic">No direct matches found.</p>
        )}
        {matches.map((match, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex space-x-2 mb-2">
                  <span className="bg-gray-800 text-white text-xs px-2 py-1 rounded font-mono">MATCH #{idx + 1}</span>
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-1">{match.name}</h4>
                <p className="text-gray-500 text-sm">
                  Program: <span className="font-bold text-gray-700">{match.program || 'PEP'}</span>
                </p>
              </div>
              <div className="text-right">
                <span className="text-4xl font-bold text-gray-900">{match.score || 0}%</span>
                <p className="text-xs text-gray-500 font-bold mt-1">AI MATCH SCORE</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScreeningReport;