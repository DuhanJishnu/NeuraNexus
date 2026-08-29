import { Router } from 'express';
import multer from 'multer';
import { errorHandler } from '../error-handler';
import { upload, getJobStatus, serveFile, serveThumbnail, getUnprocessedFiles, updateFileStatus, heartbeatIngestionLease, reindexDocuments,getDocumentsByPage,getDocumentsByName,getDocumentsByEncrypterID, deleteDocumentByEncryptedId, getFileNamesById } from '../controllers/file';
import { uploadFileValidation } from '../middlewares/secureFileValidation';
import authMiddleware from '../middlewares/auth';
import adminMiddleware from '../middlewares/admin';
import { serviceAuthMiddleware, userOrServiceAuthMiddleware } from '../middlewares/serviceAuth';

  const fileRoutes: Router = Router();

  // Configure multer for memory storage
  const storage = multer.memoryStorage();
  const uploadMiddleware = multer({ 
    storage: storage,
  });

// Routes
fileRoutes.post('/upload', 
  authMiddleware,
  adminMiddleware,
  uploadMiddleware.array('files'), 
  uploadFileValidation, // Add secure file validation with magic number detection
  errorHandler(upload)
);
fileRoutes.get('/job/:id', authMiddleware, adminMiddleware, errorHandler(getJobStatus));
fileRoutes.get('/files/:encryptedId', userOrServiceAuthMiddleware, errorHandler(serveFile));
fileRoutes.get('/thumb/:encryptedId', authMiddleware, errorHandler(serveThumbnail));
fileRoutes.get('/unprocessed', serviceAuthMiddleware, errorHandler(getUnprocessedFiles));
fileRoutes.patch('/update-status', serviceAuthMiddleware, errorHandler(updateFileStatus));
fileRoutes.patch('/heartbeat', serviceAuthMiddleware, errorHandler(heartbeatIngestionLease));
fileRoutes.post('/reindex', authMiddleware, adminMiddleware, errorHandler(reindexDocuments));
fileRoutes.post('/fetchdocuments', authMiddleware, adminMiddleware, errorHandler(getDocumentsByPage));
fileRoutes.post('/fetchdocumentsbyName', authMiddleware, adminMiddleware, errorHandler(getDocumentsByName));
fileRoutes.post('/fetchdocumentsbyID', authMiddleware, adminMiddleware, errorHandler(getDocumentsByEncrypterID));
fileRoutes.delete('/delete', authMiddleware, adminMiddleware, errorHandler(deleteDocumentByEncryptedId));
fileRoutes.post('/getFileNamesbyId', authMiddleware, errorHandler(getFileNamesById));

  export default fileRoutes;
