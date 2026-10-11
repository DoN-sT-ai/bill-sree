import { db, User, Expense, generateSalt, hashPassword } from '../db.ts';
import { SupabaseDb } from '../supabaseDb.ts';
import { isSupabaseConfigured } from '../supabaseClient.ts';
import { AuditService } from './auditService.ts';
import { safeUser } from './authService.ts';
import crypto from 'crypto';

export class EmployeeService {
  static listEmployees(storeId: string) {
    return db.users
      .filter(u => u.store_id === storeId)
      .map(u => safeUser(u));
  }

  static async createEmployee(storeId: string, adminUserId: string, adminUserName: string, payload: {
    name: string;
    email: string;
    password: string;
    role?: 'ADMIN' | 'EMPLOYEE';
  }) {
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanName = payload.name.trim();

    if (!cleanName) throw new Error('Employee name is required');
    if (!cleanEmail) throw new Error('Employee email is required');
    if (!payload.password || payload.password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Check uniqueness against Supabase (authoritative)
    if (isSupabaseConfigured) {
      const existing = await SupabaseDb.getUserByEmail(cleanEmail);
      if (existing) {
        throw new Error(`An employee with email "${cleanEmail}" already exists`);
      }
    } else {
      const existing = db.users.find(u => u.store_id === storeId && u.email.toLowerCase() === cleanEmail);
      if (existing) throw new Error(`An employee with email "${cleanEmail}" already exists`);
    }

    const salt = generateSalt();
    const passwordHash = hashPassword(payload.password, salt);
    const now = new Date().toISOString();

    const newEmp: User = {
      id: crypto.randomUUID(),
      store_id: storeId,
      name: cleanName,
      email: cleanEmail,
      password_hash: passwordHash,
      salt,
      role: payload.role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE',
      active: true,
      created_by: adminUserId || undefined,
      created_at: now,
      updated_at: now,
    };

    // Write to Supabase (primary store)
    if (isSupabaseConfigured) {
      const saved = await SupabaseDb.createUser(newEmp);
      db.users.push(saved); // update cache
      AuditService.log({
        storeId, userId: adminUserId, userName: adminUserName,
        action: 'USER_CREATED', entityType: 'USER', entityId: saved.id,
        afterData: { name: saved.name, email: saved.email, role: saved.role },
      });
      return safeUser(saved);
    }

    // No Supabase — warn but still allow local operation
    db.users.push(newEmp);
    AuditService.log({
      storeId, userId: adminUserId, userName: adminUserName,
      action: 'USER_CREATED', entityType: 'USER', entityId: newEmp.id,
      afterData: { name: newEmp.name, email: newEmp.email, role: newEmp.role },
    });
    return safeUser(newEmp);
  }

  static async setEmployeeActive(storeId: string, adminUserId: string, adminUserName: string, employeeId: string, active: boolean) {
    if (adminUserId === employeeId) {
      throw new Error('You cannot deactivate your own admin account');
    }

    const user = db.users.find(u => u.id === employeeId && u.store_id === storeId);
    if (!user) throw new Error('User not found');

    const beforeActive = user.active;
    user.active = active;
    user.updated_at = new Date().toISOString();

    if (isSupabaseConfigured) {
      await SupabaseDb.updateUser(employeeId, { active, updated_at: user.updated_at });
    }

    AuditService.log({
      storeId, userId: adminUserId, userName: adminUserName,
      action: active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'USER', entityId: user.id,
      beforeData: { active: beforeActive }, afterData: { active },
    });

    return safeUser(user);
  }

  static async resetEmployeePassword(storeId: string, adminUserId: string, adminUserName: string, employeeId: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    const user = db.users.find(u => u.id === employeeId && u.store_id === storeId);
    if (!user) throw new Error('User not found');

    const salt = generateSalt();
    const passwordHash = hashPassword(newPassword, salt);
    const now = new Date().toISOString();

    user.password_hash = passwordHash;
    user.salt = salt;
    user.updated_at = now;

    if (isSupabaseConfigured) {
      await SupabaseDb.updateUser(employeeId, { password_hash: passwordHash, salt, updated_at: now });
    }

    AuditService.log({
      storeId, userId: adminUserId, userName: adminUserName,
      action: 'USER_PASSWORD_RESET', entityType: 'USER', entityId: user.id,
    });

    return safeUser(user);
  }
}

export class ExpenseService {
  static listExpenses(storeId: string, options?: { from?: string; to?: string }) {
    let list = db.expenses.filter(e => e.store_id === storeId);
    if (options?.from) list = list.filter(e => e.expense_date >= options.from!);
    if (options?.to) list = list.filter(e => e.expense_date <= options.to!);
    return list;
  }

  static async createExpense(storeId: string, userId: string, userName: string, payload: {
    category: string;
    amount: number;
    description: string;
    expenseDate?: string;
  }) {
    const amt = Number(payload.amount);
    if (isNaN(amt) || amt <= 0) throw new Error('Expense amount must be greater than zero');
    if (!payload.category?.trim()) throw new Error('Expense category is required');

    const now = new Date().toISOString();
    const expDate = payload.expenseDate || now.split('T')[0];

    const newExp: Omit<Expense, 'id' | 'created_at'> = {
      store_id: storeId,
      created_by: userId,
      created_by_name: userName,
      category: payload.category.trim(),
      amount: amt,
      description: payload.description?.trim() || '',
      expense_date: expDate,
      status: 'ACTIVE',
    };

    if (isSupabaseConfigured) {
      const saved = await SupabaseDb.createExpense(newExp);
      db.expenses.unshift(saved);
      AuditService.log({
        storeId, userId, userName, action: 'EXPENSE_CREATED', entityType: 'EXPENSE', entityId: saved.id,
        afterData: { category: saved.category, amount: saved.amount, date: saved.expense_date },
      });
      return saved;
    }

    const local: Expense = { ...newExp, id: crypto.randomUUID(), created_at: now };
    db.expenses.unshift(local);
    AuditService.log({
      storeId, userId, userName, action: 'EXPENSE_CREATED', entityType: 'EXPENSE', entityId: local.id,
      afterData: { category: local.category, amount: local.amount, date: local.expense_date },
    });
    return local;
  }

  static async voidExpense(storeId: string, userId: string, userName: string, expenseId: string) {
    const exp = db.expenses.find(e => e.id === expenseId && e.store_id === storeId);
    if (!exp) throw new Error('Expense record not found');
    if (exp.status === 'VOIDED') throw new Error('Expense is already voided');

    exp.status = 'VOIDED';

    if (isSupabaseConfigured) {
      await SupabaseDb.voidExpense(expenseId);
    }

    AuditService.log({
      storeId, userId, userName, action: 'EXPENSE_VOIDED', entityType: 'EXPENSE', entityId: exp.id,
      afterData: { category: exp.category, amount: exp.amount, status: 'VOIDED' },
    });

    return exp;
  }
}
