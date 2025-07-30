import React, { useState } from 'react';

export const ShareFileModal = ({ file, onClose, onShare }) => {
  const [password, setPassword] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('0'); // 0 = nie ablaufen
  const [shareUrl, setShareUrl] = useState('');
  const [isProtected, setIsProtected] = useState(false);
  const [isShared, setIsShared] = useState(false);
  
  // Datei teilen
  const handleShare = () => {
    // Sende die Daten an den Server
    const shareData = {
      filePath: file.path,
      password: isProtected && password ? password : null,
      expiresInDays: expiresInDays !== '0' ? parseInt(expiresInDays) : null
    };
    
    onShare(shareData);
    
    // URL für die Benutzeroberfläche zeigen
    const baseUrl = window.location.origin;
    const fileId = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    setShareUrl(`${baseUrl}/file/${fileId}`);
    setIsShared(true);
  };
  
  // Kopieren der URL in die Zwischenablage
  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        alert('Link in die Zwischenablage kopiert!');
      })
      .catch(() => {
        alert('Fehler beim Kopieren des Links.');
      });
  };
  
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-semibold text-surface-200 mb-2">Datei teilen</h3>
        <p className="text-surface-300 mb-4">
          {file.name}
        </p>
        
        {!isShared ? (
          <div>
            <div className="form-group">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="password-protected" 
                  checked={isProtected} 
                  onChange={(e) => setIsProtected(e.target.checked)} 
                  className="rounded bg-surface-800 border-surface-600 text-primary-500 focus:ring-primary-500"
                />
                <label htmlFor="password-protected" className="form-label mb-0 cursor-pointer">
                  Mit Passwort schützen
                </label>
              </div>
            </div>
            
            {isProtected && (
              <div className="form-group">
                <label htmlFor="share-password" className="form-label">Passwort</label>
                <input
                  type="password"
                  id="share-password"
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Passwort eingeben"
                />
              </div>
            )}
            
            <div className="form-group">
              <label htmlFor="expires-in" className="form-label">Link läuft ab nach</label>
              <select
                id="expires-in"
                className="input-field"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
              >
                <option value="0">Nie</option>
                <option value="1">1 Tag</option>
                <option value="7">7 Tagen</option>
                <option value="30">30 Tagen</option>
                <option value="90">90 Tagen</option>
              </select>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button 
                type="button" 
                onClick={onClose} 
                className="btn btn-outline"
              >
                Abbrechen
              </button>
              <button 
                type="button" 
                onClick={handleShare} 
                className="btn btn-primary"
              >
                Teilen
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="form-group">
              <label className="form-label">Link zum Teilen</label>
              <div className="share-url-display">{shareUrl}</div>
              <p className="text-xs text-surface-400 mt-1">* Dateien können direkt im Browser betrachtet werden, wenn der Link geöffnet wird.</p>
            </div>
            
            <div className="mt-4">
              <div className="flex justify-between gap-2">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="btn-copy flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="icon-small" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Link kopieren
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-primary"
                >
                  Schließen
                </button>
              </div>
            </div>
            
            <div className="mt-4 text-surface-400 text-sm">
              <p>
                {isProtected && 
                  <span className="block mb-1">• Dieser Link ist passwortgeschützt.</span>
                }
                {expiresInDays !== '0' && 
                  <span className="block mb-1">• Dieser Link läuft nach {expiresInDays} {parseInt(expiresInDays) === 1 ? 'Tag' : 'Tagen'} ab.</span>
                }
                <span className="block">• Sie können alle Ihre geteilten Links in der Tab "Geteilte Links" verwalten.</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
