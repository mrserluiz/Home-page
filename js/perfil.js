import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { auth, db } from './firebase-client.js';
import { applyMedalImage, normalizeMedalIcon } from './medal-images.js?v=20260911-1';
import { AVATAR_CATALOG, AVATAR_GROUPS, DEFAULT_AVATAR_ID, avatarSource, normalizeAvatarId } from './avatar-catalog.js?v=20260912-1';
import { BANNER_CATALOG, DEFAULT_BANNER_ID, bannerSource, normalizeBannerId } from './banner-catalog.js?v=20260912-1';

document.addEventListener('DOMContentLoaded', () => {
  const card = document.querySelector('[data-profile-card]');
  const identityZone = document.querySelector('.identity-zone');
  const avatarImage = document.querySelector('[data-member-avatar]');
  const avatarOptionsContainer = document.querySelector('[data-avatar-options]');
  AVATAR_GROUPS.forEach(groupName => {
    const groupAvatars = AVATAR_CATALOG.filter(avatar => avatar.group === groupName);
    if (!groupAvatars.length || !avatarOptionsContainer) return;
    const group = document.createElement('section');
    group.className = 'avatar-option-group';
    group.setAttribute('aria-label', groupName);
    const label = document.createElement('strong');
    label.className = 'avatar-option-group-label';
    label.textContent = groupName;
    const items = document.createElement('div');
    items.className = 'avatar-option-group-items';
    groupAvatars.forEach(avatar => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.avatarOption = '';
      button.dataset.avatar = avatar.id;
      button.dataset.avatarName = avatar.name;
      button.dataset.avatarSrc = avatarSource(avatar.id);
      button.title = avatar.name;
      button.setAttribute('aria-label', avatar.name);
      button.setAttribute('aria-pressed', String(avatar.id === DEFAULT_AVATAR_ID));
      const image = document.createElement('img');
      image.src = avatarSource(avatar.id, 'thumb');
      image.alt = '';
      image.loading = 'lazy';
      button.append(image);
      items.append(button);
    });
    group.append(label, items);
    avatarOptionsContainer.append(group);
  });
  let avatarOptions = [...document.querySelectorAll('[data-avatar-option]')];
  const avatarSlideButtons = [...document.querySelectorAll('[data-avatar-slide]')];
  const bannerOptionsContainer = document.querySelector('[data-banner-options]');
  BANNER_CATALOG.forEach(banner => {
    if (!bannerOptionsContainer) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.bannerOption = '';
    button.dataset.banner = banner.id;
    button.dataset.bannerName = banner.name;
    button.dataset.bannerSrc = bannerSource(banner.id);
    button.title = banner.name;
    button.setAttribute('aria-label', banner.name);
    button.setAttribute('aria-pressed', String(banner.id === DEFAULT_BANNER_ID));
    const image = document.createElement('img');
    image.src = bannerSource(banner.id, 'thumb');
    image.alt = '';
    image.loading = 'lazy';
    const number = document.createElement('small');
    number.textContent = String(BANNER_CATALOG.indexOf(banner) + 1).padStart(2, '0');
    button.append(image, number);
    bannerOptionsContainer.append(button);
  });
  const bannerOptions = [...document.querySelectorAll('[data-banner-option]')];
  const bannerSlideButtons = [...document.querySelectorAll('[data-banner-slide]')];
  const classOptions = [...document.querySelectorAll('[data-class-option]')];
  const factionOptions = [...document.querySelectorAll('[data-faction-option]')];
  const favoriteClass = document.querySelector('[data-favorite-class]');
  const favoriteFaction = document.querySelector('[data-favorite-faction]');
  const memberBio = document.querySelector('[data-member-bio]');
  const bioInput = document.querySelector('[data-member-bio-input]');
  const bioSave = document.querySelector('[data-member-bio-save]');
  const feedback = document.querySelector('[data-profile-feedback]');
  const editToggle = document.querySelector('[data-profile-edit-toggle]');
  const editLabel = document.querySelector('[data-profile-edit-label]');
  const customizer = document.querySelector('#profile-customizer');
  const memberName = document.querySelector('[data-member-name]');
  const memberRank = document.querySelector('[data-member-rank]');
  const memberRole = document.querySelector('[data-member-role]');
  const memberStatus = document.querySelector('[data-member-status]');
  const commandBar = document.querySelector('[data-member-command-bar]');
  const adminAccess = document.querySelector('[data-admin-access]');
  const logoutButtons = [...document.querySelectorAll('[data-logout]')];
  const medalsList = document.querySelector('[data-medals-list]');
  const medalsLabel = document.querySelector('[data-medals-label]');
  const featuredHint = document.querySelector('[data-featured-hint]');
  const featuredCount = document.querySelector('[data-featured-count]');
  const memberOperationsList = document.querySelector('[data-member-operations-list]');
  const medalDetail = document.querySelector('[data-medal-detail]');
  const medalDetailClose = document.querySelector('[data-medal-detail-close]');
  const medalDetailVisual = document.querySelector('.medal-detail-visual');
  const medalDetailName = document.querySelector('[data-medal-detail-name]');
  const medalDetailImage = document.querySelector('[data-medal-detail-image]');
  const medalDetailDescription = document.querySelector('[data-medal-detail-description]');
  const medalDetailOperation = document.querySelector('[data-medal-detail-operation]');
  const medalDetailDate = document.querySelector('[data-medal-detail-date]');
  const medalDetailActions = document.querySelector('[data-medal-detail-actions]');
  const medalDetailFeature = document.querySelector('[data-medal-detail-feature]');
  const profileMedalAdd = document.querySelector('[data-profile-medal-add]');
  const profileMedalCatalog = document.querySelector('[data-profile-medal-catalog]');
  const profileMedalCatalogClose = document.querySelector('[data-profile-medal-catalog-close]');
  const profileMedalSearch = document.querySelector('[data-profile-medal-search]');
  const profileMedalCatalogGrid = document.querySelector('[data-profile-medal-catalog-grid]');
  const profileMedalCatalogFeedback = document.querySelector('[data-profile-medal-catalog-feedback]');
  const profileMedalOperation = document.querySelector('[data-profile-medal-operation]');
  const profileMedalDate = document.querySelector('[data-profile-medal-date]');
  const honuProfileAdmin = document.querySelector('[data-honu-profile-admin]');
  const honuAdminOpen = document.querySelector('[data-honu-admin-open]');
  const honuAdminClose = document.querySelector('[data-honu-admin-close]');
  const honuLinkForm = document.querySelector('[data-honu-link-form]');
  const honuCharacterInput = document.querySelector('[data-honu-character-id]');
  const honuLinkSave = document.querySelector('[data-honu-link-save]');
  const honuLinkFeedback = document.querySelector('[data-honu-link-feedback]');
  const honuAccountList = document.querySelector('[data-honu-account-list]');
  const honuLifetimeKills = document.querySelector('[data-honu-lifetime-kills]');
  const honuDailyDate = document.querySelector('[data-honu-daily-date]');
  const honuDailyKills = document.querySelector('[data-honu-daily-kills]');
  const honuDailyDeaths = document.querySelector('[data-honu-daily-deaths]');
  const honuDailyAssists = document.querySelector('[data-honu-daily-assists]');
  const honuStatsFeedback = document.querySelector('[data-honu-stats-feedback]');
  const honuCombatPanel = document.querySelector('.member-combat-panel');
  const honuCombatSummary = document.querySelector('.member-combat-summary');

  if (!card || !avatarImage) return;

  let avatars = new Map(avatarOptions.map(option => [option.dataset.avatar, option]));
  const banners = new Map(bannerOptions.map(option => [option.dataset.banner, option]));
  const classes = new Map(classOptions.map(option => [option.dataset.classOption, option]));
  const factions = new Map(factionOptions.map(option => [option.dataset.factionOption, option]));
  const requestedUid = new URLSearchParams(window.location.search).get('uid');
  let currentUser = null;
  let currentProfile = null;
  let currentProfileUid = null;
  let viewerProfile = null;
  let isOwner = false;
  let ranks = new Map();
  let medalDefinitions = new Map();
  let currentMedals = [];
  let needsFeaturedMigration = false;
  let feedbackTimer = 0;
  let editVisibilityTimer = 0;
  let activeDetailMedal = null;
  let honuStatsRequestVersion = 0;

  const HONU_ORIGIN = 'https://wt.honu.pw';
  const HONU_OUTFIT_ID = '37576258294147955';

  const medalDate = medal => medal.operationDate?.toDate?.().toLocaleDateString('pt-BR') || medal.operationDate || 'Data não informada';
  const localDateInputValue = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  const classNames = {
    infiltrador: 'Infiltrador',
    'assalto-leve': 'Assalto leve',
    medico: 'Médico de combate',
    engenheiro: 'Engenheiro',
    'assalto-pesado': 'Assalto pesado',
    max: 'MAX'
  };
  const factionNames = { tr: 'Terran Republic', nc: 'New Conglomerate', vs: 'Vanu Sovereignty', nso: 'Nanite Systems Operatives' };
  const honuFactionKeys = { 1: 'vs', 2: 'nc', 3: 'tr', 4: 'nso' };

  const effectiveMedal = medal => {
    const definition = medalDefinitions.get(medal.catalogId);
    return definition ? {
      ...medal,
      name: definition.nome || medal.name,
      description: definition.description || medal.description,
      iconUrl: definition.iconUrl || medal.iconUrl
    } : medal;
  };

  const publicMedal = storedMedal => {
    const medal = effectiveMedal(storedMedal);
    return {
      catalogId: medal.catalogId || '',
      name: medal.name || 'Medalha EXBR',
      description: medal.description || '',
      operationName: medal.operationName || 'Operação EXBR',
      operationDate: medal.operationDate || null,
      iconUrl: normalizeMedalIcon(medal.iconUrl)
    };
  };

  const loadMedalDefinitions = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'medalCatalog'));
      medalDefinitions = new Map(snapshot.docs.map(item => [item.id, item.data()]));
    } catch (error) {
      medalDefinitions = new Map();
    }
  };

  const publicActivity = participation => ({
    operationId: participation.operationId || participation.id || '',
    title: participation.title || 'Operação EXBR',
    status: participation.status || 'confirmed',
    startsAt: participation.startsAt || null,
    joinedAt: participation.joinedAt || null
  });

  const featuredMedalsFrom = medals => {
    const ids = currentProfile?.featuredMedalIds || [];
    const byId = new Map(medals.map(medal => [medal.id, medal]));
    return ids.map(id => byId.get(id)).filter(Boolean).slice(0, 5);
  };

  const refreshFeaturedCount = () => {
    if (featuredCount) featuredCount.textContent = `${Math.min(currentProfile?.featuredMedalIds?.length || 0, 5)}/5`;
  };

  const fillMedalDetail = (medal, definition = {}) => {
    const name = definition.nome || medal.name || 'Medalha EXBR';
    const description = definition.description || medal.description || 'Condecoração oficial concedida pela EXBR.';
    if (medalDetailName) medalDetailName.textContent = name;
    if (medalDetailDescription) medalDetailDescription.textContent = description;
    if (medalDetailOperation) medalDetailOperation.textContent = medal.operationName || 'Operação EXBR';
    if (medalDetailDate) medalDetailDate.textContent = medalDate(medal);
    if (medalDetailImage) {
      applyMedalImage(medalDetailImage, definition.iconUrl || medal.iconUrl, `Imagem ampliada da medalha ${name}`);
    }
    const highlighted = currentProfile?.featuredMedalIds?.includes(medal.id) || false;
    if (medalDetailActions) medalDetailActions.hidden = !isOwner;
    if (medalDetailFeature) {
      medalDetailFeature.textContent = highlighted ? 'Medalha favoritada ★' : 'Favoritar medalha ☆';
      medalDetailFeature.dataset.selected = String(highlighted);
      medalDetailFeature.setAttribute('aria-pressed', String(highlighted));
    }
  };

  const openMedalDetail = async medal => {
    if (!medalDetail) return;
    activeDetailMedal = medal;
    fillMedalDetail(medal);
    medalDetail.showModal();
    if (!medal.catalogId) return;
    try {
      const snapshot = await getDoc(doc(db, 'medalCatalog', medal.catalogId));
      if (snapshot.exists() && medalDetail.open) fillMedalDetail(medal, snapshot.data());
    } catch (error) {
      // Mantém os dados gravados na concessão quando o catálogo estiver indisponível.
    }
  };

  const desktopMedalZoom = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 769px)');
  const resetMedalZoom = () => {
    if (!medalDetailVisual) return;
    medalDetailVisual.classList.remove('is-zooming');
    medalDetailVisual.style.setProperty('--zoom-x', '50%');
    medalDetailVisual.style.setProperty('--zoom-y', '50%');
  };

  medalDetailVisual?.addEventListener('pointerenter', () => {
    if (desktopMedalZoom.matches) medalDetailVisual.classList.add('is-zooming');
  });
  medalDetailVisual?.addEventListener('pointermove', event => {
    if (!desktopMedalZoom.matches) return;
    const bounds = medalDetailVisual.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100));
    medalDetailVisual.style.setProperty('--zoom-x', `${x}%`);
    medalDetailVisual.style.setProperty('--zoom-y', `${y}%`);
  });
  medalDetailVisual?.addEventListener('pointerleave', resetMedalZoom);

  medalDetailClose?.addEventListener('click', () => medalDetail?.close());
  medalDetail?.addEventListener('close', resetMedalZoom);
  medalDetail?.addEventListener('click', event => {
    if (event.target === medalDetail) medalDetail.close();
  });

  const announce = (message, persistent = false) => {
    if (!feedback) return;
    window.clearTimeout(feedbackTimer);
    feedback.textContent = message;
    if (!persistent) {
      feedbackTimer = window.setTimeout(() => {
        feedback.textContent = 'Configuração vinculada à sua conta EXBR.';
      }, 2400);
    }
  };

  const extractHonuCharacterId = value => {
    const normalized = String(value || '').trim();
    if (/^\d{16,20}$/.test(normalized)) return normalized;
    return normalized.match(/(?:\/c\/|character\/)(\d{16,20})(?:\D|$)/i)?.[1] || '';
  };

  const honuCharactersFrom = profile => {
    if (Array.isArray(profile?.honuCharacters)) {
      return profile.honuCharacters
        .filter(character => /^\d{16,20}$/.test(String(character?.id || '')))
        .map(character => ({
          id: String(character.id),
          name: String(character.name || 'Personagem'),
          worldId: Number(character.worldId || 0),
          factionId: Number(character.factionId || 0),
          outfitId: String(character.outfitId || ''),
          linkedAt: character.linkedAt || null,
          linkedBy: String(character.linkedBy || '')
        }));
    }
    if (!profile?.honuCharacterId) return [];
    return [{
      id: String(profile.honuCharacterId),
      name: String(profile.honuCharacterName || 'Personagem'),
      worldId: Number(profile.honuWorldId || 0),
      factionId: Number(profile.honuFactionId || 0),
      outfitId: String(profile.honuOutfitId || ''),
      linkedAt: profile.honuLinkedAt || null,
      linkedBy: String(profile.honuLinkedBy || '')
    }];
  };

  const primaryHonuFields = characters => {
    const primary = characters[0];
    if (!primary) {
      return {
        honuCharacterId: deleteField(),
        honuCharacterName: deleteField(),
        honuWorldId: deleteField(),
        honuFactionId: deleteField(),
        honuOutfitId: deleteField(),
        honuLinkedAt: deleteField(),
        honuLinkedBy: deleteField()
      };
    }
    return {
      honuCharacterId: primary.id,
      honuCharacterName: primary.name,
      honuWorldId: primary.worldId,
      honuFactionId: primary.factionId,
      honuOutfitId: primary.outfitId,
      honuLinkedAt: primary.linkedAt || Timestamp.now(),
      honuLinkedBy: primary.linkedBy || currentUser?.uid || ''
    };
  };

  const renderHonuLinks = profile => {
    const isAdminViewer = viewerProfile?.role === 'admin';
    if (honuAdminOpen) honuAdminOpen.hidden = !isAdminViewer;
    if (!isAdminViewer) {
      if (honuProfileAdmin?.open) honuProfileAdmin.close();
      return;
    }

    const characters = honuCharactersFrom(profile);
    if (honuAccountList) {
      honuAccountList.replaceChildren();
      if (!characters.length) {
        const empty = document.createElement('div');
        empty.className = 'honu-account-empty';
        empty.textContent = 'Nenhuma conta Honu associada a este membro.';
        honuAccountList.append(empty);
      }
      characters.forEach((character, index) => {
        const item = document.createElement('article');
        item.className = 'honu-account-item';
        const copy = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = character.name;
        const id = document.createElement('span');
        id.textContent = `${index === 0 ? 'PRINCIPAL // ' : ''}ID ${character.id}`;
        const outfit = document.createElement('small');
        outfit.dataset.state = character.outfitId === HONU_OUTFIT_ID ? 'exbr' : 'external';
        outfit.textContent = character.outfitId === HONU_OUTFIT_ID ? 'Outfit EXBR confirmada' : 'Fora da Outfit EXBR no momento';
        copy.append(name, id, outfit);
        const actions = document.createElement('div');
        const link = document.createElement('a');
        link.href = `${HONU_ORIGIN}/c/${encodeURIComponent(character.id)}`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Abrir ↗';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.dataset.honuAccountRemove = character.id;
        remove.textContent = 'Remover';
        actions.append(link, remove);
        item.append(copy, actions);
        honuAccountList.append(item);
      });
    }
    if (honuLinkFeedback && honuLinkFeedback.dataset.state !== 'error') {
      honuLinkFeedback.textContent = characters.length
        ? `${characters.length} conta${characters.length === 1 ? '' : 's'} vinculada${characters.length === 1 ? '' : 's'} a este perfil.`
        : 'Nenhuma conta vinculada.';
      honuLinkFeedback.dataset.state = characters.length ? 'success' : 'idle';
    }
  };

  const fetchHonuCharacter = async characterId => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`${HONU_ORIGIN}/api/character/${encodeURIComponent(characterId)}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        mode: 'cors',
        signal: controller.signal
      });
      if (response.status === 204) throw new Error('Personagem não encontrado no Honu.');
      if (!response.ok) throw new Error(`O Honu respondeu com status ${response.status}.`);
      const character = await response.json();
      if (String(character?.id || '') !== characterId || !character?.name) throw new Error('O Honu não confirmou este personagem.');
      return character;
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const fetchHonuCharacterStats = async characterId => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${HONU_ORIGIN}/api/character/${encodeURIComponent(characterId)}/stats`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Honu respondeu com status ${response.status}.`);
      const stats = await response.json();
      if (!Array.isArray(stats)) throw new Error('O Honu retornou estatísticas em formato inesperado.');
      return stats;
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const totalHonuStat = (statCollections, names, field) => {
    const acceptedNames = new Set(names);
    const matching = statCollections.flat().filter(stat => acceptedNames.has(String(stat?.statName || '').toLowerCase()));
    return {
      found: matching.length > 0,
      value: matching.reduce((total, stat) => total + (Number(stat?.[field]) || 0), 0)
    };
  };

  const displayHonuStat = (element, stat) => {
    if (!element) return;
    element.textContent = stat.found ? Math.max(0, Math.round(stat.value)).toLocaleString('pt-BR') : '—';
  };

  const loadHonuProfileData = async profile => {
    const requestVersion = ++honuStatsRequestVersion;
    const characters = honuCharactersFrom(profile);
    if (honuDailyDate) honuDailyDate.textContent = new Intl.DateTimeFormat('pt-BR').format(new Date());

    const primaryFactionKey = honuFactionKeys[Number(characters[0]?.factionId || 0)];
    if (primaryFactionKey) {
      const faction = factions.get(primaryFactionKey);
      renderFavoriteMarker(
        favoriteFaction,
        faction?.dataset.symbol || '◇',
        'Facção',
        factionNames[primaryFactionKey],
        faction?.dataset.icon || ''
      );
    }

    if (!characters.length) {
      [honuLifetimeKills, honuDailyKills, honuDailyDeaths, honuDailyAssists].forEach(element => {
        if (element) element.textContent = '—';
      });
      if (honuStatsFeedback) honuStatsFeedback.textContent = 'Vincule uma conta Honu para carregar a telemetria.';
      if (honuCombatPanel) honuCombatPanel.dataset.state = 'idle';
      if (honuCombatSummary) honuCombatSummary.dataset.state = 'idle';
      return;
    }

    [honuLifetimeKills, honuDailyKills, honuDailyDeaths, honuDailyAssists].forEach(element => {
      if (element) element.textContent = '--';
    });
    if (honuStatsFeedback) honuStatsFeedback.textContent = `Somando ${characters.length} conta${characters.length === 1 ? '' : 's'} vinculada${characters.length === 1 ? '' : 's'}…`;
    if (honuCombatPanel) honuCombatPanel.dataset.state = 'loading';
    if (honuCombatSummary) honuCombatSummary.dataset.state = 'loading';

    const results = await Promise.allSettled(characters.map(character => fetchHonuCharacterStats(character.id)));
    if (requestVersion !== honuStatsRequestVersion) return;
    const statCollections = results.filter(result => result.status === 'fulfilled').map(result => result.value);
    const failedCount = results.length - statCollections.length;

    if (!statCollections.length) {
      [honuLifetimeKills, honuDailyKills, honuDailyDeaths, honuDailyAssists].forEach(element => {
        if (element) element.textContent = '—';
      });
      if (honuStatsFeedback) honuStatsFeedback.textContent = 'A telemetria do Honu está temporariamente indisponível.';
      if (honuCombatPanel) honuCombatPanel.dataset.state = 'error';
      if (honuCombatSummary) honuCombatSummary.dataset.state = 'error';
      return;
    }

    displayHonuStat(honuLifetimeKills, totalHonuStat(statCollections, ['kills'], 'valueForever'));
    displayHonuStat(honuDailyKills, totalHonuStat(statCollections, ['kills'], 'valueDaily'));
    displayHonuStat(honuDailyDeaths, totalHonuStat(statCollections, ['deaths'], 'valueDaily'));
    displayHonuStat(honuDailyAssists, totalHonuStat(statCollections, ['assists', 'assist', 'kill_assists', 'kill_assist', 'assist_count'], 'valueDaily'));
    if (honuStatsFeedback) {
      honuStatsFeedback.textContent = failedCount
        ? `${statCollections.length} de ${characters.length} contas atualizadas; o Honu não respondeu para ${failedCount}.`
        : `Dados reais somados de ${characters.length} conta${characters.length === 1 ? '' : 's'} vinculada${characters.length === 1 ? '' : 's'}.`;
    }
    if (honuCombatPanel) honuCombatPanel.dataset.state = failedCount ? 'partial' : 'success';
    if (honuCombatSummary) honuCombatSummary.dataset.state = failedCount ? 'partial' : 'success';
  };

  honuAdminOpen?.addEventListener('click', () => {
    if (viewerProfile?.role !== 'admin' || !honuProfileAdmin) return;
    if (honuLinkFeedback) delete honuLinkFeedback.dataset.state;
    renderHonuLinks(currentProfile);
    honuProfileAdmin.showModal();
    window.setTimeout(() => honuCharacterInput?.focus(), 0);
  });
  honuAdminClose?.addEventListener('click', () => honuProfileAdmin?.close());
  honuProfileAdmin?.addEventListener('click', event => {
    if (event.target === honuProfileAdmin) honuProfileAdmin.close();
  });

  honuLinkForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (viewerProfile?.role !== 'admin' || !currentProfileUid || !currentUser) return;
    const characterId = extractHonuCharacterId(honuCharacterInput?.value);
    if (!characterId) {
      if (honuLinkFeedback) {
        honuLinkFeedback.textContent = 'Informe um ID numérico válido ou cole o link do personagem no Honu.';
        honuLinkFeedback.dataset.state = 'error';
      }
      honuCharacterInput?.focus();
      return;
    }

    if (honuLinkSave) honuLinkSave.disabled = true;
    if (honuLinkFeedback) {
      honuLinkFeedback.textContent = 'Validando personagem no Honu…';
      honuLinkFeedback.dataset.state = 'loading';
    }
    try {
      const character = await fetchHonuCharacter(characterId);
      const characters = honuCharactersFrom(currentProfile);
      if (characters.some(entry => entry.id === characterId)) throw new Error('Este personagem já está vinculado ao perfil.');
      const linkedCharacter = {
        id: characterId,
        name: String(character.name),
        worldId: Number(character.worldID || 0),
        factionId: Number(character.factionID || 0),
        outfitId: String(character.outfitID || ''),
        linkedAt: Timestamp.now(),
        linkedBy: currentUser.uid
      };
      const nextCharacters = [...characters, linkedCharacter];
      await updateDoc(doc(db, 'users', currentProfileUid), {
        honuCharacters: nextCharacters,
        ...primaryHonuFields(nextCharacters),
        updatedAt: serverTimestamp()
      });
      currentProfile.honuCharacters = nextCharacters;
      Object.assign(currentProfile, primaryHonuFields(nextCharacters));
      if (honuCharacterInput) honuCharacterInput.value = '';
      renderHonuLinks(currentProfile);
      loadHonuProfileData(currentProfile);
      const outfitWarning = String(character.outfitID || '') === HONU_OUTFIT_ID ? '' : ' O personagem não consta na Outfit EXBR neste momento.';
      if (honuLinkFeedback) {
        honuLinkFeedback.textContent = `${character.name} adicionado com sucesso.${outfitWarning}`;
        honuLinkFeedback.dataset.state = 'success';
      }
      announce(`Personagem ${character.name} vinculado ao perfil.`);
    } catch (error) {
      if (honuLinkFeedback) {
        honuLinkFeedback.textContent = error?.name === 'AbortError'
          ? 'O Honu demorou para responder. Tente novamente.'
          : error?.message || 'Não foi possível validar o personagem.';
        honuLinkFeedback.dataset.state = 'error';
      }
    } finally {
      if (honuLinkSave) honuLinkSave.disabled = false;
    }
  });

  honuAccountList?.addEventListener('click', async event => {
    const removeButton = event.target.closest('[data-honu-account-remove]');
    if (!removeButton || viewerProfile?.role !== 'admin' || !currentProfileUid) return;
    const characters = honuCharactersFrom(currentProfile);
    const selected = characters.find(character => character.id === removeButton.dataset.honuAccountRemove);
    if (!selected) return;
    const characterName = selected.name || selected.id;
    if (!window.confirm(`Remover o vínculo de ${characterName} deste perfil?`)) return;
    removeButton.disabled = true;
    try {
      const nextCharacters = characters.filter(character => character.id !== selected.id);
      await updateDoc(doc(db, 'users', currentProfileUid), {
        honuCharacters: nextCharacters,
        ...primaryHonuFields(nextCharacters),
        updatedAt: serverTimestamp()
      });
      currentProfile.honuCharacters = nextCharacters;
      if (nextCharacters.length) {
        Object.assign(currentProfile, primaryHonuFields(nextCharacters));
      } else {
        ['honuCharacterId', 'honuCharacterName', 'honuWorldId', 'honuFactionId', 'honuOutfitId', 'honuLinkedAt', 'honuLinkedBy']
          .forEach(field => delete currentProfile[field]);
      }
      renderHonuLinks(currentProfile);
      loadHonuProfileData(currentProfile);
      if (honuLinkFeedback) honuLinkFeedback.textContent = `${characterName} removido do perfil.`;
      announce('Vínculo do personagem removido.');
    } catch (error) {
      if (honuLinkFeedback) {
        honuLinkFeedback.textContent = 'Não foi possível remover o vínculo.';
        honuLinkFeedback.dataset.state = 'error';
      }
    } finally {
      removeButton.disabled = false;
    }
  });

  const loadRanks = async () => {
    try {
      const response = await fetch('../data/patentes.json');
      const data = await response.json();
      ranks = new Map(data.patentes.map(rank => [rank.id, rank.nome]));
    } catch (error) {
      ranks = new Map([['soldado', 'Soldado']]);
    }
  };

  const applyAvatar = (option, animate = true) => {
    if (!option) return;
    const name = option.dataset.avatarName;
    const source = option.dataset.avatarSrc;
    if (animate) card.classList.add('is-changing');
    window.setTimeout(() => {
      avatarImage.src = source;
      avatarImage.alt = `Avatar selecionado: soldado da classe ${name}`;
      avatarOptions.forEach(button => button.setAttribute('aria-pressed', String(button === option)));
      card.classList.remove('is-changing');
    }, animate ? 180 : 0);
  };

  avatarSlideButtons.forEach(button => button.addEventListener('click', () => {
    if (!avatarOptionsContainer) return;
    const direction = Number(button.dataset.avatarSlide) || 1;
    avatarOptionsContainer.scrollBy({
      left: direction * Math.max(280, avatarOptionsContainer.clientWidth * 0.82),
      behavior: 'smooth'
    });
  }));

  bannerSlideButtons.forEach(button => button.addEventListener('click', () => {
    if (!bannerOptionsContainer) return;
    const direction = Number(button.dataset.bannerSlide) || 1;
    bannerOptionsContainer.scrollBy({
      left: direction * Math.max(260, bannerOptionsContainer.clientWidth * 0.86),
      behavior: 'smooth'
    });
  }));

  const applyBanner = option => {
    if (!option) return;
    const bannerId = normalizeBannerId(option.dataset.banner);
    card.dataset.banner = bannerId;
    card.style.setProperty('--profile-banner-image', `url("${option.dataset.bannerSrc || bannerSource(bannerId)}")`);
    bannerOptions.forEach(button => button.setAttribute('aria-pressed', String(button === option)));
  };

  const renderFavoriteMarker = (marker, symbol, label, name, iconUrl = '') => {
    if (!marker) return;
    const icon = marker.querySelector('span');
    const caption = marker.querySelector('small');
    if (icon) {
      if (iconUrl) {
        const image = document.createElement('img');
        image.src = iconUrl;
        image.alt = '';
        icon.replaceChildren(image);
      } else {
        const image = document.createElement('img');
        image.src = '../assets/icons/dock/recrutamento.png';
        image.alt = '';
        icon.replaceChildren(image);
      }
    }
    if (caption) {
      const captionText = name || label;
      const captionSize = captionText.length > 22 ? 0.22 : captionText.length > 16 ? 0.24 : captionText.length > 11 ? 0.27 : 0.42;
      caption.textContent = captionText;
      caption.style.setProperty('--marker-caption-size', `${captionSize}rem`);
    }
    marker.title = name ? `${label} favorita: ${name}` : `${label} favorita não definida`;
    marker.dataset.active = String(Boolean(name));
  };

  const savePreference = async (field, value, successMessage) => {
    if (!currentUser || !currentProfileUid || !isOwner) return;
    announce('Sincronizando perfil…', true);
    try {
      const profileUpdate = { [field]: value, updatedAt: serverTimestamp() };
      if (['bio', 'favoriteClass', 'favoriteFaction'].includes(field)) {
        profileUpdate.bio = currentProfile.bio || '';
        profileUpdate.favoriteClass = currentProfile.favoriteClass || '';
        profileUpdate.favoriteFaction = currentProfile.favoriteFaction || '';
        profileUpdate[field] = value;
      }
      await updateDoc(doc(db, 'users', currentProfileUid), {
        ...profileUpdate
      });
      currentProfile[field] = value;
      try {
        await setDoc(doc(db, 'publicProfiles', currentProfileUid), {
          [field]: value,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        // A preferência privada permanece salva mesmo se o espelho público estiver indisponível.
      }
      announce(successMessage);
    } catch (error) {
      announce('Não foi possível salvar esta alteração.', true);
    }
  };

  const profileAvatarId = profile => {
    const avatarId = profile?.avatarId || DEFAULT_AVATAR_ID;
    return (profile?.premiumAvatarIds || []).includes(avatarId) ? avatarId : normalizeAvatarId(avatarId);
  };

  const loadAuthorizedPremiumAvatars = async profile => {
    avatarOptionsContainer?.querySelector('[data-premium-group="true"]')?.remove();
    avatarOptions = [...document.querySelectorAll('[data-avatar-option]')];
    avatars = new Map(avatarOptions.map(option => [option.dataset.avatar, option]));
    const authorizedIds = Array.isArray(profile?.premiumAvatarIds) ? profile.premiumAvatarIds : [];
    if (!authorizedIds.length || !avatarOptionsContainer) return;

    try {
      const snapshot = await getDocs(collection(db, 'premiumAvatarCatalog'));
      const definitions = snapshot.docs
        .map(item => ({ id: item.id, ...item.data() }))
        .filter(avatar => authorizedIds.includes(avatar.id) && avatar.imageUrl)
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
      if (!definitions.length) return;

      const group = document.createElement('section');
      group.className = 'avatar-option-group';
      group.dataset.premiumGroup = 'true';
      group.setAttribute('aria-label', 'Premium');
      const label = document.createElement('strong');
      label.className = 'avatar-option-group-label';
      label.textContent = 'Premium';
      const items = document.createElement('div');
      items.className = 'avatar-option-group-items';

      definitions.forEach(avatar => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.avatarOption = '';
        button.dataset.premium = 'true';
        button.dataset.avatar = avatar.id;
        button.dataset.avatarName = avatar.name || 'Avatar premium';
        button.dataset.avatarSrc = avatar.imageUrl;
        button.title = avatar.name || 'Avatar premium';
        button.setAttribute('aria-label', avatar.name || 'Avatar premium');
        button.setAttribute('aria-pressed', 'false');
        const image = document.createElement('img');
        image.src = avatar.imageUrl;
        image.alt = '';
        image.loading = 'lazy';
        button.append(image);
        button.addEventListener('click', () => {
          if (!isOwner) return;
          applyAvatar(button);
          savePreference('avatarId', avatar.id, `${avatar.name || 'Avatar premium'} selecionado.`);
        });
        items.append(button);
      });
      group.append(label, items);
      avatarOptionsContainer.append(group);
      avatarOptions = [...document.querySelectorAll('[data-avatar-option]')];
      avatars = new Map(avatarOptions.map(option => [option.dataset.avatar, option]));
    } catch (error) {
      // O perfil continua utilizável com os avatares públicos quando o catálogo premium estiver indisponível.
    }
  };

  avatarOptions.forEach(option => option.addEventListener('click', () => {
    if (!isOwner) return;
    applyAvatar(option);
    savePreference('avatarId', option.dataset.avatar, `Soldado ${option.dataset.avatarName} selecionado.`);
  }));

  bannerOptions.forEach(option => option.addEventListener('click', () => {
    if (!isOwner) return;
    applyBanner(option);
    savePreference('bannerId', option.dataset.banner, `${option.dataset.bannerName} selecionado.`);
  }));

  classOptions.forEach(option => option.addEventListener('click', () => {
    if (!isOwner) return;
    const value = option.dataset.classOption;
    classOptions.forEach(button => button.setAttribute('aria-pressed', String(button === option)));
    renderFavoriteMarker(favoriteClass, option.dataset.symbol, 'Classe', classNames[value], option.dataset.icon);
    savePreference('favoriteClass', value, `${classNames[value]} definida como classe favorita.`);
  }));

  factionOptions.forEach(option => option.addEventListener('click', () => {
    if (!isOwner) return;
    const value = option.dataset.factionOption;
    factionOptions.forEach(button => button.setAttribute('aria-pressed', String(button === option)));
    renderFavoriteMarker(favoriteFaction, option.dataset.symbol, 'Facção', factionNames[value], option.dataset.icon);
    savePreference('favoriteFaction', value, `${factionNames[value]} definida como facção favorita.`);
  }));

  bioSave?.addEventListener('click', async () => {
    if (!isOwner || !bioInput) return;
    const value = bioInput.value.trim().slice(0, 220);
    bioSave.disabled = true;
    if (memberBio) memberBio.textContent = value || 'Nenhuma transmissão pessoal registrada.';
    await savePreference('bio', value, 'Transmissão pessoal atualizada.');
    bioSave.disabled = false;
  });

  const hideOwnerControls = () => {
    window.clearTimeout(editVisibilityTimer);
    if (customizer) customizer.hidden = true;
    if (editToggle) {
      editToggle.hidden = true;
      editToggle.setAttribute('aria-expanded', 'false');
    }
    if (editLabel) editLabel.textContent = 'Editar perfil';
  };

  const refreshEditTimer = () => {
    if (!isOwner || editToggle?.hidden) return;
    window.clearTimeout(editVisibilityTimer);
    editVisibilityTimer = window.setTimeout(hideOwnerControls, 30000);
  };

  const revealOwnerControls = () => {
    if (!isOwner || !editToggle) return;
    editToggle.hidden = false;
    refreshEditTimer();
  };

  avatarImage.addEventListener('click', revealOwnerControls);
  avatarImage.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    revealOwnerControls();
    editToggle?.focus();
  });
  identityZone?.addEventListener('pointerdown', refreshEditTimer);
  identityZone?.addEventListener('keydown', refreshEditTimer);

  editToggle?.addEventListener('click', () => {
    if (!customizer || !isOwner) return;
    const willOpen = editToggle.getAttribute('aria-expanded') !== 'true';
    editToggle.setAttribute('aria-expanded', String(willOpen));
    customizer.hidden = !willOpen;
    if (editLabel) editLabel.textContent = willOpen ? 'Fechar edição' : 'Editar perfil';
    refreshEditTimer();
    if (willOpen) customizer.querySelector('button')?.focus({ preventScroll: true });
  });

  logoutButtons.forEach(button => button.addEventListener('click', async event => {
    event.preventDefault();
    button.disabled = true;
    await signOut(auth);
    window.location.replace('login.html');
  }));

  const toggleFeaturedMedal = async (medal, control) => {
    if (!isOwner || !currentProfile || !currentProfileUid) return;
    const ids = [...(currentProfile.featuredMedalIds || [])];
    const index = ids.indexOf(medal.id);
    if (index < 0 && ids.length >= 5) {
      announce('Você já escolheu cinco medalhas. Remova uma para trocar.', true);
      return;
    }
    if (index >= 0) ids.splice(index, 1);
    else ids.push(medal.id);
    if (control) control.disabled = true;
    try {
      await updateDoc(doc(db, 'users', currentProfileUid), { featuredMedalIds: ids, updatedAt: serverTimestamp() });
      currentProfile.featuredMedalIds = ids;
      await setDoc(doc(db, 'publicProfiles', currentProfileUid), {
        featuredMedals: featuredMedalsFrom(currentMedals).map(publicMedal),
        updatedAt: serverTimestamp()
      }, { merge: true });
      refreshFeaturedCount();
      renderMedals(currentMedals);
      if (medalDetail?.open && activeDetailMedal?.id === medal.id) fillMedalDetail(medal);
      announce(index >= 0 ? 'Medalha removida dos destaques.' : 'Medalha adicionada aos destaques.');
    } catch (error) {
      if (control) control.disabled = false;
      announce('Não foi possível atualizar os destaques.', true);
    }
  };

  medalDetailFeature?.addEventListener('click', () => {
    if (activeDetailMedal) toggleFeaturedMedal(activeDetailMedal, medalDetailFeature);
  });

  const renderProfileMedalCatalog = () => {
    if (!profileMedalCatalogGrid) return;
    const term = profileMedalSearch?.value.trim().toLocaleLowerCase('pt-BR') || '';
    const definitions = [...medalDefinitions.entries()]
      .map(([id, definition]) => ({ id, ...definition }))
      .filter(medal => `${medal.nome || ''} ${medal.description || ''}`.toLocaleLowerCase('pt-BR').includes(term))
      .sort((first, second) => (first.nome || '').localeCompare(second.nome || '', 'pt-BR'));
    profileMedalCatalogGrid.replaceChildren();

    definitions.forEach(medal => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'profile-medal-catalog-item';
      button.title = medal.nome || 'Medalha EXBR';
      button.setAttribute('aria-label', `Conceder ${medal.nome || 'Medalha EXBR'}`);
      const image = document.createElement('img');
      applyMedalImage(image, medal.iconUrl, medal.nome || 'Medalha EXBR');
      const add = document.createElement('span');
      add.setAttribute('aria-hidden', 'true');
      add.textContent = '+';
      button.append(image, add);
      button.addEventListener('click', async () => {
        if (!currentProfileUid || viewerProfile?.role !== 'admin') return;
        const dateValue = profileMedalDate?.value || localDateInputValue();
        button.disabled = true;
        if (profileMedalCatalogFeedback) profileMedalCatalogFeedback.textContent = `Concedendo ${medal.nome || 'medalha'}…`;
        try {
          await addDoc(collection(db, 'users', currentProfileUid, 'medals'), {
            catalogId: medal.id,
            name: medal.nome || 'Medalha EXBR',
            description: medal.description || '',
            operationName: profileMedalOperation?.value.trim() || 'Operação EXBR',
            operationDate: Timestamp.fromDate(new Date(`${dateValue}T12:00:00`)),
            iconUrl: normalizeMedalIcon(medal.iconUrl),
            awardedAt: serverTimestamp()
          });
          await loadMedals(currentProfileUid);
          button.disabled = false;
          if (profileMedalCatalogFeedback) profileMedalCatalogFeedback.textContent = `${medal.nome || 'Medalha'} adicionada ao perfil.`;
          announce(`${medal.nome || 'Medalha'} adicionada ao perfil.`);
        } catch (error) {
          button.disabled = false;
          if (profileMedalCatalogFeedback) profileMedalCatalogFeedback.textContent = 'Não foi possível conceder esta medalha.';
        }
      });
      profileMedalCatalogGrid.append(button);
    });

    const inventorySize = Math.max(18, Math.ceil(definitions.length / 9) * 9);
    for (let index = definitions.length; index < inventorySize; index += 1) {
      const empty = document.createElement('span');
      empty.className = 'profile-medal-catalog-empty';
      empty.setAttribute('aria-hidden', 'true');
      profileMedalCatalogGrid.append(empty);
    }
  };

  profileMedalSearch?.addEventListener('input', renderProfileMedalCatalog);
  profileMedalAdd?.addEventListener('click', () => {
    if (!profileMedalCatalog || viewerProfile?.role !== 'admin') return;
    if (profileMedalDate) profileMedalDate.value = localDateInputValue();
    renderProfileMedalCatalog();
    profileMedalCatalog.showModal();
    profileMedalSearch?.focus({ preventScroll: true });
  });
  profileMedalCatalogClose?.addEventListener('click', () => profileMedalCatalog?.close());
  profileMedalCatalog?.addEventListener('click', event => {
    if (event.target === profileMedalCatalog) profileMedalCatalog.close();
  });

  const renderMedals = medals => {
    if (!medalsList) return;
    currentMedals = medals;
    medalsList.replaceChildren();
    if (medalsLabel) medalsLabel.textContent = medals.length ? 'Registro oficial' : 'Aguardando condecorações';
    if (!medals.length) {
      const empty = document.createElement('li');
      empty.className = 'medals-empty';
      empty.innerHTML = '<span aria-hidden="true">◇</span><strong>Nenhuma medalha registrada</strong><small>Participe das operações oficiais da EXBR.</small>';
      medalsList.append(empty);
      return;
    }

    medals.forEach(storedMedal => {
      const medal = effectiveMedal(storedMedal);
      const item = document.createElement('li');
      item.className = 'medal-entry';
      item.dataset.medalName = medal.name || 'Medalha EXBR';
      const icon = document.createElement('span');
      icon.className = 'medal-icon';
      icon.setAttribute('aria-hidden', 'true');
      const image = document.createElement('img');
      applyMedalImage(image, medal.iconUrl);
      icon.classList.add('has-image');
      icon.append(image);
      const name = medal.name || 'Medalha EXBR';
      const open = document.createElement('button');
      open.className = 'medal-open';
      open.type = 'button';
      open.title = name;
      open.setAttribute('aria-label', `Ver detalhes de ${name}`);
      open.append(icon);
      open.addEventListener('click', () => openMedalDetail(medal));
      item.append(open);

      if (isOwner) {
        item.classList.add('can-feature');
        const highlighted = currentProfile?.featuredMedalIds?.includes(medal.id) || false;
        const feature = document.createElement('button');
        feature.className = 'medal-feature';
        feature.type = 'button';
        feature.textContent = highlighted ? '★' : '☆';
        feature.dataset.selected = String(highlighted);
        feature.setAttribute('aria-pressed', String(highlighted));
        feature.setAttribute('aria-label', `${highlighted ? 'Remover' : 'Adicionar'} ${name} ${highlighted ? 'dos' : 'aos'} destaques`);
        feature.addEventListener('click', () => toggleFeaturedMedal(medal, feature));
        item.append(feature);
      }

      if (viewerProfile?.role === 'admin') {
        item.classList.add('can-manage');
        const remove = document.createElement('button');
        remove.className = 'medal-remove';
        remove.type = 'button';
        remove.textContent = '×';
        remove.setAttribute('aria-label', `Remover ${name} de ${memberName?.textContent || 'membro'}`);
        remove.addEventListener('click', async () => {
          if (!currentProfileUid || !window.confirm(`Remover a medalha ${name} deste perfil?`)) return;
          remove.disabled = true;
          try {
            await deleteDoc(doc(db, 'users', currentProfileUid, 'medals', medal.id));
            const remainingMedals = await loadMedals(currentProfileUid);
            const featuredIds = (currentProfile.featuredMedalIds || []).filter(id => id !== medal.id);
            if (featuredIds.length !== (currentProfile.featuredMedalIds || []).length) {
              await updateDoc(doc(db, 'users', currentProfileUid), { featuredMedalIds: featuredIds, updatedAt: serverTimestamp() });
              currentProfile.featuredMedalIds = featuredIds;
              refreshFeaturedCount();
            }
            await setDoc(doc(db, 'publicProfiles', currentProfileUid), {
              featuredMedals: featuredMedalsFrom(remainingMedals).map(publicMedal),
              updatedAt: serverTimestamp()
            }, { merge: true });
            announce(`${name} removida do perfil.`);
          } catch (error) {
            remove.disabled = false;
            announce('Não foi possível remover esta medalha.', true);
          }
        });
        item.append(remove);
      }
      medalsList.append(item);
    });

    const inventorySize = Math.max(9, Math.ceil(medals.length / 3) * 3);
    for (let index = medals.length; index < inventorySize; index += 1) {
      const empty = document.createElement('li');
      empty.className = 'medal-slot-empty';
      empty.setAttribute('aria-hidden', 'true');
      medalsList.append(empty);
    }
  };

  const loadMedals = async uid => {
    try {
      const snapshot = await getDocs(collection(db, 'users', uid, 'medals'));
      const medals = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      medals.sort((a, b) => (b.operationDate?.seconds || 0) - (a.operationDate?.seconds || 0));
      renderMedals(medals);
      return medals;
    } catch (error) {
      renderMedals([]);
      if (medalsLabel) medalsLabel.textContent = 'Registro indisponível';
      return [];
    }
  };

  const renderParticipations = participations => {
    if (!memberOperationsList) return;
    memberOperationsList.replaceChildren();
    if (!participations.length) {
      const empty = document.createElement('p');
      empty.className = 'member-operations-empty';
      empty.textContent = 'Nenhuma participação registrada.';
      memberOperationsList.append(empty);
      return;
    }

    participations.forEach(participation => {
      const item = document.createElement('a');
      item.className = 'member-operation-entry';
      item.href = `operacoes.html#${encodeURIComponent(participation.operationId)}`;
      const title = document.createElement('strong');
      title.textContent = participation.title || 'Operação EXBR';
      const status = document.createElement('span');
      const date = participation.startsAt?.toDate?.().toLocaleString('pt-BR') || 'Data em definição';
      status.textContent = `${participation.status === 'confirmed' ? 'Participação confirmada' : 'Registrada'} · ${date}`;
      item.append(title, status);
      memberOperationsList.append(item);
    });
  };

  const loadParticipations = async uid => {
    try {
      const snapshot = await getDocs(collection(db, 'users', uid, 'participations'));
      const participations = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      participations.sort((a, b) => (b.joinedAt?.seconds || 0) - (a.joinedAt?.seconds || 0));
      renderParticipations(participations);
      return participations;
    } catch (error) {
      renderParticipations([]);
      return [];
    }
  };

  const syncPublicProfile = async (medals, participations) => {
    if (!isOwner || !currentProfileUid || !currentProfile) return;
    await setDoc(doc(db, 'publicProfiles', currentProfileUid), {
      displayName: currentProfile.displayName || 'Membro EXBR',
      rankId: currentProfile.rankId || 'soldado',
      avatarId: profileAvatarId(currentProfile),
      premiumAvatarIds: Array.isArray(currentProfile.premiumAvatarIds) ? currentProfile.premiumAvatarIds : [],
      bannerId: normalizeBannerId(currentProfile.bannerId || DEFAULT_BANNER_ID),
      bio: currentProfile.bio || '',
      favoriteClass: currentProfile.favoriteClass || '',
      favoriteFaction: currentProfile.favoriteFaction || '',
      featuredMedals: featuredMedalsFrom(medals).map(publicMedal),
      recentActivities: participations.slice(0, 3).map(publicActivity),
      updatedAt: serverTimestamp()
    }, { merge: true });
  };

  const ensureProfile = async user => {
    const reference = doc(db, 'users', user.uid);
    const snapshot = await getDoc(reference);
    if (snapshot.exists()) {
      const stored = snapshot.data();
      needsFeaturedMigration = !Object.hasOwn(stored, 'featuredMedalIds');
      const profile = { bio: '', favoriteClass: '', favoriteFaction: '', featuredMedalIds: [], premiumAvatarIds: [], ...stored };
      if (!Object.hasOwn(stored, 'bio') || !Object.hasOwn(stored, 'favoriteClass') || !Object.hasOwn(stored, 'favoriteFaction') || !Object.hasOwn(stored, 'premiumAvatarIds') || needsFeaturedMigration) {
        try {
          await updateDoc(reference, {
            bio: profile.bio,
            favoriteClass: profile.favoriteClass,
            favoriteFaction: profile.favoriteFaction,
            featuredMedalIds: profile.featuredMedalIds,
            premiumAvatarIds: profile.premiumAvatarIds,
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          // Mantém compatibilidade enquanto as novas regras ainda não foram publicadas.
        }
      }
      return profile;
    }
    const displayName = user.displayName || user.email?.split('@')[0] || 'Membro EXBR';
    const profile = {
      email: user.email || '',
      displayName,
      role: 'member',
      rankId: 'soldado',
      avatarId: DEFAULT_AVATAR_ID,
      bannerId: DEFAULT_BANNER_ID,
      bio: '',
      favoriteClass: '',
      favoriteFaction: '',
      featuredMedalIds: [],
      premiumAvatarIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    try {
      await setDoc(reference, profile);
    } catch (error) {
      const { bio, favoriteClass, favoriteFaction, featuredMedalIds, premiumAvatarIds, ...legacyProfile } = profile;
      await setDoc(reference, legacyProfile);
    }
    return { ...profile, createdAt: null, updatedAt: null };
  };

  const renderProfile = profile => {
    const role = profile.role === 'admin' ? 'admin' : 'member';
    if (memberName) memberName.textContent = (profile.displayName || 'Membro EXBR').toUpperCase();
    if (memberRank) {
      memberRank.textContent = ranks.get(profile.rankId) || 'Soldado';
      memberRank.dataset.rankId = profile.rankId || 'soldado';
    }
    if (memberRole) {
      memberRole.textContent = role === 'admin' ? 'Administrador' : 'Membro';
      memberRole.dataset.role = role;
    }
    if (memberStatus) memberStatus.textContent = isOwner ? 'Perfil ativo' : 'Registro consultado';
    if (featuredHint) featuredHint.hidden = !isOwner;
    if (profileMedalAdd) profileMedalAdd.hidden = viewerProfile?.role !== 'admin';
    refreshFeaturedCount();
    document.body.dataset.userRole = viewerProfile?.role === 'admin' ? 'admin' : 'member';
    applyAvatar(avatars.get(profileAvatarId(profile)) || avatars.get(DEFAULT_AVATAR_ID) || avatarOptions[0], false);
    applyBanner(banners.get(normalizeBannerId(profile.bannerId)) || banners.get(DEFAULT_BANNER_ID) || bannerOptions[0]);
    const selectedClass = classes.get(profile.favoriteClass);
    const selectedFaction = factions.get(profile.favoriteFaction);
    classOptions.forEach(option => option.setAttribute('aria-pressed', String(option === selectedClass)));
    factionOptions.forEach(option => option.setAttribute('aria-pressed', String(option === selectedFaction)));
    renderFavoriteMarker(favoriteClass, selectedClass?.dataset.symbol || '◇', 'Classe', classNames[profile.favoriteClass], selectedClass?.dataset.icon || '');
    renderFavoriteMarker(favoriteFaction, selectedFaction?.dataset.symbol || '◇', 'Facção', factionNames[profile.favoriteFaction], selectedFaction?.dataset.icon || '');
    if (memberBio) memberBio.textContent = profile.bio?.trim() || 'Nenhuma transmissão pessoal registrada.';
    if (bioInput) bioInput.value = profile.bio || '';
    renderHonuLinks(profile);
    loadHonuProfileData(profile);

    if (isOwner) {
      avatarImage.setAttribute('role', 'button');
      avatarImage.setAttribute('tabindex', '0');
      avatarImage.setAttribute('aria-label', 'Mostrar opções de edição do perfil');
    } else {
      avatarImage.removeAttribute('role');
      avatarImage.removeAttribute('tabindex');
      avatarImage.removeAttribute('aria-label');
      hideOwnerControls();
    }
  };

  loadRanks().then(() => {
    onAuthStateChanged(auth, async user => {
      if (!user) {
        window.location.replace('login.html');
        return;
      }

      currentUser = user;
      try {
        viewerProfile = await ensureProfile(user);
        await loadMedalDefinitions();
        const viewingAnotherProfile = Boolean(requestedUid && requestedUid !== user.uid);
        currentProfileUid = viewingAnotherProfile ? requestedUid : user.uid;
        isOwner = currentProfileUid === user.uid;
        if (viewingAnotherProfile) {
          const collectionName = viewerProfile.role === 'admin' ? 'users' : 'publicProfiles';
          const targetSnapshot = await getDoc(doc(db, collectionName, currentProfileUid));
          if (!targetSnapshot.exists()) {
            window.location.replace('comunidade.html');
            return;
          }
          currentProfile = viewerProfile.role === 'admin'
            ? targetSnapshot.data()
            : { ...targetSnapshot.data(), role: 'member' };
        } else {
          currentProfile = viewerProfile;
        }

        if (commandBar) commandBar.hidden = false;
        if (adminAccess) adminAccess.hidden = viewerProfile.role !== 'admin';
        await loadAuthorizedPremiumAvatars(currentProfile);
        renderProfile(currentProfile);
        if (viewingAnotherProfile && viewerProfile.role !== 'admin') {
          renderMedals(currentProfile.featuredMedals || []);
          renderParticipations(currentProfile.recentActivities || []);
        } else {
          const [medals, participations] = await Promise.all([loadMedals(currentProfileUid), loadParticipations(currentProfileUid)]);
          if (isOwner && needsFeaturedMigration) {
            const initialHighlights = medals.slice(0, 5).map(medal => medal.id);
            currentProfile.featuredMedalIds = initialHighlights;
            try {
              await updateDoc(doc(db, 'users', currentProfileUid), { featuredMedalIds: initialHighlights, updatedAt: serverTimestamp() });
              needsFeaturedMigration = false;
              renderMedals(medals);
            } catch (error) {
              // A seleção continuará disponível após a publicação das regras novas.
            }
          }
          if (isOwner) {
            try { await syncPublicProfile(medals, participations); } catch (error) { /* Perfil privado continua disponível. */ }
          }
        }
        document.body.classList.add('profile-ready');
      } catch (error) {
        announce('Não foi possível carregar o perfil. Tente entrar novamente.', true);
      }
    });
  });
});
