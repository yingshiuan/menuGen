import express from 'express'
import cors from 'cors'
import { pathToFileURL } from 'url'
// import uploadRoutes from './routes/uploadRoute.js' // use upload routes, but now didn't save in the backend
import pdfRoutes from './routes/pdfRoute.js'

const app = express()
const PORT = process.env.PORT || 3000;

// Render terminates TLS in front of this process, so without this every request
// looks like it came from the proxy and the rate limiter would count the whole
// internet as one caller. One hop, not `true`: trusting every hop would let a
// caller set X-Forwarded-For themselves and get a fresh budget per request.
app.set('trust proxy', 1)

// Middleware
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))


const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ['https://menu-gen-dusky.vercel.app', 'https://menugen.insdash.ch' ]
  : ['http://localhost:5173', 'http://localhost:8080', 'http://192.168.1.163:8080', 'http://192.168.1.163:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET','POST'],
  // The export queue answers "full" with a 503 and Retry-After; a cross-origin
  // page cannot read that header unless it is exposed, and without it the client
  // cannot tell a full queue from an instance that is down.
  exposedHeaders: ['Retry-After'],
}));

// Ping
app.get('/ping', (req, res) => {
  res.send('pong');
});

// app.use('/api', uploadRoutes);
app.use('/', pdfRoutes)

// Only bind a port when this module is the one that was run. Importing it --
// a test, or anything that wants the routes without a listener -- must not take
// port 3000, which is what made this file untestable.
const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

// Start server
if (isEntrypoint) {
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
}

export default app