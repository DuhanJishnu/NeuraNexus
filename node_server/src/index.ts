import express, { Express, Request, Response } from 'express';
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import cors from "cors";
import { rootRouter } from './routes';
import { CORS_ORIGINS, envVarsCheck, PORT } from './config/envExports';
import { errorMiddleware } from './middlewares/errors';
import { startWorkers } from './workers';
import { requestContextMiddleware } from './middlewares/requestContext';

dotenv.config();
const app:Express = express();
const port = PORT

app.use(requestContextMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: CORS_ORIGINS,
  credentials : true
}));
app.use(cookieParser());

// app.use((req, res, next) => {
//   console.log("----- Incoming Request -----");
//   console.log(`Method: ${req.method}; Path: ${req.path}`);
//   console.log("Body:", req.body);
//   console.log("Headers:", req.headers);
//   console.log("Cookies:", req.cookies);
//   console.log("Params:", req.params);
//   console.log("Query:", req.query);
//   console.log("----------------------------");
//   next();
// });

app.get("/", (req: Request, res: Response) => {
  res.json({ service: 'neuranexus-api', status: 'ok' });
});

app.get('/healthz', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use('/api', rootRouter)

app.use(errorMiddleware);

// Start workers for background processing
startWorkers();

envVarsCheck(); 

app.listen(port, () => {
  console.log(`main server is running on port ${port}`);
});
