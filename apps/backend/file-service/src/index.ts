import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import fileRoutes from "./routes/fileRoutes";
import { ensureCacheDir } from "./config/cache";

const app = express();
const PORT = process.env.PORT || 5002;

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://unpkg.com/swagger-ui-dist@5.9.0/",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://unpkg.com/swagger-ui-dist@5.9.0/",
        ],
        imgSrc: ["'self'", "data:", "https://unpkg.com/swagger-ui-dist@5.9.0/"],
        fontSrc: ["'self'", "https://unpkg.com/swagger-ui-dist@5.9.0/"],
      },
    },
  })
);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',') 
      : [
          'http://localhost:3002'
        ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Type', 'Content-Length', 'ETag', 'Cache-Control']
  })
);
app.use(morgan("combined"));
app.use(express.json());

// Additional CORS middleware for file serving
app.use('/api/serve', (req: Request, res: Response, next: NextFunction) => {
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Serve static documentation files
app.use("/api/docs", express.static(path.join(__dirname, "../docs")));

app.use("/api", fileRoutes);

// Documentation root redirect
app.get("/docs", (req: Request, res: Response) => {
  res.redirect("/api/docs/index.html");
});

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "OK", message: "File service is running" });
});

// Error handling middleware
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Error:", error);
  res.status(error.status || 500).json({
    error: {
      message: error.message || "Internal server error",
      status: error.status || 500,
    },
  });
});

// 404 handler
app.use("*", (req: Request, res: Response) => {
  res.status(404).json({
    error: {
      message: "Route not found",
      status: 404,
    },
  });
});

app.listen(PORT, async () => {
  console.log(`File service running on port ${PORT}`);
  
  // Initialize cache directory
  try {
    await ensureCacheDir();
    console.log('Cache directory initialized');
  } catch (error) {
    console.error('Failed to initialize cache directory:', error);
  }
});

export default app;
