// app/admin/components/FileUpload/index.tsx
'use client'

import React from "react";
import FileDropzone from "./FileDropZone";
import FilePreviewList from "./FilePreviewList";
import FileViewer from "./FileViewer";
import UploadButton from "./UploadButton";
import UploadSuccess from "./UploadSuccess";
import  { useFileUpload } from "../../hooks/useFileUpload";
import FileList from "./FileList";
import Pagination from "./Pagination";
import FilterDropdown from "./FilterDropdown";
import SearchBar from "./SearchBar";
const FileUpload: React.FC = () => {
  const upload = useFileUpload();
const handlePageChange = (page: number) => {
    if (upload.searchQuery) {
    upload.searchFiles(upload.searchQuery, page);
  } else {
    upload.fetchFiles(page);
  }
  };
  return (
    <div className="rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mr-3">
              <span className="text-white text-lg">📂</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">File Upload</h2>
              <p className="text-gray-400 text-sm">Upload and manage your files</p>
            </div>
          </div>
          {upload.files.length > 0 && (
            <button 
              onClick={upload.clearAllFiles}
              className="px-4 py-2 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all duration-200 font-medium flex items-center"
            >
              <span className="mr-2">🗑️</span>
              Clear All
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {/* if someone select file or drop file then add to addFiles */}
        <FileDropzone 
          addFiles={upload.addFiles} 
          isDragging={upload.isDragging} 
          setIsDragging={upload.setIsDragging} 
        />
        {/* if file is there then show them and generate a temp url for preview that will be revoked when file changes*/}
        <FilePreviewList {...upload} />

        {upload.selectedFile && (
          <FileViewer file={upload.selectedFile} onClose={() => upload.setSelectedFile(null)} />
        )}

        {upload.error && (
          <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 flex items-center">
            <span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span>
            {upload.error}
          </div>
        )}

        <UploadButton files={upload.files} loading={upload.loading} onUpload={upload.handleUpload} />

        <UploadSuccess uploadedFiles={upload.uploadedFiles} />


        {/* last */}
        <div className="mt-8 pt-8 border-t border-gray-700">

          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center">
              <span className="w-3 h-3 bg-blue-500 rounded-full mr-3"></span>
              File Library
            </h3>
            <div className="group relative">
              <FilterDropdown 
                currentFilter={upload.fileFilterType}
                onFilterChange={upload.setFileFilterType}
              />
            </div>
          </div>

          <SearchBar 
  onSearch={upload.searchFiles}
  searchQuery={upload.searchQuery}
  loading={upload.filesLoading}
/>
          <FileList 
            files={upload.paginatedFiles.files}
            loading={upload.filesLoading}
            error={upload.filesError}
            fileTypeFilter={upload.fileFilterType}
            filteredCount={upload.paginatedFiles.files.length} 
            onFileDelete={upload.deleteFile}
  deleteLoading={upload.deleteLoading}
   fileIds={upload.paginatedFiles.files.map(file => file.id || 0)}
  documentEncryptedIds={upload.paginatedFiles.files.map(file => file.documentEncryptedId || '')}
   searchQuery={upload.searchQuery}
          />
          
          <Pagination
            currentPage={upload.paginatedFiles.currentPage}
            totalPages={upload.paginatedFiles.totalPages}
            hasNext={upload.paginatedFiles.hasNext}
            hasPrev={upload.paginatedFiles.hasPrev}
            onPageChange={handlePageChange}
            loading={upload.filesLoading}
          />
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
