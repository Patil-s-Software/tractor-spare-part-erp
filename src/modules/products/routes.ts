import { Router } from 'express';
import { ROLES } from '../../constants';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { productController } from './controller';
import { createProductSchema, updateProductSchema, updateProductStatusSchema } from './validators';

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

router.get('/', productController.getAll);
router.get('/:id', productController.getById);
router.post('/', authorize(ROLES.ADMIN), validate(createProductSchema), productController.create);
router.put('/:id', authorize(ROLES.ADMIN), validate(updateProductSchema), productController.update);
router.patch('/:id/status', authorize(ROLES.ADMIN), validate(updateProductStatusSchema), productController.updateStatus);

export default router;
