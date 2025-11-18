// frontend/src/components/ResultList.jsx
import React from 'react';

const ResultList = ({ results }) => {
  if (!results || results.matches.length === 0) {
    return (
      <div className="mt-6 p-4 bg-gray-100 border border-gray-300 rounded-lg">
        <p className="text-gray-700">{results.analysis || "No results to display."}</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">Screening Results</h3>
      <div className="space-y-4">
        {results.matches.map((match, index) => (
          <div key={index} className="p-4 bg-red-50 border border-red-300 rounded-lg shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-md font-bold text-red-800">Potential Match Found</h4>
                <p className="text-sm text-gray-600 mt-1">
                  <span className="font-medium">Sanctioned Name:</span> {match.sanctionedName}
                </p>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Score: {match.score.toFixed(4)}
              </span>
            </div>
            <div className="mt-3 text-sm text-gray-700">
              <p className="font-medium">AI Analysis:</p>
              <p>{match.reason}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Overall Analysis:</strong> {results.analysis}
        </p>
      </div>
    </div>
  );
};

export default ResultList;
