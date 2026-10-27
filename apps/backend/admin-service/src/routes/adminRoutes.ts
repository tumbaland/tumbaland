import { Router } from 'express';
import { assistants, deletions, overview, user, users } from '../controllers/adminController';

/**
 * Everything here reads. The one administrator write, closing an account that
 * asked to be deleted, is auth-service's, which owns accounts (see its
 * `/auth/admin/users/:id/deletion/*`). Authentication and the admin check are
 * mounted once in front of the whole router (see app.ts), so a route added here
 * cannot forget them.
 */
const router = Router();

router.get('/overview', overview);
router.get('/users', users);
router.get('/users/:id', user);
router.get('/assistants', assistants);
router.get('/deletions', deletions);

export default router;
