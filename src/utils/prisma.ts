import { PrismaClient } from '@prisma/client';

// Singleton pattern for PrismaClient in serverless environments
// Prevents multiple instances and connection issues
let prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    // Check if DATABASE_URL is available
    if (!process.env.DATABASE_URL) {
      const error = new Error('DATABASE_URL environment variable is not set. Please configure your database connection.');
      console.error('PrismaClient initialization failed:', error.message);
      throw error;
    }
    
    try {
      prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      });
    } catch (error: any) {
      console.error('Failed to create PrismaClient:', error);
      throw error;
    }
  }
  
  return prisma;
}

// Export the function, not the instance (lazy loading)
export default getPrismaClient;

