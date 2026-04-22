import { Router } from 'express';
import { connectOrg, disconnectOrg, getStatus, getDefaults } from '../controllers/auth.controller';

const router = Router();

router.post('/connect', connectOrg);
router.delete('/disconnect', disconnectOrg);
router.get('/status', getStatus);
router.get('/defaults', getDefaults);

export default router;
