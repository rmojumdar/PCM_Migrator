import { Router } from 'express';
import { requireOrg } from '../middleware/requireOrg.middleware';
import { getObjects, getCounts, startMigration, getJobStatus } from '../controllers/migration.controller';

const router = Router();

router.get('/objects', requireOrg('source', 'target'), getObjects);
router.get('/counts', requireOrg('source', 'target'), getCounts);
router.post('/start', requireOrg('source', 'target'), startMigration);
router.get('/job/:jobId', getJobStatus);

export default router;
