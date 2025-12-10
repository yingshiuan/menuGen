import express from 'express';
import cors from 'cors';
import uploadRoutes from './routes/uploadRoute.js'; // use upload routes, but now didn't save in the backend
import pdfRoutes from './routes/pdfRoute.js';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// app.use('/api', uploadRoutes); 
app.use('/', pdfRoutes);


// Start server
try {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
} catch (err) {
  console.error('Server failed to start:', err);
}