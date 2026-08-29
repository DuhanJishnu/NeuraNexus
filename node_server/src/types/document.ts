export interface InsertInitialDocumentData {
  docType: number;
  displayName: string;
  encryptedId: string;
  originalSize: number;
  fileExt: string;
  visibility: 'GLOBAL' | 'PRIVATE';
  ownerId?: string;
}

export interface UpdateDocumentStatusData {
  documentId: number;
  documentPath: string;
  currentFileSize: number;
  isCompressed: boolean;
  thumbFilePath: string;
}
