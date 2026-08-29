export interface CitationFileInfo {
  fileId?: string;
  pageNumbers?: number[];
  startTime?: number;
  endTime?: number;
  duration?: number;
}

export interface Citation {
  files: string[];
  fileNames: string[];
  fileInfos?: CitationFileInfo[];
}

export interface SystemResponse {
  answer: string;
  citation: Citation;
}

export interface Exchange {
  id: string;
  userQuery: string;
  systemResponse: SystemResponse;
  createdAt: string;
  image?: string;
}

export interface RetrievedDocument {
  metadata: {
    file_id: string;
    chunk_type?: string;
    page_number?: number;
    start_time?: number;
    end_time?: number;
    duration?: number;
  };
}

export interface StreamFinalData {
  answer?: string;
  retrieved_documents?: RetrievedDocument[];
}
