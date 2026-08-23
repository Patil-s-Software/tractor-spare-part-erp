import { Router } from 'express';
import { ROLES } from '../../constants';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { salesController } from './controller';
import { cancelSaleSchema, createDraftSaleSchema, updateDraftSaleSchema } from './validators';

const router = Router();

const validate = (schema: any) => (req: any, res: any, next: any) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

router.use(authMiddleware);

router.get('/', salesController.getAll);
router.get('/:id', salesController.getById);
router.post('/draft', authorize(ROLES.ADMIN, ROLES.SHOPKEEPER, ROLES.MANAGER), validate(createDraftSaleSchema), salesController.createDraft);
router.post('/:id/finalize', authorize(ROLES.ADMIN, ROLES.SHOPKEEPER, ROLES.MANAGER), salesController.finalize);
router.post('/:id/cancel', authorize(ROLES.ADMIN), validate(cancelSaleSchema), salesController.cancel);

export default router;
