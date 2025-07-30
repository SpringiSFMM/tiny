import React from 'react';

// Icons
const LinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-standard" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-small" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-small" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-small" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-10">
    <div className="p-4 rounded-full bg-surface-800/50 mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    </div>
    <p className="text-surface-300 text-lg font-medium">Keine geteilten Links</p>
    <p className="text-surface-400 mt-1">Sie haben noch keine Dateien geteilt</p>
  </div>
);

export const SharedLinksList = ({ links, onDeactivate }) => {
  // Formatiere das Datum
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Berechne das Ablaufdatum
  const formatExpiryDate = (createdAt, expiresInDays) => {
    if (!expiresInDays) return null;
    
    const createdDate = new Date(createdAt);
    const expiryDate = new Date(createdDate);
    expiryDate.setDate(expiryDate.getDate() + expiresInDays);
    
    return formatDate(expiryDate);
  };
  
  // Kopiere den Link in die Zwischenablage
  const copyToClipboard = (url) => {
    navigator.clipboard.writeText(url)
      .then(() => {
        alert('Link in die Zwischenablage kopiert!');
      })
      .catch(() => {
        alert('Fehler beim Kopieren des Links.');
      });
  };
  
  return (
    <div className="card card-glass overflow-hidden">
      <div className="p-4 border-b border-surface-800 flex justify-between items-center">
        <h2 className="text-lg font-medium text-surface-200">Geteilte Links</h2>
        <span className="text-sm text-surface-400">{links.length} {links.length === 1 ? 'Link' : 'Links'}</span>
      </div>
      
      <div className="p-4">
        {links.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {links.map((link) => (
              <div key={link.id} className="card card-glass p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <LinkIcon />
                      <span className="font-medium text-surface-200">{link.fileName}</span>
                    </div>
                    <p className="text-surface-400 text-sm mt-1">
                      Erstellt am {formatDate(link.createdAt)}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className={`link-badge ${link.active ? 'badge-active' : 'badge-inactive'}`}>
                        {link.active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                      
                      {link.hasPassword && (
                        <span className="link-badge badge-password flex items-center gap-1">
                          <LockIcon />
                          Passwortgeschützt
                        </span>
                      )}
                      
                      {link.expiresInDays && (
                        <span className="link-badge badge-expires flex items-center gap-1">
                          <ClockIcon />
                          Läuft ab am {formatExpiryDate(link.createdAt, link.expiresInDays)}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 self-start sm:self-center">
                    <button
                      onClick={() => copyToClipboard(`${window.location.origin}/file/${link.id}`)}
                      className="btn btn-sm btn-outline"
                      disabled={!link.active}
                    >
                      Kopieren
                    </button>
                    <button
                      onClick={() => onDeactivate(link.id)}
                      className="btn btn-sm btn-outline text-error-400 hover:bg-error-900/30 hover:border-error-700 hover:text-error-300"
                      disabled={!link.active}
                    >
                      <TrashIcon />
                      Deaktivieren
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
