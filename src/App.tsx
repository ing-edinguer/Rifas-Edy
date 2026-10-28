import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  Download,
  Check,
  Copy,
  Search,
  Clock,
  Sliders,
  CheckCircle2,
  Link as LinkIcon,
  LogIn,
  ShieldCheck,
  Upload,
  Image as ImageIcon,
  Ticket as TicketIcon,
  Share2,
  LayoutGrid,
  Trash2,
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  RaffleConfig,
  RaffleStatus,
  Ticket,
  TicketStatus,
  PaymentMethod,
  RECOMMENDED_STRATEGIES,
  COVER_PRESETS,
  StrategyPreset,
  generateTicketsFromRange,
} from './types/raffle';
import { downloadRafflePosterPNG } from './utils/canvasPoster';
import { BuyerPublicPortal } from './components/BuyerPublicPortal';
import {
  SoccerBallSVG,
  GoldenTrophySVG,
  PlayerPhotoOrCrest,
  RaffleCoverBanner,
} from './components/SoccerArtwork';
import {
  db,
  auth,
  ORGANIZER_EMAIL,
  signInOrganizer,
  signOutOrganizer,
  saveRaffleConfigToFirestore,
  updateTicketsAsOrganizer,
  compressImageFileToDataUrl,
  collection,
  doc,
  onSnapshot,
  query,
  where,
  handleFirestoreError,
  OperationType,
} from './lib/firebase';

const STORAGE_KEY_CONFIG = 'rifagol_config_v2';

const DEFAULT_CONFIG: RaffleConfig = {
  title: 'Rifa Pro-Inscripción Torneo Liga Nacional',
  description:
    'Estamos recaudando $1,800 MXN para cubrir la inscripción de nuestro hijo al Torneo de la Liga Nacional de Futbol. ¡Elige tu número de la suerte, apóyanos en este sueño deportivo y participa para ganar dinero en efectivo!',
  organizerName: 'Familia Hernández',
  playerName: 'Mateo Hernández',
  teamName: 'Categoría Sub-13 · Liga Nacional',
  photoUrl: '',
  coverImageUrl: 'preset:cancha-nocturna',
  targetNetAmount: 1800,
  startNumber: 1,
  endNumber: 50,
  ticketCount: 50,
  startAtZero: false,
  ticketPrice: 60,
  prizes: [
    { id: '1', label: '1er Lugar (Efectivo)', amount: 1000 },
    { id: '2', label: '2do Lugar (Efectivo)', amount: 200 },
  ],
  drawDate: 'Domingo 15 de Noviembre · 8:00 PM',
  drawMethod: 'Últimas 2 cifras de la Lotería Nacional / Sorteo en Vivo',
  raffleStatus: 'activa',
  bankName: 'BBVA / Nu / Spin',
  accountHolder: 'Organizador de la Rifa',
  clabeOrCard: '0123 4567 8901 2345',
  organizerPhone: '5512345678',
  contactExtra: 'WhatsApp y Entrenamientos del Equipo',
};

