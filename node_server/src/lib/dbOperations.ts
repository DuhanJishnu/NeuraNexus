import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { insertInitialDocumentSchema, updateDocumentStatusSchema } from "../schemas/document";
import { InsertInitialDocumentData, UpdateDocumentStatusData } from "../types/document";
import { RAG_ACTIVE_INDEX_VERSION } from "../config/envExports";

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

    const { docType, displayName, encryptedId, originalSize, fileExt, visibility, ownerId } = parsedBody.data;

    const document = await prisma.document.create({
      data: {
        documentType: docType,
        displayName: displayName,
        documentEncryptedId: encryptedId,
        originalFileSize: originalSize,
        fileExtension: fileExt,
        visibility,
        ownerId: visibility === 'PRIVATE' ? ownerId : null,
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
  const safeBatchSize = Math.min(Math.max(batchSize, 1), 100);
  try {
    // Claim work in the same statement that selects it. SKIP LOCKED allows
    // multiple ingestion workers to scale horizontally without processing the
    // same document. A stale lease is reclaimable after 15 minutes.
    return await prisma.$queryRaw<Array<{
      documentEncryptedId: string;
      documentType: number;
      status: string;
      processingLeaseId: string;
      targetIndexVersion: string | null;
      visibility: 'GLOBAL' | 'PRIVATE';
      ownerId: string | null;
    }>>`
      WITH active_index AS (
        SELECT version
        FROM "RagIndexDeployment"
        WHERE state = 'ACTIVE'
        LIMIT 1
      ), candidates AS (
        SELECT id
        FROM "Document"
        WHERE "isCompressed" = true
          AND "retriesCount" < 5
          AND (
            status IN ('PENDING', 'FAILED')
            OR (
              status = 'PROCESSING'
              AND "processingStartedAt" < NOW() - INTERVAL '15 minutes'
            )
          )
        ORDER BY
          CASE WHEN status = 'PENDING' THEN 0 ELSE 1 END,
          "uploadDateTime" ASC
        LIMIT ${safeBatchSize}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "Document" AS document
      SET status = 'PROCESSING',
          "processingStartedAt" = NOW(),
          "processingLeaseId" = gen_random_uuid()::text,
          "targetIndexVersion" = COALESCE(
            document."targetIndexVersion",
            (SELECT version FROM active_index),
            ${RAG_ACTIVE_INDEX_VERSION}
          ),
          "retriesCount" = document."retriesCount" + 1
      FROM candidates
      WHERE document.id = candidates.id
      RETURNING
        document."documentEncryptedId",
        document."documentType",
        document."processingLeaseId",
        document."targetIndexVersion",
        document.visibility,
        document."ownerId",
        document.status
    `;
  } catch (error) {
    console.error('Error claiming unprocessed files:', (error as Error).message);
    throw error;
  }
};

export const updateFileStatusInDB = async (
  documentId: string,
  processingLeaseId: string,
  status: 'COMPLETED' | 'FAILED',
  vectorManifest?: {
    vectorIdPrefix: string;
    chunkCount: number;
    embeddingModel: string;
    indexVersion: string;
  },
) => {
  try {
    return await prisma.$transaction(async transaction => {
      const claimedDocument = await transaction.document.findFirst({
        where: {
          documentEncryptedId: documentId,
          status: 'PROCESSING',
          processingLeaseId,
        },
        select: { id: true, targetIndexVersion: true },
      });
      if (!claimedDocument) {
        return { success: false, message: 'Ingestion lease is stale or invalid' };
      }

      const updateData: any = { status, processingLeaseId: null };

    if (status === 'COMPLETED') {
      if (!vectorManifest) {
        throw new Error('A vector manifest is required to complete ingestion');
      }
      if (vectorManifest.vectorIdPrefix !== `${documentId}:`) {
        throw new Error('Vector manifest prefix does not match the document ID');
      }
      if (
        claimedDocument.targetIndexVersion
        && vectorManifest.indexVersion !== claimedDocument.targetIndexVersion
      ) {
        await transaction.document.updateMany({
          where: {
            documentEncryptedId: documentId,
            status: 'PROCESSING',
            processingLeaseId,
          },
          data: {
            status: 'FAILED',
            isProcessed: false,
            processingStartedAt: null,
            processingLeaseId: null,
          },
        });
        return {
          success: false,
          message: `Expected index version ${claimedDocument.targetIndexVersion}`,
        };
      }
      updateData.isProcessed = true;
      updateData.processedAt = new Date();
      updateData.processingStartedAt = null;
      updateData.vectorIdPrefix = vectorManifest.vectorIdPrefix;
      updateData.chunkCount = vectorManifest.chunkCount;
      updateData.embeddingModel = vectorManifest.embeddingModel;
      updateData.indexVersion = vectorManifest.indexVersion;
      updateData.targetIndexVersion = null;
      updateData.indexedAt = new Date();
    } else if (status === 'FAILED') {
      updateData.isProcessed = false;
      updateData.processingStartedAt = null;
    } else {
      updateData.isProcessed = false;
    }
    
      const updated = await transaction.document.updateMany({
      where: {
        documentEncryptedId: documentId,
        status: 'PROCESSING',
        processingLeaseId,
      },
      data: updateData,
    });
      if (updated.count !== 1) {
        return { success: false, message: 'Ingestion lease expired during update' };
      }
      if (status === 'COMPLETED' && vectorManifest) {
        const indexedAt = new Date();
        await transaction.documentIndexManifest.upsert({
          where: {
            documentId_indexVersion: {
              documentId: claimedDocument.id,
              indexVersion: vectorManifest.indexVersion,
            },
          },
          create: {
            documentId: claimedDocument.id,
            ...vectorManifest,
            indexedAt,
          },
          update: {
            vectorIdPrefix: vectorManifest.vectorIdPrefix,
            chunkCount: vectorManifest.chunkCount,
            embeddingModel: vectorManifest.embeddingModel,
            indexedAt,
          },
        });
      }
      return { success: true };
    });
  } catch (error) {
    console.error('Error updating file status:', (error as Error).message);
    throw error;
  }
};

export const reindexDocumentsInDB = async (
  documentIds: string[],
  targetIndexVersion: string,
) => {
  const scheduled = await prisma.$transaction(async transaction => {
    const eligible = await transaction.document.findMany({
      where: {
        documentEncryptedId: { in: documentIds },
        isCompressed: true,
        status: { not: 'PROCESSING' },
      },
      select: { id: true },
    });
    const ids = eligible.map(document => document.id);
    if (!ids.length) return 0;
    await transaction.documentIndexManifest.deleteMany({
      where: { documentId: { in: ids }, indexVersion: targetIndexVersion },
    });
    const result = await transaction.document.updateMany({
      where: { id: { in: ids }, status: { not: 'PROCESSING' } },
      data: {
        status: 'PENDING',
        retriesCount: 0,
        processingStartedAt: null,
        processingLeaseId: null,
        processedAt: null,
        isProcessed: false,
        vectorIdPrefix: null,
        chunkCount: null,
        embeddingModel: null,
        indexedAt: null,
        targetIndexVersion,
      },
    });
    return result.count;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return { requested: documentIds.length, scheduled };
};

export const heartbeatIngestionLeaseInDB = async (
  documentId: string,
  processingLeaseId: string,
) => {
  const result = await prisma.document.updateMany({
    where: {
      documentEncryptedId: documentId,
      status: 'PROCESSING',
      processingLeaseId,
    },
    data: { processingStartedAt: new Date() },
  });
  return result.count === 1;
};
