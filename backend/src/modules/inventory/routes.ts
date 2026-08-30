import { Router } from 'express';
import { ROLES } from '../../constants';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { inventoryController } from './controller';
import { adjustStockSchema } from './validators';

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

router.get('/', inventoryController.getAll);
router.get('/movements', inventoryController.getMovements);
router.get('/:productId', inventoryController.getByProductId);
router.post('/adjust', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(adjustStockSchema), inventoryController.adjustStock);

export default router;
