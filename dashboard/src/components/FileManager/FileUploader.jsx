import React, { useState, useRef } from 'react';
import axios from 'axios';

// Icons
const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="icon-standard" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

export const FileUploader = ({ currentPath, onUploadComplete, onError }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);
  
  const handleClick = () => {
    fileInputRef.current.click();
  };
  
  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    setProgress(0);
    
    const formData = new FormData();
    
    // Füge alle ausgewählten Dateien hinzu
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    
    // Füge den aktuellen Pfad hinzu
    formData.append('path', currentPath);
    
    try {
      const token = localStorage.getItem('token');
      
      await axios.post('http://localhost:3001/api/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setProgress(percentCompleted);
        }
      });
      
      setUploading(false);
      setProgress(0);
      onUploadComplete();
      
      // Zurücksetzen des Datei-Inputs
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setUploading(false);
      console.error('Fehler beim Hochladen:', error);
      onError(error.response?.data?.error || 'Fehler beim Hochladen der Dateien.');
      
      // Zurücksetzen des Datei-Inputs
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        className="hidden"
        disabled={uploading}
      />
      {uploading ? (
        <div>
          <div className="text-surface-300 mb-1 flex justify-between">
            <span>Hochladen...</span>
            <span>{progress}%</span>
          </div>
          <div className="upload-progress">
            <div 
              className="upload-progress-bar" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      ) : (
        <button
          onClick={handleClick}
          className="btn btn-primary flex items-center gap-2"
          disabled={uploading}
        >
          <UploadIcon />
          Dateien hochladen
        </button>
      )}
    </div>
  );
};
