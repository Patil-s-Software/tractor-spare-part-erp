import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { ERROR_CODES, STATUS } from '../../constants';
import { AppError } from '../../middlewares/error-handler.middleware';
import { authRepository, AuthRepository } from './repository';

export class AuthService {
  constructor(private repo: AuthRepository = authRepository) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateAccessToken(user: { id: bigint; email: string; roleId: number; roleName: string }): string {
    return jwt.sign(
      {
        id: user.id.toString(),
        email: user.email,
        roleId: user.roleId,
        roleName: user.roleName,
      },
      config.jwtSecret,
      { expiresIn: '15m' }
    );
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(40).toString('hex');
  }

  async login(email: string, password: string, userAgent?: string) {
    const user = await this.repo.findUserByEmail(email);
    if (!user || user.status !== STATUS.ACTIVE) {
      throw new AppError('Invalid email or password', 401, ERROR_CODES.INVALID_CREDENTIALS);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401, ERROR_CODES.INVALID_CREDENTIALS);
    }

    const accessToken = this.generateAccessToken({
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
    });

    const refreshTokenRaw = this.generateRefreshToken();
    const tokenHash = this.hashToken(refreshTokenRaw);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.jwtRefreshExpiresInDays);

    await this.repo.createRefreshToken({
      userId: user.id,
      tokenHash,
      userAgent,
      expiresAt,
    });

    await this.repo.updateLastLogin(user.id);

    return {
      accessToken,
      refreshToken: refreshTokenRaw,
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role.name,
      },
    };
  }

  async refresh(refreshTokenRaw: string, userAgent?: string) {
    const tokenHash = this.hashToken(refreshTokenRaw);
    const tokenRecord = await this.repo.findRefreshTokenByHash(tokenHash);

    if (!tokenRecord || tokenRecord.user.status !== STATUS.ACTIVE) {
      throw new AppError('Invalid or expired refresh token', 401, ERROR_CODES.UNAUTHORIZED);
    }

    // Revoke current refresh token (Rotate)
    await this.repo.revokeRefreshToken(tokenRecord.id);

    // Issue new access + refresh token pair
    const accessToken = this.generateAccessToken({
      id: tokenRecord.user.id,
      email: tokenRecord.user.email,
      roleId: tokenRecord.user.roleId,
      roleName: tokenRecord.user.role.name,
    });

    const newRefreshTokenRaw = this.generateRefreshToken();
    const newTokenHash = this.hashToken(newRefreshTokenRaw);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.jwtRefreshExpiresInDays);

    await this.repo.createRefreshToken({
      userId: tokenRecord.user.id,
      tokenHash: newTokenHash,
      userAgent,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: newRefreshTokenRaw,
    };
  }

  async logout(refreshTokenRaw: string) {
    const tokenHash = this.hashToken(refreshTokenRaw);
    const tokenRecord = await this.repo.findRefreshTokenByHash(tokenHash);
    if (tokenRecord) {
      await this.repo.revokeRefreshToken(tokenRecord.id);
    }
    return true;
  }

  async changePassword(userId: bigint, currentPassword: string, newPassword: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ERROR_CODES.NOT_FOUND);
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Current password is incorrect', 400, ERROR_CODES.INVALID_CREDENTIALS);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.repo.updateUserPassword(userId, passwordHash);
    await this.repo.revokeAllUserRefreshTokens(userId);

    return true;
  }
}

export const authService = new AuthService();
