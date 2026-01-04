import { Router } from 'express';
import { getPrismaClient } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Example route
router.get('/users', async (req, res) => {
  try {
    const users = await getPrismaClient().user.findMany();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Example route with service
import { exampleService } from '../services/exampleService';

router.get('/example', async (req, res) => {
  try {
    const result = await exampleService.getExampleData();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get example data' });
  }
});

// Social accounts routes
import socialAccountsRoutes from './socialAccounts';
router.use('/social-accounts', socialAccountsRoutes);

// Submissions routes
import submissionsRoutes from './submissions';
router.use('/submissions', submissionsRoutes);

// Stats/Dashboard routes
import statsRoutes from './stats';
router.use('/stats', statsRoutes);

export default router;

