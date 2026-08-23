import { prisma } from '../../database';

export class UserRepository {
  async findById(id: bigint) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        roleId: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { id: true, name: true, description: true } },
      },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findAll(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const whereClause: any = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [total, users] = await Promise.all([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          roleId: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          role: { select: { id: true, name: true } },
        },
      }),
    ]);

    return { total, users };
  }

  async createUser(data: {
    name: string;
    email: string;
    phone?: string;
    passwordHash: string;
    roleId: number;
  }) {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash: data.passwordHash,
        roleId: data.roleId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        roleId: true,
        status: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
      },
    });
  }

  async updateStatus(id: bigint, status: string) {
    return prisma.user.update({
      where: { id },
      data: { status, updatedAt: new Date() },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        updatedAt: true,
      },
    });
  }
}

export const userRepository = new UserRepository();
