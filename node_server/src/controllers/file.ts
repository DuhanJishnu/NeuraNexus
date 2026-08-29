import { NextFunction, Request, Response } from "express";
import { FileService } from "../services/file";
import { updateFileStatusSchema, reindexDocumentsSchema, ingestionHeartbeatSchema, fetchDocumentsSchema,fetchDocumentsByNameSchema,fetchDocumentsByIdSchema} from "../schemas/document";
import { CATEGORY_IDS } from "../lib/magicNumberDetection";





/**
 * Upload controller - handles file uploads
 */
export const upload = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const query = req.query;
    const payload = {
      ...req.body,
      uploaderUserId: req.user!.id,
    };

    if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
    
    // Get file validation results from middleware
    const validationSummary = (req as any).fileValidation;
    
    // Process files using service - now with securely validated file types
    const results = await FileService.processSecureUploadedFiles(files, payload, query);

    res.status(200).json({
      message: 'Files are being processed in background',
      files: results,
      securityInfo: validationSummary ? {
        totalFiles: validationSummary.totalFiles,
        validatedFiles: validationSummary.validatedFiles,
        rejectedFiles: validationSummary.rejectedFiles,
        securityRisksDetected: validationSummary.hasSecurityRisks
      } : undefined
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Get job status controller
 */
export const getJobStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = req.params.id;
    const fileType = req.query.fileType as string || '1';

    const jobStatus = await FileService.getJobStatus(jobId, fileType);
    res.json(jobStatus);
  } catch (error) {
    next(error);
  }
};

/**
 * Serve file controller
 */
export const serveFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const encryptedId = req.params.encryptedId;
    const { filePath, mimeType } = await FileService.getFileByEncryptedId(
      encryptedId,
      req.user ? { id: req.user.id, role: req.user.role } : undefined,
    );
    
    res.setHeader('Content-Type', mimeType);
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
};

/**
 * Serve thumbnail controller
 */
export const serveThumbnail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const encryptedId = req.params.encryptedId;
    const { filePath, mimeType } = await FileService.getThumbnailByEncryptedId(
      encryptedId,
      req.user ? { id: req.user.id, role: req.user.role } : undefined,
    );
    
    res.setHeader('Content-Type', mimeType);
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
};

export const getUnprocessedFiles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestedBatchSize = parseInt(req.query.batch_size as string) || 4;
    const batch_size = Math.min(Math.max(requestedBatchSize, 1), 100);

    const unprocessedFiles = await FileService.getUnprocessedFiles(batch_size);
    res.json(unprocessedFiles);
  } catch (error) {
    next(error);
  }
};

export const updateFileStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = updateFileStatusSchema.safeParse(req.body); 
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Invalid request data', details: parsedBody.error });
    }

    const { documentId, processingLeaseId, status, vectorManifest } = parsedBody.data;

    const result = await FileService.updateFileStatus(
      documentId, processingLeaseId, status, vectorManifest,
    );
    if (result.success === true) {
      return res.status(200).json({ message: 'File status updated successfully' });
    } else {
      return res.status(409).json({ error: result.message });
    }
  } catch (error) {
    next(error);
  }
};

export const reindexDocuments = async (req: Request, res: Response) => {
  const parsedBody = reindexDocumentsSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({
      error: 'Invalid reindex request',
      details: parsedBody.error,
    });
  }
  const result = await FileService.scheduleReindex(
    parsedBody.data.documentIds,
    parsedBody.data.targetIndexVersion,
  );
  return res.status(202).json(result);
};

export const heartbeatIngestionLease = async (req: Request, res: Response) => {
  const parsedBody = ingestionHeartbeatSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ error: 'Invalid heartbeat request' });
  }
  const renewed = await FileService.heartbeatIngestionLease(
    parsedBody.data.documentId,
    parsedBody.data.processingLeaseId,
  );
  if (!renewed) {
    return res.status(409).json({ error: 'Ingestion lease is stale or invalid' });
  }
  return res.status(204).send();
};



export const getDocumentsByPage = async (req: Request, res: Response) => {
  try {
    // Parsing is now safer and provides a default for pageNo
    console.log(req.body);

    const { pageNo, docType } = fetchDocumentsSchema.parse(req.body);

    const result=await FileService.getDocumentbyPage(pageNo,docType);
    
    return res.json({
      result
    });
  } catch (err) {
    
      return res.status(400).json({ error: (err as Error).message });
    
    
  }
};




export const getDocumentsByName = async (req: Request, res: Response) => {


  try {
    // validate query params
    const { pageNo, name, docType } = fetchDocumentsByNameSchema.parse(req.body);

    const result=await FileService.getDocumentsByName(name,pageNo,docType);

    return res.json({
     result
    });
  } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    
  
  }
};

export const getDocumentsByEncrypterID = async (req: Request, res: Response) => {
  try {
    const { id } = fetchDocumentsByIdSchema.parse(req.body);

    const result=await FileService.getDocumentsByEncrypterID(id);

    if(result.status){
      return res.status(404).json({ error: result.message });
    }

    return res.json(result);
  } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    
  }
};






export const deleteDocumentByEncryptedId = async (req: Request, res: Response) => {
  try {
    // validate request
    const { id } = fetchDocumentsByIdSchema.parse(req.body);

    const message=await FileService.deleteDocumentByEncryptedId(id);
    

    return res.json({
      message: message,
      deletedDocumentId: id,
    });
  } catch (err) {
      return res.status(400).json({ error: (err as Error).message });

  }
};

export const getFileNamesById = async (req: Request, res: Response) => {
  try {
    const encryptedIds: string[] = req.body.encryptedIds;
    if (!encryptedIds) {
      return res.status(400).json({ error: 'Missing encryptedIds in request body' });
    }

    const fileNames = await FileService.getFileNamesByIds(
      encryptedIds,
      { id: req.user!.id, role: req.user!.role },
    );
    res.json({ fileNames });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve file names', message: error instanceof Error ? error.message : 'Unknown error' });
  }
};
