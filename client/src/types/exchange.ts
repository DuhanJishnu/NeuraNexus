export interface Exchange {
  id: string;
  userQuery: string;
  systemResponse: Response;
  createdAt: string;
}

export interface Response {
  answer: string; 
  citation: {
    files: Array<string>;
    fileNames: Array<string>;
    fileInfos?: Array<Record<string, any>>;
  }
}