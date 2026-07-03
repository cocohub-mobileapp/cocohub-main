import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';

export type InsuranceProvider = 'trupanion' | 'nationwide' | 'mock';
export type ClaimStatus = 'submitted' | 'under_review' | 'approved' | 'denied';

export interface InsurancePolicy {
  id: string;
  userId: string;
  provider: InsuranceProvider;
  policyNumber: string;
  petId?: string;
  coverageLimit: number;
  deductible: number;
  premium: number;
  status: 'active' | 'expired' | 'cancelled';
  expiresAt: string;
}

export interface InsuranceClaim {
  id: string;
  policyId: string;
  userId: string;
  petId?: string;
  amount: number;
  description: string;
  status: ClaimStatus;
  attachmentUrls: string[];
  statusEvents: ClaimStatusEvent[];
  submittedAt: string;
  updatedAt: string;
}

export interface ClaimStatusEvent {
  status: ClaimStatus;
  label: string;
  timestamp: string;
}

export interface ClaimSummaryPdfResult {
  buffer: Buffer;
  filename: string;
}

// In-memory stores (replace with DB in production)
const policies = new Map<string, InsurancePolicy>();
const claims = new Map<string, InsuranceClaim>();

function statusLabel(status: ClaimStatus): string {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function createStatusEvent(status: ClaimStatus, timestamp = new Date().toISOString()): ClaimStatusEvent {
  return {
    status,
    label: statusLabel(status),
    timestamp,
  };
}

function sanitizeText(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .slice(0, 1000);
}

// ─── Mock provider OAuth token exchange ──────────────────────────────────────
export async function exchangeOAuthCode(
  provider: InsuranceProvider,
  code: string,
  userId: string,
): Promise<InsurancePolicy> {
  // In production: call provider OAuth endpoint with code
  // Mock: return a fake policy
  const policy: InsurancePolicy = {
    id: uuidv4(),
    userId,
    provider,
    policyNumber: `${provider.toUpperCase()}-${code.slice(0, 8).toUpperCase()}`,
    coverageLimit: 10000,
    deductible: 250,
    premium: 49.99,
    status: 'active',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  };
  policies.set(policy.id, policy);
  return policy;
}

export function getPolicies(userId: string): InsurancePolicy[] {
  return [...policies.values()].filter((p) => p.userId === userId);
}

export function getPolicy(policyId: string): InsurancePolicy | undefined {
  return policies.get(policyId);
}

export function submitClaim(
  policyId: string,
  userId: string,
  data: { petId?: string; amount: number; description: string; attachmentUrls?: string[] },
): InsuranceClaim {
  const now = new Date().toISOString();
  const claim: InsuranceClaim = {
    id: uuidv4(),
    policyId,
    userId,
    petId: data.petId,
    amount: data.amount,
    description: data.description,
    status: 'submitted',
    attachmentUrls: data.attachmentUrls ?? [],
    statusEvents: [createStatusEvent('submitted', now)],
    submittedAt: now,
    updatedAt: now,
  };
  claims.set(claim.id, claim);

  // Simulate async status progression (mock)
  setTimeout(() => {
    const c = claims.get(claim.id);
    if (c) {
      c.status = 'under_review';
      c.updatedAt = new Date().toISOString();
      c.statusEvents.push(createStatusEvent('under_review', c.updatedAt));
    }
  }, 5000);

  return claim;
}

export function getClaims(userId: string): InsuranceClaim[] {
  return [...claims.values()]
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export function getClaim(claimId: string): InsuranceClaim | undefined {
  return claims.get(claimId);
}

export function generateClaimSummaryPdf(claimId: string): Promise<ClaimSummaryPdfResult | null> {
  const claim = claims.get(claimId);
  if (!claim) return Promise.resolve(null);

  const policy = policies.get(claim.policyId);
  const filename = `insurance-claim-${sanitizeText(claim.id).slice(0, 8)}.pdf`;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), filename }));

    doc
      .fontSize(20)
      .fillColor('#1a202c')
      .text('Cocohub Insurance Claim Summary', { align: 'center' })
      .moveDown(0.5)
      .fontSize(10)
      .fillColor('#718096')
      .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
      .moveDown(1.5);

    doc.fontSize(13).fillColor('#2d3748').text('Claim Details').moveDown(0.4);
    doc.fontSize(10).fillColor('#1a202c');
    doc.text(`Claim ID: ${sanitizeText(claim.id)}`);
    doc.text(`Status: ${statusLabel(claim.status)}`);
    doc.text(`Amount: $${claim.amount.toFixed(2)}`);
    doc.text(`Description: ${sanitizeText(claim.description)}`);
    doc.text(`Submitted: ${new Date(claim.submittedAt).toLocaleString()}`);
    doc.text(`Updated: ${new Date(claim.updatedAt).toLocaleString()}`);

    doc.moveDown(1);
    doc.fontSize(13).fillColor('#2d3748').text('Policy').moveDown(0.4);
    doc.fontSize(10).fillColor('#1a202c');
    doc.text(`Provider: ${sanitizeText(policy?.provider ?? 'Unknown')}`);
    doc.text(`Policy Number: ${sanitizeText(policy?.policyNumber ?? 'Unknown')}`);
    doc.text(`Coverage Limit: $${(policy?.coverageLimit ?? 0).toLocaleString()}`);
    doc.text(`Deductible: $${(policy?.deductible ?? 0).toLocaleString()}`);

    doc.moveDown(1);
    doc.fontSize(13).fillColor('#2d3748').text('Status Timeline').moveDown(0.4);
    doc.fontSize(10).fillColor('#1a202c');
    claim.statusEvents.forEach((event) => {
      doc.text(`- ${event.label}: ${new Date(event.timestamp).toLocaleString()}`);
    });

    doc.moveDown(1);
    doc.fontSize(13).fillColor('#2d3748').text('Attachments').moveDown(0.4);
    doc.fontSize(10).fillColor('#1a202c');
    if (claim.attachmentUrls.length === 0) {
      doc.text('No attachments submitted.');
    } else {
      claim.attachmentUrls.forEach((url, index) => {
        doc.text(`${index + 1}. ${sanitizeText(url)}`);
      });
    }

    doc.moveDown(1.5);
    doc
      .fontSize(8)
      .fillColor('#718096')
      .text('This summary is generated from Cocohub claim data for submission review.');

    doc.end();
  });
}
