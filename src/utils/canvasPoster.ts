import { RaffleConfig, Ticket } from '../types/raffle';

export function downloadRafflePosterPNG(config: RaffleConfig, tickets: Ticket[]) {
  const canvas = document.createElement('canvas');
  const width = 1080;
  const cols = 10;
  const rows = Math.ceil(tickets.length / cols);
  const cellH = tickets.length > 60 ? 64 : 84;
  const gap = 10;
  const gridHeight = rows * (cellH + gap);
  const height = Math.max(1380, 560 + gridHeight);

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Background Deep Stadium Pitch Green
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#064e3b');
  bgGrad.addColorStop(0.4, '#04281c');
  bgGrad.addColorStop(1, '#021710');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Pitch Markings Geometry
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.12)';
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 35, width - 80, height - 70);
  ctx.beginPath();
  ctx.arc(width / 2, 190, 130, 0, Math.PI * 2);
  ctx.stroke();

  // 2. Top Kicker in Gold
  ctx.fillStyle = '#fbbf24';
  ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RIFA DEPORTIVA CON CAUSA · LIGA NACIONAL DE FUTBOL', width / 2, 85);

  // 3. Main Title & Player / Organizer
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 44px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(config.title.toUpperCase(), width / 2, 145);

  ctx.fillStyle = '#a7f3d0';
  ctx.font = '600 25px "Plus Jakarta Sans", sans-serif';
  const orgLine = config.organizerName
    ? `Jugador: ${config.playerName}  ·  Organiza: ${config.organizerName}`
    : `Jugador: ${config.playerName}  ·  ${config.teamName}`;
  ctx.fillText(orgLine, width / 2, 190);

  // 4. Prize & Price Gold/Emerald Highlight Box
  const stripY = 225;
  const stripH = 140;
  ctx.fillStyle = 'rgba(3, 27, 18, 0.88)';
  roundRect(ctx, 60, stripY, width - 120, stripH, 20, true, false);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
  ctx.lineWidth = 2.5;
  roundRect(ctx, 60, stripY, width - 120, stripH, 20, false, true);

  const totalPrize = config.prizes.reduce((acc, p) => acc + p.amount, 0);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#fde68a';
  ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('PREMIO EN EFECTIVO', 100, stripY + 46);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '700 54px "JetBrains Mono", monospace';
  ctx.fillText(`$${totalPrize.toLocaleString('es-MX')} MXN`, 100, stripY + 110);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#a7f3d0';
  ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('PRECIO POR BOLETO', width - 100, stripY + 46);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 54px "JetBrains Mono", monospace';
  ctx.fillText(`$${config.ticketPrice} MXN`, width - 100, stripY + 110);

  // Prize breakdown line
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d1fae5';
  ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
  const prizeDetails = config.prizes
    .map((p) => `${p.label}: $${p.amount.toLocaleString('es-MX')}`)
    .join('   ·   ');
  ctx.fillText(prizeDetails, width / 2, stripY + stripH + 40);

  // 5. Grid of Numbers
  const gridTop = stripY + stripH + 68;
  const gridWidth = width - 120;
  const cellW = (gridWidth - gap * (cols - 1)) / cols;

  tickets.forEach((ticket, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = 60 + col * (cellW + gap);
    const y = gridTop + row * (cellH + gap);

    const isAvailable = ticket.status === 'available';

    if (isAvailable) {
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, x, y, cellW, cellH, 12, true, false);

      ctx.fillStyle = '#022c22';
      ctx.font = `700 ${tickets.length > 60 ? '26px' : '30px'} "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ticket.number, x + cellW / 2, y + cellH / 2);
    } else {
      ctx.fillStyle = 'rgba(2, 23, 16, 0.85)';
      roundRect(ctx, x, y, cellW, cellH, 12, true, false);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, cellW, cellH, 12, false, true);

      ctx.fillStyle = 'rgba(167, 243, 208, 0.35)';
      ctx.font = `600 ${tickets.length > 60 ? '20px' : '22px'} "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ticket.number, x + cellW / 2, y + cellH / 2 - 9);

      ctx.fillStyle = ticket.status === 'paid' ? '#34d399' : '#fbbf24';
      ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(
        ticket.status === 'paid' ? 'PAGADO' : 'APARTADO',
        x + cellW / 2,
        y + cellH / 2 + 15
      );
    }
  });

  ctx.textBaseline = 'alphabetic';

  // 6. Footer Info Strip
  const footerTop = gridTop + rows * (cellH + gap) + 34;
  const availableCount = tickets.filter((t) => t.status === 'available').length;

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fbbf24';
  ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `¡Quedan ${availableCount} boletos disponibles de ${tickets.length}! Aparta el tuyo hoy`,
    width / 2,
    footerTop
  );

  ctx.fillStyle = '#d1fae5';
  ctx.font = '500 21px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `Sorteo: ${config.drawDate}  ·  Método: ${config.drawMethod}`,
    width / 2,
    footerTop + 38
  );

  if (config.bankName || config.clabeOrCard) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 21px "JetBrains Mono", monospace';
    ctx.fillText(
      `Transferencia: ${config.bankName} · ${config.clabeOrCard} (${config.accountHolder})`,
      width / 2,
      footerTop + 74
    );
  }

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `rifa-${config.playerName.toLowerCase().replace(/\s+/g, '-')}.png`;
  link.href = dataUrl;
  link.click();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: boolean,
  stroke: boolean
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}
