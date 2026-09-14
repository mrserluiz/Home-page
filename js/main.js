document.addEventListener('DOMContentLoaded', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = document.querySelector('[data-site-header]');
  const nav = document.querySelector('[data-site-nav]');
  const toggle = document.querySelector('.nav-toggle');
  const menuLinks = [...document.querySelectorAll('.site-nav a')];
  const operationEntryLinks = [...document.querySelectorAll('[data-operations-entry]')];
  const isOperationsPage = document.body.classList.contains('operations-page');
  const insidePages = window.location.pathname.includes('/pages/');
  try {
    if (isOperationsPage) sessionStorage.setItem('exbr.operationsVisited', '1');
    const operationsVisited = sessionStorage.getItem('exbr.operationsVisited') === '1';
    const operationTarget = operationsVisited
      ? (insidePages ? 'operacoes.html' : 'pages/operacoes.html')
      : (insidePages ? '../index.html#operacoes' : '#operacoes');
    operationEntryLinks.forEach(link => { link.href = operationTarget; });
  } catch (error) {
    // Mantém o endereço original quando o armazenamento da guia não está disponível.
  }
  const navLinks = [...document.querySelectorAll('.site-nav a[href^="#"]')];
  const dockLinks = [...document.querySelectorAll('.dock-menu a[href^="#"]')];
  const sections = [...document.querySelectorAll('main section[id]')];
  let activeOverride = window.location.hash === '#comunidade' ? '#comunidade' : '';

  const setActiveSection = currentId => {
    navLinks.forEach(link => {
      if (link.getAttribute('href') === currentId) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    dockLinks.forEach(link => {
      if (link.getAttribute('href') === currentId) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  };

  if (activeOverride) setActiveSection(activeOverride);

  if (document.documentElement.classList.contains('home-first-boot')) {
    window.setTimeout(() => {
      document.documentElement.classList.remove('home-first-boot');
    }, 2500);
  }

  const startAmbientMatrix = () => {
    const storageKey = 'exbr.matrixStartedAt';
    let startedAt = Date.now();

    try {
      const stored = Number(sessionStorage.getItem(storageKey));
      if (Number.isFinite(stored) && stored > 0) startedAt = stored;
      else sessionStorage.setItem(storageKey, String(startedAt));
    } catch (error) {
      // O efeito continua sem persistência quando o armazenamento está indisponível.
    }

    const matrix = document.createElement('div');
    matrix.className = 'ambient-matrix';
    matrix.setAttribute('aria-hidden', 'true');
    document.body.prepend(matrix);

    const seeded = value => {
      const result = Math.sin(value * 9301 + 49297) * 233280;
      return result - Math.floor(result);
    };

    const buildStreams = () => {
      matrix.replaceChildren();
      const width = window.innerWidth;
      const spacing = width < 560 ? 17 : 20;
      const count = Math.min(110, Math.ceil(width / spacing) + 2);
      const elapsedSeconds = (Date.now() - startedAt) / 1000;
      const fragment = document.createDocumentFragment();

      for (let index = 0; index < count; index += 1) {
        const stream = document.createElement('span');
        const durationBase = 15 + seeded(index + 47) * 16;
        const duration = reduceMotion ? durationBase * 1.35 : durationBase;
        const phase = (elapsedSeconds + seeded(index + 21) * duration) % duration;
        const trail = 17 + Math.floor(seeded(index + 73) * 20);
        const x = index * spacing + (seeded(index + 2) - 0.5) * 9;

        stream.className = 'matrix-stream';
        stream.textContent = Array.from({ length: trail }, (_, dotIndex) => (
          seeded(index * 41 + dotIndex * 17) > 0.13 ? '•' : ' '
        )).join('\n');
        stream.style.setProperty('--matrix-x', `${x}px`);
        stream.style.setProperty('--matrix-size', `${8 + Math.floor(seeded(index + 113) * 5)}px`);
        stream.style.setProperty('--matrix-opacity', String(0.34 + seeded(index + 91) * 0.5));
        stream.style.setProperty('--matrix-duration', `${duration.toFixed(2)}s`);
        stream.style.setProperty('--matrix-delay', `${(-phase).toFixed(2)}s`);
        fragment.append(stream);
      }

      matrix.append(fragment);
    };

    let resizeFrame = 0;
    buildStreams();
    window.addEventListener('resize', () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(buildStreams);
    }, { passive: true });
  };

  startAmbientMatrix();

  const setMenu = open => {
    if (!nav || !toggle) return;
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };

  toggle?.addEventListener('click', () => {
    setMenu(toggle.getAttribute('aria-expanded') !== 'true');
  });

  menuLinks.forEach(link => {
    link.addEventListener('click', () => setMenu(false));
  });

  [...new Set([...navLinks, ...dockLinks])].forEach(link => {
    link.addEventListener('click', () => {
      const targetId = link.getAttribute('href');
      activeOverride = targetId === '#comunidade' ? targetId : '';
      setActiveSection(targetId);
    });
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setMenu(false);
  });

  document.addEventListener('click', event => {
    if (!nav?.classList.contains('is-open')) return;
    if (nav.contains(event.target) || toggle?.contains(event.target)) return;
    setMenu(false);
  });

  const updateHeader = () => {
    header?.classList.toggle('is-scrolled', window.scrollY > 24);
  };

  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    document.querySelectorAll('[data-reveal]').forEach(element => revealObserver.observe(element));

    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const currentId = `#${entry.target.id}`;
        if (activeOverride && currentId === '#operacoes') return;
        if (currentId !== '#operacoes') activeOverride = '';
        setActiveSection(currentId);
      });
    }, { rootMargin: '-35% 0px -55%', threshold: 0 });

    sections.forEach(section => sectionObserver.observe(section));
  } else {
    document.querySelectorAll('[data-reveal]').forEach(element => element.classList.add('is-visible'));
  }

  document.querySelectorAll('[data-current-year]').forEach(element => {
    element.textContent = String(new Date().getFullYear());
  });

  const homeHonuPanel = document.querySelector('[data-home-honu-status]');
  const homeHonuOnline = document.querySelector('[data-home-honu-online]');
  const homeHonuFeedback = document.querySelector('[data-home-honu-feedback]');
  if (homeHonuPanel && homeHonuOnline) {
    const endpoint = 'https://wt.honu.pw/api/outfit/37576258294147955/online';
    let request = null;
    let refreshTimer = 0;

    const loadOnlineCount = async () => {
      if (request || document.hidden) return;
      const controller = new AbortController();
      request = controller;
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      homeHonuPanel.dataset.homeHonuStatus = 'loading';
      if (homeHonuFeedback) homeHonuFeedback.textContent = 'Consultando Honu…';
      try {
        const response = await fetch(endpoint, { headers: { Accept: 'application/json' }, signal: controller.signal });
        if (!response.ok) throw new Error(`Honu respondeu com status ${response.status}`);
        const payload = await response.json();
        if (!Array.isArray(payload)) throw new Error('Formato inesperado do Honu');
        const onlineIds = new Set(payload
          .filter(player => player?.online !== false && player?.player?.online !== false)
          .map(player => String(player?.characterID || player?.characterId || player?.id || ''))
          .filter(Boolean));
        homeHonuOnline.textContent = String(onlineIds.size).padStart(2, '0');
        homeHonuPanel.dataset.homeHonuStatus = 'success';
        if (homeHonuFeedback) homeHonuFeedback.textContent = 'EXBR conectados no jogo';
      } catch (error) {
        if (homeHonuOnline.textContent === '--') homeHonuOnline.textContent = '—';
        homeHonuPanel.dataset.homeHonuStatus = 'error';
        if (homeHonuFeedback) homeHonuFeedback.textContent = 'Leitura temporariamente indisponível';
      } finally {
        window.clearTimeout(timeout);
        request = null;
      }
    };

    const startOnlineUpdates = () => {
      window.clearInterval(refreshTimer);
      if (document.hidden) return;
      loadOnlineCount();
      refreshTimer = window.setInterval(loadOnlineCount, 60000);
    };

    document.addEventListener('visibilitychange', startOnlineUpdates);
    startOnlineUpdates();
  }
});
