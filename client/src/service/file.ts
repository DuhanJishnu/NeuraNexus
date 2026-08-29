import api  from "./api";

// ================= FILE MANAGEMENT =================

// Upload File
export const uploadFile = async (
  files: File[]
) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const res = await api.post("/file/v1/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

// Get Job Status
export const getJobStatus = async (id: string) => {
  const res = await api.get(`/file/v1/job/${id}`);
  return res.data;
};

// Get File
export const getFile = async (encryptedId: string) => {
  const res = await api.get(`/file/v1/files/${encryptedId}`, { responseType: "blob" });
  return res.data;
};

// Get Thumbnail
export const getThumbnail = async (encryptedId: string) => {
  const res = await api.get(`/file/v1/thumb/${encryptedId}`, { responseType: "blob" });
  return res.data;
};

export const getFileNamesByIds = async (encryptedIds: string[]) => {
  const response = await api.post('/file/v1/getFileNamesbyId', { encryptedIds });
  return response.data as { fileNames?: string[] };
};

// Fetch Documents
export const fetchDocuments = async (pageNo: number, docType: string) => {
  const res = await api.post("/file/v1/fetchdocuments", {
    pageNo,
    docType
  });
  return res.data;
};

// Fetch Documents by Name
export const fetchDocumentsByName = async (pageNo: number, docType: string, name: string) => {
  const res = await api.post("/file/v1/fetchdocumentsbyName", {
    pageNo,
    docType,
    name,
  });
  return res.data;
};

// Delete Document
export const deleteDocument = async (encryptedId: string) => {
  const res = await api.delete("/file/v1/delete", {
    data: { id: encryptedId }
  });
  return res.data;
};
