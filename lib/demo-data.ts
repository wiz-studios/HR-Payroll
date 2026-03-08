import { db } from './db-schema';
import { generateId, generateEmployeeNumber } from './utils-hr';
import { authService } from './auth';

/**
 * Initialize demo data for testing
 * This creates a demo company with employees and sample payroll data
 */
export function initializeDemoData() {
  try {
    // Check if demo data already exists
    const existingCompany = db.getAllCompanies().find(c => c.email === 'hr@techcorp.com');
    if (existingCompany) {
      console.log('[Demo] Demo data already initialized');
      return;
    }

    console.log('[Demo] Initializing demo data...');

    // Register demo company
    const { company, user } = authService.registerCompany({
      companyName: 'TechCorp Kenya Ltd',
      registrationNumber: 'PVT/REG/2023/456789',
      taxPin: 'A000000001Z',
      nssf: 'NSSF/2023/456789',
      nhif: 'NHIF/2023/456789',
      address: '123 Tech Park, Nairobi CBD',
      phone: '+254712345678',
      email: 'hr@techcorp.com',
      adminEmail: 'admin@techcorp.com',
      adminPassword: 'AdminPass123',
      adminFirstName: 'John',
      adminLastName: 'Kimani',
    });

    console.log(`[Demo] Created company: ${company.name}`);

    // Create additional users
    authService.createUser(company.id, 'manager@techcorp.com', 'Jane', 'Ochieng', 'manager');
    authService.createUser(company.id, 'employee@techcorp.com', 'Peter', 'Mwangi', 'employee');

    // Create demo employees
    const employeeData = [
      {
        firstName: 'Alice',
        lastName: 'Kariuki',
        email: 'alice.kariuki@techcorp.com',
        phoneNumber: '+254712345001',
        idNumber: '12345678',
        taxPin: 'A000000010B',
        accountNumber: '1234567890',
        bankCode: '001',
        bankName: 'Equity Bank',
        department: 'Engineering',
        position: 'Senior Software Engineer',
        baseSalary: 180000,
        allowances: {
          housing: 30000,
          transport: 10000,
          medical: 5000,
        },
        deductions: {
          nssf: 0,
          nhif: 0,
          unionFees: 1000,
        },
      },
      {
        firstName: 'Michael',
        lastName: 'Kipchoge',
        email: 'michael.kipchoge@techcorp.com',
        phoneNumber: '+254712345002',
        idNumber: '87654321',
        taxPin: 'A000000020C',
        accountNumber: '0987654321',
        bankCode: '001',
        bankName: 'Equity Bank',
        department: 'Engineering',
        position: 'Software Engineer',
        baseSalary: 120000,
        allowances: {
          housing: 20000,
          transport: 8000,
          medical: 3000,
        },
        deductions: {
          nssf: 0,
          nhif: 0,
        },
      },
      {
        firstName: 'Grace',
        lastName: 'Njeri',
        email: 'grace.njeri@techcorp.com',
        phoneNumber: '+254712345003',
        idNumber: '11223344',
        taxPin: 'A000000030D',
        accountNumber: '5555666677',
        bankCode: '001',
        bankName: 'Equity Bank',
        department: 'Finance',
        position: 'Finance Manager',
        baseSalary: 150000,
        allowances: {
          housing: 25000,
          transport: 9000,
          medical: 4000,
        },
        deductions: {
          nssf: 0,
          nhif: 0,
          unionFees: 500,
        },
      },
      {
        firstName: 'David',
        lastName: 'Muthamba',
        email: 'david.muthamba@techcorp.com',
        phoneNumber: '+254712345004',
        idNumber: '55667788',
        taxPin: 'A000000040E',
        accountNumber: '9999000011',
        bankCode: '001',
        bankName: 'Equity Bank',
        department: 'HR',
        position: 'HR Officer',
        baseSalary: 90000,
        allowances: {
          housing: 15000,
          transport: 6000,
          medical: 2000,
        },
        deductions: {
          nssf: 0,
          nhif: 0,
        },
      },
      {
        firstName: 'Emma',
        lastName: 'Omondi',
        email: 'emma.omondi@techcorp.com',
        phoneNumber: '+254712345005',
        idNumber: '99887766',
        taxPin: 'A000000050F',
        accountNumber: '1111222233',
        bankCode: '001',
        bankName: 'Equity Bank',
        department: 'Sales',
        position: 'Sales Manager',
        baseSalary: 140000,
        allowances: {
          housing: 23000,
          transport: 8500,
          medical: 3500,
        },
        deductions: {
          nssf: 0,
          nhif: 0,
          unionFees: 800,
        },
      },
    ];

    const employees = employeeData.map((data, index) => {
      const employee = db.createEmployee({
        id: generateId('emp'),
        companyId: company.id,
        employeeNumber: generateEmployeeNumber(company.id, index + 1),
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        idNumber: data.idNumber,
        taxPin: data.taxPin,
        accountNumber: data.accountNumber,
        bankCode: data.bankCode,
        bankName: data.bankName,
        department: data.department,
        position: data.position,
        joiningDate: new Date('2023-01-01'),
        status: 'active',
        employmentType: 'permanent',
        baseSalary: data.baseSalary,
        salaryFrequency: 'monthly',
        allowances: data.allowances,
        deductions: data.deductions,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`[Demo] Created employee: ${employee.firstName} ${employee.lastName}`);
      return employee;
    });

    console.log('[Demo] Demo data initialization complete!');
    console.log(`[Demo] Demo credentials:`);
    console.log(`[Demo]   Email: admin@techcorp.com`);
    console.log(`[Demo]   Password: AdminPass123`);
  } catch (error) {
    console.error('[Demo] Failed to initialize demo data:', error);
  }
}

/**
 * Clear all data (use with caution!)
 */
export function clearAllData() {
  // This is a simplified version - in production, you'd need proper data cleanup
  console.warn('[Demo] Clearing all data...');
}
