import { prisma } from "../config/prisma";
import { insertInitialDocumentSchema, updateDocumentStatusSchema } from "../schemas/document";
import { InsertInitialDocumentData, UpdateDocumentStatusData } from "../types/document";

/**
 * Inserts a new document record into the Documents table.
 * 
 * @param {number} data.docType - Tinyint representing the document type
 * @param {string} data.displayName - The name to display
 * @param {string} data.encryptedId - The encrypted identifier
 * @param {number} data.originalSize - Original file size in MB/KB (float)
 * @param {string} data.fileExt - File extension (e.g., "pdf", "jpg")
 */

export async function insertInitialDocumentData(data: InsertInitialDocumentData) {
  try {
    const parsedBody = insertInitialDocumentSchema.safeParse(data);
    if (!parsedBody.success) {
      throw new Error(`Validation failed: ${JSON.stringify(parsedBody.error)}`);
    }

    const { docType, displayName, encryptedId, originalSize, fileExt } = parsedBody.data;

    const document = await prisma.document.create({
      data: {
        documentType: docType,
        displayName: displayName,
        documentEncryptedId: encryptedId,
        originalFileSize: originalSize,
        fileExtension: fileExt,
      },
    });
    
    return document.id;
  } catch (err) {
    console.error('Error inserting initial document data:', (err as Error).message);
    throw err;
  }
}


/**
 * Updates a document record with processing results.
 * 
 * @param {number} data.documentId - The ID of the document to update
 * @param {string} data.documentPath - Final path of the processed document
 * @param {number} data.currentFileSize - The compressed/current file size
 * @param {boolean|number} data.isCompressed - Whether the document was processed (0 or 1)
 * @param {Date|string} data.compressedDateTime - Timestamp of processing (can be JS Date or MySQL datetime string)
 */

export async function updateDocumentStatus(data: UpdateDocumentStatusData) {
  try {
    // 🧪 Validate inputs
    const parsedInputs = updateDocumentStatusSchema.safeParse(data); 
    if (!parsedInputs.success) {
      throw new Error(`Validation failed: ${JSON.stringify(parsedInputs.error)}`);
    }

    const updatedDocument = await prisma.document.update({
      where: { id: parsedInputs.data.documentId },
      data: {
        documentPath: parsedInputs.data.documentPath,
        currentFileSize: parsedInputs.data.currentFileSize,
        isCompressed: parsedInputs.data.isCompressed,
        compressedDateTime: new Date(),
        thumbPath: parsedInputs.data.thumbFilePath,
      },
    });

    return updatedDocument;
  } catch (err) {
    console.error('Error updating document:', (err as Error).message);
    throw err;
  }
}


/* 
 * Finds the Path of file from its encrypted ID
 * 
 * returns -1 for file not present
 * returns -2 for file not processed 
 * returns -3 for error while finding file
 * 
 * @param {string} encryptedId - encrypted id of document
 * */
export async function getFilePath(encryptedId: string) {
  try {
    // Check the encryptedId does not have any special characters which can cause issues
    if (typeof encryptedId !== 'string' || /[^a-zA-Z0-9_]/.test(encryptedId)) {
      return -3;
    }

    const document = await prisma.document.findUnique({
      where: { documentEncryptedId: encryptedId },
      select: { documentPath: true, isCompressed: true },
    });

    if (!document) {
      return -1;
    }

    // Return the file path if the document is compressed, otherwise return -2
    if (document.isCompressed) {
      return document.documentPath;
    } else {
      return -2;
    }
  } catch (err) {
    console.error('Error finding document path:', (err as Error).message);
    return -3;
  }
}

/* 
 * Finds the Path of thumb file from its encrypted ID
 * 
 * returns -1 for file not present
 * returns -2 for file not processed 
 * returns -3 for error while finding file
 * 
 * @param {string} encryptedId - encrypted id of document
 * */
export async function getThumbFilePath(encryptedId: string) {
  try {
    // Check the encryptedId does not have any special characters which can cause issues
    if (typeof encryptedId !== 'string' || /[^a-zA-Z0-9_]/.test(encryptedId)) {
      return -3;
    }

    const document = await prisma.document.findUnique({
      where: { documentEncryptedId: encryptedId },
      select: { thumbPath: true, isCompressed: true },
    });

    if (!document) {
      return -1;
    }

    // Return the thumb path if the document is compressed, otherwise return -2
    if (document.isCompressed) {
      return document.thumbPath;
    } else {
      return -2;
    }
  } catch (err) {
    console.error('Error finding thumb path:', (err as Error).message);
    return -3;
  }
}


export async function deleteDocumentById(documentId: number) {
  try {
    if (typeof documentId !== 'number' || isNaN(documentId)) {
      throw new Error(`Invalid documentId: ${JSON.stringify(documentId)}`);
    }

    const deletedDocument = await prisma.document.delete({
      where: { id: documentId },
    });

    return deletedDocument;
  } catch (err) {
    console.error('Error deleting document:', (err as Error).message);
    throw err;
  }
}

export const getUnprocessedFilesFromDB = async (batchSize: number) => {
  let files = []; 
  try {
    files = await prisma.document.findMany({
      where: { isCompressed: true, status: { in: ['PENDING', 'FAILED'] } },
      select: { documentEncryptedId: true, documentType: true, status: true },
    });
  } catch (error) {
    console.error('Error fetching unprocessed files:', (error as Error).message);
    throw error;
  }

  // Separate pending and failed
  const pendingFiles = files.filter(f => f.status === 'PENDING');
  const failedFiles = files.filter(f => f.status === 'FAILED');

  let unprocessedFiles;

  if (pendingFiles.length > 0) {
    unprocessedFiles = pendingFiles.slice(0, batchSize);
  } else {
    unprocessedFiles = failedFiles.slice(0, batchSize);
  }

  return unprocessedFiles;
};

export const updateFileStatusInDB = async (documentId: string, status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED', retriesCount?: number) => {
  try {
    const updateData: any = { status };
    if (retriesCount !== undefined) {
      updateData.retriesCount = retriesCount;
    }

    if (status === 'COMPLETED') {
      updateData.isProcessed = true;
    } else {
      updateData.isProcessed = false;
    }
    
    await prisma.document.update({
      where: { documentEncryptedId: documentId },
      data: updateData,
    });
    return {
      success: true,
    };
  } catch (error) {
    console.error('Error updating file status:', (error as Error).message);
    throw error;
  }
};

export const getFileNamesByIdsFromDB = async (encryptedIds: string[]) => {
  try {
    const documents = await prisma.document.findMany({
      where: { documentEncryptedId: { in: encryptedIds } },
      select: { documentEncryptedId: true, displayName: true },
    });

    // Make a map for fast O(1) lookups
    const docMap = new Map(
      documents.map(doc => [doc.documentEncryptedId, doc.displayName])
    );

    // Preserve order of input IDs
    const orderedFileNames = encryptedIds
      .map(id => docMap.get(id))
      .filter(Boolean);

    console.log('Ordered file names:', orderedFileNames);
    return orderedFileNames;
  } catch (error) {
    console.error('Error fetching file names by IDs:', (error as Error).message);
    throw error;
  }
};

