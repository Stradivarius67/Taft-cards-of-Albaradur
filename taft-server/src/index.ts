import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './rooms/manager.js';
import { setupSocketHandlers } from './socket/handlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();
app.use(cors());
// gzip всё, что отдаёт сервер: HTML/JS/CSS дают ощутимое сжатие.
// WebP уже сжат, но compression сам пропустит такие ответы — без вреда.
app.use(compression());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager();

// Health-check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: roomManager.getRoomCount() });
});

// Serve built client from public/ (production mode)
const publicPath = path.join(__dirname, '..', 'public');
app.use(
  express.static(publicPath, {
    // Vite кладёт хешированные файлы в /assets/, их можно кешировать жёстко.
    // Остальное (index.html) — без долгого кеша, иначе клиент застрянет на старой версии.
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

// SPA fallback: all unknown GET requests → index.html
app.get('*', (req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/socket.io')) {
    return next();
  }
  res.sendFile(path.join(publicPath, 'index.html'), (err) => {
    if (err) next(); // No index.html (dev mode) — just skip
  });
});

// Socket.IO handlers
setupSocketHandlers(io, roomManager);

httpServer.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Taft server running on port ${PORT}`);
});

export { app, io, httpServer };
