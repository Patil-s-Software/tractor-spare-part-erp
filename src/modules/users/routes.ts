import { Router } from 'express';
import { ROLES } from '../../constants';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { userController } from './controller';
import { createUserSchema, updateUserStatusSchema } from './validators';

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

router.get('/me', userController.getMe);
router.get('/', authorize(ROLES.ADMIN, ROLES.MANAGER), userController.getAllUsers);
router.post('/', authorize(ROLES.ADMIN), validate(createUserSchema), userController.createUser);
router.put('/:id/status', authorize(ROLES.ADMIN), validate(updateUserStatusSchema), userController.updateUserStatus);

export default router;
