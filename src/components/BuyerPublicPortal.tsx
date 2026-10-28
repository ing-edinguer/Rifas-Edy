import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Check,
  Shuffle,
  ShieldCheck,
  Send,
  CreditCard,
  Phone,
  Calendar,
  Award,
  User,
  Lock,
  ArrowDown,
} from 'lucide-react';
import { RaffleConfig, Ticket, PaymentMethod } from '../types/raffle';
import { reserveTicketsAsBuyer } from '../lib/firebase';
import {
  RaffleCoverBanner,
  PlayerPhotoOrCrest,
  SoccerBallSVG,
  GoldenTrophySVG,
} from './SoccerArtwork';

interface BuyerPublicPortalProps {
  config: RaffleConfig;
  tickets: Ticket[];
  onReservationSuccess?: (numbers: string[], buyerName: string) => void;
}

interface ConfirmedReservation {
  numbers: string[];
  buyerName: string;
  buyerPhone: string;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  timestamp: string;
}

export function BuyerPublicPortal({
  config,
  tickets,
  onReservationSuccess,
}: BuyerPublicPortalProps) {
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transferencia');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedReservation | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [gridFilter, setGridFilter] = useState<'all' | 'available' | 'taken'>('all');

  const availableTickets = tickets.filter((t) => t.status === 'available');
  const totalPrize = config.prizes.reduce((acc, p) => acc + p.amount, 0);
  const isRaffleOpen = (config.raffleStatus || 'activa') === 'activa';

  const statusLabelMap: Record<string, { text: string; tone: string }> = {
    activa: { text: 'Rifa Activa · Boletos Disponibles', tone: 'text-emerald-300' },
    pausada: { text: 'Rifa Temporalmente en Pausa', tone: 'text-amber-300' },
    cerrada: { text: 'Venta de Boletos Cerrada', tone: 'text-amber-300' },
    finalizada: { text: 'Sorteo Finalizado', tone: 'text-amber-300' },
  };
  const currentStatusMeta = statusLabelMap[config.raffleStatus || 'activa'] || statusLabelMap.activa;

  const toggleNumber = (num: string, status: string) => {
    if (!isRaffleOpen || status !== 'available') return;
    setErrorMsg(null);
    setSelectedNumbers((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    );
  };

  const pickRandomAvailable = (count: number) => {
    if (!isRaffleOpen) return;
    setErrorMsg(null);
    const pool = availableTickets.map((t) => t.number);
    if (pool.length === 0) {
      setErrorMsg('¡Todos los boletos ya han sido apartados!');
      return;
    }
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    setSelectedNumbers(shuffled.slice(0, Math.min(count, shuffled.length)));
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField((prev) => (prev === id ? null : prev)), 2500);
  };

  const scrollToForm = () => {
    const el = document.getElementById('buyer-checkout-form');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleReserveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isRaffleOpen) {
      setErrorMsg('La rifa no está recibiendo nuevos apartados en este momento.');
      return;
    }

    if (selectedNumbers.length === 0) {
      setErrorMsg('Por favor toca al menos un número disponible en el tablero.');
      return;
    }

    const cleanName = buyerName.trim();
    const cleanPhone = buyerPhone.trim();

    if (cleanName.length < 2) {
      setErrorMsg('Por favor escribe tu nombre y apellido para registrar tu boleto.');
      return;
    }

    if (cleanPhone.length < 8) {
      setErrorMsg('Por favor ingresa un número de teléfono o WhatsApp válido (10 dígitos).');
      return;
    }

    const stillAvailable = selectedNumbers.every((num) => {
      const found = tickets.find((t) => t.number === num);
      return found && found.status === 'available';
    });

    if (!stillAvailable) {
      setErrorMsg(
        'Uno de los números que elegiste acaba de ser apartado por otra persona. Por favor revisa tu selección.'
      );
      setSelectedNumbers((prev) =>
        prev.filter((num) => tickets.find((t) => t.number === num)?.status === 'available')
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await reserveTicketsAsBuyer({
        numbers: selectedNumbers,
        buyerName: cleanName,
        buyerPhone: cleanPhone,
        paymentMethod,
        notes: notes.trim(),
      });

      const order: ConfirmedReservation = {
        numbers: [...selectedNumbers],
        buyerName: cleanName,
        buyerPhone: cleanPhone,
        paymentMethod,
        totalAmount: selectedNumbers.length * config.ticketPrice,
        timestamp: new Date().toLocaleString('es-MX', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
      };

      setConfirmedOrder(order);
      setSelectedNumbers([]);
      if (onReservationSuccess) {
        onReservationSuccess(order.numbers, order.buyerName);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      setErrorMsg(
        'No se pudo guardar el apartado en este momento. Verifica que el número siga libre e inténtalo de nuevo.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getWhatsAppConfirmationUrl = (order: ConfirmedReservation) => {
    const cleanOrgPhone = config.organizerPhone.replace(/\D/g, '');
    const phoneWithCountry =
      cleanOrgPhone.length === 10 ? `52${cleanOrgPhone}` : cleanOrgPhone;
    const text = `⚽ ¡Hola! Acabo de apartar mi(s) boleto(s) en *${config.title}*:\n\n🔢 *Boleto(s):* #${order.numbers.join(', #')}\n👤 *Nombre:* ${order.buyerName}\n📱 *Mi WhatsApp:* ${order.buyerPhone}\n💵 *Total a pagar:* $${order.totalAmount} MXN (${order.paymentMethod})\n\n¡En breve te mando mi comprobante de pago! 🙌`;
    if (phoneWithCountry) {
      return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(text)}`;
    }
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const displayedTickets = tickets.filter((t) => {
    if (gridFilter === 'available') return t.status === 'available';
    if (gridFilter === 'taken') return t.status !== 'available';
    return true;
  });

  return (
    <div className="space-y-8 pb-20 lg:pb-8">
      {/* 1. Stadium Hero Banner with Original Soccer Artwork */}
      <RaffleCoverBanner coverImageUrl={config.coverImageUrl}>
        <div className="p-6 sm:p-8 lg:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left 7 Cols: Player Photo/Crest, Title, Description/Cause & Organizer */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-4">
                <PlayerPhotoOrCrest
                  photoUrl={config.photoUrl}
                  playerName={config.playerName}
                  sizeClass="w-16 h-16 sm:w-20 sm:h-20"
                />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className={currentStatusMeta.tone}>{currentStatusMeta.text}</span>
                    <span className="text-emerald-500" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-emerald-100">{config.teamName}</span>
                  </div>
                  <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight text-balance">
                    {config.title}
                  </h1>
                  <div className="text-xs sm:text-sm text-amber-300 font-medium">
                    Jugador: {config.playerName}
                    {config.organizerName ? ` · Organiza: ${config.organizerName}` : ''}
                  </div>
                </div>
              </div>

              <p className="text-sm sm:text-base text-emerald-50/90 leading-relaxed max-w-2xl">
                {config.description ||
                  `Estamos recaudando fondos para cubrir la inscripción de ${config.playerName} al Torneo de la Liga Nacional de Futbol. Elige tus números de la suerte en el tablero e ingresa tus datos para apartarlos al instante.`}
              </p>

              {/* Metadata Details */}
              <div className="pt-2 flex flex-wrap items-center gap-y-2 gap-x-5 text-xs sm:text-sm text-emerald-200">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Sorteo: <strong className="text-white">{config.drawDate}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Método: <strong className="text-white">{config.drawMethod}</strong>
                  </span>
                </div>
                {config.organizerPhone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Contacto: <strong className="text-white font-mono">{config.organizerPhone}</strong>
                      {config.contactExtra ? ` (${config.contactExtra})` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right 5 Cols: Championship Gold Prize & Ticket Value Card */}
            <div className="lg:col-span-5 bg-[#031D13]/90 border border-amber-400/40 rounded-2xl p-5 sm:p-6 shadow-lg space-y-5">
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-emerald-800/70">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Premio Total en Efectivo
                  </div>
                  <div className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-amber-400 mt-1">
                    ${totalPrize.toLocaleString('es-MX')} MXN
                  </div>
                </div>
                <GoldenTrophySVG className="w-14 h-14 shrink-0" />
              </div>

              <div className="space-y-1.5 text-xs sm:text-sm text-emerald-100">
                {config.prizes.map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <span className="text-emerald-200">{p.label}:</span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      ${p.amount.toLocaleString('es-MX')} MXN
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-emerald-800/70 flex items-center justify-between">
                <div>
                  <div className="text-xs text-emerald-300 font-medium">Precio por Boleto</div>
                  <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-white">
                    ${config.ticketPrice} <span className="text-sm font-normal text-emerald-300">MXN</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-emerald-300 font-medium">Boletos Disponibles</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-emerald-400">
                    {availableTickets.length} <span className="text-xs text-emerald-300">/ {tickets.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </RaffleCoverBanner>

      {/* 2. Confirmed Order Receipt Card (if Buyer just reserved tickets) */}
      {confirmedOrder && (
        <section className="bg-[#063322] text-white border-2 border-amber-400 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-800 pb-5">
            <div className="space-y-1">
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                ¡BOLETO(S) APARTADO(S) CON ÉXITO!
              </div>
              <h2 className="text-2xl font-bold text-white">
                ¡Muchas gracias por apoyar, {confirmedOrder.buyerName}!
              </h2>
              <p className="text-xs sm:text-sm text-emerald-200">
                Tus números ya quedaron apartados a tu nombre en el tablero oficial.
              </p>
            </div>
            <div className="bg-[#031D13] border border-amber-400/50 rounded-2xl px-5 py-3.5 text-right shrink-0">
              <div className="text-xs text-emerald-300">Tus Números de la Suerte</div>
              <div className="text-2xl sm:text-3xl font-mono font-bold text-amber-400 tabular-nums">
                #{confirmedOrder.numbers.join(', #')}
              </div>
              <div className="text-xs font-mono text-white mt-0.5">
                Total a cubrir: ${confirmedOrder.totalAmount.toLocaleString('es-MX')} MXN
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div className="bg-[#031D13] border border-emerald-800 rounded-2xl p-5 space-y-3">
              <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" />
                Datos para Transferencia (${confirmedOrder.totalAmount} MXN)
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-300">Banco:</span>
                  <span className="font-semibold text-white">
                    {config.bankName || 'Consultar por WhatsApp'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-emerald-300">Titular:</span>
                  <span className="font-semibold text-white">{config.accountHolder}</span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-emerald-900">
                  <div>
                    <span className="text-xs text-emerald-300 block">Tarjeta o CLABE:</span>
                    <span className="font-mono font-bold text-base sm:text-lg text-amber-300 tabular-nums">
                      {config.clabeOrCard}
                    </span>
                  </div>
                  <button
                    onClick={() => copyText(config.clabeOrCard, 'clabe-copy')}
                    className="min-h-[44px] px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                  >
                    {copiedField === 'clabe-copy' ? (
                      <>
                        <Check className="w-4 h-4 text-amber-300" /> ¡Copiada!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" /> Copiar Cuenta
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed">
                <strong>Confirma tu boleto por WhatsApp:</strong> Toca el botón dorado de abajo para enviar tu confirmación al organizador y mandarle foto de tu comprobante.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={getWhatsAppConfirmationUrl(confirmedOrder)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-h-[52px] py-3.5 px-5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-center shadow-md"
                >
                  <Send className="w-4 h-4" />
                  Enviar Confirmación por WhatsApp
                </a>
                <button
                  onClick={() => setConfirmedOrder(null)}
                  className="min-h-[52px] py-3.5 px-5 bg-emerald-900 hover:bg-emerald-800 text-emerald-100 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Elegir más boletos
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Status Notice if Raffle is Not Active */}
      {!isRaffleOpen && (
        <div className="bg-amber-500/15 border border-amber-400/50 rounded-2xl p-5 text-amber-200 flex items-center gap-3">
          <Lock className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="text-sm">
            <strong>Estado actual de la rifa: {currentStatusMeta.text}.</strong> En este momento no es posible apartar nuevos boletos. Si ya tienes tu boleto apartado, puedes consultar el tablero abajo.
          </div>
        </div>
      )}

      {/* 3. Main Interactive Board + Buyer Checkout Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 8 Cols: Interactive Mobile-Optimized Ticket Grid */}
        <section className="lg:col-span-8 bg-[#05291C] border border-emerald-800/80 rounded-3xl p-5 sm:p-7 space-y-6 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-emerald-800/70">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Paso 1 · Selección Directa
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-0.5">
                Toca los Boletos que Quieras Apartar
              </h2>
              <p className="text-xs sm:text-sm text-emerald-200/80 mt-0.5">
                Boletos numerados del{' '}
                <strong className="font-mono text-white">
                  {tickets[0]?.number || '01'}
                </strong>{' '}
                al{' '}
                <strong className="font-mono text-white">
                  {tickets[tickets.length - 1]?.number || '50'}
                </strong>
                . Toca cualquier número blanco para elegirlo.
              </p>
            </div>

            {/* Large Mobile-Friendly Random Pickers */}
            {isRaffleOpen && (
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => pickRandomAvailable(1)}
                  className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-800/90 hover:bg-emerald-700 border border-emerald-600/50 rounded-xl transition-all active:scale-[0.97] cursor-pointer whitespace-nowrap"
                >
                  <Shuffle className="w-4 h-4 text-amber-400" />
                  1 Boleto al Azar
                </button>
                <button
                  type="button"
                  onClick={() => pickRandomAvailable(2)}
                  className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all active:scale-[0.97] cursor-pointer whitespace-nowrap shadow-sm"
                >
                  <Shuffle className="w-4 h-4" />
                  Par de la Suerte (2 × ${config.ticketPrice * 2})
                </button>
              </div>
            )}
          </div>

          {/* Filter Tabs & Legend */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-1 p-1 bg-[#031B12] border border-emerald-800/80 rounded-xl self-start">
              <button
                type="button"
                onClick={() => setGridFilter('all')}
                className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  gridFilter === 'all'
                    ? 'bg-emerald-700 text-white'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                Todos ({tickets.length})
              </button>
              <button
                type="button"
                onClick={() => setGridFilter('available')}
                className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  gridFilter === 'available'
                    ? 'bg-emerald-700 text-white'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                Libres ({availableTickets.length})
              </button>
              <button
                type="button"
                onClick={() => setGridFilter('taken')}
                className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  gridFilter === 'taken'
                    ? 'bg-emerald-700 text-white'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                Ocupados ({tickets.length - availableTickets.length})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-emerald-200">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-md bg-white border border-emerald-300 inline-block" />
                <span>Disponible</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-md bg-amber-400 inline-block" />
                <span>Tu selección ({selectedNumbers.length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-md bg-[#031A11] border border-emerald-900 inline-block" />
                <span>Ocupado</span>
              </div>
            </div>
          </div>

          {/* Responsive Touch-Friendly Grid */}
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2.5">
            {displayedTickets.map((ticket) => {
              const isSelected = selectedNumbers.includes(ticket.number);
              const isAvailable = ticket.status === 'available';

              let btnClass =
                'bg-white text-slate-950 border-2 border-white hover:border-amber-400 shadow-xs cursor-pointer active:scale-[0.95]';
              if (isSelected) {
                btnClass =
                  'bg-amber-400 text-slate-950 border-2 border-amber-300 ring-2 ring-amber-400/60 shadow-md scale-[1.02] cursor-pointer';
              } else if (!isAvailable) {
                btnClass =
                  'bg-[#031A11] text-emerald-700 border border-emerald-900/70 cursor-not-allowed opacity-70';
              }

              return (
                <button
                  key={ticket.number}
                  type="button"
                  disabled={!isAvailable || !isRaffleOpen}
                  onClick={() => toggleNumber(ticket.number, ticket.status)}
                  className={`min-h-[54px] rounded-xl flex flex-col items-center justify-center transition-all duration-150 select-none ${btnClass}`}
                >
                  <span className="font-mono font-bold text-base tabular-nums leading-none">
                    {ticket.number}
                  </span>
                  <span
                    className={`text-[10px] mt-1 font-semibold truncate max-w-[90%] leading-none ${
                      isSelected
                        ? 'text-slate-900'
                        : isAvailable
                        ? 'text-emerald-700'
                        : 'text-emerald-600/80'
                    }`}
                  >
                    {isSelected
                      ? 'Elegido'
                      : isAvailable
                      ? 'Libre'
                      : ticket.buyerName.split(' ')[0] || 'Ocupado'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Right 4 Cols: Buyer Self-Registration Form */}
        <aside
          id="buyer-checkout-form"
          className="lg:col-span-4 bg-[#05291C] border border-emerald-700/80 rounded-3xl p-6 space-y-5 shadow-xl lg:sticky lg:top-20"
        >
          <div className="border-b border-emerald-800/80 pb-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Paso 2 · Tus Datos
              </div>
              <h3 className="text-xl font-bold text-white mt-0.5">
                Registra tu(s) Boleto(s)
              </h3>
            </div>
            <SoccerBallSVG className="w-10 h-10 shrink-0" />
          </div>

          {/* Selected Numbers Summary Box */}
          <div className="p-4 rounded-2xl bg-[#031B12] border border-emerald-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-emerald-300">
              <span>Boletos seleccionados:</span>
              {selectedNumbers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedNumbers([])}
                  className="text-amber-300 hover:text-amber-200 underline cursor-pointer font-medium"
                >
                  Quitar todos
                </button>
              )}
            </div>

            {selectedNumbers.length === 0 ? (
              <div className="text-xs text-emerald-200/70 py-1">
                Toca uno o más números blancos en el tablero para apartarlos a tu nombre.
              </div>
            ) : (
              <div className="flex items-baseline justify-between pt-1">
                <div className="font-mono font-bold text-xl text-amber-400 tabular-nums">
                  #{selectedNumbers.join(', #')}
                </div>
                <div className="font-mono font-bold text-lg text-white tabular-nums">
                  ${(selectedNumbers.length * config.ticketPrice).toLocaleString('es-MX')} MXN
                </div>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-950/90 border border-red-500/60 text-xs text-red-200 font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleReserveSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                Tu Nombre y Apellido *
              </label>
              <input
                type="text"
                required
                disabled={!isRaffleOpen}
                maxLength={80}
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Ej. Claudia Ramírez"
                className="w-full min-h-[48px] px-4 py-2.5 text-sm bg-[#031B12] text-white placeholder:text-emerald-600 border border-emerald-700/80 rounded-xl focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                Tu WhatsApp / Teléfono (10 dígitos) *
              </label>
              <input
                type="tel"
                required
                disabled={!isRaffleOpen}
                maxLength={20}
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="Ej. 5512345678"
                className="w-full min-h-[48px] px-4 py-2.5 text-sm font-mono bg-[#031B12] text-white placeholder:text-emerald-600 border border-emerald-700/80 rounded-xl focus:outline-none focus:border-amber-400"
              />
              <p className="text-[11px] text-emerald-300/80 mt-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                Tu número telefónico queda protegido en privado solo para el organizador.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                Método de Pago Preferido
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('transferencia')}
                  className={`min-h-[46px] py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    paymentMethod === 'transferencia'
                      ? 'bg-emerald-600 text-white border-amber-400/80 shadow-xs'
                      : 'bg-[#031B12] text-emerald-200 border-emerald-800 hover:border-emerald-600'
                  }`}
                >
                  Transferencia
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('efectivo')}
                  className={`min-h-[46px] py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    paymentMethod === 'efectivo'
                      ? 'bg-emerald-600 text-white border-amber-400/80 shadow-xs'
                      : 'bg-[#031B12] text-emerald-200 border-emerald-800 hover:border-emerald-600'
                  }`}
                >
                  Efectivo
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-100 mb-1.5">
                Mensaje de apoyo o nota (Opcional)
              </label>
              <input
                type="text"
                disabled={!isRaffleOpen}
                maxLength={150}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={`¡Mucho éxito en el torneo, ${config.playerName}!`}
                className="w-full min-h-[48px] px-4 py-2.5 text-sm bg-[#031B12] text-white placeholder:text-emerald-600 border border-emerald-700/80 rounded-xl focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || selectedNumbers.length === 0 || !isRaffleOpen}
              className="w-full min-h-[54px] py-3.5 px-5 bg-amber-400 hover:bg-amber-300 disabled:bg-emerald-950 disabled:text-emerald-600 disabled:border disabled:border-emerald-800 text-slate-950 font-bold text-sm rounded-xl transition-all active:scale-[0.98] cursor-pointer shadow-lg"
            >
              {isSubmitting
                ? 'Registrando tus boletos...'
                : selectedNumbers.length > 0
                ? `Apartar ${selectedNumbers.length} Boleto(s) · $${(
                    selectedNumbers.length * config.ticketPrice
                  ).toLocaleString('es-MX')} MXN`
                : 'Toca un número libre en el tablero'}
            </button>
          </form>

          {/* Bank Transfer Info Box */}
          {config.clabeOrCard && (
            <div className="pt-4 border-t border-emerald-800/80 space-y-2 text-xs text-emerald-200">
              <div className="font-semibold text-amber-300">
                Cuenta para Transferencia Bancaria:
              </div>
              <div className="bg-[#031B12] p-3.5 rounded-xl border border-emerald-800/80 space-y-1">
                <div>
                  Banco: <strong className="text-white">{config.bankName}</strong>
                </div>
                <div>
                  Titular: <strong className="text-white">{config.accountHolder}</strong>
                </div>
                <div className="flex items-center justify-between pt-1.5">
                  <span className="font-mono font-bold text-sm text-amber-300 tabular-nums">
                    {config.clabeOrCard}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(config.clabeOrCard, 'sidebar-clabe')}
                    className="px-2.5 py-1 bg-emerald-800/80 hover:bg-emerald-700 text-white rounded-lg font-semibold cursor-pointer"
                  >
                    {copiedField === 'sidebar-clabe' ? '¡Copiada!' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Mobile Sticky Bottom Checkout Trigger (when numbers are selected on mobile) */}
      {selectedNumbers.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-[#021710]/95 backdrop-blur-md border-t border-amber-400/40 shadow-2xl">
          <button
            type="button"
            onClick={scrollToForm}
            className="w-full min-h-[50px] px-4 py-3 bg-amber-400 text-slate-950 font-bold text-sm rounded-xl flex items-center justify-between shadow-md active:scale-[0.98]"
          >
            <span className="truncate">
              Apartar #{selectedNumbers.join(', #')} ({selectedNumbers.length})
            </span>
            <span className="font-mono font-extrabold flex items-center gap-1 shrink-0">
              ${(selectedNumbers.length * config.ticketPrice).toLocaleString('es-MX')} MXN
              <ArrowDown className="w-4 h-4" />
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
