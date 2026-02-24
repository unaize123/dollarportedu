(() => {
  const siteLoader = document.getElementById('siteLoader');
  if (siteLoader) {
    const hideLoader = () => siteLoader.classList.add('hide');
    window.setTimeout(hideLoader, 1400);
    window.addEventListener('load', () => window.setTimeout(hideLoader, 350), { once: true });
  }

  const initLiquidityGlobe = () => {
    const canvas = document.getElementById('liquidityGlobe');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sessions = [
      { name: 'Sydney', lat: -33.9, lon: 151.2, color: '#f2d16b', base: 36 },
      { name: 'Tokyo', lat: 35.6, lon: 139.7, color: '#00ff9c', base: 58 },
      { name: 'London', lat: 51.5, lon: -0.1, color: '#f2d16b', base: 92 },
      { name: 'New York', lat: 40.7, lon: -74.0, color: '#00ff9c', base: 84 }
    ];

    const flows = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [1, 3]
    ];

    let size = 0;
    let cx = 0;
    let cy = 0;
    let r = 0;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      size = Math.max(200, Math.floor(Math.min(rect.width, rect.height) || 300));
      dpr = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = Math.floor(size * dpr);
      canvas.height = Math.floor(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = size / 2;
      cy = size / 2;
      r = size * 0.39;
    };

    const project = (lat, lon, rot) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + rot) * (Math.PI / 180);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);
      return { x: cx + x, y: cy + y, z };
    };

    const drawCurve = (a, b, colorA, colorB) => {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2 - size * 0.09;
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0, colorA);
      grad.addColorStop(1, colorB);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(mx, my, b.x, b.y);
      ctx.stroke();
    };

    const liqRows = Array.from(document.querySelectorAll('[data-session-row]'));
    const liqBars = Array.from(document.querySelectorAll('[data-liq-bar]'));
    const liqValues = Array.from(document.querySelectorAll('[data-liq-value]'));

    const updateLiquidityPanel = (timeTick) => {
      const live = sessions.map((s, idx) => {
        const wave = Math.sin(timeTick * 0.028 + idx * 1.45) * 6;
        return Math.max(20, Math.min(98, s.base + wave));
      });
      const active = Math.floor((timeTick / 55) % sessions.length);

      liqRows.forEach((row, idx) => row.classList.toggle('active', idx === active));
      liqBars.forEach((bar, idx) => {
        const v = live[idx] ?? sessions[idx]?.base ?? 50;
        bar.style.setProperty('--liq', `${v.toFixed(1)}%`);
      });
      liqValues.forEach((valueEl, idx) => {
        const v = live[idx] ?? sessions[idx]?.base ?? 50;
        valueEl.textContent = `${Math.round(v)}%`;
      });

      return live;
    };

    let tick = 0;
    const render = () => {
      tick += 0.7;
      const rot = tick * 0.42;
      const liquidityLevels = updateLiquidityPanel(tick);
      ctx.clearRect(0, 0, size, size);

      const bg = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 4, cx, cy, r * 1.15);
      bg.addColorStop(0, 'rgba(242,209,107,0.22)');
      bg.addColorStop(0.55, 'rgba(8,8,8,0.82)');
      bg.addColorStop(1, 'rgba(3,3,3,1)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
      ctx.fill();

      // Meridians
      for (let lon = -180; lon < 180; lon += 20) {
        ctx.beginPath();
        for (let lat = -80; lat <= 80; lat += 4) {
          const p = project(lat, lon, rot);
          if (lat === -80) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = 'rgba(242,209,107,0.14)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }

      // Parallels
      for (let lat = -60; lat <= 60; lat += 15) {
        ctx.beginPath();
        for (let lon = -180; lon <= 180; lon += 4) {
          const p = project(lat, lon, rot);
          if (lon === -180) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = 'rgba(0,255,156,0.1)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }

      // Session hubs + liquidity flows
      const hubs = sessions.map((s, i) => ({ ...project(s.lat, s.lon, rot), c: s.color, i }));
      flows.forEach(([ai, bi]) => {
        const a = hubs[ai];
        const b = hubs[bi];
        if (a.z < -r * 0.25 || b.z < -r * 0.25) return;
        const flowBoost = (((liquidityLevels[ai] || 50) + (liquidityLevels[bi] || 50)) / 2) / 100;
        ctx.globalAlpha = 0.55 + flowBoost * 0.45;
        drawCurve(
          a,
          b,
          ai % 2 ? 'rgba(0,255,156,0.75)' : 'rgba(242,209,107,0.72)',
          bi % 2 ? 'rgba(0,255,156,0.75)' : 'rgba(242,209,107,0.72)'
        );
        ctx.globalAlpha = 1;
      });

      hubs.forEach((h) => {
        if (h.z < -r * 0.25) return;
        const liq = (liquidityLevels[h.i] || 50) / 100;
        const pulse = 1 + Math.sin((tick + h.i * 24) * 0.08) * (0.16 + liq * 0.25);
        ctx.beginPath();
        ctx.arc(h.x, h.y, (1.8 + liq * 2.4) * pulse, 0, Math.PI * 2);
        ctx.fillStyle = h.c;
        ctx.fill();
      });

      // Orbiting liquidity scanner
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((tick * 0.02) % (Math.PI * 2));
      const scan = ctx.createLinearGradient(0, -r, 0, r);
      scan.addColorStop(0, 'rgba(0,255,156,0)');
      scan.addColorStop(0.45, 'rgba(0,255,156,0.04)');
      scan.addColorStop(0.5, 'rgba(242,209,107,0.16)');
      scan.addColorStop(0.55, 'rgba(0,255,156,0.04)');
      scan.addColorStop(1, 'rgba(0,255,156,0)');
      ctx.fillStyle = scan;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(242,209,107,0.35)';
      ctx.lineWidth = 1.1;
      ctx.stroke();

      window.requestAnimationFrame(render);
    };

    resize();
    window.addEventListener('resize', resize);
    render();
  };

  initLiquidityGlobe();

  const revealItems = Array.from(
    document.querySelectorAll('main section, .glass-card, .panel, .stat-card')
  );

  revealItems.forEach((item, index) => {
    item.classList.add('will-reveal');
    item.style.setProperty('--reveal-delay', `${Math.min(index * 35, 320)}ms`);
  });
  document.body.classList.add('js-ready');

  if ('IntersectionObserver' in window && revealItems.length) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('revealed'));
  }

  const menuBtn = document.getElementById('menuBtn');
  const mobileMenu = document.getElementById('mobileMenu');

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }

  const leadForms = Array.from(document.querySelectorAll('form[data-lead-form]'));
  const leadResultOverlay = document.getElementById('leadResultOverlay');
  const leadResultKicker = document.getElementById('leadResultKicker');
  const leadResultTitle = document.getElementById('leadResultTitle');
  const leadResultText = document.getElementById('leadResultText');
  const leadResultClose = document.getElementById('leadResultClose');

  const setLeadResultContent = (ok) => {
    if (!leadResultOverlay || !leadResultKicker || !leadResultTitle || !leadResultText) return;
    if (ok) {
      leadResultOverlay.classList.remove('is-error');
      leadResultKicker.textContent = 'Signal Confirmed';
      leadResultTitle.textContent = 'Thank You. Your Request Is Locked In.';
      leadResultText.textContent = 'Our mentorship team will contact you shortly with your course placement plan.';
      return;
    }

    leadResultOverlay.classList.add('is-error');
    leadResultKicker.textContent = 'Execution Failed';
    leadResultTitle.textContent = 'Submission Did Not Go Through';
    leadResultText.textContent = 'Please retry in a moment. If this continues, check mail configuration and try again.';
  };

  const openLeadResult = (ok) => {
    if (!leadResultOverlay) return;
    setLeadResultContent(ok);
    leadResultOverlay.classList.remove('hidden');
    leadResultOverlay.setAttribute('aria-hidden', 'false');
  };

  const closeLeadResult = () => {
    if (!leadResultOverlay) return;
    leadResultOverlay.classList.add('hidden');
    leadResultOverlay.setAttribute('aria-hidden', 'true');
  };

  if (leadResultClose) {
    leadResultClose.addEventListener('click', closeLeadResult);
  }
  if (leadResultOverlay) {
    leadResultOverlay.addEventListener('click', (e) => {
      if (e.target === leadResultOverlay) closeLeadResult();
    });
  }

  leadForms.forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.textContent : '';
      if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
      }

      const formData = new FormData(form);
      if (!String(formData.get('sourcePage') || '').trim()) {
        formData.set('sourcePage', window.location.pathname || '/');
      }
      if (!String(formData.get('leadType') || '').trim()) {
        formData.set('leadType', 'general_inquiry');
      }

      const query = new URLSearchParams(window.location.search);
      const utmMappings = [
        ['utm_source', 'utmSource'],
        ['utm_medium', 'utmMedium'],
        ['utm_campaign', 'utmCampaign']
      ];
      utmMappings.forEach(([utmKey, fieldKey]) => {
        const value = query.get(utmKey);
        if (value && !String(formData.get(fieldKey) || '').trim()) {
          formData.set(fieldKey, value);
        }
      });

      const payload = new URLSearchParams(formData);
      const endpoint = form.getAttribute('action') || '/leads';
      let ok = false;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: payload.toString()
        });
        ok = response.ok;
      } catch (error) {
        ok = false;
      } finally {
        if (submitBtn instanceof HTMLButtonElement) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
      }

      if (ok) {
        form.reset();
        const select = form.querySelector('select[name="courseInterest"]');
        if (select instanceof HTMLSelectElement) {
          select.selectedIndex = 0;
        }
        const hiddenCourse = form.querySelector('input[name="courseInterest"][type="hidden"]');
        if (hiddenCourse instanceof HTMLInputElement) {
          hiddenCourse.value = 'Online Session';
          document.querySelectorAll('.lead-course-chip').forEach((chip, index) => {
            chip.classList.toggle('active', index === 0);
          });
        }
      }

      openLeadResult(ok);
    });
  });

  const byId = (id) => document.getElementById(id);

  const initSimulation = () => {
    const pairEl = byId('pair');
    const buyBtn = byId('buyBtn');
    const sellBtn = byId('sellBtn');
    const closeTradeBtn = byId('closeTradeBtn');
    const lotSizeEl = byId('lotSize');
    const pnlElement = byId('pnl');
    const balanceElement = byId('balance');
    const livePriceEl = byId('livePrice');
    const spreadInfoEl = byId('spreadInfo');
    const positionInfoEl = byId('positionInfo');
    const entryPriceEl = byId('entryPrice');
    const currentPriceEl = byId('currentPrice');
    const pipMoveEl = byId('pipMove');
    const chartCanvas = byId('simChart');
    const chartWrap = byId('chartArea');
    if (!pairEl || !buyBtn || !sellBtn || !pnlElement || !balanceElement) return;

    const cfg = {
      'EUR/USD': { mid: 1.0842, spread: 1.2, tick: 0.0001, vol: 0.00022, pipValue: 10, digits: 5 },
      'GBP/USD': { mid: 1.2710, spread: 1.6, tick: 0.0001, vol: 0.0003, pipValue: 10, digits: 5 },
      'USD/JPY': { mid: 149.22, spread: 1.4, tick: 0.01, vol: 0.03, pipValue: 9.2, digits: 3 },
      'XAU/USD': { mid: 2034.5, spread: 18, tick: 0.1, vol: 0.9, pipValue: 1, digits: 2 }
    };

    let balance = 10000;
    let currentPair = pairEl.value;
    let state = { ...cfg[currentPair] };
    let position = null;
    let livePnl = 0;
    let tickCount = 0;
    let candle = { o: state.mid, h: state.mid, l: state.mid, c: state.mid };
    const candles = Array.from({ length: 48 }, () => ({ ...candle }));

    const formatPrice = (value) => value.toFixed(state.digits);
    const bid = () => state.mid - (state.spread * state.tick) / 2;
    const ask = () => state.mid + (state.spread * state.tick) / 2;

    const resizeChart = () => {
      if (!chartCanvas || !chartWrap) return;
      const rect = chartWrap.getBoundingClientRect();
      const dpr = Math.max(window.devicePixelRatio || 1, 1);
      chartCanvas.width = Math.floor(rect.width * dpr);
      chartCanvas.height = Math.floor(rect.height * dpr);
      chartCanvas.style.width = `${Math.floor(rect.width)}px`;
      chartCanvas.style.height = `${Math.floor(rect.height)}px`;
    };

    const drawChart = () => {
      if (!chartCanvas) return;
      const ctx = chartCanvas.getContext('2d');
      if (!ctx) return;
      const dpr = Math.max(window.devicePixelRatio || 1, 1);
      const w = chartCanvas.width / dpr;
      const h = chartCanvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const highs = candles.map((c) => c.h);
      const lows = candles.map((c) => c.l);
      const max = Math.max(...highs);
      const min = Math.min(...lows);
      const range = Math.max(max - min, state.tick * 6);
      const xStep = w / candles.length;

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 5; i += 1) {
        const y = (h / 5) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      candles.forEach((c, i) => {
        const x = i * xStep + xStep * 0.5;
        const yo = h - ((c.o - min) / range) * h;
        const yc = h - ((c.c - min) / range) * h;
        const yh = h - ((c.h - min) / range) * h;
        const yl = h - ((c.l - min) / range) * h;
        const up = c.c >= c.o;
        ctx.strokeStyle = up ? 'rgba(0,255,156,0.9)' : 'rgba(242,209,107,0.95)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, yh);
        ctx.lineTo(x, yl);
        ctx.stroke();

        const bw = Math.max(3, xStep * 0.58);
        ctx.fillStyle = up ? 'rgba(0,255,156,0.78)' : 'rgba(242,209,107,0.82)';
        ctx.fillRect(x - bw / 2, Math.min(yo, yc), bw, Math.max(1.4, Math.abs(yc - yo)));
      });
    };

    const resetUiForPair = () => {
      if (livePriceEl) livePriceEl.textContent = formatPrice(state.mid);
      if (spreadInfoEl) spreadInfoEl.textContent = `${state.spread.toFixed(1)} pips`;
      if (positionInfoEl) positionInfoEl.textContent = 'No active trade';
      if (entryPriceEl) entryPriceEl.textContent = '-';
      if (currentPriceEl) currentPriceEl.textContent = '-';
      if (pipMoveEl) pipMoveEl.textContent = '0.0';
      if (pnlElement) {
        pnlElement.textContent = '$0.00';
        pnlElement.className = 'mt-2 text-3xl font-bold text-gray-100';
      }
      position = null;
      livePnl = 0;
      candle = { o: state.mid, h: state.mid, l: state.mid, c: state.mid };
      candles.splice(0, candles.length, ...Array.from({ length: 48 }, () => ({ ...candle })));
      drawChart();
    };

    const updatePosition = () => {
      if (!position) return;
      const mark = position.side === 'buy' ? bid() : ask();
      const delta = position.side === 'buy' ? mark - position.entry : position.entry - mark;
      const pips = delta / state.tick;
      livePnl = pips * state.pipValue * position.lots;
      if (positionInfoEl) positionInfoEl.textContent = `${position.side.toUpperCase()} ${currentPair} | ${position.lots.toFixed(2)} lots`;
      if (entryPriceEl) entryPriceEl.textContent = formatPrice(position.entry);
      if (currentPriceEl) currentPriceEl.textContent = formatPrice(mark);
      if (pipMoveEl) pipMoveEl.textContent = pips.toFixed(1);
      if (pnlElement) {
        pnlElement.textContent = `$${livePnl.toFixed(2)}`;
        pnlElement.className = `mt-2 text-3xl font-bold ${livePnl >= 0 ? 'text-dpGreen' : 'text-red-400'}`;
      }
    };

    const openTrade = (side) => {
      if (position) return;
      const lots = Math.max(0.01, Number(lotSizeEl?.value || 0.1));
      position = {
        side,
        lots,
        entry: side === 'buy' ? ask() : bid()
      };
      updatePosition();
    };

    const closeTrade = () => {
      if (!position) return;
      balance += livePnl;
      if (balanceElement) balanceElement.textContent = `$${balance.toFixed(2)}`;
      position = null;
      livePnl = 0;
      if (positionInfoEl) positionInfoEl.textContent = 'No active trade';
      if (entryPriceEl) entryPriceEl.textContent = '-';
      if (currentPriceEl) currentPriceEl.textContent = '-';
      if (pipMoveEl) pipMoveEl.textContent = '0.0';
      if (pnlElement) {
        pnlElement.textContent = '$0.00';
        pnlElement.className = 'mt-2 text-3xl font-bold text-gray-100';
      }
    };

    buyBtn.addEventListener('click', () => openTrade('buy'));
    sellBtn.addEventListener('click', () => openTrade('sell'));
    closeTradeBtn?.addEventListener('click', closeTrade);

    pairEl.addEventListener('change', () => {
      currentPair = pairEl.value;
      state = { ...cfg[currentPair] };
      resetUiForPair();
    });

    window.addEventListener('resize', resizeChart);
    resizeChart();
    resetUiForPair();
    if (balanceElement) balanceElement.textContent = `$${balance.toFixed(2)}`;

    window.setInterval(() => {
      const drift = (Math.random() - 0.5) * state.vol;
      state.mid = Math.max(state.tick, state.mid + drift);

      candle.h = Math.max(candle.h, state.mid);
      candle.l = Math.min(candle.l, state.mid);
      candle.c = state.mid;
      tickCount += 1;

      if (tickCount % 6 === 0) {
        candles.push({ ...candle });
        if (candles.length > 52) candles.shift();
        candle = { o: state.mid, h: state.mid, l: state.mid, c: state.mid };
      }

      if (livePriceEl) livePriceEl.textContent = formatPrice(state.mid);
      updatePosition();
      drawChart();
    }, 900);
  };

  initSimulation();

  const marketState = {
    EURUSD: 1.0842,
    GBPUSD: 1.2710,
    USDJPY: 149.22,
    XAUUSD: 2034.5,
    USDCHF: 0.8820,
    AUDUSD: 0.6624
  };

  const formatPrice = (symbol, value) => {
    if (symbol === 'USDJPY') {
      return value.toFixed(2);
    }
    if (symbol === 'XAUUSD') {
      return value.toFixed(1);
    }
    return value.toFixed(4);
  };

  const marketEls = Array.from(document.querySelectorAll('[data-price]'));
  if (marketEls.length) {
    window.setInterval(() => {
      Object.keys(marketState).forEach((symbol) => {
        const baseMove = symbol === 'XAUUSD' ? 0.35 : symbol === 'USDJPY' ? 0.08 : 0.0007;
        const delta = (Math.random() - 0.5) * baseMove;
        const next = marketState[symbol] + delta;
        marketState[symbol] = Number(next.toFixed(symbol === 'XAUUSD' ? 1 : symbol === 'USDJPY' ? 2 : 4));

        document.querySelectorAll(`[data-price="${symbol}"]`).forEach((el) => {
          el.textContent = formatPrice(symbol, marketState[symbol]);
          el.classList.remove('up', 'down');
          el.classList.add(delta >= 0 ? 'up' : 'down');
        });
      });
    }, 2600);
  }

  const leadCtaBtn = document.getElementById('leadCtaBtn');
  const leadModal = document.getElementById('leadModal');
  const leadModalClose = document.getElementById('leadModalClose');
  const leadCourseGrid = document.getElementById('leadCourseGrid');
  const leadCourseInterest = document.getElementById('leadCourseInterest');

  const openLeadModal = () => {
    if (!leadModal) return;
    leadModal.classList.remove('hidden');
    leadModal.setAttribute('aria-hidden', 'false');
  };

  const closeLeadModal = () => {
    if (!leadModal) return;
    leadModal.classList.add('hidden');
    leadModal.setAttribute('aria-hidden', 'true');
  };

  if (leadCtaBtn) {
    leadCtaBtn.addEventListener('click', openLeadModal);
  }
  if (leadModalClose) {
    leadModalClose.addEventListener('click', closeLeadModal);
  }
  if (leadModal) {
    leadModal.addEventListener('click', (e) => {
      if (e.target === leadModal) closeLeadModal();
    });
  }
  if (leadCourseGrid && leadCourseInterest) {
    leadCourseGrid.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains('lead-course-chip')) return;
      const course = target.getAttribute('data-course');
      if (!course) return;
      leadCourseInterest.value = course;
      leadCourseGrid.querySelectorAll('.lead-course-chip').forEach((chip) => chip.classList.remove('active'));
      target.classList.add('active');
    });
  }

  const botToggle = document.getElementById('botToggle');
  const botPanel = document.getElementById('botPanel');
  const botClose = document.getElementById('botClose');
  const botForm = document.getElementById('botForm');
  const botInput = document.getElementById('botInput');
  const botMessages = document.getElementById('botMessages');

  const addBotMsg = (text, type = 'ai') => {
    if (!botMessages) return;
    const div = document.createElement('div');
    div.className = `bot-msg ${type === 'user' ? 'bot-msg-user' : 'bot-msg-ai'}`;
    div.textContent = text;
    botMessages.appendChild(div);
    botMessages.scrollTop = botMessages.scrollHeight;
  };

  const botReply = (q) => {
    const msg = q.toLowerCase();
    if (msg.includes('course')) return 'PipMentor AI: Start with Beginner Forex Foundations, then Technical Analysis, then Risk Management for consistency.';
    if (msg.includes('risk')) return 'PipMentor AI: Keep risk between 1% and 2% per trade, define stop loss first, then position size.';
    if (msg.includes('session') || msg.includes('london') || msg.includes('new york')) return 'PipMentor AI: Best liquidity is London-New York overlap. Tokyo is moderate. Sydney is usually lower volatility.';
    if (msg.includes('sim') || msg.includes('practice')) return 'PipMentor AI: Practice one setup in Simulation for 20 trades, journal outcomes, then refine your rules.';
    if (msg.includes('tool') || msg.includes('calculator')) return 'PipMentor AI: Use Tools page for lot size, pip, risk, and P/L. Plan every trade before entry.';
    if (msg.includes('broker') || msg.includes('mt4') || msg.includes('mt5')) return 'PipMentor AI: Compare regulation, spread model, and withdrawal reliability in the Broker Guide before choosing.';
    if (msg.includes('contact') || msg.includes('enroll') || msg.includes('join')) return 'PipMentor AI: Open Contact / Enroll or tap Book Free Mentorship Call, and our team will reach out.';
    return 'PipMentor AI: I can guide you on courses, risk control, sessions, simulation, tools, broker choice, and enrollment.';
  };

  if (botToggle && botPanel) {
    botToggle.addEventListener('click', () => botPanel.classList.toggle('hidden'));
  }
  if (botClose && botPanel) {
    botClose.addEventListener('click', () => botPanel.classList.add('hidden'));
  }
  if (botForm && botInput) {
    botForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = botInput.value.trim();
      if (!q) return;
      addBotMsg(q, 'user');
      botInput.value = '';
      window.setTimeout(() => addBotMsg(botReply(q), 'ai'), 280);
    });
  }

  document.querySelectorAll('[data-calc]').forEach((button) => {
    button.addEventListener('click', () => {
      const calc = button.getAttribute('data-calc');

      if (calc === 'lot') {
        const account = Number(byId('lotAccount')?.value || 0);
        const risk = Number(byId('lotRisk')?.value || 0) / 100;
        const stop = Number(byId('lotStop')?.value || 1);
        const lot = (account * risk) / (stop * 10 || 1);
        byId('lotResult').textContent = `Result: ${lot.toFixed(2)} lots`;
      }

      if (calc === 'pip') {
        const lots = Number(byId('pipLot')?.value || 0);
        const move = Number(byId('pipPair')?.value || 0);
        const pipValue = lots * move * 10;
        byId('pipResult').textContent = `Result: $${pipValue.toFixed(2)}`;
      }

      if (calc === 'risk') {
        const balanceInput = Number(byId('riskBalance')?.value || 0);
        const riskInput = Number(byId('riskPercent')?.value || 0) / 100;
        const riskAmount = balanceInput * riskInput;
        byId('riskResult').textContent = `Result: $${riskAmount.toFixed(2)} at risk`;
      }

      if (calc === 'pl') {
        const entry = Number(byId('plEntry')?.value || 0);
        const exit = Number(byId('plExit')?.value || 0);
        const lots = Number(byId('plLots')?.value || 0);
        const profitLoss = (exit - entry) * 10000 * lots;
        byId('plResult').textContent = `Result: $${profitLoss.toFixed(2)}`;
      }
    });
  });
})();
