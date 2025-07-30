import React, { useState } from 'react';

export const CreateFolderModal = ({ onClose, onCreateFolder }) => {
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validierung
    if (!folderName || folderName.trim() === '') {
      setError('Bitte geben Sie einen Ordnernamen ein.');
      return;
    }
    
    // Ungültige Zeichen im Dateinamen prüfen
    const invalidChars = /[<>:"\/\\|?*\x00-\x1F]/;
    if (invalidChars.test(folderName)) {
      setError('Der Ordnername enthält ungültige Zeichen. Bitte vermeiden Sie < > : " / \\ | ? *');
      return;
    }
    
    onCreateFolder(folderName.trim());
  };
  
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-semibold text-surface-200 mb-4">Neuen Ordner erstellen</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="folder-name" className="form-label">Ordnername</label>
            <input
              type="text"
              id="folder-name"
              className="input-field"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Neuer Ordner"
              autoFocus
            />
            {error && <p className="text-error-400 text-sm mt-1">{error}</p>}
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
              type="submit" 
              className="btn btn-primary"
            >
              Erstellen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
