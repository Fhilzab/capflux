import { defineStore } from 'pinia';
import { StudentRepository } from '../repositories/StudentRepository';
import { GuardianRepository } from '../repositories/GuardianRepository';
import { LedgerRepository } from '../repositories/LedgerRepository';
import { PaymentAccountRepository } from '../repositories/PaymentAccountRepository';
import { NotificationRepository } from '../repositories/NotificationRepository';
import { ReportService } from '../services/ReportService';
import { useSyncStore } from './syncStore';
import dayjs from 'dayjs';

const DEFAULT_SCHOOL_ID = 'demo-school';

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    loading: false,
    error: null,
    
    // Core metrics
    totalStudents: 0,
    totalGuardians: 0,
    totalCharges: 0,
    totalPayments: 0,
    netBalance: 0,
    collectionRate: 0,
    
    // Today's data
    todaysCollections: 0,
    todaysPaymentsCount: 0,
    pendingVerification: 0,
    pendingNotifications: 0,
    offlineQueue: 0,
    
    // Outstanding
    outstandingByStudent: [],
    outstandingStudentCount: 0,
    
    // Recent payments
    recentPayments: [],
    
    // Payment accounts
    totalDVAs: 0,
    pendingDVAs: 0,
    failedDVAs: 0,
    
    // Sync & system
    lastSync: null,
    
    // Derived data
    todaysExpected: 0,
    trendData: {
      payments: [],
      collections: []
    }
  }),
  
  getters: {
    formattedTodaysCollections: (state) => `₦${state.todaysCollections.toLocaleString()}`,
    formattedTotalCharges: (state) => `₦${state.totalCharges.toLocaleString()}`,
    formattedNetBalance: (state) => `₦${state.netBalance.toLocaleString()}`,
    collectionRatePercent: (state) => `${state.collectionRate.toFixed(1)}%`,
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
        );
        
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
          const studentEntries = entries.filter(e => e.student_id === student.id);
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
            };
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
    
    calculateTodaysExpected(students) {
      // Estimate expected: assume each active student should pay ~20k per term
      // This is a placeholder - real implementation would use tuition configs
      const activeStudents = students.filter(s => s.status === 'ACTIVE');
      return activeStudents.length * 20000;
    },
    
    calculateTrendData(entries) {
      const last7Days = [];
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