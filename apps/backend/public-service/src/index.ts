import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { logger } from '@tumbaland/core';
import app from './app';

const PORT = process.env.PORT || 5003;

// Start the server
app.listen(PORT, () => logger.info('Public service started successfully', { port: PORT }));
