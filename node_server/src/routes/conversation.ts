import { Router} from 'express';
import { errorHandler } from '../error-handler';
import authMiddleware from '../middlewares/auth';
import { getRecentConversations, updateTitle } from '../controllers/conversation';

const convRoutes:Router = Router();

convRoutes.get('/getrecentconv',authMiddleware,errorHandler(getRecentConversations));
convRoutes.post('/updatetitle', authMiddleware, errorHandler(updateTitle));

export default convRoutes;