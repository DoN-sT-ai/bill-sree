import crypto from 'crypto';
import { db, verifyPassword, User } from '../db.ts';
import { SupabaseDb } from '../supabaseDb.ts';
import { isSupabaseConfigured } from '../supabaseClient.ts';
import { AuditService } from './auditService.ts';

export interface SessionData {
  userId: string;
  storeId: string;
  role: 'ADMIN' | 'EMPLOYEE';
  name: string;
  email: string;
  createdAt: number;
}

// In-memory active sessions map: token -> SessionData
const activeSessions = new Map<string, SessionData>();

export function safeUser(u: User) {
  return {
    id: u.id,
    store_id: u.store_id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    last_login_at: u.last_login_at,
    created_at: u.created_at,
  };
}

export class AuthService {
  /**
   * Authenticate a user by looking up their record directly from Supabase (if configured)
   * or from the local in-memory database. This ensures logins always reflect the live
   * database state — no hardcoded credentials.
   */
  static async login(email: string, password: string, ip?: string, userAgent?: string) {
    const cleanEmail = email.trim().toLowerCase();

    let user: User | null = null;

    // PRIMARY: Query Supabase directly so login is always live
    if (isSupabaseConfigured) {
      user = await SupabaseDb.getUserByEmail(cleanEmail);
    }

    // FALLBACK: Use local in-memory db (only when Supabase is NOT configured)
    if (!user && !isSupabaseConfigured) {
      user = db.users.find(u => u.email.toLowerCase() === cleanEmail) ?? null;
    }

    if (!user) {
      if (!isSupabaseConfigured) {
        throw new Error('Database not connected: SUPABASE_URL and SUPABASE_ANON_KEY are missing in Vercel Environment Variables. Please add them in Vercel Project Settings > Environment Variables and redeploy.');
      }

      if (isSupabaseConfigured) {
        try {
          const { supabase } = await import('../supabaseClient.ts');
          if (supabase) {
            const { count, error } = await supabase.from('users').select('*', { count: 'exact', head: true });
            if (error) {
              throw new Error(`Database connection failed: ${error.message}`);
            }
            if (count === 0) {
              throw new Error('Supabase database is empty: Please run the seed SQL in your Supabase SQL Editor to create the admin user.');
            }
          }
        } catch (err: any) {
          throw err;
        }
      }

      AuditService.log({
        storeId: 'global',
        action: 'LOGIN_FAILED',
        entityType: 'AUTH',
        afterData: { email: cleanEmail, reason: 'User not found' },
        ipAddress: ip,
        userAgent,
      });
      throw new Error('Invalid email or password');
    }

    if (!user.active) {
      AuditService.log({
        storeId: user.store_id,
        userId: user.id,
        userName: user.name,
        action: 'LOGIN_BLOCKED_INACTIVE',
        entityType: 'AUTH',
        ipAddress: ip,
        userAgent,
      });
      throw new Error('Your account has been deactivated. Please contact the administrator.');
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      AuditService.log({
        storeId: user.store_id,
        userId: user.id,
        userName: user.name,
        action: 'LOGIN_FAILED',
        entityType: 'AUTH',
        afterData: { email: cleanEmail, reason: 'Password mismatch' },
        ipAddress: ip,
        userAgent,
      });
      throw new Error('Invalid email or password');
    }

    // Update last_login_at
    const now = new Date().toISOString();
    if (isSupabaseConfigured) {
      await SupabaseDb.updateUser(user.id, { last_login_at: now }).catch(() => {});
    } else {
      user.last_login_at = now;
      db.save();
    }

    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    const session: SessionData = {
      userId: user.id,
      storeId: user.store_id,
      role: user.role,
      name: user.name,
      email: user.email,
      createdAt: Date.now(),
    };
    activeSessions.set(token, session);

    AuditService.log({
      storeId: user.store_id,
      userId: user.id,
      userName: user.name,
      action: 'LOGIN_SUCCESS',
      entityType: 'AUTH',
      ipAddress: ip,
      userAgent,
    });

    // Get store
    let store: any = null;
    if (isSupabaseConfigured) {
      store = await SupabaseDb.getStore(user.store_id);
    } else {
      store = db.stores.find(s => s.id === user!.store_id) ?? null;
    }

    // Ensure user and store are present in cache
    if (isSupabaseConfigured && (!db.users.some(u => u.id === user!.id) || db.stores.length === 0)) {
      await db.syncFromSupabase().catch(() => {});
    }

    return {
      token,
      user: safeUser(user),
      store,
    };
  }

  static getSession(token: string): { user: ReturnType<typeof safeUser>; store: any; session: SessionData } | null {
    if (!token) return null;
    const session = activeSessions.get(token);
    if (!session) return null;

    let user = db.users.find(u => u.id === session.userId && u.active);
    let store = user ? db.stores.find(s => s.id === user.store_id) : db.stores.find(s => s.id === session.storeId);

    if (!user) {
      // Provide session fallback so auth never breaks if cache sync is pending
      return {
        user: {
          id: session.userId,
          store_id: session.storeId,
          name: session.name,
          email: session.email,
          role: session.role,
          active: true,
          last_login_at: undefined,
          created_at: new Date(session.createdAt).toISOString(),
        },
        store: store || {
          id: session.storeId,
          name: 'LedgerStore Supermarket',
          code: 'STORE-01',
          currency: 'INR',
          invoice_prefix: 'INV-',
        },
        session,
      };
    }

    return {
      user: safeUser(user),
      store: store || {
        id: session.storeId,
        name: 'LedgerStore Supermarket',
        code: 'STORE-01',
        currency: 'INR',
        invoice_prefix: 'INV-',
      },
      session,
    };
  }

  static logout(token: string) {
    if (token) {
      const session = activeSessions.get(token);
      if (session) {
        AuditService.log({
          storeId: session.storeId,
          userId: session.userId,
          userName: session.name,
          action: 'LOGOUT',
          entityType: 'AUTH',
        });
      }
      activeSessions.delete(token);
    }
  }
}
