import { unitRepository, UnitRepository } from './repository';

export class UnitService {
  constructor(private repo: UnitRepository = unitRepository) {}

  async getAllUnits() {
    return this.repo.findAll();
  }

  async createUnit(data: { name: string; shortCode?: string }) {
    return this.repo.create(data);
  }
}

export const unitService = new UnitService();
