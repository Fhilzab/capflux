import db from '../offline/localDb';
import { LocalRepository } from '../offline/localDb';
import type { FeeRule, PlatformFeeCalculation } from '../types/billing';

export const FeeRuleRepository = {
  /**
   * Save fee rule to IndexedDB and enqueue for sync
   */
  async saveFeeRule(rule: Partial<FeeRule>) {
    const { v4: uuidv4 } = await import('uuid');
    const record: FeeRule = {
      id: rule.id ?? uuidv4(),
      school_id: rule.school_id!,
      minimum_fee: rule.minimum_fee ?? 200,
      percentage: rule.percentage ?? 1.5,
      maximum_fee: rule.maximum_fee ?? 2000,
      effective_date: rule.effective_date ?? new Date().toISOString().split('T')[0],
      is_active: rule.is_active ?? true,
      created_at: rule.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await LocalRepository.saveFeeRule(record);
    await LocalRepository.enqueueSyncItem({
      school_id: record.school_id,
      entity_type: 'fee_rules',
      entity_id: record.id,
      payload: {
        id: record.id,
        school_id: record.school_id,
        minimum_fee: record.minimum_fee,
        percentage: record.percentage,
        maximum_fee: record.maximum_fee,
        effective_date: record.effective_date,
        is_active: record.is_active,
        created_at: record.created_at,
        updated_at: record.updated_at,
      } as Record<string, unknown>,
    });

    return record;
  },

  /**
   * Get active fee rule for a school
   */
  async getActiveFeeRule(school_id: string): Promise<FeeRule | undefined> {
    return LocalRepository.getActiveFeeRule(school_id);
  },

  /**
   * Get all fee rules for a school
   */
  async getFeeRulesBySchool(school_id: string): Promise<FeeRule[]> {
    return LocalRepository.getFeeRulesBySchool(school_id);
  },

  /**
   * Calculate platform fee based on fee rules
   */
  async calculatePlatformFee(amount: number, school_id: string): Promise<PlatformFeeCalculation> {
    const rule = await this.getActiveFeeRule(school_id);
    
    if (!rule) {
      // Default calculation
      const calculatedFee = amount * 0.015;
      return {
        fee: calculatedFee,
        breakdown: {
          base_amount: amount,
          percentage: 1.5,
          calculated_fee: calculatedFee,
          minimum_applied: false,
          maximum_applied: false,
        },
      };
    }

    const calculatedFee = amount * (rule.percentage / 100);
    let finalFee = calculatedFee;
    let minimumApplied = false;
    let maximumApplied = false;

    if (calculatedFee < rule.minimum_fee) {
      finalFee = rule.minimum_fee;
      minimumApplied = true;
    } else if (calculatedFee > rule.maximum_fee) {
      finalFee = rule.maximum_fee;
      maximumApplied = true;
    }

    return {
      fee: finalFee,
      breakdown: {
        base_amount: amount,
        percentage: rule.percentage,
        calculated_fee: calculatedFee,
        minimum_applied: minimumApplied,
        maximum_applied: maximumApplied,
      },
    };
  },

  /**
   * Update fee rule
   */
  async updateFeeRule(rule_id: string, updates: Partial<FeeRule>) {
    const existing = await db.fee_rules.get(rule_id);
    if (!existing) throw new Error('Fee rule not found');

    const updated: FeeRule = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await db.fee_rules.put(updated);
    await LocalRepository.enqueueSyncItem({
      school_id: updated.school_id,
      entity_type: 'fee_rules',
      entity_id: rule_id,
      operation: 'UPDATE',
      payload: {
        id: updated.id,
        school_id: updated.school_id,
        minimum_fee: updated.minimum_fee,
        percentage: updated.percentage,
        maximum_fee: updated.maximum_fee,
        effective_date: updated.effective_date,
        is_active: updated.is_active,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      } as Record<string, unknown>,
    });

    return updated;
  },
};