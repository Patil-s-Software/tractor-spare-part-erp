import { prisma } from '../../database';

export class AuthRepository {
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
  }

  async findUserById(id: bigint) {
    return prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
  }

  async createRefreshToken(data: {
    userId: bigint;
    tokenHash: string;
    userAgent?: string;
    expiresAt: Date;
  }) {
    return prisma.refreshToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        userAgent: data.userAgent,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findRefreshTokenByHash(tokenHash: string) {
    return prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: { include: { role: true } } },
    });
  }

  async revokeRefreshToken(id: bigint) {
    return prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserRefreshTokens(userId: bigint) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async updateUserPassword(userId: bigint, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash, updatedAt: new Date() },
    });
  }

  async updateLastLogin(userId: bigint) {
    return prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }
}

export const authRepository = new AuthRepository();
