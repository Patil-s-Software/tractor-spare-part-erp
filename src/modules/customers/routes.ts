import { Router } from 'express';
import { ROLES } from '../../constants';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { customerController } from './controller';
import { createCustomerSchema, updateCustomerSchema } from './validators';

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

router.get('/', customerController.getAll);
router.get('/:id', customerController.getById);
router.post('/', authorize(ROLES.ADMIN), validate(createCustomerSchema), customerController.create);
router.put('/:id', authorize(ROLES.ADMIN), validate(updateCustomerSchema), customerController.update);

// Customer Sub-resource Read Views
router.get('/:id/sales', customerController.getSales);
router.get('/:id/invoices', customerController.getInvoices);
router.get('/:id/payments', customerController.getPayments);
router.get('/:id/ledger', customerController.getLedger);
router.get('/:id/outstanding', customerController.getOutstanding);

export default router;
