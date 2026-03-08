import { Company, User, db } from './db-schema';
import { hashPassword, verifyPassword, generateId } from './utils-hr';

export interface AuthSession {
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  companyId: string;
  companyName: string;
  expiresAt: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCompanyInput {
  companyName: string;
  registrationNumber: string;
  taxPin: string;
  nssf: string;
  nhif: string;
  address: string;
  phone: string;
  email: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
}

/**
 * Authentication Service
 * Handles user login, registration, and session management
 */
class AuthService {
  private sessions: Map<string, AuthSession> = new Map();

  /**
   * Register a new company with admin user
   */
  registerCompany(input: RegisterCompanyInput): { company: Company; user: User; sessionToken: string } {
    // Check if email already exists
    if (db.getUserByEmail(input.adminEmail)) {
      throw new Error('Email already registered');
    }

    // Create company
    const company = db.createCompany({
      id: generateId('cmp'),
      name: input.companyName,
      registrationNumber: input.registrationNumber,
      taxPin: input.taxPin,
      nssf: input.nssf,
      nhif: input.nhif,
      address: input.address,
      phone: input.phone,
      email: input.email,
      country: 'Kenya',
      currency: 'KES',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create admin user
    const user = db.createUser({
      id: generateId('usr'),
      email: input.adminEmail,
      passwordHash: hashPassword(input.adminPassword),
      firstName: input.adminFirstName,
      lastName: input.adminLastName,
      role: 'admin',
      companyId: company.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create session
    const sessionToken = this.createSession(user, company);

    return { company, user, sessionToken };
  }

  /**
   * Login user with email and password
   */
  login(credentials: LoginCredentials): { user: User; company: Company; sessionToken: string } {
    const user = db.getUserByEmail(credentials.email);

    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!verifyPassword(credentials.password, user.passwordHash)) {
      throw new Error('Invalid email or password');
    }

    const company = db.getCompany(user.companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    const sessionToken = this.createSession(user, company);
    return { user, company, sessionToken };
  }

  /**
   * Create a session for a user
   */
  private createSession(user: User, company: Company): string {
    const sessionToken = generateId('sess');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour session

    const session: AuthSession = {
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName} ${user.lastName}`,
      userRole: user.role,
      companyId: company.id,
      companyName: company.name,
      expiresAt,
    };

    this.sessions.set(sessionToken, session);
    return sessionToken;
  }

  /**
   * Get session from token
   */
  getSession(token: string): AuthSession | null {
    const session = this.sessions.get(token);

    if (!session) {
      return null;
    }

    // Check if session expired
    if (new Date() > session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }

    return session;
  }

  /**
   * Logout (invalidate session)
   */
  logout(token: string): void {
    this.sessions.delete(token);
  }

  /**
   * Verify password strength
   */
  static isStrongPassword(password: string): boolean {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
  }

  /**
   * Change user password
   */
  changePassword(userId: string, oldPassword: string, newPassword: string): void {
    const user = db.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!verifyPassword(oldPassword, user.passwordHash)) {
      throw new Error('Current password is incorrect');
    }

    if (!AuthService.isStrongPassword(newPassword)) {
      throw new Error('Password must be at least 8 characters with uppercase, lowercase, and numbers');
    }

    db.updateUser(userId, {
      passwordHash: hashPassword(newPassword),
    });
  }

  /**
   * Create new user in company
   */
  createUser(
    companyId: string,
    email: string,
    firstName: string,
    lastName: string,
    role: 'admin' | 'manager' | 'employee'
  ): User {
    if (db.getUserByEmail(email)) {
      throw new Error('Email already registered');
    }

    // Generate temporary password
    const tempPassword = this.generateTemporaryPassword();

    return db.createUser({
      id: generateId('usr'),
      email,
      passwordHash: hashPassword(tempPassword),
      firstName,
      lastName,
      role,
      companyId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Generate temporary password for new users
   */
  private generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Reset password (admin only)
   */
  resetUserPassword(userId: string): string {
    const user = db.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const tempPassword = this.generateTemporaryPassword();
    db.updateUser(userId, {
      passwordHash: hashPassword(tempPassword),
    });

    return tempPassword;
  }
}

// Global auth instance
export const authService = new AuthService();
