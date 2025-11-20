// frontend/src/components/AuditDashboard.jsx
import React, { useState, useEffect } from 'react';

const AuditDashboard = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [dataVersions, setDataVersions] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('audit');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [auditRes, versionRes] = await Promise.all([
          fetch('/api/audit-logs'),
          fetch('/api/data-versions'),
        ]);

        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAuditLogs(auditData);
        }

        if (versionRes.ok) {
          const versionData = await versionRes.json();
          setDataVersions(versionData);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return <div className="p-6 text-center">Loading dashboard...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Compliance Dashboard</h2>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'audit'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Audit Logs ({auditLogs.length})
        </button>
        <button
          onClick={() => setActiveTab('versions')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'versions'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Data Versions
        </button>
      </div>

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div>
          {auditLogs.length === 0 ? (
            <p className="text-gray-600">No audit logs available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 px-4 py-2 text-left">Timestamp</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Input Name</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">User ID</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Risk Score</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Matches Count</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-4 py-2 text-sm">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-sm font-medium">
                        {log.inputName}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">{log.userId}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm font-bold">
                        {log.riskScore}/100
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-sm text-center">
                        {log.matchesCount}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-sm text-gray-600">
                        {log.resultSummary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Data Versions Tab */}
      {activeTab === 'versions' && (
        <div>
          {!dataVersions ? (
            <p className="text-gray-600">No version information available.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(dataVersions).map(([key, value]) => (
                <div key={key} className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h3 className="font-bold text-gray-900">{key}</h3>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-600">Version</p>
                      <p className="font-medium text-gray-900">{value.version}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Status</p>
                      <p className={`font-medium ${value.status === 'Current' ? 'text-green-600' : 'text-orange-600'}`}>
                        {value.status}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-600">Last Updated</p>
                      <p className="font-medium text-gray-900">
                        {new Date(value.last_updated).toLocaleString()}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-600">Source</p>
                      <p className="font-medium text-gray-900 break-all text-xs">{value.source}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditDashboard;
