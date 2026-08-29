import { Queue, Job } from 'bullmq';
import path from 'path';
import fs from 'fs/promises';
import mime from 'mime-types';
import { redisConnection } from '../config/redis';
import { generateHash } from '../lib/crypto';
import { insertInitialDocumentData, getFilePath, getThumbFilePath, getUnprocessedFilesFromDB, updateFileStatusInDB, reindexDocumentsInDB, heartbeatIngestionLeaseInDB } from '../lib/dbOperations';
import { IMAGE_MAX_SIZE } from '../config/envExports';
import { getFolderHashAndFileCount } from '../lib/fileStructure';
import { CATEGORY_IDS, FileTypeDetectionResult } from '../lib/magicNumberDetection';
import { prisma } from "../config/prisma";
import { INGESTION_SERVICE_TOKEN, PYTHON_SERVER_URL } from '../config/envExports';


// Queue configuration
const queueConfig = {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  }
};

// Initialize queues
const imageProcessingQueue = new Queue('image-processing', queueConfig);
const audioProcessingQueue = new Queue('audio-processing', queueConfig);
const pdfProcessingQueue = new Queue('pdf-processing', queueConfig);
const documentProcessingQueue = new Queue('document-processing', queueConfig);

export class FileService {
  private static async assertDocumentReadable(
    encryptedId: string,
    requester?: { id: string; role: string },
  ): Promise<void> {
    // An undefined requester is the authenticated ingestion service.
    if (!requester) return;
    const document = await prisma.document.findUnique({
      where: { documentEncryptedId: encryptedId },
      select: { visibility: true, ownerId: true },
    });
    if (
      !document
      || (
        document.visibility !== 'GLOBAL'
        && document.ownerId !== requester.id
        && requester.role !== 'ADMIN'
      )
    ) {
      throw new Error('File not found');
    }
  }
  
    /**
   * Safe file deletion with retry logic for Windows
   */
  public static async safeDeleteFile(filePath: string, maxRetries: number = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await fs.unlink(filePath);
        return;
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          // File doesn't exist, consider it successfully deleted
          return;
        }
        
        if (attempt === maxRetries) {
          console.warn(`Failed to delete file ${filePath} after ${maxRetries} attempts:`, error);
          return; // Don't throw error, just log warning
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }
  
  /**
   * Process securely validated files and queue them for processing
   */
  static async processSecureUploadedFiles(files: any[], payload: any, query: any): Promise<any[]> {
    const fileType: number = parseInt(query.fileType as string) || 1;

    // Use project root directory for uploads
    const projectRoot = process.cwd();
    const pathToUpload = path.join(projectRoot, 'uploads', 'temp');
    
    // Ensure upload directory exists
    try {
      await fs.access(pathToUpload);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        await fs.mkdir(pathToUpload, { recursive: true });
      } else {
        throw err;
      }
    }

    const tasks = files.map(async (file) => {
      // Use the securely detected file type instead of user-provided or default
      const secureFileType = this.getSecureFileType(file);
      return await this.processIndividualSecureFile(file, secureFileType, payload, query, pathToUpload);
    });

