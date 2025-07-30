import React from 'react';

// Icons
const FolderIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="file-icon text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="file-icon text-surface-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-small" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-small" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const ShareIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-small" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
);

const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-small" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center py-10">
    <svg className="animate-spin h-8 w-8 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <p className="mt-3 text-surface-300">Dateien werden geladen...</p>
  </div>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-10">
    <div className="p-4 rounded-full bg-surface-800/50 mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
      </svg>
    </div>
    <p className="text-surface-300 text-lg font-medium">Dieser Ordner ist leer</p>
    <p className="text-surface-400 mt-1">Laden Sie Dateien hoch oder erstellen Sie einen neuen Ordner</p>
  </div>
);

// Pfad-Navigation
const BreadcrumbPath = ({ currentPath, onNavigateToFolder, onNavigateUp }) => {
  const pathParts = currentPath ? currentPath.split('/').filter(p => p !== '') : [];
  
  return (
    <div className="folder-path flex items-center overflow-x-auto">
      <button 
        onClick={onNavigateUp} 
        disabled={currentPath === ''}
        className={`p-1 rounded-md mr-2 ${currentPath === '' ? 'text-surface-500' : 'text-surface-300 hover:bg-surface-700/50'}`}
        title="Übergeordneter Ordner"
        aria-label="Übergeordneter Ordner"
      >
        <ChevronUpIcon />
      </button>
      
      <div className="breadcrumb">
        <div className="breadcrumb-item">
          <span 
            className="breadcrumb-link cursor-pointer"
            onClick={() => onNavigateToFolder('')}
          >
            Home
          </span>
        </div>
        
        {pathParts.map((part, index) => {
          // Berechne den Pfad bis zu diesem Teil
          const pathToHere = pathParts.slice(0, index + 1).join('/');
          
          return (
            <div key={index} className="breadcrumb-item">
              <span 
                className="breadcrumb-link cursor-pointer"
                onClick={() => onNavigateToFolder(pathToHere)}
              >
                {part}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Hauptkomponente
export const FileExplorer = ({ 
  files, 
  currentPath,
  isLoading, 
  onNavigateToFolder, 
  onNavigateUp,
  onDelete,
  onShare
}) => {
  
  // Datei-/Ordnername formatieren, falls zu lang
  const formatName = (name) => {
    if (name.length > 20) {
      return name.substring(0, 17) + '...';
    }
    return name;
  };
  
  // Dateigröße formatieren
  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Prüft, ob es sich um ein Bild handelt
  const isImageFile = (fileName) => {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];
    const extension = fileName.split('.').pop().toLowerCase();
    return imageExtensions.includes(extension);
  };
  
  // Dateityp-Icon oder Vorschaubild
  const getFilePreview = (file) => {
    if (file.isDirectory) {
      return <FolderIcon />;
    } else if (isImageFile(file.name)) {
      // Für Bilder eine Vorschau anzeigen
      const filePath = `/uploads/${file.path}`;
      return (
        <img 
          src={`/api/files/image?path=${encodeURIComponent(file.path)}`} 
          alt={file.name} 
          className="file-thumb"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '';
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'block';
          }}
        />
      );
    } else {
      return <FileIcon />;
    }
  };
  
  return (
    <div className="card card-glass overflow-hidden">
      {/* Pfad-Navigation */}
      <div className="p-4 border-b border-surface-800">
        <BreadcrumbPath 
          currentPath={currentPath}
          onNavigateToFolder={onNavigateToFolder}
          onNavigateUp={onNavigateUp}
        />
      </div>
      
      {/* Dateiliste */}
      <div className="p-4">
        {isLoading ? (
          <LoadingSpinner />
        ) : files.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="file-grid">
            {files.map((file, index) => (
              <div key={index} className="file-item card card-glass p-3 flex flex-col">
                {/* Vorschau */}
                <div className="flex justify-center items-center h-24 mb-3">
                  {getFilePreview(file)}
                </div>
                
                {/* Name mit Tooltip für lange Namen */}
                <div className="text-center mb-2" title={file.name}>
                  <h3 className="font-medium text-surface-200 truncate">
                    {formatName(file.name)}
                  </h3>
                  {!file.isDirectory && (
                    <p className="text-surface-400 text-sm">{formatSize(file.size)}</p>
                  )}
                </div>
                
                {/* Aktionen */}
                <div className="mt-auto pt-2 flex justify-center gap-2 border-t border-surface-800">
                  {file.isDirectory ? (
                    <button
                      onClick={() => onNavigateToFolder(file.path)}
                      className="btn btn-sm btn-ghost"
                      title="Öffnen"
                      aria-label={`Ordner ${file.name} öffnen`}
                    >
                      Öffnen
                    </button>
                  ) : (
                    <>
                      <a
                        href={`/api/files/download?path=${encodeURIComponent(file.path)}`}
                        download={file.name}
                        className="btn btn-sm btn-ghost"
                        title="Herunterladen"
                        aria-label={`Datei ${file.name} herunterladen`}
                      >
                        <DownloadIcon />
                      </a>
                      <button
                        onClick={() => onShare(file)}
                        className="btn btn-sm btn-ghost"
                        title="Teilen"
                        aria-label={`Datei ${file.name} teilen`}
                      >
                        <ShareIcon />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => onDelete(file)}
                    className="btn btn-sm btn-ghost text-error-400 hover:text-error-300"
                    title="Löschen"
                    aria-label={`${file.isDirectory ? 'Ordner' : 'Datei'} ${file.name} löschen`}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
