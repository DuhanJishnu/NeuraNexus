import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma";
import { hashSync, compareSync } from "bcrypt";
import { BadRequestException } from "../exceptions/bad_request";
import { ErrorCode } from "../exceptions/root";
import { UnprocessableEntity } from "../exceptions/validation";
import { LoginSchema, SignupSchema } from "../schemas/user";
import { generateAccessToken, generateHashRefreshToken, getSafeUser } from "../services/auth";
import jwt from "jsonwebtoken";
import { JWT_REFRESH_SECRET } from "../config/envExports";
import { User } from "../types/auth";
import { NotFoundException } from "../exceptions/not-found";

const prismaClient = prisma; 

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
   const parsedBody = SignupSchema.parse(req.body);
   console.log(1);
    const { email, password, fullname } = parsedBody;
    console.log(2);
    let user = await prismaClient.user.findFirst({
      where: {
        email,
      },
    });
    console.log(3);
    if (user) {
       throw new BadRequestException(
          "User already exists",
          ErrorCode.USER_ALREADY_EXISTS
        );
    }
    console.log(4);
    user = await prismaClient.user.create({
      data: {
        email,
        password: hashSync(password, 10),
        username: fullname,
      },
    });
    console.log(5)
    const access_token = generateAccessToken(user.id);

    const refresh_token = await generateHashRefreshToken(user.id);

console.log(6);
    res.cookie("access_token", access_token, {
      httpOnly: true,       // not accessible via JS
      //secure: true,         // only over HTTPS (set false in dev)
      sameSite: "strict",   // CSRF protection
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refresh_token", refresh_token, {
      httpOnly: true,
      //secure: true,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    console.log(7);
    res.json({
      id: user.id,
      email: user.email,
      username: user.username
    });
    
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  LoginSchema.parse(req.body);
  console.log(1);
    const { email, password } = req.body;
    let user = await prismaClient.user.findUnique({ where: { email } });

    console.log(2);
    if (!user) {throw new NotFoundException("User not found",ErrorCode.USER_NOT_FOUND)}
    if (!compareSync(password, user.password)) {
          throw new BadRequestException(
          "Incorrect Credentials",
          ErrorCode.INCORRECT_CREDENTIALS);
    }
    console.log(3, 'in login');
    const access_token = generateAccessToken(user.id);
    const refresh_token = await generateHashRefreshToken(user.id);
    console.log(4);

    res.cookie("access_token", access_token, {
      httpOnly: true,       // not accessible via JS
         // only over HTTPS (set false in dev)
      sameSite: "strict",   // CSRF protection
      maxAge: 15 * 60 * 1000,
    });
    res.cookie("refresh_token", refresh_token, {
      httpOnly: true,

      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    console.log(5);
    res.json({
      id: user.id,
      email: user.email,
      username: user.username
    });
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Correctly read the token from the httpOnly cookie

  const refresh_token = req.cookies.refresh_token;

  if (!refresh_token)
    return res.status(401).json({ message: "Missing token" });

  try {
    const decoded = jwt.verify(refresh_token, JWT_REFRESH_SECRET) as {
      userId: string;
    };
    const storedTokenEntry = await prisma.refreshToken.findUnique({
      where: { tokenHash: refresh_token },
    });

    if (!storedTokenEntry) {
      return next(
        new BadRequestException("Invalid refresh token", ErrorCode.UNAUTHORIZED)
      );
    }

    if (storedTokenEntry.expiresAt < new Date()) {
      await prisma.refreshToken.delete({
        where: { tokenHash: refresh_token },
      });
      return next(
        new BadRequestException("Refresh token expired", ErrorCode.UNAUTHORIZED)
      );
    }

    // Verify user still exists
    const user = await prismaClient.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      // Clean up token for non-existent user
      await prismaClient.refreshToken.delete({
        where: { tokenHash: refresh_token },
      });
      return res.status(401).json({ message: "User not found" });
    }
    
    const access_token = generateAccessToken(decoded.userId);
    const new_refresh_token = await generateHashRefreshToken(decoded.userId);

    await prisma.refreshToken.delete({
      where: { tokenHash: refresh_token },
    });

    res.cookie("access_token", access_token, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refresh_token", new_refresh_token, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: "Token refreshed successfully",
    });
  } catch (err: any) {
    console.error('Token refresh error:', err);
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      // Try to clean up invalid token if it exists in database
      try {
        await prismaClient.refreshToken.deleteMany({
          where: { tokenHash: refresh_token }
        });
      } catch (cleanupError) {
        console.error('Error cleaning up invalid token:', cleanupError);
      }
      
      return res.status(401).json({ message: "Invalid refresh token" });
    }
    
    next(
      new UnprocessableEntity(
        err?.message || err,
        "Could not generate tokens",
        ErrorCode.TOKEN_ERROR
      )
    );
  }
};

export const me = async (req: Request, res: Response) => {
  console.log(1);
  if (!req.user) {
    return res.status(401).json({ message: "User not found" });
  }
  const safeUser = getSafeUser(req.user as any);
  console.log(2);
  res.json(safeUser);
};

export const logout = async (req: Request, res: Response) =>{
  await prismaClient.refreshToken.delete({
    where:{tokenHash: req.cookies.refresh_token}
  })
   res.clearCookie("access_token", {
    httpOnly: true,
    //secure: true,
    sameSite: "strict"
  });
   res.clearCookie("refresh_token", {
    httpOnly: true,
    //secure: true,
    sameSite: "strict"
  });
  res.json({ message: "Logged out successfully" });
}


export const getUser = async (req: Request, res: Response, next: NextFunction) => {
  
    const email = String(req.query.email);
    let user = await prismaClient.user.findUnique({ where: { email } });

    if (!user) {throw new NotFoundException("User not found",ErrorCode.USER_NOT_FOUND)}
   
    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt
    });
};
export const makeAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.body.userId;
    if (typeof userId !== "string" || !userId.trim()) {
      throw new BadRequestException("userId is required", ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const user = await prismaClient.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException("User not found", ErrorCode.USER_NOT_FOUND);
    }

  
    const updatedUser = await prismaClient.user.update({
      where: { id: userId },
      data: { role: "ADMIN" },
    });
    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      role: updatedUser.role,
      message: "USER has been promoted to ADMIN"
    });
};