    return await Promise.all(tasks);
  }


  static async getDocumentbyPage(pageNo: number, docType?: number) {
       
        const pageSize = 20;
       // No need to check if pageNo exists, it will be 1 by default
       const skip = (pageNo - 1) * pageSize;
       // build where condition dynamically (this part was already correct)
        const whereClause = docType==0 ? {} : { documentType: docType };
    
        const documents = await prisma.document.findMany({
          where: whereClause,
          orderBy: {  id: "desc" },
          skip,
          take: pageSize,
        });
    
        const totalCount = await prisma.document.count({
          where: whereClause,
        });

        return {
          pageNo,
          pageSize,
          totalPages: Math.ceil(totalCount / pageSize),
          totalCount,
          documents
        }
  
  }


  static async getDocumentsByName(name: string, pageNo: number, docType: number) {
  
        const pageSize = 20;
        const skip = (pageNo - 1) * pageSize;
    
        const whereClause = docType==0 ? {} : { documentType: docType };
        // fetch documents by partial name match
        const documents = await prisma.document.findMany({
          where: {
            displayName: {
              contains: name, // partial match
              mode: "insensitive", // case insensitive search
            },
            ...whereClause,
          },
          orderBy: { id: "desc" },
          skip,
          take: pageSize,
        });
    
        // total count for pagination metadata
        const totalCount = await prisma.document.count({
          where: {
            displayName: {
              contains: name,
              mode: "insensitive",
            },
          },
        });

        return {
          documents,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
          pageNo,
          pageSize,
        }
  }

  static async getDocumentsByEncrypterID(id: string){

    const document = await prisma.document.findUnique({
      where: { documentEncryptedId: id },
    });

    if (!document) {
      return { status: 404, message:"Document not Found"};
    }
    return {
      document
    };
  }

  static async deleteDocumentByEncryptedId(id: string) {

    // find document
    const document = await prisma.document.findUnique({
      where: { documentEncryptedId: id },
    });

    if (!document) {
      return "Document not found";
    }

    const vectorDeleteResponse = await fetch(
      `${PYTHON_SERVER_URL}/api/vectors/documents/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${INGESTION_SERVICE_TOKEN}`,
        },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!vectorDeleteResponse.ok) {
      const errorBody = await vectorDeleteResponse.text();
      throw new Error(
        `Vector deletion failed (${vectorDeleteResponse.status}): ${errorBody}`,
      );
    }

    const pathsToDelete = [document.documentPath, document.thumbPath].filter(
      (filePath): filePath is string => Boolean(filePath),
    );

    for (const filePath of pathsToDelete) {
      try {
        const absPath = path.resolve(filePath); // ensure absolute path
        await fs.unlink(absPath);
        console.log(`Deleted file: ${absPath}`);
      } catch (err) {
        console.warn(`Could not delete file at ${filePath}:`, (err as Error).message);
      }
    }

    // delete record from DB (optional, remove if you just want file delete)
    await prisma.document.delete({
      where: { documentEncryptedId: id },
    });
    return "Deleted Succefully"
       
    
  }

  /**
   * Original method for backward compatibility (legacy - less secure)
   */
  static async processUploadedFiles(files: Express.Multer.File[], payload: any, query: any): Promise<any[]> {
    const fileType: number = parseInt(query.fileType as string) || 1;

    // Use project root directory for uploads
    const projectRoot = process.cwd();
    const pathToUpload = path.join(projectRoot, 'uploads', 'temp');
    
    // Ensure upload directory exists
    try {
      await fs.access(pathToUpload);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        await fs.mkdir(pathToUpload, { recursive: true });
      } else {
        throw err;
      }
    }

    const tasks = files.map(async (file) => {
      return await this.processIndividualFile(file, fileType, payload, query, pathToUpload);
    });

    return await Promise.all(tasks);
  }

  /**
   * Process individual file and add to appropriate queue
   */
  private static async processIndividualFile(
    file: Express.Multer.File, 
    fileType: number, 
    payload: any, 
    query: any, 
    pathToUpload: string
  ) {
    const sizeInBytes = file.size;
    const sizeInMB = parseFloat((sizeInBytes / (1024 * 1024)).toFixed(2));

    const { folderHash, fileCount, hashes } = await getFolderHashAndFileCount(); 

    const encryptedId = folderHash + generateHash(70); 

    // Insert initial document data
    const documentId = await insertInitialDocumentData({
      docType: fileType,
      displayName: file.originalname,
      encryptedId,
      originalSize: sizeInMB,
      fileExt: path.extname(file.originalname),
      visibility: payload.visibility === 'PRIVATE' ? 'PRIVATE' : 'GLOBAL',
      ownerId: payload.visibility === 'PRIVATE'
        ? (payload.ownerId || payload.uploaderUserId)
        : undefined,
  });

    // Generate sanitized filename
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/\s+/g, '_').slice(0, 50);
    const sanitizedFileName = `${baseName}${ext}`;
    const fileName = `${Date.now()}-${sanitizedFileName}`;

    const finalLink = `${process.env.DOMAIN_NAME}/api/file/v1/files/${encryptedId}`;
    const finalThumbLink = `${process.env.DOMAIN_NAME}/api/file/v1/thumb/${encryptedId}`;

    let job: Job | null = null;

    try {
      switch (fileType) {
        case 1: // Image
          job = await this.processImageFile(file, fileName, pathToUpload, payload, query, documentId, finalLink, finalThumbLink, hashes);
          break;
        case 2: // Audio
          job = await this.processAudioFile(file, fileName, pathToUpload, payload, documentId, finalLink, finalThumbLink, hashes);
          break;
        case 3: // PDF
          job = await this.processPdfFile(file, fileName, pathToUpload, payload, documentId, finalLink, finalThumbLink, hashes);
          break;
        case 4: // MS Word/Document files
          job = await this.processDocumentFile(file, fileName, pathToUpload, payload, documentId, finalLink, finalThumbLink, hashes);
          break;
        default:
          throw new Error('Unsupported file type');
      }

      return {
        name: sanitizedFileName,
        jobId: job?.id,
        link: finalLink,
        thumb: finalThumbLink,
        fileType,
        status: 'queued',
      };
    } catch (error) {
      console.error('Error processing file:', error);
      return {
        name: sanitizedFileName,
        status: 'error',
        error: error instanceof Error ? error.message : 'Processing failed',
      };
    }
  }

  /**
   * Get secure file type from validated file with detection results
   */
  private static getSecureFileType(file: any): number {
    // Check if file has detection results from middleware
    if (file.detectionResult && file.detectionResult.categoryId) {
      // Convert negative category IDs to positive for processing
      return Math.abs(file.detectionResult.categoryId);
    }
    
    // Fallback to MIME type detection if no detection results
    if (file.mimetype) {
      if (file.mimetype.startsWith('image/')) return 1;
      if (file.mimetype.startsWith('audio/')) return 2;
      if (file.mimetype === 'application/pdf') return 3;
      if (file.mimetype.includes('word') || 
          file.mimetype === 'application/msword' ||
          file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return 4;
      }
    }
    
    return 1; // Default to image
  }

  /**
   * Process individual securely validated file
   */
  private static async processIndividualSecureFile(
    file: any,
    fileType: number,
    payload: any,
    query: any,
    pathToUpload: string
  ) {
    const sizeInBytes = file.size;
    const sizeInMB = parseFloat((sizeInBytes / (1024 * 1024)).toFixed(2));

    const { folderHash, fileCount, hashes } = await getFolderHashAndFileCount(); 

    const encryptedId = folderHash + generateHash(70);

    // Use the secure detected extension instead of original filename extension
    const detectedExtension = file.detectionResult?.detectedExtension || path.extname(file.originalname);
    const secureOriginalName = file.originalname;

    // Insert initial document data with secure type information
    const documentId = await insertInitialDocumentData({
      docType: fileType,
      displayName: secureOriginalName,
      encryptedId,
      originalSize: sizeInMB,
      fileExt: detectedExtension,
      visibility: payload.visibility === 'PRIVATE' ? 'PRIVATE' : 'GLOBAL',
      ownerId: payload.visibility === 'PRIVATE'
        ? (payload.ownerId || payload.uploaderUserId)
        : undefined,
    });

    // Generate sanitized filename using detected extension for security
    const baseName = path.basename(secureOriginalName, path.extname(secureOriginalName))
      .replace(/\s+/g, '_').slice(0, 50);
    const sanitizedFileName = `${baseName}.${detectedExtension.replace('.', '')}`;
    const fileName = `${Date.now()}-${sanitizedFileName}`;

    const finalLink = `${process.env.DOMAIN_NAME}/api/file/v1/files/${encryptedId}`;
    const finalThumbLink = `${process.env.DOMAIN_NAME}/api/file/v1/thumb/${encryptedId}`;

    let job: Job | null = null;

    try {
      switch (fileType) {
        case 1: // Image
          job = await this.processImageFile(file, fileName, pathToUpload, payload, query, documentId, finalLink, finalThumbLink, hashes);
          break;
        case 2: // Audio
          job = await this.processAudioFile(file, fileName, pathToUpload, payload, documentId, finalLink, finalThumbLink, hashes);
          break;
        case 3: // PDF
          job = await this.processPdfFile(file, fileName, pathToUpload, payload, documentId, finalLink, finalThumbLink, hashes);
          break;
        case 4: // MS Word/Document files
          job = await this.processDocumentFile(file, fileName, pathToUpload, payload, documentId, finalLink, finalThumbLink, hashes);
          break;
        default:
          throw new Error('Unsupported file type');
      }

      return {
        name: sanitizedFileName,
        jobId: job?.id,
        link: finalLink,
        thumb: finalThumbLink,
        fileType,
        status: 'queued',
        securityInfo: file.detectionResult ? {
          originalClaimedType: file.originalname.split('.').pop(),
          detectedType: file.detectionResult.detectedCategory,
          mimeType: file.detectionResult.detectedMimeType,
          wasSecure: !file.detectionResult.securityRisk,
          magicNumberMatch: true
        } : undefined
      };
    } catch (error) {
      console.error('Error processing secure file:', error);
      return {
        name: sanitizedFileName,
        status: 'error',
        error: error instanceof Error ? error.message : 'Processing failed',
        securityInfo: file.detectionResult ? {
          detectedType: file.detectionResult.detectedCategory,
          wasSecure: !file.detectionResult.securityRisk
        } : undefined
      };
    }
  }

  /**
   * Process image file
   */
  private static async processImageFile(
    file: Express.Multer.File,
    fileName: string,
    pathToUpload: string,
    payload: any,
    query: any,
    documentId: number,
    finalLink: string,
    finalThumbLink: string,
    hashes: string[]
  ) {
    const sizeInMB = parseFloat((file.size / (1024 * 1024)).toFixed(2));
    
    if (sizeInMB > IMAGE_MAX_SIZE) {
      throw new Error('File too large');
    }

    const width = parseInt(query.width) || parseInt(process.env.DEFAULT_IMAGE_WIDTH || '800');
    const height = parseInt(query.height) || parseInt(process.env.DEFAULT_IMAGE_HEIGHT || '600');
    const quality = parseInt(query.quality) || parseInt(process.env.DEFAULT_IMAGE_QUALITY || '80');
    
    const tempInput = path.join(pathToUpload, `temp-${fileName}`);
    await fs.writeFile(tempInput, file.buffer);
    
    const projectRoot = process.cwd();
    const finalFilePath = path.join(projectRoot, 'uploads', ...hashes, path.parse(fileName).name + '.webp');

    return await imageProcessingQueue.add('image-processing', {
      documentId,
      filePath: tempInput,
      width,
      height,
      quality,
      fileName,
      finalFilePath,
      finalLink,
      finalThumbLink
    }, {
      jobId: this.generateJobId(documentId, 1),
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      delay: 0,
      priority: 0,
      removeOnComplete: 10,
      removeOnFail: 5,
    });
  }

  /**
   * Process audio file
   */
  private static async processAudioFile(
    file: Express.Multer.File,
    fileName: string,
    pathToUpload: string,
    payload: any,
    documentId: number,
    finalLink: string,
    finalThumbLink: string,
    hashes: string[]
  ) {
    const sizeInMB = parseFloat((file.size / (1024 * 1024)).toFixed(2));
    const maxSize = parseFloat(process.env.AUDIO_MAX_SIZE || '50');
    
    if (sizeInMB > maxSize) {
      throw new Error('File too large');
    }

    const projectRoot = process.cwd();
    // Change extension to .wav for audio output
    const baseFileName = path.parse(fileName).name;
    const wavFileName = baseFileName + '.wav';
    const outputPath = path.join(projectRoot, 'uploads', ...hashes, wavFileName);
    const tempInput = path.join(pathToUpload, `temp-${fileName}`);
    await fs.writeFile(tempInput, file.buffer);

    return await audioProcessingQueue.add('audio-processing', {
      documentId,
      filePath: tempInput,
      originalname: file.originalname,
      finalFilePath: outputPath,
      finalLink,
      finalThumbLink
    }, {
      jobId: this.generateJobId(documentId, 2),
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      delay: 0,
      priority: 0,
      removeOnComplete: 10,
      removeOnFail: 5,
    });
  }

  /**
   * Process PDF file
   */
  private static async processPdfFile(
    file: Express.Multer.File,
    fileName: string,
    pathToUpload: string,
    payload: any,
    documentId: number,
    finalLink: string,
    finalThumbLink: string,
    hashes: string[]
  ) {
    const sizeInMB = parseFloat((file.size / (1024 * 1024)).toFixed(2));
    const maxSize = parseFloat(process.env.PDF_MAX_SIZE || '50');
    
    if (sizeInMB > maxSize) {
      throw new Error('File too large');
    }

    const projectRoot = process.cwd();
    const outputPath = path.join(projectRoot, 'uploads', ...hashes, fileName);
    const tempInput = path.join(pathToUpload, `temp-${fileName}`);
    await fs.writeFile(tempInput, file.buffer);

    return await pdfProcessingQueue.add('pdf-processing', {
      documentId,
      filePath: tempInput,
      finalFilePath: outputPath
    }, {
      jobId: this.generateJobId(documentId, 3),
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      delay: 0,
      priority: 0,
      removeOnComplete: 10,
      removeOnFail: 5,
    });
  }

  /**
   * Process document files (MS Word, etc.)
   */
  private static async processDocumentFile(
    file: Express.Multer.File,
    fileName: string,
    pathToUpload: string,
    payload: any,
    documentId: number,
    finalLink: string,
    finalThumbLink: string,
    hashes: string[]
  ) {
    const sizeInMB = parseFloat((file.size / (1024 * 1024)).toFixed(2));
    const maxSize = parseFloat(process.env.DOCUMENT_MAX_SIZE || '25');
    
    if (sizeInMB > maxSize) {
      throw new Error('File too large');
    }

    const projectRoot = process.cwd();
    const outputPath = path.join(projectRoot, 'uploads', ...hashes, fileName);
    const tempInput = path.join(pathToUpload, `temp-${fileName}`);
    await fs.writeFile(tempInput, file.buffer);

    return await documentProcessingQueue.add('document-processing', {
      documentId,
      filePath: tempInput,
      originalname: file.originalname,
      finalFilePath: outputPath,
      finalLink,
      finalThumbLink
    }, {
      jobId: this.generateJobId(documentId, 4),
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      delay: 0,
      priority: 0,
      removeOnComplete: 10,
      removeOnFail: 5,
    });
  }

  /**
   * Get job status
   */
  static async getJobStatus(jobId: string, fileType: string): Promise<any> {
    let queue: Queue;
    
    switch (fileType) {
      case '1':
        queue = imageProcessingQueue;
        break;
      case '2':
        queue = audioProcessingQueue;
        break;
      case '3':
        queue = pdfProcessingQueue;
        break;
      case '4':
        queue = documentProcessingQueue;
        break;
      default:
        queue = imageProcessingQueue;
    }

    const job = await queue.getJob(jobId);
    
    if (!job) {
      throw new Error('Job not found');
    }

    const state = await job.getState();
    const progress = job.progress;

    return {
      id: job.id,
      name: job.name,
      state,
      result: job.returnvalue,
      progress,
    };
  }

  /**
   * Get file by encrypted ID
   */
  static async getFileByEncryptedId(
    encryptedId: string,
    requester?: { id: string; role: string },
  ): Promise<{ filePath: string; mimeType: string }> {
    await this.assertDocumentReadable(encryptedId, requester);
    const filePath = await getFilePath(encryptedId);

    if (typeof filePath === 'number') {
      const errorMessages: Record<string, string> = {
        '-1': 'File not found',
        '-2': 'File not processed',
        '-3': 'Server error while locating file'
      };
      throw new Error(errorMessages[filePath.toString()] || 'Unknown error');
    }

    if (!filePath) {
      throw new Error('File path is null or undefined');
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      throw new Error('File not accessible');
    }

    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    
    return { filePath, mimeType };
  }

  /**
   * Get thumbnail by encrypted ID
   */
  static async getThumbnailByEncryptedId(
    encryptedId: string,
    requester?: { id: string; role: string },
  ): Promise<{ filePath: string; mimeType: string }> {
    await this.assertDocumentReadable(encryptedId, requester);
    const filePath = await getThumbFilePath(encryptedId);

    if (typeof filePath === 'number') {
      const errorMessages: Record<string, string> = {
        '-2': 'Thumbnail not processed',
        '-3': 'Server error while locating thumbnail'
      };
      throw new Error(errorMessages[filePath.toString()] || 'Unknown error');
    }

    if (!filePath) {
      throw new Error('Thumbnail path is null or undefined');
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      throw new Error('Thumbnail not accessible');
    }

    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    
    return { filePath, mimeType };
  }

  static async getUnprocessedFiles(batchSize: number): Promise<any[]> {
    const unprocessedFiles = await getUnprocessedFilesFromDB(batchSize);
    return unprocessedFiles;
  }

  static async updateFileStatus(
    documentId: string,
    processingLeaseId: string,
    status: 'COMPLETED' | 'FAILED',
    vectorManifest?: {
      vectorIdPrefix: string;
      chunkCount: number;
      embeddingModel: string;
      indexVersion: string;
    },
  ): Promise<any> {
    try {
      const result = await updateFileStatusInDB(
        documentId, processingLeaseId, status, vectorManifest,
      );
      return result;
    } catch (error) {
      throw new Error('Failed to update file status');
    }
  }

  static async scheduleReindex(documentIds: string[], targetIndexVersion: string) {
    return reindexDocumentsInDB(documentIds, targetIndexVersion);
  }

  static async heartbeatIngestionLease(
    documentId: string, processingLeaseId: string,
  ) {
    return heartbeatIngestionLeaseInDB(documentId, processingLeaseId);
  }

  static async getFileNamesByIds(
    encryptedIds: string[],
    requester: { id: string; role: string },
  ): Promise<string[]> {
    const documents = await prisma.document.findMany({
      where: {
        documentEncryptedId: { in: encryptedIds },
        ...(requester.role === 'ADMIN' ? {} : {
          OR: [
            { visibility: 'GLOBAL' as const },
            { visibility: 'PRIVATE' as const, ownerId: requester.id },
          ],
        }),
      },
      select: { documentEncryptedId: true, displayName: true },
    });
    const names = new Map(
      documents.map(document => [document.documentEncryptedId, document.displayName]),
    );
    return encryptedIds.flatMap(id => names.has(id) ? [names.get(id)!] : []);
  }

  /**
   * Generate unique job ID
   */
  private static generateJobId(documentId: number, fileType: number): string {
    return `${fileType}-${documentId}-${Date.now()}`;
  }
}
