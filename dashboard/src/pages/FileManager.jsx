import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './FileManager.css';
import { FileExplorer } from '../components/FileManager/FileExplorer';
import { FileUploader } from '../components/FileManager/FileUploader';
import { CreateFolderModal } from '../components/FileManager/CreateFolderModal';
import { ShareFileModal } from '../components/FileManager/ShareFileModal';
import { SharedLinksList } from '../components/FileManager/SharedLinksList';

// Icon components
const FolderIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-standard" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-standard" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const LinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-standard" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-small" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-small" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-small" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-small" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

// Hauptkomponente für den Dateimanager
const FileManager = () => {
  const { getAuthHeader, user } = useAuth();
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [sharedLinks, setSharedLinks] = useState([]);
  const [view, setView] = useState('files'); // 'files' oder 'links'

  // Dateien laden
  useEffect(() => {
    fetchFiles();
    fetchSharedLinks();
  }, [currentPath]);

  // Dateien vom Server laden
  const fetchFiles = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get(`http://localhost:3001/api/files/files?path=${encodeURIComponent(currentPath)}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setFiles(response.data);
      setErrorMessage('');
    } catch (error) {
      console.error('Fehler beim Laden der Dateien:', error);
      setErrorMessage('Fehler beim Laden der Dateien. Bitte versuchen Sie es erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  // Geteilte Links laden
  const fetchSharedLinks = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.get('http://localhost:3001/api/files/links', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setSharedLinks(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der geteilten Links:', error);
    }
  };

  // Ordner erstellen
  const createFolder = async (folderName) => {
    try {
      const token = localStorage.getItem('token');
      
      await axios.post('http://localhost:3001/api/files/directory', {
        path: currentPath,
        name: folderName
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setSuccessMessage(`Ordner "${folderName}" erfolgreich erstellt.`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      fetchFiles();
      setShowCreateFolderModal(false);
    } catch (error) {
      console.error('Fehler beim Erstellen des Ordners:', error);
      setErrorMessage(error.response?.data?.error || 'Fehler beim Erstellen des Ordners.');
    }
  };

  // Datei oder Ordner löschen
  const deleteItem = async (item) => {
    if (!confirm(`Sind Sie sicher, dass Sie ${item.isDirectory ? 'den Ordner' : 'die Datei'} "${item.name}" löschen möchten?`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      
      await axios.delete('http://localhost:3001/api/files/files', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        data: {
          path: item.path
        }
      });
      
      setSuccessMessage(`${item.isDirectory ? 'Ordner' : 'Datei'} "${item.name}" erfolgreich gelöscht.`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      fetchFiles();
      fetchSharedLinks(); // Links aktualisieren, falls welche gelöscht wurden
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      setErrorMessage(error.response?.data?.error || 'Fehler beim Löschen.');
    }
  };

  // Datei teilen
  const shareFile = async (fileData) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.post('http://localhost:3001/api/files/share', fileData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setSuccessMessage(`Link für "${selectedFile.name}" erfolgreich erstellt.`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      fetchSharedLinks();
      setShowShareModal(false);
    } catch (error) {
      console.error('Fehler beim Teilen der Datei:', error);
      setErrorMessage(error.response?.data?.error || 'Fehler beim Teilen der Datei.');
    }
  };

  // Link deaktivieren
  const deactivateLink = async (linkId) => {
    if (!confirm('Sind Sie sicher, dass Sie diesen Link deaktivieren möchten?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      
      await axios.delete(`http://localhost:3001/api/files/share/${linkId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setSuccessMessage('Link erfolgreich deaktiviert.');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      fetchSharedLinks();
    } catch (error) {
      console.error('Fehler beim Deaktivieren des Links:', error);
      setErrorMessage(error.response?.data?.error || 'Fehler beim Deaktivieren des Links.');
    }
  };

  // In einen Ordner navigieren
  const navigateToFolder = (folderPath) => {
    setCurrentPath(folderPath);
  };

  // Eine Ebene nach oben navigieren
  const navigateUp = () => {
    const pathParts = currentPath.split('/');
    pathParts.pop();
    setCurrentPath(pathParts.join('/'));
  };

  return (
    <div className="space-y-8">
      {/* Header mit Titel und Aktionen */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FolderIcon /> 
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-300 to-accent-300">
              Dateimanager
            </span>
          </h1>
          <p className="text-surface-300 mt-1">Dateien hochladen, verwalten und teilen</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setView('files')}
            className={`btn ${view === 'files' ? 'btn-primary' : 'btn-outline'} flex items-center gap-2`}
          >
            <FolderIcon />
            Dateien
          </button>
          <button 
            onClick={() => setView('links')}
            className={`btn ${view === 'links' ? 'btn-primary' : 'btn-outline'} flex items-center gap-2`}
          >
            <LinkIcon />
            Geteilte Links
          </button>
        </div>
      </div>
      
      {/* Benachrichtigungen */}
      {errorMessage && (
        <div key="error-notification" className="bg-error-700/30 text-error-300 border border-error-700/50 rounded-lg p-4 mb-4 flex items-center gap-3 shadow-error-glow card-glass animate-fadeIn">
          <div className="p-1.5 bg-error-900/50 rounded-full">
            <AlertIcon />
          </div>
          <span className="font-medium">{errorMessage}</span>
          <button 
            onClick={() => setErrorMessage('')} 
            className="ml-auto text-error-300 hover:text-error-200 p-1.5 rounded-full hover:bg-error-800/50 transition-colors"
            aria-label="Fehlermeldung ausblenden"
          >
            <CloseIcon />
          </button>
        </div>
      )}
      
      {successMessage && (
        <div key="success-notification" className="bg-accent-700/30 text-accent-300 border border-accent-700/50 rounded-lg p-4 mb-4 flex items-center gap-3 shadow-accent-glow card-glass animate-fadeIn">
          <div className="p-1.5 bg-accent-900/50 rounded-full">
            <CheckIcon />
          </div>
          <span className="font-medium">{successMessage}</span>
          <button 
            onClick={() => setSuccessMessage('')} 
            className="ml-auto text-accent-300 hover:text-accent-200 p-1.5 rounded-full hover:bg-accent-800/50 transition-colors"
            aria-label="Erfolgsmeldung ausblenden"
          >
            <CloseIcon />
          </button>
        </div>
      )}
      
      {/* Ansicht je nach ausgewähltem Tab */}
      {view === 'files' ? (
        <div>
          {/* Aktionsleiste für Dateien */}
          <div className="card card-glass mb-6 p-4 flex flex-wrap gap-4">
            <button 
              onClick={() => setShowCreateFolderModal(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <PlusIcon />
              Ordner erstellen
            </button>
            <FileUploader 
              currentPath={currentPath} 
              onUploadComplete={() => {
                fetchFiles();
                setSuccessMessage('Dateien erfolgreich hochgeladen.');
                setTimeout(() => setSuccessMessage(''), 3000);
              }}
              onError={(error) => {
                setErrorMessage(error);
              }}
            />
          </div>
          
          {/* Datei-Explorer */}
          <FileExplorer 
            files={files}
            currentPath={currentPath}
            isLoading={isLoading}
            onNavigateToFolder={navigateToFolder}
            onNavigateUp={navigateUp}
            onDelete={deleteItem}
            onShare={(file) => {
              setSelectedFile(file);
              setShowShareModal(true);
            }}
          />
        </div>
      ) : (
        <SharedLinksList 
          links={sharedLinks}
          onDeactivate={deactivateLink}
        />
      )}
      
      {/* Modals */}
      {showCreateFolderModal && (
        <CreateFolderModal 
          onClose={() => setShowCreateFolderModal(false)}
          onCreateFolder={createFolder}
        />
      )}
      
      {showShareModal && selectedFile && (
        <ShareFileModal
          file={selectedFile}
          onClose={() => {
            setShowShareModal(false);
            setSelectedFile(null);
          }}
          onShare={shareFile}
        />
      )}
    </div>
  );
};

export default FileManager;
