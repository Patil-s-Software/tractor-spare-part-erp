import { ERROR_CODES } from '../../constants';
import { AppError } from '../../middlewares/error-handler.middleware';
import { customerRepository, CustomerRepository } from './repository';

export class CustomerService {
  constructor(private repo: CustomerRepository = customerRepository) {}

  async createCustomer(data: any) {
    const existing = await this.repo.findByMobile(data.mobile);
    if (existing) {
      throw new AppError('Customer with this mobile number already exists', 409, ERROR_CODES.CONFLICT);
    }

    const customerCode = await this.repo.generateCustomerCode();
    return this.repo.create({
      ...data,
      customerCode,
    });
  }

  async getCustomerById(id: bigint) {
    const customer = await this.repo.findById(id);
    if (!customer) {
      throw new AppError('Customer not found', 404, ERROR_CODES.NOT_FOUND);
    }
    return customer;
  }

  async getAllCustomers(params: { page?: number; limit?: number; search?: string; status?: string }) {
    const { total, customers } = await this.repo.findAll(params);
    const limit = params.limit || 20;
    const page = params.page || 1;
    return {
      customers,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateCustomer(id: bigint, data: any) {
    await this.getCustomerById(id);
    return this.repo.update(id, data);
  }

  async getCustomerSales(id: bigint, page = 1, limit = 20) {
    await this.getCustomerById(id);
    const { total, sales } = await this.repo.findSalesByCustomer(id, page, limit);
    return { sales, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getCustomerInvoices(id: bigint, page = 1, limit = 20) {
    await this.getCustomerById(id);
    const { total, invoices } = await this.repo.findInvoicesByCustomer(id, page, limit);
    return { invoices, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getCustomerPayments(id: bigint, page = 1, limit = 20) {
    await this.getCustomerById(id);
    const { total, payments } = await this.repo.findPaymentsByCustomer(id, page, limit);
    return { payments, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getCustomerLedger(id: bigint, page = 1, limit = 20) {
    await this.getCustomerById(id);
    const { total, ledger } = await this.repo.findLedgerByCustomer(id, page, limit);
    return { ledger, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getCustomerOutstanding(id: bigint) {
    await this.getCustomerById(id);
    const outstanding = await this.repo.getLatestOutstanding(id);
    return { customerId: id.toString(), outstanding };
  }
}

export const customerService = new CustomerService();
