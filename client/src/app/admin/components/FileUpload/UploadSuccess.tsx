import React from "react";
import Image from 'next/image';
import type { UploadedFile } from "../../../admin/hooks/useFileUpload";

interface UploadSuccessProps {
  uploadedFiles: UploadedFile[];
}

const UploadSuccess: React.FC<UploadSuccessProps> = ({ uploadedFiles }) => {
  if (uploadedFiles.length === 0) return null;

  return (
    <div className="mt-6 p-6 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
      <div className="flex items-center mb-4">
        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
          <span className="text-white text-lg">✓</span>
        </div>
        <div>
          <p className="font-semibold text-green-300 text-lg">Upload Successful!</p>
          <p className="text-green-400/70 text-sm">{uploadedFiles.length} files uploaded</p>
        </div>
      </div>
      
      <div className="space-y-2 max-h-48 overflow-y-scroll no-scrollbar">
        {uploadedFiles.map((file, idx) => (
          <a
            key={file.documentEncryptedId || file.link || idx}
            href={file.link}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-3 rounded-lg bg-black/20 hover:bg-black/30 transition-all duration-200 group"
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {file.thumb ? (
                <Image
                  src={file.thumb}
                  alt={file.name}
                  width={40}
                  height={40}
                  unoptimized
                  className="w-10 h-10 rounded-md object-cover"
                />
              ) : (
                <span className="text-green-400 text-lg">📄</span>
              )}
              <span className="text-green-300 truncate group-hover:text-green-200 transition-colors duration-200">
                {file.name}
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

export default UploadSuccess;
