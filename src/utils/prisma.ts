import { PrismaClient } from '@prisma/client';

// Singleton pattern for PrismaClient in serverless environments
// Prevents multiple instances and connection issues
let prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    // Check if DATABASE_URL is available
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set. Please configure your database connection.');
    }
    
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  
  return prisma;
}

// Export default instance for convenience
export default getPrismaClient();

