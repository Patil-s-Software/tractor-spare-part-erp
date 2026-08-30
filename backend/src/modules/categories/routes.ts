import { Router } from 'express';
import { ROLES } from '../../constants';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { categoryController } from './controller';
import { createCategorySchema, updateCategorySchema } from './validators';

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
router.get('/', categoryController.getAll);
router.post('/', authorize(ROLES.ADMIN), validate(createCategorySchema), categoryController.create);
router.put('/:id', authorize(ROLES.ADMIN), validate(updateCategorySchema), categoryController.update);

export default router;
