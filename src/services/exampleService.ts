import { getPrismaClient } from '../utils/prisma';

export const exampleService = {
  async getExampleData() {
    // Example service method
    // Note: Not using PrismaClient here, but if needed, use getPrismaClient()
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

