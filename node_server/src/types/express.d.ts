// import { User } from "@prisma/client";
// import express  from "express";
// declare module 'express'{
//     export interface Request{
//         user:User
//     }
// }
// types/express.d.ts
import { User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: Omit<User, "password">; // optional + remove password
      requestId?: string;
    }
  }
}
