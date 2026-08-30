import { prisma } from '../../database';

export class UnitRepository {
  async findAll() {
    return prisma.unit.findMany({ orderBy: { name: 'asc' } });
  }

  async create(data: { name: string; shortCode?: string }) {
    return prisma.unit.create({ data });
  }
}

export const unitRepository = new UnitRepository();
