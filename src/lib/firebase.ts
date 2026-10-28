import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  onSnapshot,
  setDoc,
  writeBatch,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { RaffleConfig, TicketStatus, PaymentMethod, RaffleStatus } from '../types/raffle';

// Clean up any stale cached auth tokens in IndexedDB that could trigger securetoken refresh errors
try {
  if (typeof window !== 'undefined' && window.indexedDB) {
    window.indexedDB.deleteDatabase('firebaseLocalStorageDb');
  }
} catch {
  // ignore
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = initializeAuth(app, {
  persistence: inMemoryPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});
export const googleProvider = new GoogleAuthProvider();

export const ORGANIZER_EMAIL = 'edinguer@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection validation on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'raffle_config', 'main'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

let tokenExpiryTimer: ReturnType<typeof setTimeout> | null = null;

export async function signInOrganizer() {
  const cred = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
  if (tokenExpiryTimer) {
    clearTimeout(tokenExpiryTimer);
  }
  // Proactively sign out before the 60-minute token expires so Firebase never calls securetoken API
  tokenExpiryTimer = setTimeout(() => {
    signOut(auth).catch(() => {});
  }, 50 * 60 * 1000);
  return cred.user;
}

export async function signOutOrganizer() {
  if (tokenExpiryTimer) {
    clearTimeout(tokenExpiryTimer);
    tokenExpiryTimer = null;
  }
  return signOut(auth);
}

// Sanitize strings to match firebase-blueprint.json maxLength constraints
function clampStr(val: string | undefined, max: number, fallback = ''): string {
  const raw = (val ?? '').trim();
  const clean = raw.length > 0 ? raw : fallback;
  return clean.slice(0, max);
}

// Client-side image compression for uploading player photo or cover banner
export function compressImageFileToDataUrl(
  file: File,
  maxWidth = 720,
  maxHeight = 480,
  quality = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagen no válido'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export async function saveRaffleConfigToFirestore(config: RaffleConfig) {
  const path = 'raffle_config/main';
  try {
    const prize1 = config.prizes[0] || { label: '1er Lugar (Efectivo)', amount: 1000 };
    const prize2 = config.prizes[1] || { label: '', amount: 0 };

    const safeStart = Math.max(0, Math.min(999, Math.floor(Number(config.startNumber) || 0)));
    const safeEnd = Math.max(safeStart + 1, Math.min(999, Math.floor(Number(config.endNumber) || 50)));
    const computedCount = Math.max(1, Math.min(500, safeEnd - safeStart + 1));
    const validStatus: RaffleStatus = ['activa', 'pausada', 'cerrada', 'finalizada'].includes(
      config.raffleStatus
    )
      ? config.raffleStatus
      : 'activa';

    await setDoc(doc(db, 'raffle_config', 'main'), {
      title: clampStr(config.title, 120, 'Rifa Pro-Inscripción Liga Nacional'),
      description: clampStr(
        config.description,
        600,
        'Estamos recaudando fondos para cubrir la inscripción al Torneo de la Liga Nacional de Futbol. ¡Muchas gracias por apoyar el deporte juvenil!'
      ),
      organizerName: clampStr(config.organizerName, 100, 'Familia del Jugador'),
      playerName: clampStr(config.playerName, 80, 'Jugador'),
      teamName: clampStr(config.teamName, 100, 'Liga Nacional'),
      photoUrl: clampStr(config.photoUrl, 140000, ''),
      coverImageUrl: clampStr(config.coverImageUrl, 140000, 'preset:cancha-nocturna'),
      targetNetAmount: Math.max(0, Math.min(1000000, Number(config.targetNetAmount) || 1800)),
      startNumber: safeStart,
      endNumber: safeEnd,
      ticketCount: computedCount,
      startAtZero: safeStart === 0,
      ticketPrice: Math.max(1, Math.min(50000, Number(config.ticketPrice) || 60)),
      prize1Label: clampStr(prize1.label, 80, '1er Lugar (Efectivo)'),
      prize1Amount: Math.max(0, Math.min(1000000, Number(prize1.amount) || 1000)),
      prize2Label: clampStr(prize2.label, 80, ''),
      prize2Amount: Math.max(0, Math.min(1000000, Number(prize2.amount) || 0)),
      drawDate: clampStr(config.drawDate, 120, 'Por definir'),
      drawMethod: clampStr(config.drawMethod, 150, 'Sorteo en vivo / Lotería Nacional'),
      raffleStatus: validStatus,
      bankName: clampStr(config.bankName, 80, ''),
      accountHolder: clampStr(config.accountHolder, 100, ''),
      clabeOrCard: clampStr(config.clabeOrCard, 60, ''),
      organizerPhone: clampStr(config.organizerPhone, 25, ''),
      contactExtra: clampStr(config.contactExtra, 150, ''),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Public Buyer Self-Service Reservation (Atomic Batch Write to /tickets and /tickets_private)
export async function reserveTicketsAsBuyer(params: {
  numbers: string[];
  buyerName: string;
  buyerPhone: string;
  paymentMethod: PaymentMethod;
  notes: string;
}) {
  const { numbers, buyerName, buyerPhone, paymentMethod, notes } = params;
  const cleanFullName = clampStr(buyerName, 80, 'Comprador');
  const nameParts = cleanFullName.split(/\s+/);
  const publicDisplay =
    nameParts.length > 1
      ? `${nameParts[0]} ${nameParts[1].charAt(0)}.`
      : nameParts[0];
  const cleanPublicName = clampStr(publicDisplay, 60, 'Apartado');
  const cleanPhone = clampStr(buyerPhone, 25, '');
  const cleanNotes = clampStr(notes, 200, '');
  const validPayment: PaymentMethod =
    paymentMethod === 'efectivo' || paymentMethod === 'transferencia'
      ? paymentMethod
      : 'transferencia';

  const batch = writeBatch(db);

  for (const num of numbers) {
    const publicRef = doc(db, 'tickets', num);
    const privateRef = doc(db, 'tickets_private', num);

    batch.set(publicRef, {
      number: num,
      status: 'reserved',
      buyerPublicName: cleanPublicName,
      paymentMethod: validPayment,
      updatedAt: serverTimestamp(),
    });

    batch.set(privateRef, {
      number: num,
      buyerName: cleanFullName,
      buyerPhone: cleanPhone,
      notes: cleanNotes,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `tickets/${numbers.join(',')}`);
  }
}

// Organizer Admin Ticket Update
export async function updateTicketsAsOrganizer(params: {
  numbers: string[];
  status: TicketStatus;
  buyerName: string;
  buyerPhone: string;
  paymentMethod: PaymentMethod;
  notes: string;
}) {
  const { numbers, status, buyerName, buyerPhone, paymentMethod, notes } = params;
  const isAvailable = status === 'available';
  const cleanFullName = isAvailable ? '' : clampStr(buyerName, 80, 'Comprador');
  const nameParts = cleanFullName.split(/\s+/).filter(Boolean);
  const publicDisplay =
    nameParts.length > 1
      ? `${nameParts[0]} ${nameParts[1].charAt(0)}.`
      : nameParts[0] || '';
  const cleanPublicName = isAvailable ? '' : clampStr(publicDisplay, 60, '');
  const cleanPhone = isAvailable ? '' : clampStr(buyerPhone, 25, '');
  const cleanNotes = isAvailable ? '' : clampStr(notes, 200, '');
  const cleanMethod: PaymentMethod = isAvailable ? 'pendiente' : paymentMethod;

  const batch = writeBatch(db);

  for (const num of numbers) {
    const publicRef = doc(db, 'tickets', num);
    const privateRef = doc(db, 'tickets_private', num);

    batch.set(publicRef, {
      number: num,
      status,
      buyerPublicName: cleanPublicName,
      paymentMethod: cleanMethod,
      updatedAt: serverTimestamp(),
    });

    batch.set(privateRef, {
      number: num,
      buyerName: cleanFullName,
      buyerPhone: cleanPhone,
      notes: cleanNotes,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `tickets/${numbers.join(',')}`);
  }
}

export { collection, doc, onSnapshot, query, where };
