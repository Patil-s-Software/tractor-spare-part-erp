import { prisma } from '../../database';

export class CategoryRepository {
  async findAll() {
    return prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { parentCategory: { select: { id: true, name: true } } },
    });
  }

  async findById(id: bigint) {
    return prisma.category.findUnique({
      where: { id },
      include: { parentCategory: { select: { id: true, name: true } } },
    });
  }

  async create(data: { name: string; parentCategoryId?: bigint }) {
    return prisma.category.create({
      data: {
        name: data.name,
        parentCategoryId: data.parentCategoryId,
      },
    });
  }

  async update(id: bigint, data: { name?: string; parentCategoryId?: bigint | null; status?: string }) {
    return prisma.category.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.parentCategoryId !== undefined ? { parentCategoryId: data.parentCategoryId } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
    });
  }
}

export const categoryRepository = new CategoryRepository();
