import bcrypt from 'bcryptjs';
import { ERROR_CODES } from '../../constants';
import { AppError } from '../../middlewares/error-handler.middleware';
import { userRepository, UserRepository } from './repository';

export class UserService {
  constructor(private repo: UserRepository = userRepository) {}

  async getUserById(id: bigint) {
    const user = await this.repo.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, ERROR_CODES.NOT_FOUND);
    }
    return user;
  }

  async getAllUsers(page = 1, limit = 20, search?: string) {
    const { total, users } = await this.repo.findAll(page, limit, search);
    const totalPages = Math.ceil(total / limit);
    return {
      users,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async createUser(data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    roleId: number;
  }) {
    const existing = await this.repo.findByEmail(data.email);
    if (existing) {
      throw new AppError('Email address is already in use', 409, ERROR_CODES.CONFLICT);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.repo.createUser({
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash,
      roleId: data.roleId,
    });
  }

  async updateUserStatus(id: bigint, status: string) {
    await this.getUserById(id);
    return this.repo.updateStatus(id, status);
  }
}

export const userService = new UserService();
