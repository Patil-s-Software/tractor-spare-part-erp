import { categoryRepository, CategoryRepository } from './repository';

export class CategoryService {
  constructor(private repo: CategoryRepository = categoryRepository) {}

  async getAllCategories() {
    return this.repo.findAll();
  }

  async createCategory(data: { name: string; parentCategoryId?: bigint }) {
    return this.repo.create(data);
  }

  async updateCategory(id: bigint, data: { name?: string; parentCategoryId?: bigint | null; status?: string }) {
    return this.repo.update(id, data);
  }
}

export const categoryService = new CategoryService();
