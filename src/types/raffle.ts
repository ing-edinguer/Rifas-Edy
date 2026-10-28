export type TicketStatus = 'available' | 'reserved' | 'paid';

export type PaymentMethod = 'transferencia' | 'efectivo' | 'pendiente';

export type RaffleStatus = 'activa' | 'pausada' | 'cerrada' | 'finalizada';

export interface Ticket {
  number: string; // e.g., "01".."50" or "00".."99"
  status: TicketStatus;
  buyerName: string;
  buyerPhone: string;
  paymentMethod: PaymentMethod;
  notes: string;
  updatedAt?: string;
}

export interface PrizeTier {
  id: string;
  label: string;
  amount: number;
}

export interface RaffleConfig {
  title: string; // Nombre de la rifa
  description: string; // Descripción y causa de recaudación
  organizerName: string; // Nombre de organizador
  playerName: string; // Nombre del jugador / hijo
  teamName: string; // Categoría / Liga
  photoUrl: string; // Fotografía opcional (URL o dataURL comprimido)
  coverImageUrl: string; // Imagen de portada (preset ID o URL/dataURL)
  targetNetAmount: number; // Meta libre ($1,800 MXN)
  startNumber: number; // Número inicial de los boletos (ej. 1 o 0)
  endNumber: number; // Número final de los boletos (ej. 50, 60, 99, 100)
  ticketCount: number; // Calculado automáticamente: endNumber - startNumber + 1
  startAtZero: boolean;
  ticketPrice: number; // Precio de cada boleto
  prizes: PrizeTier[]; // Importe del premio
  drawDate: string; // Fecha y hora del sorteo
  drawMethod: string; // Método para seleccionar el ganador
  raffleStatus: RaffleStatus; // Estado de la rifa
  bankName: string;
  accountHolder: string;
  clabeOrCard: string;
  organizerPhone: string; // Teléfono WhatsApp de contacto
  contactExtra: string; // Redes sociales, correo o punto de entrega
}

export interface StrategyPreset {
  id: string;
  name: string;
  subtitle: string;
  badgeText: string;
  startNumber: number;
  endNumber: number;
  ticketCount: number;
  startAtZero: boolean;
  ticketPrice: number;
  prizes: PrizeTier[];
  grossRevenue: number;
  totalPrizes: number;
  netProfit: number;
  drawMethod: string;
  whyItWorks: string;
  idealFor: string;
}

export const COVER_PRESETS = [
  {
    id: 'preset:cancha-nocturna',
    label: 'Estadio Nocturno y Reflectores',
    description: 'Cancha profesional iluminada con líneas tácticas doradas',
  },
  {
    id: 'preset:balon-dorado',
    label: 'Balón Oficial Edición Oro',
    description: 'Balón de campeonato sobre césped esmeralda profundo',
  },
  {
    id: 'preset:trofeo-liga',
    label: 'Copa Torneo Nacional',
    description: 'Trofeo dorado con laureles de la Liga Nacional',
  },
  {
    id: 'preset:cantera-juvenil',
    label: 'Pasión Futbol Juvenil',
    description: 'Diseño dinámico de cantera y espíritu deportivo',
  },
];

export const RECOMMENDED_STRATEGIES: StrategyPreset[] = [
  {
    id: 'rapida-50',
    name: 'Opción 1: Rifa Exprés de 50 Boletos (01 al 50)',
    subtitle: 'Menos boletos por vender y llegas rápido a los $1,800 MXN libres',
    badgeText: 'Recomendada · Más rápida de llenar',
    startNumber: 1,
    endNumber: 50,
    ticketCount: 50,
    startAtZero: false,
    ticketPrice: 60,
    prizes: [
      { id: '1', label: '1er Lugar (Efectivo)', amount: 1000 },
      { id: '2', label: '2do Lugar (Reintegro)', amount: 200 },
    ],
    grossRevenue: 3000,
    totalPrizes: 1200,
    netProfit: 1800,
    drawMethod: 'Tómbola digital en vivo por WhatsApp / Lotería Nacional',
    whyItWorks:
      'Vender 50 números es el doble de rápido que vender 100. Si 25 familiares o amigos te compran 2 boletos ($120 MXN por persona), terminas la rifa en un fin de semana.',
    idealFor: 'Familia, compañeros de trabajo y papás del equipo.',
  },
  {
    id: 'billete-cerrado-60',
    name: 'Opción 2: Billete Cerrado de $50 MXN (01 al 60)',
    subtitle: 'El precio más práctico para cobrar en efectivo sin dar cambio',
    badgeText: 'Fácil cobro en efectivo',
    startNumber: 1,
    endNumber: 60,
    ticketCount: 60,
    startAtZero: false,
    ticketPrice: 50,
    prizes: [{ id: '1', label: 'Premio Único en Efectivo', amount: 1200 }],
    grossRevenue: 3000,
    totalPrizes: 1200,
    netProfit: 1800,
    drawMethod: 'Tómbola digital en vivo con video para los participantes',
    whyItWorks:
      '$50 pesos es un billete exacto: nadie batalla con monedas ni cambio, y ofrecer $1,200 MXN de premio (24 veces el valor del boleto) motiva muchísimo.',
    idealFor: 'Venta en entrenamientos, vecinos, escuela y reuniones familiares.',
  },
  {
    id: 'loteria-100',
    name: 'Opción 3: Clásica Lotería Nacional (00 al 99)',
    subtitle: 'Boletos súper accesibles de $30 MXN con promoción de 2 × $60',
    badgeText: '100 Números · Lotería Nacional',
    startNumber: 0,
    endNumber: 99,
    ticketCount: 100,
    startAtZero: true,
    ticketPrice: 30,
    prizes: [
      { id: '1', label: '1er Lugar (Últimas 2 cifras)', amount: 1000 },
      { id: '2', label: '2do Lugar (Segundo premio)', amount: 200 },
    ],
    grossRevenue: 3000,
    totalPrizes: 1200,
    netProfit: 1800,
    drawMethod: 'Últimas 2 cifras del Premio Mayor de la Lotería Nacional',
    whyItWorks:
      'A $30 pesos nadie dice que no y casi todos eligen 2 o 3 números ("dame 2 por $60"). Usar la Lotería Nacional brinda total confianza.',
    idealFor: 'Grupos grandes de WhatsApp, redes sociales y venta por paquetes.',
  },
];

export function formatTicketNumber(num: number, endNumber: number): string {
  const padLen = endNumber >= 100 ? (endNumber >= 100 && num < 100 ? 2 : String(endNumber).length) : 2;
  return num.toString().padStart(Math.max(2, padLen), '0');
}

export function generateTicketsFromRange(startNumber: number, endNumber: number): Ticket[] {
  const safeStart = Math.max(0, Math.min(999, Math.floor(startNumber)));
  const safeEnd = Math.max(safeStart, Math.min(safeStart + 299, Math.floor(endNumber)));
  const padWidth = safeEnd >= 100 ? 3 : 2;

  const list: Ticket[] = [];
  for (let n = safeStart; n <= safeEnd; n++) {
    const formatted =
      safeEnd === 100 && safeStart === 1
        ? n.toString().padStart(2, '0')
        : n.toString().padStart(padWidth, '0');
    list.push({
      number: formatted,
      status: 'available',
      buyerName: '',
      buyerPhone: '',
      paymentMethod: 'pendiente',
      notes: '',
    });
  }
  return list;
}
