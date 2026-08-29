import { Router } from 'express';
import { errorHandler } from '../error-handler';
import authMiddleware from '../middlewares/auth';
import adminMiddleware from '../middlewares/admin';
import {
  listIndexDeployments,
  promoteIndexCandidate,
  recordIndexEvaluation,
  registerIndexCandidate,
  rollbackIndex,
} from '../controllers/indexDeployment';


const routes = Router();
routes.use(authMiddleware, adminMiddleware);
routes.get('/', errorHandler(listIndexDeployments));
routes.post('/candidates', errorHandler(registerIndexCandidate));
routes.post('/evaluations', errorHandler(recordIndexEvaluation));
routes.post('/promote', errorHandler(promoteIndexCandidate));
routes.post('/rollback', errorHandler(rollbackIndex));

export default routes;
