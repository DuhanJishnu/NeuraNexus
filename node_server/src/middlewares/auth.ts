import {Request, Response, NextFunction } from "express";
import { UnauthorizedException } from "../exceptions/unauthorized";
import { ErrorCode } from "../exceptions/root";
import * as jwt from 'jsonwebtoken';
import { JWT_ACCESS_SECRET, JWT_REFRESH_SECRET} from "../config/envExports";
import {prisma} from "../config/prisma"
import {refresh} from "../controllers/auth"

const prismaClient = prisma; 

const authMiddleware = async(req:Request, res:Response, next:NextFunction)=>{
    //1. extract token from header
    const access_token = req.cookies.access_token;
    //2. if !token throw error of unauthorized
    if(!access_token){
        return next(new UnauthorizedException("Unauthorized",ErrorCode.UNAUTHORIZED))
    }
    try{
         //3. if token is present -> verify it extract the payload
        const payload:any = jwt.verify(access_token,JWT_ACCESS_SECRET)
        //4. to get the user from the payload
        const user=await prismaClient.user.findFirst({
            where:{
                id: payload.userId
            }
        })
        
        if(!user){
            next(new UnauthorizedException("Unauthorized",ErrorCode.UNAUTHORIZED));
            return;
        }
        //5. to attach the user the user to the current request object
        const { password: _password, ...safeUser } = user;
        req.user = safeUser;
        next()
    }catch(error){
        next(new UnauthorizedException("Unauthorized",ErrorCode.UNAUTHORIZED))
    }
}
export default authMiddleware;
