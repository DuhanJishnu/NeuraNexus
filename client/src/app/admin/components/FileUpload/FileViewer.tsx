// app/admin/components/FileUpload/FileViewer.tsx
"use client";

import React, { useEffect, useState } from "react";
import Image from 'next/image';

interface FileViewerProps {
  file: File;
  onClose: () => void;
}

const FileViewer: React.FC<FileViewerProps> = ({ file, onClose }) => {
  const [url, setUrl] = useState('');

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className="mt-6 p-6 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mr-3">
            <span className="text-white text-sm">👁️</span>
          </div>
          <h3 className="font-semibold text-white truncate max-w-md">{file.name}</h3>
        </div>
        <button
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg transition-all duration-200 font-medium flex items-center"
          onClick={onClose}
        >
          <span className="mr-2">×</span>
          Close
        </button>
      </div>

      <div className="rounded-xl overflow-hidden bg-black/20">
        {url && file.type.startsWith("image/") && (
          <Image
            src={url}
            alt={file.name}
            width={1200}
            height={800}
            unoptimized
            className="w-full max-h-96 object-contain rounded-lg"
          />
        )}
        {url && file.type.startsWith("audio/") && (
          <div className="p-6">
            <audio controls className="w-full text-gray-200 rounded-lg">
              <source src={url} type={file.type} />
              Your browser does not support audio.
            </audio>
          </div>
        )}
        {url && (file.type === "text/plain" || file.type === "application/pdf") && (
          <iframe src={url} className="w-full h-96 border-0 rounded-lg" title={file.name} />
        )}
        {!file.type.startsWith("image/") &&
          !file.type.startsWith("audio/") &&
          file.type !== "text/plain" &&
          file.type !== "application/pdf" && (
            <div className="text-center p-12 bg-gradient-to-br from-gray-900 to-black text-gray-300 rounded-lg">
              <div className="text-6xl mb-4">📄</div>
              <p className="text-xl font-medium mb-2">{file.name}</p>
              <p className="text-gray-500">Preview not available for this file type Since Browser Does Not support This</p>
            </div>
          )}
      </div>
    </div>
  );
};

export default FileViewer;
