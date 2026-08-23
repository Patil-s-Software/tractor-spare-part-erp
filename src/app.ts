import cors from 'cors';
import express, { Request, Response } from 'express';
import { errorHandlerMiddleware } from './middlewares/error-handler.middleware';
import apiRoutes from './routes';
import { sendSuccess } from './utils/response';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req: Request, res: Response) => {
  return sendSuccess(res, 'Tractor Spare Parts ERP API is running healthy', {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/v1', apiRoutes);

// Global Error Handler
app.use(errorHandlerMiddleware);

export default app;
