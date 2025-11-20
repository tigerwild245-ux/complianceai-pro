// frontend/src/components/ResultList.jsx
import React, { useState } from 'react';

const ResultList = ({ results, inputName }) => {
  const [expandedMatch, setExpandedMatch] = useState(null);

  if (!results) {
    return null;
  }

  // Determine overall risk level based on risk score
  const getRiskLevel = (score) => {
    if (score >= 80) return { level: 'CRITICAL', color: 'red', bgColor: 'bg-red-50', borderColor: 'border-red-300' };
    if (score >= 60) return { level: 'HIGH', color: 'orange', bgColor: 'bg-orange-50', borderColor: 'border-orange-300' };
    if (score >= 40) return { level: 'MEDIUM', color: 'yellow', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-300' };
    return { level: 'LOW', color: 'green', bgColor: 'bg-green-50', borderColor: 'border-green-300' };
  };

  const riskInfo = getRiskLevel(results.riskScore);

  // Display no matches message
  if (results.matches.length === 0 && !results.pepStatus) {
    return (
      <div className={`mt-6 p-4 ${riskInfo.bgColor} border ${riskInfo.borderColor} rounded-lg`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-700 font-medium">Screening Result: CLEAR</p>
            <p className="text-sm text-gray-600 mt-1">{results.analysis}</p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-${riskInfo.color}-100 text-${riskInfo.color}-800`}>
            Risk Score: {results.riskScore}/100
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {/* Overall Risk Score Summary */}
      <div className={`p-4 ${riskInfo.bgColor} border ${riskInfo.borderColor} rounded-lg mb-6`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Overall Risk Assessment</h3>
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-medium">Input Name:</span> {inputName}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">{results.riskScore}</div>
            <div className="text-sm text-gray-600">/100</div>
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium bg-${riskInfo.color}-100 text-${riskInfo.color}-800`}>
              {riskInfo.level}
            </span>
          </div>
        </div>
      </div>

      {/* PEP Status */}
      {results.pepStatus && (
        <div className="p-4 bg-purple-50 border border-purple-300 rounded-lg mb-6">
          <h4 className="text-md font-bold text-purple-800">⚠️ Politically Exposed Person (PEP) Alert</h4>
          <div className="mt-3 space-y-2">
            <p className="text-sm text-gray-700">
              <span className="font-medium">Name:</span> {results.pepStatus.name}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Country:</span> {results.pepStatus.country}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Role:</span> {results.pepStatus.role}
            </p>
            <p className="text-sm text-gray-700 mt-2">
              <span className="font-medium">Bio:</span> {results.pepStatus.bio}
            </p>
          </div>
        </div>
      )}

      {/* Sanction Matches */}
      {results.matches.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">
            Sanction List Matches ({results.matches.length})
          </h3>
          <div className="space-y-4">
            {results.matches.map((match, index) => (
              <div
                key={index}
                className={`p-4 border rounded-lg shadow-sm cursor-pointer transition ${
                  expandedMatch === index
                    ? 'bg-red-50 border-red-300'
                    : 'bg-white border-gray-200 hover:border-red-300'
                }`}
                onClick={() => setExpandedMatch(expandedMatch === index ? null : index)}
              >
                {/* Match Header */}
                <div className="flex justify-between items-start">
                  <div className="flex-grow">
                    <h4 className="text-md font-bold text-red-800">Match #{index + 1}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">Sanctioned Name:</span> {match.sanctionedName}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">List:</span> {match.list_type}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-red-800">{match.finalScore}</div>
                    <div className="text-xs text-gray-600">/100</div>
                  </div>
                </div>

                {/* Risk Score Breakdown */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-100 p-2 rounded">
                    <p className="text-gray-600">Base Score</p>
                    <p className="font-bold text-gray-900">{match.baseScore.toFixed(1)}</p>
                  </div>
                  <div className="bg-gray-100 p-2 rounded">
                    <p className="text-gray-600">Final Score</p>
                    <p className="font-bold text-gray-900">{match.finalScore.toFixed(1)}</p>
                  </div>
                </div>

                {/* Match Decision Badge */}
                <div className="mt-3">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      match.matchDecision === 'MATCH'
                        ? 'bg-red-200 text-red-800'
                        : match.matchDecision === 'POTENTIAL'
                        ? 'bg-orange-200 text-orange-800'
                        : 'bg-green-200 text-green-800'
                    }`}
                  >
                    {match.matchDecision}
                  </span>
                </div>

                {/* Expanded Details */}
                {expandedMatch === index && (
                  <div className="mt-4 pt-4 border-t border-red-200 space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Designation</p>
                      <p className="text-sm text-gray-700">{match.designation}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Country</p>
                      <p className="text-sm text-gray-700">{match.country}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">AI Reasoning</p>
                      <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded mt-1">
                        {match.reasoning}
                      </p>
                    </div>
                    {match.full_data && (
                      <div>
                        <p className="text-sm font-medium text-gray-900">Full Data (JSON)</p>
                        <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-auto max-h-48">
                          {JSON.stringify(match.full_data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Expand/Collapse Indicator */}
                <div className="mt-2 text-center">
                  <span className="text-xs text-gray-500">
                    {expandedMatch === index ? '▲ Click to collapse' : '▼ Click for details'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Analysis */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Summary:</strong> {results.analysis}
        </p>
      </div>
    </div>
  );
};

export default ResultList;
