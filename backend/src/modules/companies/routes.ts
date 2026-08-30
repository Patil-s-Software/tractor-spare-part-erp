import { Router } from 'express';
import { ROLES } from '../../constants';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { companyController } from './controller';
import { createCompanySchema, updateCompanySchema } from './validators';

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
router.get('/', companyController.getAll);
router.post('/', authorize(ROLES.ADMIN), validate(createCompanySchema), companyController.create);
router.put('/:id', authorize(ROLES.ADMIN), validate(updateCompanySchema), companyController.update);

export default router;
