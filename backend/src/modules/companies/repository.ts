import { prisma } from '../../database';

export class CompanyRepository {
  async findAll() {
    return prisma.company.findMany({ orderBy: { name: 'asc' } });
  }

  async create(name: string) {
    return prisma.company.create({ data: { name } });
  }

  async update(id: bigint, data: { name?: string; status?: string }) {
    return prisma.company.update({ where: { id }, data });
  }
}

export const companyRepository = new CompanyRepository();
