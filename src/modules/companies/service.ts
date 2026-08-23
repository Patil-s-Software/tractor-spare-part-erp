import { companyRepository, CompanyRepository } from './repository';

export class CompanyService {
  constructor(private repo: CompanyRepository = companyRepository) {}

  async getAllCompanies() {
    return this.repo.findAll();
  }

  async createCompany(name: string) {
    return this.repo.create(name);
  }

  async updateCompany(id: bigint, data: { name?: string; status?: string }) {
    return this.repo.update(id, data);
  }
}

export const companyService = new CompanyService();
