import { Router} from 'express';
import { login, refresh, signup, me, logout, getUser, makeAdmin } from '../controllers/auth';
import { errorHandler } from '../error-handler';
import authMiddleware from '../middlewares/auth';
import adminMiddleware from '../middlewares/admin';

const authRoutes:Router = Router();

authRoutes.post('/signup',errorHandler( signup))
authRoutes.post('/login', errorHandler(login))
authRoutes.get('/refresh',errorHandler(refresh))
authRoutes.post('/logout', authMiddleware, errorHandler(logout))
authRoutes.get('/me', authMiddleware, errorHandler(me))
authRoutes.get('/getuser',[authMiddleware, adminMiddleware], errorHandler(getUser) );
authRoutes.patch('/makeadmin',[authMiddleware, adminMiddleware], errorHandler(makeAdmin) );

export default authRoutes;
