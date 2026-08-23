import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { authController } from './controller';
import { changePasswordSchema, loginSchema, refreshSchema } from './validators';

const router = Router();

const validate = (schema: any) => (req: any, res: any, next: any) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', authMiddleware, authController.logout);
router.post('/change-password', authMiddleware, validate(changePasswordSchema), authController.changePassword);

export default router;
