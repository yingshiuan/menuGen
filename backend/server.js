import express from 'express'
import cors from 'cors'
import uploadRoutes from './routes/uploadRoute.js' // use upload routes, but now didn't save in the backend
import pdfRoutes from './routes/pdfRoute.js'

const app = express()
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Ping
app.get('/ping', (req, res) => {
  res.send('pong');
});

// app.use('/api', uploadRoutes);
app.use('/', pdfRoutes)

// Start server
try {
  // Listen on all interfaces (LAN / mobile)
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on port ${PORT}`);
    // console.log(`Backend server running on http://192.168.1.163:${PORT}`)
    // console.log(`Backend server running on http://localhost:${PORT}`);
  })
  // For local development, you can also listen on localhost:
  // app.listen(PORT, () => {
  //   console.log(`Backend server running on http://localhost:${PORT}`);
  // });
} catch (err) {
  console.error('Server failed to start:', err)
}