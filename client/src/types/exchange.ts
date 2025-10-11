export interface Response {
  answer: string; 
  citation: {
    files: Array<string>;
    fileNames: Array<string>;
  }
}