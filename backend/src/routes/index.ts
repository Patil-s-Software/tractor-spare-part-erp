import { Router } from 'express';
import authRoutes from '../modules/auth/routes';
import userRoutes from '../modules/users/routes';
import categoryRoutes from '../modules/categories/routes';
import companyRoutes from '../modules/companies/routes';
import unitRoutes from '../modules/units/routes';
import productRoutes from '../modules/products/routes';
import inventoryRoutes from '../modules/inventory/routes';
import customerRoutes from '../modules/customers/routes';
import salesRoutes from '../modules/sales/routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/categories', categoryRoutes);
router.use('/companies', companyRoutes);
router.use('/units', unitRoutes);
router.use('/products', productRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/customers', customerRoutes);
router.use('/sales', salesRoutes);

export default router;
