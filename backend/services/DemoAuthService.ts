/**
 * DemoAuthService — server-side sandbox demo authentication.
 *
 * This service handles demo persona authentication for the sandbox environment.
 * It validates personas against a server-side allowlist and issues short-lived
 * signed demo session tokens.
 *
 * SECURITY: This service MUST only be used in CAPFLUX_MODE=sandbox.
 * Production deployments must never expose demo authentication endpoints.
 */
import { SignJWT, jwtVerify } from 'jose';
import { getCapfluxMode } from './RuntimeConfiguration.js';

export interface DemoPersona {
  id: string;
  email: string;
  fullName: string;
  role: 'OWNER' | 'ADMIN' | 'BURSAR' | 'STAFF';
  systemRole: 'OWNER' | 'ADMIN' | 'STAFF';
  title: string;
  platformStaff?: boolean;
}

export interface DemoSessionPayload {
  sandbox: true;
  demo: true;
  personaId: string;
  role: string;
  systemRole: string;
  platformStaff?: boolean;
  title: string;
  issuedAt: number;
  exp: number;
}

const DEMO_SESSION_TTL_SECONDS = 60 * 60 * 4; // 4 hours

const DEMO_PERSONAS: readonly DemoPersona[] = [
  {
    id: 'proprietor',
    email: 'owner@demo.capflux',
    fullName: 'Amaka Obi',
    role: 'OWNER',
    systemRole: 'OWNER',
    title: 'Proprietress / School Owner',
  },
  {
    id: 'administrator',
    email: 'admin@demo.capflux',
    fullName: 'Chinedu Bello',
    role: 'ADMIN',
    systemRole: 'ADMIN',
    title: 'School Administrator',
  },
  {
    id: 'bursar',
    email: 'bursar@demo.capflux',
    fullName: 'Ngozi Eze',
    role: 'BURSAR',
    systemRole: 'ADMIN',
    title: 'Bursar',
  },
  {
    id: 'teacher',
    email: 'staff@demo.capflux',
    fullName: 'Tunde Adebayo',
    role: 'STAFF',
    systemRole: 'STAFF',
    title: 'Class Teacher',
  },
  {
    id: 'platform_ops',
    email: 'ops@capflux.demo',
    fullName: 'CAPFLUX Platform Ops',
    role: 'STAFF',
    systemRole: 'STAFF',
    title: 'Platform Compliance Staff',
    platformStaff: true,
  },
] as const;

const PERSONA_BY_ID: ReadonlyMap<string, DemoPersona> = new Map(
  DEMO_PERSONAS.map((p) => [p.id, p]),
);

const PERSONA_BY_EMAIL: ReadonlyMap<string, DemoPersona> = new Map(
  DEMO_PERSONAS.map((p) => [p.email.toLowerCase(), p]),
);

function getDemoSigningSecret(): Uint8Array {
  const secret = process.env.DEMO_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('DEMO_SESSION_SECRET must be set and at least 32 characters for sandbox mode');
  }
  return new TextEncoder().encode(secret);
}

export class DemoAuthService {
  static assertSandboxMode(): void {
    if (getCapfluxMode() !== 'sandbox') {
      throw new Error('Demo authentication is only available in sandbox mode');
    }
  }

  static getPersonas(): readonly DemoPersona[] {
    return DEMO_PERSONAS;
  }

  static getPersonaById(id: string): DemoPersona | undefined {
    return PERSONA_BY_ID.get(id);
  }

  static getPersonaByEmail(email: string): DemoPersona | undefined {
    return PERSONA_BY_EMAIL.get(email.toLowerCase());
  }

  static validatePersona(personaId: string): DemoPersona {
    this.assertSandboxMode();
    const persona = this.getPersonaById(personaId);
    if (!persona) {
      throw new Error(`Unknown demo persona: ${personaId}`);
    }
    return persona;
  }

  static async createDemoSession(persona: DemoPersona): Promise<string> {
    this.assertSandboxMode();

    const now = Math.floor(Date.now() / 1000);
    const payload: DemoSessionPayload = {
      sandbox: true,
      demo: true,
      personaId: persona.id,
      role: persona.role,
      systemRole: persona.systemRole,
      platformStaff: persona.platformStaff ?? false,
      title: persona.title,
      issuedAt: now,
      exp: now + DEMO_SESSION_TTL_SECONDS,
    };

    const secret = getDemoSigningSecret();
    const token = await new SignJWT(payload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt(now)
      .setExpirationTime(`${DEMO_SESSION_TTL_SECONDS}s`)
      .sign(secret);

    return token;
  }

  static async verifyDemoSession(token: string): Promise<DemoSessionPayload> {
    this.assertSandboxMode();

    const secret = getDemoSigningSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    if (!payload.sandbox || !payload.demo) {
      throw new Error('Invalid demo session: missing sandbox/demo claims');
    }

    if (typeof payload.personaId !== 'string') {
      throw new Error('Invalid demo session: missing personaId');
    }

    const persona = this.getPersonaById(payload.personaId as string);
    if (!persona) {
      throw new Error('Invalid demo session: unknown persona');
    }

    return payload as unknown as DemoSessionPayload;
  }
}

export { DEMO_PERSONAS, DEMO_SESSION_TTL_SECONDS };
export default DemoAuthService;