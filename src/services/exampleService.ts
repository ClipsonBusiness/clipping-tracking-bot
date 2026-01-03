import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const exampleService = {
  async getExampleData() {
    // Example service method
    return {
      message: 'This is example data from the service layer',
      timestamp: new Date().toISOString(),
    };
  },

  async processData(data: any) {
    // Example processing logic
    return {
      processed: true,
      data,
      processedAt: new Date().toISOString(),
    };
  },
};

