import { prisma } from '../../database';

export class CustomerRepository {
  async generateCustomerCode(): Promise<string> {
    const count = await prisma.customer.count();
    return `CUST-${(count + 1).toString().padStart(6, '0')}`;
  }

  async findByMobile(mobile: string) {
    return prisma.customer.findUnique({ where: { mobile } });
  }

  async findById(id: bigint) {
    return prisma.customer.findUnique({ where: { id } });
  }

  async findAll(params: { page?: number; limit?: number; search?: string; status?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.search) {
      where.OR = [
        { name: { contains: params.search } },
        { mobile: { contains: params.search } },
        { customerCode: { contains: params.search } },
      ];
    }
    if (params.status) where.status = params.status;

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { total, customers };
  }

  async create(data: any) {
    return prisma.customer.create({ data });
  }

  async update(id: bigint, data: any) {
    return prisma.customer.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  async findSalesByCustomer(customerId: bigint, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, sales] = await Promise.all([
      prisma.sale.count({ where: { customerId } }),
      prisma.sale.findMany({
        where: { customerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { total, sales };
  }

  async findInvoicesByCustomer(customerId: bigint, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, invoices] = await Promise.all([
      prisma.invoice.count({ where: { sale: { customerId } } }),
      prisma.invoice.findMany({
        where: { sale: { customerId } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { total, invoices };
  }

  async findPaymentsByCustomer(customerId: bigint, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, payments] = await Promise.all([
      prisma.payment.count({ where: { customerId } }),
      prisma.payment.findMany({
        where: { customerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { total, payments };
  }

  async findLedgerByCustomer(customerId: bigint, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, ledger] = await Promise.all([
      prisma.customerLedger.count({ where: { customerId } }),
      prisma.customerLedger.findMany({
        where: { customerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { total, ledger };
  }

  async getLatestOutstanding(customerId: bigint) {
    const lastEntry = await prisma.customerLedger.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: { runningBalance: true },
    });
    return lastEntry ? lastEntry.runningBalance : 0;
  }
}

export const customerRepository = new CustomerRepository();
