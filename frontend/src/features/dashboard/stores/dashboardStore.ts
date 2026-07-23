import { defineStore } from 'pinia';
import { StudentRepository } from '../../../shared/repositories/StudentRepository';
import { GuardianRepository } from '../../../shared/repositories/GuardianRepository';
import { LedgerRepository } from '../../../shared/repositories/LedgerRepository';
import { PaymentAccountRepository } from '../../../shared/repositories/PaymentAccountRepository';
import { NotificationRepository } from '../../../shared/repositories/NotificationRepository';
import { ReportService } from '../../../shared/services/ReportService';
import { useSyncStore } from '../../../stores/syncStore';
import dayjs from 'dayjs';

const DEFAULT_SCHOOL_ID = 'demo-school';

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  class_name: string;
  status: string;
  guardian?: {
    primary_phone?: string;
    full_name?: string;
  };
}

export interface LedgerEntry {
  id: string;
  student_id: string;
  amount: number;
  entry_type: 'DEBIT' | 'CREDIT';
  created_at: string;
  metadata?: {
    verified?: boolean;
  };
}

export interface OutstandingStudent {
  student_id: string;
  student_name: string;
  class_name: string;
  phone: string;
  outstanding: number;
  percentage_paid: number;
}

export interface TrendData {
  date: string;
  total: number;
  count: number;
}

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    loading: false as boolean,
    error: null as string | null,
    
    // Core metrics
    totalStudents: 0 as number,
    totalGuardians: 0 as number,
    totalCharges: 0 as number,
    totalPayments: 0 as number,
    netBalance: 0 as number,
    collectionRate: 0 as number,
    
    // Today's data
    todaysCollections: 0 as number,
    todaysPaymentsCount: 0 as number,
    pendingVerification: 0 as number,
    pendingNotifications: 0 as number,
    offlineQueue: 0 as number,
    
    // Outstanding
    outstandingByStudent: [] as OutstandingStudent[],
    outstandingStudentCount: 0 as number,
    
    // Recent payments
    recentPayments: [] as LedgerEntry[],
    
    // Payment accounts
    totalDVAs: 0 as number,
    pendingDVAs: 0 as number,
    failedDVAs: 0 as number,
    
    // Sync & system
    lastSync: null as string | null,
    
    // Derived data
    todaysExpected: 0 as number,
    trendData: {
      payments: [] as TrendData[],
      collections: [] as TrendData[]
    }
  }),
  
  getters: {
    formattedTodaysCollections: (state): string => `₦${state.todaysCollections.toLocaleString()}`,
    formattedTotalCharges: (state): string => `₦${state.totalCharges.toLocaleString()}`,
    formattedNetBalance: (state): string => `₦${state.netBalance.toLocaleString()}`,
    collectionRatePercent: (state): string => `${state.collectionRate.toFixed(1)}%`,
  },
  
  actions: {
    async fetchDashboardData() {
      this.loading = true;
      this.error = null;
      
      try {
        const [students, guardians, entries, paymentAccounts, notifications] = await Promise.all([
          StudentRepository.getStudentsBySchool(DEFAULT_SCHOOL_ID),
          GuardianRepository.getBySchool(DEFAULT_SCHOOL_ID),
          LedgerRepository.getEntriesBySchool(DEFAULT_SCHOOL_ID),
          PaymentAccountRepository.getBySchool(DEFAULT_SCHOOL_ID),
          NotificationRepository.getBySchool(DEFAULT_SCHOOL_ID),
        ]);
        
        // Basic counts
        this.totalStudents = students.length;
        this.totalGuardians = guardians.length;
        
        // Calculate charges and payments
        let totalCharges = 0;
        let totalPayments = 0;
        const todaysEntries = entries.filter(e => 
          dayjs(e.created_at).isSame(dayjs(), 'day')
        ) as LedgerEntry[];
        
        entries.forEach(entry => {
          const amount = Number(entry.amount || 0);
          if (entry.entry_type === 'DEBIT') {
            totalCharges += amount;
          } else {
            totalPayments += amount;
          }
        });
        
        this.totalCharges = totalCharges;
        this.totalPayments = totalPayments;
        this.netBalance = totalCharges - totalPayments;
        this.collectionRate = totalCharges > 0 
          ? (totalPayments / totalCharges) * 100 
          : 0;
        
        // Today's collections
        this.todaysCollections = todaysEntries
          .filter(e => e.entry_type === 'CREDIT')
          .reduce((sum, e) => sum + Number(e.amount || 0), 0);
        this.todaysPaymentsCount = todaysEntries.filter(e => e.entry_type === 'CREDIT').length;
        
        // Outstanding by student
        this.outstandingByStudent = students.map(student => {
          const studentEntries = entries.filter((e: LedgerEntry) => e.student_id === student.id);
          const charges = studentEntries
            .filter(e => e.entry_type === 'DEBIT')
            .reduce((sum, e) => sum + Number(e.amount || 0), 0);
          const payments = studentEntries
            .filter(e => e.entry_type === 'CREDIT')
            .reduce((sum, e) => sum + Number(e.amount || 0), 0);
          
          return {
            student_id: student.id,
            student_name: `${student.first_name} ${student.last_name}`,
            class_name: student.class_name,
            phone: student.guardian?.primary_phone || '',
            outstanding: charges - payments,
            percentage_paid: charges > 0 ? (payments / charges) * 100 : 0,
          };
        }).filter(s => s.outstanding > 0);
        
        this.outstandingStudentCount = this.outstandingByStudent.length;
        
        // Recent payments
        this.recentPayments = entries
          .filter(e => e.entry_type === 'CREDIT')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 10)
          .map(entry => {
            const student = students.find(s => s.id === entry.student_id);
            return {
              ...entry,
              student_name: student ? `${student.first_name} ${student.last_name}` : 'Unknown',
              guardian_name: student?.guardian?.full_name || 'Unknown',
            } as LedgerEntry & { student_name: string; guardian_name: string };
          });
        
        // Payment accounts
        this.totalDVAs = paymentAccounts.filter(a => a.account_status === 'ACTIVE').length;
        this.pendingDVAs = paymentAccounts.filter(a => a.account_status === 'INACTIVE').length;
        this.failedDVAs = paymentAccounts.filter(a => a.account_status === 'SUSPENDED').length;
        
        // Notifications
        this.pendingNotifications = notifications.filter(n => n.delivery_status === 'PENDING').length;
        
        // Sync store data
        const syncStore = useSyncStore();
        await syncStore.refreshStatus();
        this.offlineQueue = syncStore.pendingCount;
        
        // Pending verification (payments without sync)
        this.pendingVerification = entries.filter(e => 
          e.entry_type === 'CREDIT' && !e.metadata?.verified
        ).length;
        
        // Today's expected (based on tuition config)
        this.todaysExpected = this.calculateTodaysExpected(students);
        
        // Trend data for chart
        this.trendData = this.calculateTrendData(entries);
        
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
      } finally {
        this.loading = false;
      }
    },
    
    calculateTodaysExpected(students: Student[]): number {
      // Estimate expected: assume each active student should pay ~20k per term
      // This is a placeholder - real implementation would use tuition configs
      const activeStudents = students.filter(s => s.status === 'ACTIVE');
      return activeStudents.length * 20000;
    },
    
    calculateTrendData(entries: LedgerEntry[]): { payments: TrendData[] } {
      const last7Days: TrendData[] = [];
      const today = dayjs();
      
      for (let i = 6; i >= 0; i--) {
        const date = today.subtract(i, 'day').format('YYYY-MM-DD');
        const dayEntries = entries.filter(e => 
          dayjs(e.created_at).format('YYYY-MM-DD') === date && e.entry_type === 'CREDIT'
        );
        last7Days.push({
          date,
          total: dayEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0),
          count: dayEntries.length,
        });
      }
      
      return { payments: last7Days };
    },
  },
});