export default function App() {
  const isBuyerUrlParam = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('vista') === 'comprador';
  }, []);

  const [activeSection, setActiveSection] = useState<
    'comprador' | 'tablero' | 'estrategia' | 'whatsapp' | 'sorteo'
  >('comprador');

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const isOrganizerAdmin = useMemo(() => {
    return Boolean(
      currentUser &&
        currentUser.email &&
        currentUser.email.toLowerCase() === ORGANIZER_EMAIL.toLowerCase()
    );
  }, [currentUser]);

  const [config, setConfig] = useState<RaffleConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_CONFIG;
  });

  // Public ticket statuses from Firestore (/tickets)
  const [publicTicketMap, setPublicTicketMap] = useState<
    Record<
      string,
      {
        status: TicketStatus;
        buyerPublicName: string;
        paymentMethod: PaymentMethod;
      }
    >
  >({});

  // Private ticket PII from Firestore (/tickets_private/{ticketId}, only when admin is logged in)
  const [privateTicketMap, setPrivateTicketMap] = useState<
    Record<
      string,
      {
        buyerName: string;
        buyerPhone: string;
        notes: string;
      }
    >
  >({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // 1. Real-time listener for public /raffle_config/main
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'raffle_config', 'main'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const prizes = [
            {
              id: '1',
              label: data.prize1Label || '1er Lugar (Efectivo)',
              amount: Number(data.prize1Amount) || 1000,
            },
          ];
          if (Number(data.prize2Amount) > 0) {
            prizes.push({
              id: '2',
              label: data.prize2Label || '2do Lugar (Efectivo)',
              amount: Number(data.prize2Amount),
            });
          }
          const startNum =
            data.startNumber !== undefined
              ? Number(data.startNumber)
              : data.startAtZero
              ? 0
              : 1;
          const endNum =
            data.endNumber !== undefined
              ? Number(data.endNumber)
              : data.startAtZero
              ? Number(data.ticketCount || 100) - 1
              : Number(data.ticketCount || 50);

          const loadedConfig: RaffleConfig = {
            title: data.title || DEFAULT_CONFIG.title,
            description: data.description ?? DEFAULT_CONFIG.description,
            organizerName: data.organizerName ?? DEFAULT_CONFIG.organizerName,
            playerName: data.playerName || DEFAULT_CONFIG.playerName,
            teamName: data.teamName || DEFAULT_CONFIG.teamName,
            photoUrl: data.photoUrl ?? '',
            coverImageUrl: data.coverImageUrl || 'preset:cancha-nocturna',
            targetNetAmount: Number(data.targetNetAmount) || 1800,
            startNumber: startNum,
            endNumber: endNum,
            ticketCount: Math.max(1, endNum - startNum + 1),
            startAtZero: startNum === 0,
            ticketPrice: Number(data.ticketPrice) || 60,
            prizes,
            drawDate: data.drawDate || DEFAULT_CONFIG.drawDate,
            drawMethod: data.drawMethod || DEFAULT_CONFIG.drawMethod,
            raffleStatus: (data.raffleStatus as RaffleStatus) || 'activa',
            bankName: data.bankName ?? DEFAULT_CONFIG.bankName,
            accountHolder: data.accountHolder ?? DEFAULT_CONFIG.accountHolder,
            clabeOrCard: data.clabeOrCard ?? DEFAULT_CONFIG.clabeOrCard,
            organizerPhone: data.organizerPhone ?? DEFAULT_CONFIG.organizerPhone,
            contactExtra: data.contactExtra ?? DEFAULT_CONFIG.contactExtra,
          };
          setConfig(loadedConfig);
          try {
            localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(loadedConfig));
          } catch {
            // ignore
          }
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'raffle_config/main');
      }
    );
    return () => unsub();
  }, []);

  // 2. Real-time listener for public /tickets
  useEffect(() => {
    const q = query(
      collection(db, 'tickets'),
      where('status', 'in', ['available', 'reserved', 'paid'])
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const nextMap: Record<
          string,
          {
            status: TicketStatus;
            buyerPublicName: string;
            paymentMethod: PaymentMethod;
          }
        > = {};
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          nextMap[docSnap.id] = {
            status: d.status as TicketStatus,
            buyerPublicName: d.buyerPublicName || '',
            paymentMethod: (d.paymentMethod as PaymentMethod) || 'pendiente',
          };
        });
        setPublicTicketMap(nextMap);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'tickets');
      }
    );
    return () => unsub();
  }, []);

  // 3. Real-time listeners for private /tickets_private/{ticketId} (when Organizer Admin is signed in)
  useEffect(() => {
    if (!authReady || !isOrganizerAdmin) {
      setPrivateTicketMap({});
      return;
    }

    const occupiedNumbers = Object.keys(publicTicketMap).filter(
      (num) => publicTicketMap[num]?.status !== 'available'
    );

    if (occupiedNumbers.length === 0) {
      setPrivateTicketMap({});
      return;
    }

    const unsubs = occupiedNumbers.map((num) =>
      onSnapshot(
        doc(db, 'tickets_private', num),
        (docSnap) => {
          if (docSnap.exists()) {
            const d = docSnap.data();
            setPrivateTicketMap((prev) => ({
              ...prev,
              [num]: {
                buyerName: d.buyerName || '',
                buyerPhone: d.buyerPhone || '',
                notes: d.notes || '',
              },
            }));
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, `tickets_private/${num}`);
        }
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, isOrganizerAdmin, publicTicketMap]);

  // Combine generated ticket range (startNumber .. endNumber) with live Firestore data
  const tickets: Ticket[] = useMemo(() => {
    const base = generateTicketsFromRange(config.startNumber, config.endNumber);
    return base.map((item) => {
      const pub = publicTicketMap[item.number];
      const priv = privateTicketMap[item.number];
      if (!pub || pub.status === 'available') {
        return item;
      }
      return {
        number: item.number,
        status: pub.status,
        buyerName: priv?.buyerName || pub.buyerPublicName || 'Apartado',
        buyerPhone: priv?.buyerPhone || '',
        paymentMethod: pub.paymentMethod,
        notes: priv?.notes || '',
      };
    });
  }, [config.startNumber, config.endNumber, publicTicketMap, privateTicketMap]);

  // Organizer Board Selection & Filtering State
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>(['01']);
  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Editor form state for selected ticket(s)
  const [formStatus, setFormStatus] = useState<TicketStatus>('paid');
  const [formBuyerName, setFormBuyerName] = useState('');
  const [formBuyerPhone, setFormBuyerPhone] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod>('transferencia');
  const [formNotes, setFormNotes] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Draw / Lottery state
  const [lotteryWinningInput, setLotteryWinningInput] = useState('');
  const [onlyPaidInDraw, setOnlyPaidInDraw] = useState(true);
  const [drawnTicket, setDrawnTicket] = useState<Ticket | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (selectedNumbers.length === 1) {
      const found = tickets.find((t) => t.number === selectedNumbers[0]);
      if (found) {
        setFormStatus(found.status === 'available' ? 'paid' : found.status);
        setFormBuyerName(found.buyerName);
        setFormBuyerPhone(found.buyerPhone);
        setFormPaymentMethod(
          found.paymentMethod === 'pendiente' ? 'transferencia' : found.paymentMethod
        );
        setFormNotes(found.notes);
      }
    }
  }, [selectedNumbers, tickets]);

  const showToast = (msg: string) => {
    setFeedbackBanner(msg);
    setTimeout(() => {
      setFeedbackBanner((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const buyerShareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin.replace('https://ais-dev-', 'https://ais-pre-');
    return `${origin}/?vista=comprador`;
  }, []);

  // Financial Metrics Calculations
  const metrics = useMemo(() => {
    const totalPrizes = config.prizes.reduce((sum, p) => sum + p.amount, 0);
    const totalTickets = tickets.length;
    const grossPotential = totalTickets * config.ticketPrice;
    const netPotential = grossPotential - totalPrizes;

    const paidCount = tickets.filter((t) => t.status === 'paid').length;
    const reservedCount = tickets.filter((t) => t.status === 'reserved').length;
    const availableCount = tickets.filter((t) => t.status === 'available').length;

    const collectedCash = paidCount * config.ticketPrice;
    const pendingCash = reservedCount * config.ticketPrice;
    const totalCommittedCash = collectedCash + pendingCash;

    const netAfterPrize = Math.max(0, collectedCash - totalPrizes);
    const netIncludingReserved = Math.max(0, totalCommittedCash - totalPrizes);

    const ticketsForPrize = Math.ceil(totalPrizes / Math.max(1, config.ticketPrice));
    const ticketsForGoal = Math.ceil(
      (totalPrizes + config.targetNetAmount) / Math.max(1, config.ticketPrice)
    );
    const progressPercent = Math.min(
      100,
      Math.round((netIncludingReserved / Math.max(1, config.targetNetAmount)) * 100)
    );

    return {
      totalTickets,
      totalPrizes,
      grossPotential,
      netPotential,
      paidCount,
      reservedCount,
      availableCount,
      collectedCash,
      pendingCash,
      totalCommittedCash,
      netAfterPrize,
      netIncludingReserved,
      ticketsForPrize,
      ticketsForGoal,
      progressPercent,
    };
  }, [config, tickets]);

  // Save Config to Firestore
  const handlePublishConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isOrganizerAdmin) {
      try {
        await signInOrganizer();
      } catch {
        showToast('Inicia sesión con tu cuenta de Google para publicar los cambios.');
        return;
      }
    }
    setIsSavingConfig(true);
    try {
      const safeStart = Math.max(0, Math.min(999, Math.floor(Number(config.startNumber) || 0)));
      const safeEnd = Math.max(
        safeStart + 1,
        Math.min(safeStart + 299, Math.floor(Number(config.endNumber) || 50))
      );
      const updated: RaffleConfig = {
        ...config,
        startNumber: safeStart,
        endNumber: safeEnd,
        ticketCount: safeEnd - safeStart + 1,
        startAtZero: safeStart === 0,
      };
      setConfig(updated);
      await saveRaffleConfigToFirestore(updated);
      showToast('¡Configuración guardada y publicada en vivo!');
    } catch {
      showToast('Error al guardar configuración. Verifica tu sesión de organizador.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Handle Photo Upload (Player or Cover)
  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'photoUrl' | 'coverImageUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const maxW = field === 'coverImageUrl' ? 960 : 400;
      const maxH = field === 'coverImageUrl' ? 540 : 400;
      const dataUrl = await compressImageFileToDataUrl(file, maxW, maxH, 0.72);
      setConfig((prev) => ({ ...prev, [field]: dataUrl }));
      showToast(
        field === 'photoUrl'
          ? 'Fotografía cargada lista para publicar'
          : 'Imagen de portada cargada lista para publicar'
      );
    } catch {
      showToast('No se pudo procesar la imagen seleccionada');
    }
  };

  // Apply Strategy Preset
  const handleApplyStrategy = async (preset: StrategyPreset) => {
    const updatedConfig: RaffleConfig = {
      ...config,
      startNumber: preset.startNumber,
      endNumber: preset.endNumber,
      ticketCount: preset.ticketCount,
      startAtZero: preset.startAtZero,
      ticketPrice: preset.ticketPrice,
      prizes: preset.prizes.map((p) => ({ ...p })),
      drawMethod: preset.drawMethod,
    };
    setConfig(updatedConfig);
    setSelectedNumbers([preset.startAtZero ? '00' : '01']);

    if (isOrganizerAdmin) {
      await saveRaffleConfigToFirestore(updatedConfig);
      showToast(
        `Fórmula publicada: Boletos del ${preset.startNumber} al ${preset.endNumber} ($${preset.ticketPrice} MXN)`
      );
    } else {
      showToast(
        `Fórmula aplicada (${preset.ticketCount} boletos de $${preset.ticketPrice}). Presiona "Guardar y Publicar" abajo.`
      );
    }
  };

  const handleTicketClick = (num: string, isMultiSelect: boolean) => {
    if (isMultiSelect) {
      setSelectedNumbers((prev) =>
        prev.includes(num) ? (prev.length > 1 ? prev.filter((n) => n !== num) : prev) : [...prev, num]
      );
    } else {
      setSelectedNumbers([num]);
    }
  };

  const handleSaveTicketAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedNumbers.length === 0) return;

    if (!isOrganizerAdmin) {
      try {
        await signInOrganizer();
      } catch {
        showToast('Inicia sesión como organizador para editar boletos.');
        return;
      }
    }

    const cleanName = formBuyerName.trim() || 'Comprador registrado';
    try {
      await updateTicketsAsOrganizer({
        numbers: selectedNumbers,
        status: formStatus,
        buyerName: cleanName,
        buyerPhone: formBuyerPhone.trim(),
        paymentMethod: formStatus === 'paid' ? formPaymentMethod : 'pendiente',
        notes: formNotes.trim(),
      });
      showToast(
        formStatus === 'available'
          ? `Boleto(s) ${selectedNumbers.join(', ')} liberado(s)`
          : `Guardado en vivo: Boleto(s) ${selectedNumbers.join(', ')} para ${cleanName}`
      );
    } catch {
      showToast('No se pudo actualizar el boleto. Verifica tu sesión de organizador.');
    }
  };

  const handleReleaseTickets = async () => {
    if (!isOrganizerAdmin) {
      try {
        await signInOrganizer();
      } catch {
        return;
      }
    }
    try {
      await updateTicketsAsOrganizer({
        numbers: selectedNumbers,
        status: 'available',
        buyerName: '',
        buyerPhone: '',
        paymentMethod: 'pendiente',
        notes: '',
      });
      setFormBuyerName('');
      setFormBuyerPhone('');
      setFormNotes('');
      showToast(`Boleto(s) ${selectedNumbers.join(', ')} liberado(s)`);
    } catch {
      showToast('Inicia sesión como organizador para liberar boletos.');
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        t.number.toLowerCase().includes(q) ||
        t.buyerName.toLowerCase().includes(q) ||
        t.buyerPhone.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [tickets, statusFilter, searchQuery]);

  const soldOrReservedTickets = useMemo(
    () => tickets.filter((t) => t.status !== 'available'),
    [tickets]
  );

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Copiado al portapapeles');
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2500);
  };

  // WhatsApp Message Templates
  const whatsappTemplates = useMemo(() => {
    const freeNums = tickets.filter((t) => t.status === 'available').map((t) => t.number);
    const freePreview =
      freeNums.length > 35
        ? `${freeNums.slice(0, 35).join(', ')}... (${freeNums.length} disponibles)`
        : freeNums.join(', ');

    const prizeBreakdown = config.prizes
      .map((p) => `• ${p.label}: *$${p.amount.toLocaleString('es-MX')} MXN*`)
      .join('\n');

    const generalInvite = `⚽ *¡Hola! Te invito a apoyar a ${config.playerName} en ${config.title}* 🏆

${config.description}

👉 *ELIGE TU BOLETO Y APÁRTALO DIRECTAMENTE DESDE TU CELULAR AQUÍ:*
${buyerShareUrl}

💰 *Premios en Efectivo:*
${prizeBreakdown}

🎟️ *Precio del boleto:* $${config.ticketPrice} MXN (Del ${tickets[0]?.number || '01'} al ${
      tickets[tickets.length - 1]?.number || '50'
    })
📅 *Fecha y hora del sorteo:* ${config.drawDate}
🎯 *Método del sorteo:* ${config.drawMethod}
👤 *Organiza:* ${config.organizerName || config.accountHolder}

🔢 *Números libres en este momento:*
${freePreview || '¡Todos vendidos!'}

💳 *Datos para transferencia:*
Banco: ${config.bankName}
Cuenta / Tarjeta: ${config.clabeOrCard}
Titular: ${config.accountHolder}

¡Toca el enlace para elegir tu número de la suerte! 🙏⚽`;

    const packagePromo = `🔥 *¡Doble Oportunidad de Ganar Efectivo apoyando a ${config.playerName}!* ⚽

Si eliges *2 boletos hoy ($${config.ticketPrice * 2} MXN)* tienes doble oportunidad de llevarte los *$${metrics.totalPrizes.toLocaleString('es-MX')} MXN en premios*.

👉 *Toca aquí para elegir tus 2 números libres en el tablero:*
${buyerShareUrl}

¡Muchas gracias por sumarte! 🙌`;

    return { generalInvite, packagePromo };
  }, [config, tickets, metrics.totalPrizes, buyerShareUrl]);

  const handleRunDigitalDraw = () => {
    const pool = onlyPaidInDraw ? tickets.filter((t) => t.status === 'paid') : tickets;

    if (pool.length === 0) {
      showToast('No hay boletos pagados para sortear. Desmarca la casilla o confirma pagos primero.');
      return;
    }

    setIsDrawing(true);
    let ticks = 0;
    const interval = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * pool.length);
      setDrawnTicket(pool[randomIdx]);
      ticks++;
      if (ticks >= 14) {
        clearInterval(interval);
        const finalWinner = pool[Math.floor(Math.random() * pool.length)];
        setDrawnTicket(finalWinner);
        setIsDrawing(false);
      }
    }, 80);
  };

  const matchedLotteryTicket = useMemo(() => {
    const clean = lotteryWinningInput.trim();
    if (!clean) return null;
    const lastTwo = clean.slice(-2).padStart(2, '0');
    return (
      tickets.find((t) => t.number === lastTwo || Number(t.number) === Number(lastTwo)) || null
    );
  }, [lotteryWinningInput, tickets]);

  return (
    <div className="min-h-screen bg-[#031B12] text-white flex flex-col selection:bg-amber-400 selection:text-slate-950">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-[#02140E]/95 backdrop-blur-md border-b border-emerald-800/70 px-4 sm:px-6 py-3.5">
        <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#comprador"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('comprador');
            }}
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            RifaGol Liga Nacional
          </a>

          {/* Zone 2: 5 concise single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-emerald-200">
            <a
              href="#comprador"
              onClick={(e) => {
                e.preventDefault();
                setActiveSection('comprador');
              }}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                activeSection === 'comprador'
                  ? 'border-amber-400 text-amber-300 font-bold'
                  : 'border-transparent'
              }`}
            >
              Elegir Boletos
            </a>
            <a
              href="#tablero"
              onClick={(e) => {
                e.preventDefault();
                setActiveSection('tablero');
              }}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                activeSection === 'tablero'
                  ? 'border-amber-400 text-amber-300 font-bold'
                  : 'border-transparent'
              }`}
            >
              Control de Ventas
            </a>
            <a
              href="#estrategia"
              onClick={(e) => {
                e.preventDefault();
                setActiveSection('estrategia');
              }}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                activeSection === 'estrategia'
                  ? 'border-amber-400 text-amber-300 font-bold'
                  : 'border-transparent'
              }`}
            >
              Configurar Rifa
            </a>
            <a
              href="#whatsapp"
              onClick={(e) => {
                e.preventDefault();
                setActiveSection('whatsapp');
              }}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                activeSection === 'whatsapp'
                  ? 'border-amber-400 text-amber-300 font-bold'
                  : 'border-transparent'
              }`}
            >
              Compartir
            </a>
            <a
              href="#sorteo"
              onClick={(e) => {
                e.preventDefault();
                setActiveSection('sorteo');
              }}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                activeSection === 'sorteo'
                  ? 'border-amber-400 text-amber-300 font-bold'
                  : 'border-transparent'
              }`}
            >
              Sorteo
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => copyToClipboard(buyerShareUrl, 'header-share-link')}
              className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 rounded-xl hover:bg-amber-300 transition-all active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
            >
              {copiedId === 'header-share-link' ? (
                <>
                  <Check className="w-4 h-4" />
                  ¡Enlace Copiado!
                </>
              ) : (
                <>
                  <LinkIcon className="w-4 h-4" />
                  Copiar Link de Rifa
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Toast Feedback Banner */}
      {feedbackBanner && (
        <div className="fixed top-20 right-4 z-50 bg-amber-400 text-slate-950 px-4 py-3 rounded-xl shadow-xl border border-amber-300 flex items-center gap-2.5 text-xs sm:text-sm font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-950 shrink-0" />
          <span>{feedbackBanner}</span>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 pb-24 md:pb-12">
        {/* =========================================================
            SECTION 0: VISTA PÚBLICA DE COMPRADORES (BOLETOS)
           ========================================================= */}
        {activeSection === 'comprador' && (
          <div className="space-y-6">
            {(!isBuyerUrlParam || isOrganizerAdmin) && (
              <div className="bg-[#05291C] border border-emerald-700/70 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-amber-400">
                    Modo Vista de Comprador · Lista para Celulares
                  </div>
                  <p className="text-xs text-emerald-100/90">
                    Aquí tus compradores eligen directamente sus boletos e ingresan su nombre y WhatsApp.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => setActiveSection('estrategia')}
                    className="min-h-[42px] px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Personalizar Datos de la Rifa
                  </button>
                  <button
                    onClick={() => setActiveSection('tablero')}
                    className="min-h-[42px] px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Ver Boletos Vendidos ({metrics.paidCount + metrics.reservedCount})
                  </button>
                </div>
              </div>
            )}

            <BuyerPublicPortal
              config={config}
              tickets={tickets}
              onReservationSuccess={(nums, buyer) => {
                showToast(`¡Listo! Boleto(s) #${nums.join(', #')} apartado(s) para ${buyer}`);
              }}
            />
          </div>
        )}

        {/* Organizer Header Telemetry Strip (for Admin tabs) */}
        {activeSection !== 'comprador' && (
          <section className="bg-[#05291C] border border-emerald-700/80 rounded-3xl p-6 shadow-lg">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-emerald-800/80">
              <div className="flex items-center gap-4">
                <PlayerPhotoOrCrest
                  photoUrl={config.photoUrl}
                  playerName={config.playerName}
                  sizeClass="w-16 h-16"
                />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-300 font-medium">
                    <span>Panel del Administrador</span>
                    <span aria-hidden="true">·</span>
                    <span>Organiza: {config.organizerName || 'Familia'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-300 font-semibold capitalize">
                      Estado: {config.raffleStatus}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {config.title} ({config.playerName})
                  </h1>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center shrink-0">
                {isOrganizerAdmin ? (
                  <div className="flex items-center gap-2 px-3.5 py-2 bg-[#031B12] border border-emerald-700 rounded-xl text-xs text-emerald-200">
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Admin: {currentUser?.email}</span>
                    <button
                      onClick={() => signOutOrganizer()}
                      className="ml-2 text-amber-300 hover:text-amber-200 underline cursor-pointer"
                    >
                      Salir
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => signInOrganizer()}
                    className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <LogIn className="w-4 h-4" />
                    Iniciar Sesión de Administrador
                  </button>
                )}
              </div>
            </div>

            {/* 4-Column Financial Telemetry Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
              <div>
                <div className="text-xs text-emerald-300 font-medium">Numeración y Precio</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tabular-nums text-white">
                    {tickets[0]?.number} al {tickets[tickets.length - 1]?.number} · ${config.ticketPrice}
                  </span>
                </div>
                <div className="mt-1 text-xs text-emerald-200/80 font-mono tabular-nums">
                  {metrics.totalTickets} boletos · Total: ${metrics.grossPotential.toLocaleString('es-MX')} MXN
                </div>
              </div>

              <div>
                <div className="text-xs text-emerald-300 font-medium">Importe de Premios</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tabular-nums text-amber-400">
                    ${metrics.totalPrizes.toLocaleString('es-MX')} MXN
                  </span>
                </div>
                <div className="mt-1 text-xs text-emerald-200/80">
                  Se cubre con los primeros{' '}
                  <span className="font-mono font-bold text-white">
                    {metrics.ticketsForPrize} boletos
                  </span>
                </div>
              </div>

              <div>
                <div className="text-xs text-emerald-300 font-medium">Avance de Boletos</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tabular-nums text-white">
                    {metrics.paidCount + metrics.reservedCount} / {metrics.totalTickets}
                  </span>
                  <span className="text-xs text-emerald-300 font-mono tabular-nums">
                    ({metrics.availableCount} libres)
                  </span>
                </div>
                <div className="mt-1 text-xs text-emerald-200/80 font-mono tabular-nums">
                  Pagado: ${metrics.collectedCash.toLocaleString('es-MX')} · Apartado: $
                  {metrics.pendingCash.toLocaleString('es-MX')}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-emerald-300">
                    Ganancia Libre (Meta ${config.targetNetAmount.toLocaleString('es-MX')})
                  </span>
                  <span className="font-mono tabular-nums text-amber-300 font-bold">
                    Max: ${metrics.netPotential.toLocaleString('es-MX')}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
                    ${metrics.netIncludingReserved.toLocaleString('es-MX')} MXN
                  </span>
                  <span className="text-xs font-mono tabular-nums text-emerald-200">
                    {metrics.progressPercent}%
                  </span>
                </div>
                <div className="mt-2 w-full bg-[#031B12] h-2.5 rounded-full overflow-hidden border border-emerald-800">
                  <div
                    className="bg-amber-400 h-full transition-all duration-200"
                    style={{ width: `${metrics.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* =========================================================
            SECTION 1: CONFIGURACIÓN COMPLETA DEL ADMINISTRADOR
           ========================================================= */}
        {activeSection === 'estrategia' && (
          <div className="space-y-8">
            {/* Full Administrator Configuration Form with all 12 requested fields */}
            <form
              onSubmit={handlePublishConfig}
              className="bg-[#05291C] border border-emerald-700/80 rounded-3xl p-6 sm:p-8 space-y-8 shadow-xl"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-800 pb-5">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Configuración General de la Rifa
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-white mt-0.5">
                    Personaliza todos los Datos, Imágenes, Boletos y Premios
                  </h2>
                  <p className="text-xs sm:text-sm text-emerald-200/80 mt-0.5">
                    Define aquí todos los parámetros de tu rifa. Al presionar el botón dorado se actualizará en tiempo real para todos los compradores.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="min-h-[48px] px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-bold rounded-xl transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap shrink-0 shadow-md"
                >
                  {isSavingConfig ? 'Publicando Cambios...' : 'Guardar y Publicar en Vivo'}
                </button>
              </div>

              {/* Group 1: Identidad, Causa, Organizador y Estado */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
                  1. Información General, Causa y Estado de la Rifa
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      Nombre de la Rifa *
                    </label>
                    <input
                      type="text"
                      required
                      value={config.title}
                      onChange={(e) => setConfig({ ...config, title: e.target.value })}
                      placeholder="Ej. Gran Rifa Pro-Inscripción Torneo Liga Nacional"
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm bg-[#031B12] text-white border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      Estado de la Rifa *
                    </label>
                    <select
                      value={config.raffleStatus}
                      onChange={(e) =>
                        setConfig({ ...config, raffleStatus: e.target.value as RaffleStatus })
                      }
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm bg-[#031B12] text-amber-300 font-bold border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    >
                      <option value="activa">🟢 Activa (Recibiendo apartados)</option>
                      <option value="pausada">🟡 Pausada temporalmente</option>
                      <option value="cerrada">🔒 Venta Cerrada</option>
                      <option value="finalizada">🏆 Sorteo Finalizado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      Nombre del Organizador *
                    </label>
                    <input
                      type="text"
                      value={config.organizerName}
                      onChange={(e) => setConfig({ ...config, organizerName: e.target.value })}
                      placeholder="Ej. Familia Hernández / Papás de Mateo"
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm bg-[#031B12] text-white border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      Nombre del Jugador (Hijo) *
                    </label>
                    <input
                      type="text"
                      value={config.playerName}
                      onChange={(e) => setConfig({ ...config, playerName: e.target.value })}
                      placeholder="Ej. Mateo Hernández"
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm bg-[#031B12] text-white border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      Equipo / Categoría / Liga
                    </label>
                    <input
                      type="text"
                      value={config.teamName}
                      onChange={(e) => setConfig({ ...config, teamName: e.target.value })}
                      placeholder="Ej. Categoría Sub-13 · Liga Nacional"
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm bg-[#031B12] text-white border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      Descripción y Causa de Recaudación *
                    </label>
                    <textarea
                      rows={3}
                      value={config.description}
                      onChange={(e) => setConfig({ ...config, description: e.target.value })}
                      placeholder="Explica brevemente el motivo de la rifa (ej. pagar la inscripción de $1,800 MXN al Torneo de la Liga Nacional de Futbol)..."
                      className="w-full px-4 py-2.5 text-sm bg-[#031B12] text-white border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* Group 2: Fotografía Opcional e Imagen de Portada */}
              <div className="space-y-4 pt-6 border-t border-emerald-800/80">
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
                  2. Fotografía Opcional e Imagen Deportiva de Portada
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Optional Player / Organizer Photo */}
                  <div className="bg-[#031B12] border border-emerald-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-4">
                      <PlayerPhotoOrCrest
                        photoUrl={config.photoUrl}
                        playerName={config.playerName}
                        sizeClass="w-20 h-20"
                      />
                      <div className="space-y-1 flex-1">
                        <div className="text-sm font-bold text-white">
                          Fotografía del Jugador o Escudo (Opcional)
                        </div>
                        <p className="text-xs text-emerald-300/80">
                          Sube una foto desde tu teléfono o deja el escudo deportivo original con balón dorado.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <label className="min-h-[42px] px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer inline-flex items-center gap-2 transition-colors">
                        <Upload className="w-4 h-4 text-amber-400" />
                        Subir Fotografía
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, 'photoUrl')}
                          className="hidden"
                        />
                      </label>
                      {config.photoUrl && (
                        <button
                          type="button"
                          onClick={() => setConfig({ ...config, photoUrl: '' })}
                          className="min-h-[42px] px-3 py-2 bg-white/10 hover:bg-white/20 text-xs text-emerald-200 rounded-xl cursor-pointer"
                        >
                          Usar Escudo Original
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] text-emerald-300 mb-1">
                        O pega el enlace (URL) de una imagen:
                      </label>
                      <input
                        type="text"
                        value={config.photoUrl.startsWith('data:') ? '' : config.photoUrl}
                        onChange={(e) => setConfig({ ...config, photoUrl: e.target.value })}
                        placeholder="https://ejemplo.com/foto-jugador.jpg"
                        className="w-full px-3 py-2 text-xs bg-[#05291C] text-white border border-emerald-800 rounded-lg focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {/* Cover Image Selector */}
                  <div className="bg-[#031B12] border border-emerald-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-white">
                          Imagen de Portada de la Rifa
                        </div>
                        <p className="text-xs text-emerald-300/80">
                          Elige un diseño deportivo original o sube una foto de portada desde tu celular.
                        </p>
                      </div>
                      <label className="min-h-[42px] px-3.5 py-2 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer inline-flex items-center gap-1.5 shrink-0">
                        <ImageIcon className="w-4 h-4 text-amber-400" />
                        Subir Portada
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, 'coverImageUrl')}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {COVER_PRESETS.map((preset) => {
                        const isSelected = config.coverImageUrl === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setConfig({ ...config, coverImageUrl: preset.id })}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-800/70 border-amber-400 text-white'
                                : 'bg-[#05291C] border-emerald-800/80 text-emerald-200 hover:border-emerald-600'
                            }`}
                          >
                            <div className="text-xs font-bold">{preset.label}</div>
                            <div className="text-[11px] text-emerald-300/80 mt-0.5 line-clamp-1">
                              {preset.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Group 3: Importe del Premio, Precio del Boleto, Número Inicial y Final */}
              <div className="space-y-4 pt-6 border-t border-emerald-800/80">
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
                  3. Premios en Efectivo, Precio del Boleto y Numeración (Inicial y Final)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      Número Inicial de Boletos *
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={900}
                      value={config.startNumber}
                      onChange={(e) => {
                        const start = Math.max(0, Number(e.target.value));
                        const end = Math.max(start + 1, config.endNumber);
                        setConfig({
                          ...config,
                          startNumber: start,
                          endNumber: end,
                          ticketCount: end - start + 1,
                          startAtZero: start === 0,
                        });
                      }}
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm font-mono bg-[#031B12] text-white border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      Número Final de Boletos *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={config.endNumber}
                      onChange={(e) => {
                        const end = Math.max(config.startNumber + 1, Number(e.target.value));
                        setConfig({
                          ...config,
                          endNumber: end,
                          ticketCount: end - config.startNumber + 1,
                        });
                      }}
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm font-mono bg-[#031B12] text-white border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      Precio de Cada Boleto ($ MXN) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={5}
                      value={config.ticketPrice}
                      onChange={(e) =>
                        setConfig({ ...config, ticketPrice: Math.max(1, Number(e.target.value)) })
                      }
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm font-mono font-bold bg-[#031B12] text-amber-300 border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      Meta Libre Deseada ($ MXN)
                    </label>
                    <input
                      type="number"
                      min={100}
                      step={100}
                      value={config.targetNetAmount}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          targetNetAmount: Math.max(100, Number(e.target.value)),
                        })
                      }
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm font-mono bg-[#031B12] text-white border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      Importe del 1er Premio ($ MXN) *
                    </label>
                    <input
                      type="number"
                      min={50}
                      step={50}
                      value={config.prizes[0]?.amount || 0}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value));
                        const nextPrizes = [...config.prizes];
                        if (nextPrizes[0]) {
                          nextPrizes[0] = { ...nextPrizes[0], amount: val };
                        } else {
                          nextPrizes.push({ id: '1', label: '1er Lugar (Efectivo)', amount: val });
                        }
                        setConfig({ ...config, prizes: nextPrizes });
                      }}
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm font-mono font-bold bg-[#031B12] text-amber-300 border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      Etiqueta 1er Premio
                    </label>
                    <input
                      type="text"
                      value={config.prizes[0]?.label || '1er Lugar (Efectivo)'}
                      onChange={(e) => {
                        const nextPrizes = [...config.prizes];
                        if (nextPrizes[0]) {
                          nextPrizes[0] = { ...nextPrizes[0], label: e.target.value };
                        }
                        setConfig({ ...config, prizes: nextPrizes });
                      }}
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm bg-[#031B12] text-white border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      2do Premio Opcional ($ MXN)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={config.prizes[1]?.amount || 0}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value));
                        let nextPrizes = [...config.prizes];
                        if (val === 0) {
                          nextPrizes = nextPrizes.slice(0, 1);
                        } else if (nextPrizes[1]) {
                          nextPrizes[1] = { ...nextPrizes[1], amount: val };
                        } else {
                          nextPrizes.push({ id: '2', label: '2do Lugar (Efectivo)', amount: val });
                        }
                        setConfig({ ...config, prizes: nextPrizes });
                      }}
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm font-mono bg-[#031B12] text-white border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="bg-[#031B12] border border-amber-400/40 rounded-xl p-3 flex flex-col justify-center">
                    <div className="text-[11px] text-emerald-300">Resumen con esta numeración:</div>
                    <div className="text-sm font-mono font-bold text-white mt-0.5">
                      {metrics.totalTickets} boletos = ${metrics.grossPotential.toLocaleString('es-MX')}
                    </div>
                    <div className="text-xs font-mono font-bold text-amber-400">
                      Ganancia Libre: ${metrics.netPotential.toLocaleString('es-MX')} MXN
                    </div>
                  </div>
                </div>
              </div>

              {/* Group 4: Fecha, Hora, Método del Sorteo y Datos de Contacto / Pago */}
              <div className="space-y-4 pt-6 border-t border-emerald-800/80">
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
                  4. Fecha y Hora del Sorteo, Método de Selección y Datos de Contacto
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      Fecha y Hora del Sorteo *
                    </label>
                    <input
                      type="text"
                      value={config.drawDate}
                      onChange={(e) => setConfig({ ...config, drawDate: e.target.value })}
                      placeholder="Ej. Domingo 15 de Noviembre · 8:00 PM"
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm bg-[#031B12] text-white border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      Método para Seleccionar al Ganador *
                    </label>
                    <input
                      type="text"
                      value={config.drawMethod}
                      onChange={(e) => setConfig({ ...config, drawMethod: e.target.value })}
                      placeholder="Ej. Últimas 2 cifras de la Lotería Nacional / Tómbola en Vivo"
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm bg-[#031B12] text-white border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      WhatsApp de Contacto (10 dígitos) *
                    </label>
                    <input
                      type="tel"
                      value={config.organizerPhone}
                      onChange={(e) => setConfig({ ...config, organizerPhone: e.target.value })}
                      placeholder="Ej. 5512345678"
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm font-mono bg-[#031B12] text-white border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      Datos de Contacto Adicionales (Redes, Correo o Punto de Reunión)
                    </label>
                    <input
                      type="text"
                      value={config.contactExtra}
                      onChange={(e) => setConfig({ ...config, contactExtra: e.target.value })}
                      placeholder="Ej. Entrenamientos martes y jueves 5:00 PM en Cancha 2"
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm bg-[#031B12] text-white border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      Banco para Transferencias
                    </label>
                    <input
                      type="text"
                      value={config.bankName}
                      onChange={(e) => setConfig({ ...config, bankName: e.target.value })}
                      placeholder="Ej. BBVA / Banamex / Nu / Spin"
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm bg-[#031B12] text-white border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      Número de Tarjeta o CLABE
                    </label>
                    <input
                      type="text"
                      value={config.clabeOrCard}
                      onChange={(e) => setConfig({ ...config, clabeOrCard: e.target.value })}
                      placeholder="16 dígitos de tarjeta o 18 de CLABE"
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm font-mono bg-[#031B12] text-amber-300 border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      Nombre del Titular de la Cuenta
                    </label>
                    <input
                      type="text"
                      value={config.accountHolder}
                      onChange={(e) => setConfig({ ...config, accountHolder: e.target.value })}
                      placeholder="Nombre completo del titular"
                      className="w-full min-h-[46px] px-4 py-2.5 text-sm bg-[#031B12] text-white border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-emerald-800 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="w-full sm:w-auto min-h-[52px] px-8 py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm rounded-xl transition-all active:scale-[0.98] cursor-pointer shadow-lg"
                >
                  {isSavingConfig
                    ? 'Guardando y Publicando...'
                    : 'Guardar Configuración y Actualizar Rifa en Vivo'}
                </button>
              </div>
            </form>

            {/* 3 Recommended Formulas Quick Selector */}
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Plantillas Rápidas para Juntar $1,800 MXN Libres
                </h2>
                <p className="text-sm text-emerald-200/80">
                  Si prefieres cargar automáticamente una de las 3 combinaciones matemáticas recomendadas, toca cualquiera de estas opciones:
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                {RECOMMENDED_STRATEGIES.map((strategy) => {
                  const isCurrent =
                    config.startNumber === strategy.startNumber &&
                    config.endNumber === strategy.endNumber &&
                    config.ticketPrice === strategy.ticketPrice;

                  return (
                    <div
                      key={strategy.id}
                      className={`bg-[#05291C] rounded-3xl border p-6 flex flex-col justify-between transition-colors ${
                        isCurrent
                          ? 'border-amber-400 ring-1 ring-amber-400'
                          : 'border-emerald-800 hover:border-emerald-600'
                      }`}
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
                          <span>{strategy.badgeText}</span>
                          {isCurrent && (
                            <span className="text-emerald-300 font-bold flex items-center gap-1">
                              <Check className="w-4 h-4" /> Activa
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="text-lg font-bold text-white">{strategy.name}</h3>
                          <p className="text-xs text-emerald-200/80 mt-0.5">{strategy.subtitle}</p>
                        </div>

                        <div className="border-t border-b border-emerald-800/80 py-3.5 space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-emerald-200">Boletos:</span>
                            <span className="font-mono font-bold text-white tabular-nums">
                              Del {strategy.startNumber} al {strategy.endNumber} ({strategy.ticketCount})
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-emerald-200">Precio por boleto:</span>
                            <span className="font-mono font-bold text-white tabular-nums">
                              ${strategy.ticketPrice} MXN
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-emerald-200">Premio en efectivo:</span>
                            <span className="font-mono font-bold text-amber-400 tabular-nums">
                              ${strategy.totalPrizes.toLocaleString('es-MX')} MXN
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-1.5 border-t border-emerald-800/80">
                            <span className="font-semibold text-white">Ganancia libre:</span>
                            <span className="font-mono font-bold text-base text-emerald-400 tabular-nums">
                              +${strategy.netProfit.toLocaleString('es-MX')} MXN
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-emerald-100/80 leading-relaxed">
                          {strategy.whyItWorks}
                        </p>
                      </div>

                      <div className="pt-5 mt-5 border-t border-emerald-800/80">
                        <button
                          onClick={() => handleApplyStrategy(strategy)}
                          className={`w-full min-h-[46px] py-2.5 px-4 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                            isCurrent
                              ? 'bg-emerald-800 text-amber-300 border border-amber-400/50'
                              : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                          }`}
                        >
                          {isCurrent ? 'Fórmula Activa' : 'Cargar esta Fórmula'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* =========================================================
            SECTION 2: CONTROL DE VENTAS Y COMPRADORES (ADMIN)
           ========================================================= */}
        {activeSection === 'tablero' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-6">
              {!isOrganizerAdmin && (
                <div className="bg-amber-400/15 border border-amber-400/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-xs text-amber-100">
                    <strong>Modo Administrador:</strong> Inicia sesión con tu cuenta de Google (
                    <strong>{ORGANIZER_EMAIL}</strong>) para ver los teléfonos privados de los compradores y confirmar pagos.
                  </div>
                  <button
                    onClick={() => signInOrganizer()}
                    className="min-h-[42px] px-4 py-2 bg-amber-400 text-slate-950 text-xs font-bold rounded-xl cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    Iniciar Sesión
                  </button>
                </div>
              )}

              <div className="bg-[#05291C] border border-emerald-800 rounded-3xl p-6 space-y-5 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-emerald-800/80">
                  <div className="flex items-center gap-1 p-1 bg-[#031B12] border border-emerald-800 rounded-xl self-start overflow-x-auto max-w-full">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                        statusFilter === 'all'
                          ? 'bg-emerald-700 text-white'
                          : 'text-emerald-200 hover:text-white'
                      }`}
                    >
                      Todos ({metrics.totalTickets})
                    </button>
                    <button
                      onClick={() => setStatusFilter('available')}
                      className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                        statusFilter === 'available'
                          ? 'bg-emerald-700 text-white'
                          : 'text-emerald-200 hover:text-white'
                      }`}
                    >
                      Libres ({metrics.availableCount})
                    </button>
                    <button
                      onClick={() => setStatusFilter('reserved')}
                      className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                        statusFilter === 'reserved'
                          ? 'bg-amber-400 text-slate-950 font-bold'
                          : 'text-emerald-200 hover:text-white'
                      }`}
                    >
                      Apartados ({metrics.reservedCount})
                    </button>
                    <button
                      onClick={() => setStatusFilter('paid')}
                      className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                        statusFilter === 'paid'
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'text-emerald-200 hover:text-white'
                      }`}
                    >
                      Pagados ({metrics.paidCount})
                    </button>
                  </div>

                  <div className="relative flex-1 sm:max-w-xs">
                    <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar boleto o comprador..."
                      className="w-full min-h-[42px] pl-10 pr-3 py-2 text-xs bg-[#031B12] text-white placeholder:text-emerald-600 border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Grid of Tickets */}
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2.5">
                  {filteredTickets.map((ticket) => {
                    const isSelected = selectedNumbers.includes(ticket.number);
                    let cellStyle =
                      'bg-white text-slate-950 border-white hover:border-amber-400';

                    if (ticket.status === 'paid') {
                      cellStyle =
                        'bg-emerald-500 text-slate-950 border-emerald-400 font-bold';
                    } else if (ticket.status === 'reserved') {
                      cellStyle =
                        'bg-amber-400 text-slate-950 border-amber-300 font-bold';
                    }

                    return (
                      <button
                        key={ticket.number}
                        onClick={(e) =>
                          handleTicketClick(ticket.number, e.shiftKey || e.metaKey || e.ctrlKey)
                        }
                        className={`relative min-h-[54px] rounded-xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer select-none ${cellStyle} ${
                          isSelected ? 'ring-3 ring-amber-300 ring-offset-2 ring-offset-[#05291C]' : ''
                        }`}
                      >
                        <span className="font-mono font-bold text-base tabular-nums leading-none">
                          {ticket.number}
                        </span>
                        <span className="text-[10px] mt-1 font-semibold truncate max-w-[90%] leading-none opacity-85">
                          {ticket.status === 'paid'
                            ? ticket.buyerName.split(' ')[0] || 'Pagado'
                            : ticket.status === 'reserved'
                            ? ticket.buyerName.split(' ')[0] || 'Apartado'
                            : 'Libre'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Buyers Directory Table */}
              <div className="bg-[#05291C] border border-emerald-800 rounded-3xl p-6 space-y-4 shadow-lg">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Lista de Compradores Registrados ({soldOrReservedTickets.length})
                  </h3>
                  <p className="text-xs text-emerald-300">
                    Toca cualquier comprador para editar su boleto o presiona "Confirmar Pago" cuando recibas su transferencia.
                  </p>
                </div>

                {soldOrReservedTickets.length === 0 ? (
                  <div className="py-10 text-center space-y-2 border border-dashed border-emerald-800 rounded-2xl">
                    <p className="text-sm font-semibold text-emerald-100">
                      Aún no hay boletos apartados
                    </p>
                    <p className="text-xs text-emerald-300/80 max-w-md mx-auto">
                      Comparte el enlace de tu rifa por WhatsApp para que tus contactos seleccionen sus boletos directamente.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-emerald-800 text-xs text-emerald-300 font-semibold">
                          <th className="py-3 px-3">Boleto</th>
                          <th className="py-3 px-3">Comprador</th>
                          <th className="py-3 px-3">WhatsApp</th>
                          <th className="py-3 px-3">Estado</th>
                          <th className="py-3 px-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-900/70">
                        {soldOrReservedTickets.map((t) => (
                          <tr
                            key={t.number}
                            onClick={() => setSelectedNumbers([t.number])}
                            className="hover:bg-emerald-900/40 transition-colors cursor-pointer"
                          >
                            <td className="py-3 px-3 font-mono font-bold text-amber-400 tabular-nums">
                              #{t.number}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-white">{t.buyerName}</div>
                              {t.notes && (
                                <div className="text-xs text-emerald-300">{t.notes}</div>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono text-xs text-emerald-200 tabular-nums">
                              {t.buyerPhone || (isOrganizerAdmin ? '—' : 'Privado')}
                            </td>
                            <td className="py-3 px-3 text-xs font-bold">
                              {t.status === 'paid' ? (
                                <span className="text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-4 h-4" /> Pagado
                                </span>
                              ) : (
                                <span className="text-amber-300 flex items-center gap-1">
                                  <Clock className="w-4 h-4" /> Apartado
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {t.status === 'reserved' ? (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!isOrganizerAdmin) {
                                      await signInOrganizer();
                                      return;
                                    }
                                    await updateTicketsAsOrganizer({
                                      numbers: [t.number],
                                      status: 'paid',
                                      buyerName: t.buyerName,
                                      buyerPhone: t.buyerPhone,
                                      paymentMethod: 'transferencia',
                                      notes: t.notes,
                                    });
                                    showToast(`Boleto #${t.number} confirmado como PAGADO`);
                                  }}
                                  className="min-h-[38px] px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors cursor-pointer"
                                >
                                  Confirmar Pago
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const msg = `⚽ *Boleto Digital Confirmado — ${config.title}*\n\n¡Muchas gracias *${t.buyerName}* por apoyar a ${config.playerName}!\n🔢 *Tu número:* #${t.number}\n✅ *Estado:* PAGADO ($${config.ticketPrice} MXN)\n📅 *Sorteo:* ${config.drawDate}\n\n¡Mucha suerte! 🍀`;
                                    copyToClipboard(msg, `receipt-${t.number}`);
                                  }}
                                  className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer"
                                >
                                  Copiar Recibo
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Right 4 Cols: Organizer Inspector */}
            <aside className="lg:col-span-4 bg-[#05291C] border border-emerald-700/80 rounded-3xl p-6 space-y-5 shadow-xl lg:sticky lg:top-20">
              <div className="border-b border-emerald-800 pb-4">
                <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">
                  Control de Boleto
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <h3 className="text-xl font-bold text-white font-mono tabular-nums">
                    Boleto #{selectedNumbers.join(', #')}
                  </h3>
                  <span className="text-sm font-mono font-bold text-amber-300 tabular-nums">
                    ${selectedNumbers.length * config.ticketPrice} MXN
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveTicketAssignment} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                    Estado del Boleto
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setFormStatus('paid')}
                      className={`min-h-[46px] py-2.5 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                        formStatus === 'paid'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-[#031B12] text-emerald-200 border-emerald-800'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Pagado
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormStatus('reserved')}
                      className={`min-h-[46px] py-2.5 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                        formStatus === 'reserved'
                          ? 'bg-amber-400 text-slate-950 border-amber-300'
                          : 'bg-[#031B12] text-emerald-200 border-emerald-800'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      Apartado
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                    Nombre del Comprador
                  </label>
                  <input
                    type="text"
                    required
                    value={formBuyerName}
                    onChange={(e) => setFormBuyerName(e.target.value)}
                    placeholder="Nombre y Apellido"
                    className="w-full min-h-[46px] px-4 py-2 text-sm bg-[#031B12] text-white border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={formBuyerPhone}
                      onChange={(e) => setFormBuyerPhone(e.target.value)}
                      placeholder="10 dígitos"
                      className="w-full min-h-[46px] px-3 py-2 text-sm font-mono bg-[#031B12] text-white border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                      Método
                    </label>
                    <select
                      value={formPaymentMethod}
                      onChange={(e) => setFormPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full min-h-[46px] px-3 py-2 text-sm bg-[#031B12] text-white border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                    >
                      <option value="transferencia">Transferencia</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="pendiente">Pendiente</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                    Nota
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Nota opcional"
                    className="w-full min-h-[46px] px-4 py-2 text-sm bg-[#031B12] text-white border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="pt-2 space-y-2.5">
                  <button
                    type="submit"
                    className="w-full min-h-[48px] py-3 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-md"
                  >
                    Guardar Boleto #{selectedNumbers.join(', #')}
                  </button>
                  <button
                    type="button"
                    onClick={handleReleaseTickets}
                    className="w-full min-h-[44px] py-2.5 px-3 bg-[#031B12] border border-emerald-800 hover:border-red-500/60 hover:text-red-300 text-emerald-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Liberar Número (Dejar Disponible)
                  </button>
                </div>
              </form>
            </aside>
          </div>
        )}

        {/* =========================================================
            SECTION 3: COMPARTIR EN WHATSAPP Y DESCARGAR PLANTILLA
           ========================================================= */}
        {activeSection === 'whatsapp' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-[#05291C] border-2 border-amber-400/60 rounded-3xl p-6 space-y-4 shadow-lg">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Enlace Directo para tus Compradores
                </div>
                <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed">
                  Envía este link por WhatsApp. Al tocarlo desde su teléfono, tus familiares y amigos verán tu rifa con fondo verde deportivo, elegirán sus boletos y anotarán su nombre:
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={buyerShareUrl}
                    className="flex-1 min-h-[46px] px-4 py-2.5 text-xs font-mono bg-[#031B12] text-amber-300 border border-emerald-700 rounded-xl"
                  />
                  <button
                    onClick={() => copyToClipboard(buyerShareUrl, 'share-box-url')}
                    className="min-h-[46px] px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {copiedId === 'share-box-url' ? '¡Enlace Copiado!' : 'Copiar Enlace'}
                  </button>
                </div>
              </div>

              {/* Template 1 */}
              <div className="bg-[#05291C] border border-emerald-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-amber-400 font-bold">Mensaje Principal</div>
                    <h3 className="text-base font-bold text-white">
                      1. Invitación Completa con Link Directo
                    </h3>
                  </div>
                  <button
                    onClick={() => copyToClipboard(whatsappTemplates.generalInvite, 'tpl-1')}
                    className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
                  >
                    {copiedId === 'tpl-1' ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    {copiedId === 'tpl-1' ? '¡Copiado!' : 'Copiar Mensaje'}
                  </button>
                </div>
                <pre className="bg-[#031B12] border border-emerald-800 rounded-2xl p-4 text-xs text-emerald-100 whitespace-pre-wrap font-sans leading-relaxed">
                  {whatsappTemplates.generalInvite}
                </pre>
              </div>
            </div>

            {/* Right 5 Cols: Poster Preview & PNG Download */}
            <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
              <div className="bg-[#05291C] text-white rounded-3xl p-6 space-y-5 border border-emerald-700/80 shadow-xl">
                <div className="text-center space-y-1">
                  <div className="text-[11px] font-bold tracking-wider text-amber-400">
                    PLANTILLA DEPORTIVA PARA ESTADOS DE WHATSAPP
                  </div>
                  <h3 className="text-xl font-bold">{config.title}</h3>
                  <p className="text-xs text-emerald-200">
                    Jugador: {config.playerName} · {config.teamName}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-[#031B12] border border-amber-400/40 rounded-2xl p-4">
                  <div>
                    <div className="text-[10px] text-amber-300 font-bold">PREMIO EN EFECTIVO</div>
                    <div className="text-xl font-bold font-mono tabular-nums text-amber-400">
                      ${metrics.totalPrizes.toLocaleString('es-MX')} MXN
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-emerald-300 font-bold">PRECIO BOLETO</div>
                    <div className="text-xl font-bold font-mono tabular-nums text-white">
                      ${config.ticketPrice} MXN
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-10 gap-1">
                  {tickets.slice(0, 100).map((t) => (
                    <div
                      key={t.number}
                      className={`h-6 rounded text-[10px] font-mono font-bold flex items-center justify-center tabular-nums ${
                        t.status === 'available'
                          ? 'bg-white text-slate-950'
                          : 'bg-[#031B12] text-emerald-700 line-through'
                      }`}
                    >
                      {t.number}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => downloadRafflePosterPNG(config, tickets)}
                  className="w-full min-h-[52px] py-3.5 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Download className="w-4 h-4" />
                  Descargar Imagen HD (PNG) para WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            SECTION 4: SORTEO OFICIAL Y VERIFICADOR
           ========================================================= */}
        {activeSection === 'sorteo' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <section className="bg-[#05291C] border border-emerald-800 rounded-3xl p-6 space-y-5 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-amber-400 font-bold uppercase">
                    Opción A · Lotería Nacional
                  </div>
                  <h2 className="text-xl font-bold text-white mt-0.5">
                    Verificador de Boleto Ganador
                  </h2>
                </div>
                <GoldenTrophySVG className="w-12 h-12 shrink-0" />
              </div>
              <p className="text-xs sm:text-sm text-emerald-200/80">
                Ingresa el número ganador del sorteo para identificar al instante quién compró ese boleto y si ya está pagado.
              </p>

              <div>
                <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                  Número Ganador (o últimas 2 cifras)
                </label>
                <input
                  type="text"
                  value={lotteryWinningInput}
                  onChange={(e) => setLotteryWinningInput(e.target.value)}
                  placeholder="Ej. 48207 (Toma el 07)"
                  className="w-full min-h-[52px] px-4 py-3 text-lg font-mono font-bold bg-[#031B12] text-amber-300 border border-emerald-700 rounded-xl focus:outline-none focus:border-amber-400 tabular-nums"
                />
              </div>

              {matchedLotteryTicket && (
                <div className="p-5 rounded-2xl bg-[#031B12] border border-amber-400/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-300">
                      Boleto Coincidente
                    </span>
                    <span className="text-xl font-mono font-bold text-amber-400">
                      #{matchedLotteryTicket.number}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-emerald-300">Comprador: </span>
                    <strong className="text-white">
                      {matchedLotteryTicket.buyerName || 'Sin comprador (Boleto libre)'}
                    </strong>
                  </div>
                  <div className="text-xs">
                    Estado:{' '}
                    <span className="font-bold text-amber-300">
                      {matchedLotteryTicket.status === 'paid'
                        ? 'PAGADO ✅ (Ganador confirmado)'
                        : matchedLotteryTicket.status === 'reserved'
                        ? 'APARTADO PENDIENTE DE PAGO ⚠️'
                        : 'BOLETO NO VENDIDO'}
                    </span>
                  </div>
                </div>
              )}
            </section>

            <section className="bg-[#05291C] border border-emerald-800 rounded-3xl p-6 space-y-5 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-amber-400 font-bold uppercase">
                    Opción B · Tómbola Digital
                  </div>
                  <h2 className="text-xl font-bold text-white mt-0.5">
                    Sorteo Aleatorio en Vivo
                  </h2>
                </div>
                <SoccerBallSVG className="w-12 h-12 shrink-0" />
              </div>
              <p className="text-xs sm:text-sm text-emerald-200/80">
                Gira la tómbola digital para elegir un boleto ganador al azar en vivo frente a los participantes.
              </p>

              <label className="flex items-center gap-3 text-xs sm:text-sm text-emerald-100 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyPaidInDraw}
                  onChange={(e) => setOnlyPaidInDraw(e.target.checked)}
                  className="w-5 h-5 rounded border-emerald-600 text-amber-400 focus:ring-amber-400"
                />
                <span>
                  Sortear únicamente entre boletos PAGADOS ({metrics.paidCount} boletos)
                </span>
              </label>

              <button
                onClick={handleRunDigitalDraw}
                disabled={isDrawing}
                className="w-full min-h-[54px] py-3.5 px-5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <Trophy className="w-5 h-5" />
                {isDrawing ? 'Girando Tómbola...' : 'Sacar Boleto Ganador al Azar'}
              </button>

              {drawnTicket && (
                <div className="p-6 rounded-2xl bg-[#031B12] border-2 border-amber-400 text-center space-y-3">
                  <div className="text-xs font-bold text-amber-400">
                    ¡BOLETO GANADOR OFICIAL!
                  </div>
                  <div className="text-5xl font-mono font-bold text-white tabular-nums">
                    #{drawnTicket.number}
                  </div>
                  <div className="text-lg font-bold text-emerald-300">
                    {drawnTicket.buyerName || 'Boleto Libre'}
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        const msg = `🏆 *¡TENEMOS GANADOR(A) DE ${config.title.toUpperCase()}!* ⚽🎉\n\n🔢 *Boleto Ganador:* #${drawnTicket.number}\n🙌 *Felicidades a:* ${drawnTicket.buyerName || 'Participante'}\n💰 *Premio:* $${(config.prizes[0]?.amount || 1000).toLocaleString('es-MX')} MXN en efectivo\n\n¡Muchas gracias a todos por apoyar a ${config.playerName} rumbo a la Liga Nacional! 🙏⚽`;
                        copyToClipboard(msg, 'winner-msg');
                      }}
                      className="min-h-[44px] px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      Copiar Anuncio de Ganador para WhatsApp
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (5 Tabs for One-Handed Phone Use) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#02140E]/95 backdrop-blur-md border-t border-emerald-800/80 grid grid-cols-5 items-center h-16 px-1">
        <button
          onClick={() => setActiveSection('comprador')}
          className={`flex flex-col items-center justify-center h-full cursor-pointer ${
            activeSection === 'comprador' ? 'text-amber-400 font-bold' : 'text-emerald-300/80'
          }`}
        >
          <TicketIcon className="w-5 h-5" />
          <span className="text-[10px] mt-1">Boletos</span>
        </button>
        <button
          onClick={() => setActiveSection('tablero')}
          className={`flex flex-col items-center justify-center h-full cursor-pointer ${
            activeSection === 'tablero' ? 'text-amber-400 font-bold' : 'text-emerald-300/80'
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[10px] mt-1">Ventas</span>
        </button>
        <button
          onClick={() => setActiveSection('estrategia')}
          className={`flex flex-col items-center justify-center h-full cursor-pointer ${
            activeSection === 'estrategia' ? 'text-amber-400 font-bold' : 'text-emerald-300/80'
          }`}
        >
          <Sliders className="w-5 h-5" />
          <span className="text-[10px] mt-1">Configurar</span>
        </button>
        <button
          onClick={() => setActiveSection('whatsapp')}
          className={`flex flex-col items-center justify-center h-full cursor-pointer ${
            activeSection === 'whatsapp' ? 'text-amber-400 font-bold' : 'text-emerald-300/80'
          }`}
        >
          <Share2 className="w-5 h-5" />
          <span className="text-[10px] mt-1">Compartir</span>
        </button>
        <button
          onClick={() => setActiveSection('sorteo')}
          className={`flex flex-col items-center justify-center h-full cursor-pointer ${
            activeSection === 'sorteo' ? 'text-amber-400 font-bold' : 'text-emerald-300/80'
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[10px] mt-1">Sorteo</span>
        </button>
      </nav>

      {/* Quiet Desktop Footer */}
      <footer className="hidden md:block border-t border-emerald-900/80 bg-[#02140E] py-5 px-6 mt-12">
        <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-4 text-xs text-emerald-300/80">
          <span>
            RifaGol Liga Nacional · Plataforma deportiva sincronizada en tiempo real.
          </span>
          <div className="flex items-center gap-5">
            <button
              onClick={() => setActiveSection('comprador')}
              className="text-emerald-200 hover:text-amber-300 font-semibold cursor-pointer"
            >
              Vista de Comprador
            </button>
            <button
              onClick={() => setActiveSection('estrategia')}
              className="text-emerald-200 hover:text-amber-300 font-semibold cursor-pointer"
            >
              Configurar Rifa
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
