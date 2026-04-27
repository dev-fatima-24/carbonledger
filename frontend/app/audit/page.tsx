'use client';

import { useState } from 'react';
import { useIsMobile } from '@/hooks/useMediaQuery';

export default function AuditPage() {
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState('all');

  const auditLogs = [
    { id: 1, timestamp: '2024-01-15 10:30', user: 'admin@example.com', action: 'Credit Issuance', details: '100 tons issued', status: 'Success' },
    { id: 2, timestamp: '2024-01-14 15:45', user: 'trader@example.com', action: 'Transfer', details: '50 tons transferred', status: 'Success' },
    { id: 3, timestamp: '2024-01-13 09:00', user: 'verifier@example.com', action: 'Verification', details: 'Project verified', status: 'Pending' },
  ];

  const filteredLogs = filter === 'all' ? auditLogs : auditLogs.filter(log => log.status.toLowerCase() === filter);

  return (
    <div className="container" style={{ padding: isMobile ? '16px' : '24px' }}>
      <h1 style={{ fontSize: isMobile ? '24px' : '32px', marginBottom: '16px' }}>
        Audit Log
      </h1>

      {/* Filter buttons - touch friendly */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {['all', 'success', 'pending'].map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            style={{
              padding: '12px 20px',
              minHeight: '44px',
              backgroundColor: filter === type ? '#3b82f6' : '#e5e7eb',
              color: filter === type ? 'white' : '#374151',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {isMobile ? (
        <div className="mobile-card-container">
          {filteredLogs.map((log) => (
            <div key={log.id} className="mobile-card">
              <div className="mobile-card-title">{log.timestamp}</div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">User</span>
                <span className="mobile-card-value">{log.user}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Action</span>
                <span className="mobile-card-value">{log.action}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Details</span>
                <span className="mobile-card-value">{log.details}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Status</span>
                <span className="mobile-card-value" style={{ 
                  color: log.status === 'Success' ? '#10b981' : '#f59e0b'
                }}>
                  {log.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td>{log.timestamp}</td>
                  <td>{log.user}</td>
                  <td>{log.action}</td>
                  <td>{log.details}</td>
                  <td style={{ color: log.status === 'Success' ? '#10b981' : '#f59e0b' }}>
                    {log.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
