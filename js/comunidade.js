import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { auth, db } from './firebase-client.js';
import { archiveImage } from './cloudinary-images.js?v=20260912-1';
import { applyMedalImage, normalizeMedalIcon } from './medal-images.js?v=20260911-1';
import { createMediaElement, normalizeExternalUrl } from './community-media.js?v=20260911-1';
import { DEFAULT_AVATAR_ID, avatarSource, normalizeAvatarId } from './avatar-catalog.js?v=20260912-1';
import { DEFAULT_BANNER_ID, normalizeBannerId } from './banner-catalog.js?v=20260912-1';

const list = document.querySelector('[data-community-list]');
const search = document.querySelector('[data-community-search]');
const feedback = document.querySelector('[data-community-feedback]');
const galleryFeedback = document.querySelector('[data-gallery-feedback]');
const gallery = document.querySelector('[data-community-gallery]');
const tabs = [...document.querySelectorAll('[data-community-tab]')];
const panels = [...document.querySelectorAll('[data-community-panel]')];
const galleryForm = document.querySelector('[data-community-gallery-form]');
const honuFeedback = document.querySelector('[data-honu-feedback]');
const honuRoster = document.querySelector('[data-honu-roster]');
const honuOnlineCount = document.querySelector('[data-honu-online-count]');
const honuUpdated = document.querySelector('[data-honu-updated]');
const honuRefresh = document.querySelector('[data-honu-refresh]');
let members = [];
let ranks = new Map();
let medalDefinitions = new Map();
let galleryItems = [];
let currentUser = null;
let viewerProfile = null;
let honuRefreshTimer = null;
let honuRequest = null;
let activeCommunityTab = 'gallery';

const HONU_OUTFIT_ID = '37576258294147955';
const HONU_API_ORIGIN = 'https://wt.honu.pw';
const HONU_ONLINE_ENDPOINT = `${HONU_API_ORIGIN}/api/outfit/${HONU_OUTFIT_ID}/online`;
const HONU_REFRESH_INTERVAL = 60_000;

const classNames = { infiltrador: 'Infiltrador', 'assalto-leve': 'Assalto leve', medico: 'Médico de combate', engenheiro: 'Engenheiro', 'assalto-pesado': 'Assalto pesado', max: 'MAX' };
const classSymbols = { infiltrador: '◇', 'assalto-leve': '△', medico: '✚', engenheiro: '⚙', 'assalto-pesado': '⬡', max: '◆' };
const classIcons = {
  infiltrador: 'https://res.cloudinary.com/uofznsju/image/upload/exbr-site/classes/n4vssk15kqxqd4c6obgi.png?rev=20260912-2',
  'assalto-leve': 'https://res.cloudinary.com/uofznsju/image/upload/exbr-site/classes/qkv2u8faf5cywdqa7eot.png?rev=20260912-2',
  medico: 'https://res.cloudinary.com/uofznsju/image/upload/exbr-site/classes/melgfelpgez4cb1dcbig.png?rev=20260912-2',
  engenheiro: 'https://res.cloudinary.com/uofznsju/image/upload/exbr-site/classes/tupc2fprhxjq1ykrzouz.png?rev=20260912-2',
  'assalto-pesado': 'https://res.cloudinary.com/uofznsju/image/upload/exbr-site/classes/oxihdaqkerwop0l10ihy.png?rev=20260912-2',
  max: 'https://res.cloudinary.com/uofznsju/image/upload/exbr-site/classes/eosv1y4g0vl2m5zsa67w.png?rev=20260912-2'
};
const factionNames = { tr: 'Terran Republic', nc: 'New Conglomerate', vs: 'Vanu Sovereignty', nso: 'Nanite Systems Operatives' };
const factionIcons = {
  nc: 'https://res.cloudinary.com/uofznsju/image/upload/v1789227363/exbr-site/factions-v2/wuzxzjfvsyvozqecvdwz.png',
  tr: 'https://res.cloudinary.com/uofznsju/image/upload/v1789227373/exbr-site/factions-v2/dvuz7ij53agnvbfdpmkr.png',
  vs: 'https://res.cloudinary.com/uofznsju/image/upload/v1789227385/exbr-site/factions-v2/pnjy20rev044nq6ddsvn.png',
  nso: 'https://res.cloudinary.com/uofznsju/image/upload/v1789227395/exbr-site/factions-v2/vpmerleuuqstlpozn6aw.png'
};

const setFeedback = (message, state = 'info') => {
  if (!feedback) return;
  feedback.textContent = message;
  feedback.dataset.state = state;
};

const setHonuFeedback = (message, state = 'info') => {
  if (!honuFeedback) return;
  honuFeedback.textContent = message;
  honuFeedback.dataset.state = state;
};

const honuWorldName = worldId => ({
  1: 'Osprey',
  10: 'Wainwright',
  13: 'Cobalt',
  17: 'Emerald',
  19: 'Jaeger',
  25: 'Briggs',
  40: 'SolTech'
}[Number(worldId)] || 'Osprey');

const normalizeHonuPlayer = player => ({
  id: String(player?.id || ''),
  name: String(player?.name || 'Soldado EXBR'),
  battleRank: Number.isFinite(Number(player?.battleRank)) ? Number(player.battleRank) : null,
  prestige: Number.isFinite(Number(player?.prestige)) ? Number(player.prestige) : 0,
  worldId: Number(player?.worldID || 1)
});

const renderHonuRoster = players => {
  if (!honuRoster) return;
  honuRoster.replaceChildren();

  if (!players.length) {
    const empty = document.createElement('div');
    empty.className = 'community-empty online-empty';
    empty.textContent = 'Nenhum soldado EXBR aparece online neste momento.';
    honuRoster.append(empty);
    return;
  }

  players.forEach(player => {
    const card = document.createElement('article');
    card.className = 'online-player';

    const signal = document.createElement('span');
    signal.className = 'online-player-signal';
    signal.setAttribute('aria-label', 'Online agora');

    const identity = document.createElement('div');
    identity.className = 'online-player-identity';
    const name = document.createElement('strong');
    name.textContent = player.name;
    const details = document.createElement('span');
    const rank = player.battleRank === null ? 'BR não informado' : `BR ${player.battleRank}`;
    const prestige = player.prestige > 0 ? ` · ASP ${player.prestige}` : '';
    details.textContent = `${rank}${prestige} · ${honuWorldName(player.worldId)}`;
    identity.append(name, details);

    const profile = document.createElement('a');
    profile.href = `${HONU_API_ORIGIN}/c/${encodeURIComponent(player.id)}`;
    profile.target = '_blank';
    profile.rel = 'noopener noreferrer';
    profile.textContent = 'Dados de combate ↗';

    card.append(signal, identity, profile);
    honuRoster.append(card);
  });
};

const loadHonuActivity = async () => {
  if (!honuRoster || honuRequest) return;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  honuRequest = controller;
  if (honuRefresh) honuRefresh.disabled = true;
  setHonuFeedback('Consultando a telemetria pública do Honu…');

  try {
    const response = await fetch(HONU_ONLINE_ENDPOINT, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      mode: 'cors',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Honu respondeu com status ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error('Formato inesperado recebido do Honu');

    const players = payload
      .map(normalizeHonuPlayer)
      .filter(player => player.id && player.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    renderHonuRoster(players);
    if (honuOnlineCount) honuOnlineCount.textContent = String(players.length).padStart(2, '0');
    if (honuUpdated) honuUpdated.textContent = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
    setHonuFeedback(`${players.length} soldado${players.length === 1 ? '' : 's'} EXBR online agora. Atualização automática a cada 60 segundos.`, 'success');
  } catch (error) {
    if (honuOnlineCount) honuOnlineCount.textContent = '--';
    if (honuRoster && !honuRoster.querySelector('.online-player')) {
      honuRoster.innerHTML = '<div class="community-empty online-empty">A leitura em tempo real está temporariamente indisponível. Use o painel Honu para consultar agora.</div>';
    }
    setHonuFeedback(error?.name === 'AbortError'
      ? 'O Honu demorou para responder. Uma nova tentativa será feita automaticamente.'
      : 'Não foi possível alcançar o Honu. Uma nova tentativa será feita automaticamente.', 'error');
  } finally {
    window.clearTimeout(timeout);
    honuRequest = null;
    if (honuRefresh) honuRefresh.disabled = false;
  }
};

const stopHonuUpdates = () => {
  if (honuRefreshTimer) window.clearInterval(honuRefreshTimer);
  honuRefreshTimer = null;
};

const startHonuUpdates = () => {
  stopHonuUpdates();
  if (activeCommunityTab !== 'online' || document.hidden) return;
  loadHonuActivity();
  honuRefreshTimer = window.setInterval(loadHonuActivity, HONU_REFRESH_INTERVAL);
};

const publicMedal = medal => ({
  catalogId: medal.catalogId || '',
  name: medal.name || 'Medalha EXBR',
  description: medal.description || '',
  operationName: medal.operationName || 'Operação EXBR',
  operationDate: medal.operationDate || null,
  iconUrl: normalizeMedalIcon(medal.iconUrl)
});

const publicActivity = participation => ({
  operationId: participation.operationId || participation.id || '',
  title: participation.title || 'Operação EXBR',
  status: participation.status || 'confirmed',
  startsAt: participation.startsAt || null,
  joinedAt: participation.joinedAt || null
});

const ensureViewerPublicProfile = async user => {
  const profileSnapshot = await getDoc(doc(db, 'users', user.uid));
  if (!profileSnapshot.exists()) return null;
  const profile = profileSnapshot.data();
  const [medalsSnapshot, participationsSnapshot] = await Promise.all([
    getDocs(collection(db, 'users', user.uid, 'medals')),
    getDocs(collection(db, 'users', user.uid, 'participations'))
  ]);
  const allMedals = medalsSnapshot.docs.map(item => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (b.operationDate?.seconds || 0) - (a.operationDate?.seconds || 0));
  const medalById = new Map(allMedals.map(medal => [medal.id, medal]));
  const selectedMedals = Object.hasOwn(profile, 'featuredMedalIds')
    ? (profile.featuredMedalIds || []).map(id => medalById.get(id)).filter(Boolean)
    : allMedals;
  const medals = selectedMedals.slice(0, 5).map(publicMedal);
  const activities = participationsSnapshot.docs.map(item => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (b.joinedAt?.seconds || 0) - (a.joinedAt?.seconds || 0))
    .slice(0, 3)
    .map(publicActivity);
  await setDoc(doc(db, 'publicProfiles', user.uid), {
    displayName: profile.displayName || user.displayName || 'Membro EXBR',
    rankId: profile.rankId || 'soldado',
    avatarId: normalizeAvatarId(profile.avatarId || DEFAULT_AVATAR_ID),
    bannerId: normalizeBannerId(profile.bannerId || DEFAULT_BANNER_ID),
    bio: profile.bio || '',
    favoriteClass: profile.favoriteClass || '',
    favoriteFaction: profile.favoriteFaction || '',
    featuredMedals: medals,
    recentActivities: activities,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return profile;
};

const createMedal = storedMedal => {
  const definition = medalDefinitions.get(storedMedal.catalogId);
  const medal = definition ? {
    ...storedMedal,
    name: definition.nome || storedMedal.name,
    iconUrl: definition.iconUrl || storedMedal.iconUrl
  } : storedMedal;
  const slot = document.createElement('span');
  slot.className = 'community-medal';
  slot.title = medal.name || 'Medalha EXBR';
  const image = document.createElement('img');
  applyMedalImage(image, medal.iconUrl, medal.name || 'Medalha EXBR');
  slot.append(image);
  return slot;
};

const render = () => {
  if (!list) return;
  const term = search?.value.trim().toLocaleLowerCase('pt-BR') || '';
  const visible = members.filter(member => `${member.displayName || ''} ${ranks.get(member.rankId) || ''} ${classNames[member.favoriteClass] || ''} ${factionNames[member.favoriteFaction] || ''}`.toLocaleLowerCase('pt-BR').includes(term));
  list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('div');
    empty.className = 'community-empty';
    empty.textContent = term ? 'Nenhum membro encontrado.' : 'Nenhum perfil público disponível no momento.';
    list.append(empty);
    return;
  }

  visible.forEach(member => {
    const card = document.createElement('article');
    card.className = 'community-member';
    const avatar = document.createElement('img');
    avatar.className = 'community-avatar';
    avatar.src = avatarSource(member.avatarId, 'thumb');
    avatar.alt = '';

    const identity = document.createElement('div');
    identity.className = 'community-identity';
    const name = document.createElement('strong');
    name.textContent = member.displayName || 'Membro EXBR';
    const rank = document.createElement('span');
    rank.className = 'community-rank';
    rank.textContent = ranks.get(member.rankId) || 'Soldado';
    const activity = document.createElement('span');
    activity.className = 'community-activity';
    const latest = member.recentActivities?.[0];
    if (latest) {
      activity.append('Atividade recente: ');
      const activityName = document.createElement('b');
      activityName.textContent = latest.title || 'Operação EXBR';
      activity.append(activityName);
    } else {
      activity.textContent = 'Disponível na comunidade';
    }
    const specifications = document.createElement('span');
    specifications.className = 'community-specifications';
    const className = classNames[member.favoriteClass];
    const factionName = factionNames[member.favoriteFaction];
    if (className || factionName) {
      const classSpecification = document.createElement('span');
      classSpecification.className = 'community-class-specification';
      if (classIcons[member.favoriteClass]) {
        const classIcon = document.createElement('img');
        classIcon.src = classIcons[member.favoriteClass];
        classIcon.alt = '';
        classSpecification.append(classIcon);
      } else {
        classSpecification.append((classSymbols[member.favoriteClass] || '◇') + ' ');
      }
      classSpecification.append(className || 'Classe não definida');
      const separator = document.createTextNode(' · ');
      const factionSpecification = document.createElement('span');
      factionSpecification.className = 'community-faction-specification';
      if (factionIcons[member.favoriteFaction]) {
        const factionIcon = document.createElement('img');
        factionIcon.src = factionIcons[member.favoriteFaction];
        factionIcon.alt = '';
        factionSpecification.append(factionIcon);
      }
      factionSpecification.append(factionName || 'Facção não definida');
      specifications.append(classSpecification, separator, factionSpecification);
    } else {
      specifications.textContent = 'Classe e facção ainda não definidas';
    }
    const biography = document.createElement('span');
    biography.className = 'community-biography';
    biography.textContent = member.bio?.trim() || 'Sem transmissão pessoal.';
    identity.append(name, rank, specifications, biography, activity);

    const featured = document.createElement('div');
    featured.className = 'community-featured';
    const featuredLabel = document.createElement('span');
    featuredLabel.className = 'community-featured-label';
    featuredLabel.textContent = 'Medalhas em destaque';
    const medals = document.createElement('div');
    medals.className = 'community-medals';
    (member.featuredMedals || []).slice(0, 5).forEach(medal => medals.append(createMedal(medal)));
    for (let index = medals.children.length; index < 5; index += 1) {
      const empty = document.createElement('span');
      empty.className = 'community-medal community-medal-empty';
      empty.setAttribute('aria-hidden', 'true');
      medals.append(empty);
    }
    featured.append(featuredLabel, medals);

    const profile = document.createElement('a');
    profile.className = 'community-profile-link';
    profile.href = `perfil.html?uid=${encodeURIComponent(member.id)}`;
    profile.textContent = 'Ver perfil';
    card.append(avatar, identity, featured, profile);
    list.append(card);
  });
  setFeedback(`${visible.length} membro${visible.length === 1 ? '' : 's'} na rede EXBR.`, 'success');
};

const renderGallery = () => {
  if (!gallery) return;
  gallery.replaceChildren();
  if (!galleryItems.length) {
    const empty = document.createElement('div');
    empty.className = 'community-empty';
    empty.textContent = 'Nenhum registro visual publicado ainda.';
    gallery.append(empty);
    if (galleryFeedback) galleryFeedback.textContent = 'Arquivo visual aguardando transmissões.';
    return;
  }

  galleryItems.forEach(item => {
    const card = document.createElement('article');
    card.className = 'gallery-card';
    const visual = document.createElement('div');
    visual.className = 'gallery-visual';
    const media = createMediaElement(item, { onError: () => card.remove() });
    if (!media) return;
    visual.append(media);
    const copy = document.createElement('div');
    copy.className = 'gallery-copy';
    const label = document.createElement('span');
    label.textContent = item.type === 'video' ? 'VÍDEO // EXBR' : 'IMAGEM // EXBR';
    const title = document.createElement('h3');
    title.textContent = item.title || 'Registro da comunidade';
    const description = document.createElement('p');
    description.textContent = item.description || 'Arquivo visual da Outfit EXBR.';
    const author = document.createElement('small');
    author.textContent = `Publicado por ${item.authorName || 'Membro EXBR'}`;
    copy.append(label, title, description, author);
    card.append(visual, copy);
    if (currentUser && item.createdBy === currentUser.uid) {
      const remove = document.createElement('button');
      remove.className = 'gallery-owner-remove';
      remove.type = 'button';
      remove.textContent = 'Remover minha publicação';
      remove.addEventListener('click', async () => {
        if (!window.confirm(`Remover ${title.textContent} da galeria?`)) return;
        remove.disabled = true;
        try {
          await deleteDoc(doc(db, 'communityGallery', item.id));
          galleryItems = galleryItems.filter(entry => entry.id !== item.id);
          renderGallery();
          if (galleryFeedback) galleryFeedback.textContent = 'Sua publicação foi removida.';
        } catch (error) {
          remove.disabled = false;
          if (galleryFeedback) galleryFeedback.textContent = 'Não foi possível remover sua publicação.';
        }
      });
      card.append(remove);
    }
    gallery.append(card);
  });
  if (galleryFeedback) galleryFeedback.textContent = `${galleryItems.length} registro${galleryItems.length === 1 ? '' : 's'} no arquivo visual.`;
};

galleryForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentUser) return;
  const submit = galleryForm.querySelector('[type="submit"]');
  const url = normalizeExternalUrl(galleryForm.elements.url.value);
  if (!url) {
    if (galleryFeedback) galleryFeedback.textContent = 'Informe uma URL HTTPS válida.';
    return;
  }
  const type = galleryForm.elements.type.value === 'video' ? 'video' : 'image';
  const item = {
    type,
    url,
    title: galleryForm.elements.title.value.trim(),
    description: galleryForm.elements.description.value.trim(),
    createdBy: currentUser.uid,
    authorName: viewerProfile?.displayName || currentUser.displayName || 'Membro EXBR',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  submit.disabled = true;
  if (galleryFeedback) galleryFeedback.textContent = type === 'image' ? 'Arquivando imagem permanentemente…' : 'Transmitindo registro visual…';
  try {
    if (type === 'image') item.url = await archiveImage(url);
    const reference = await addDoc(collection(db, 'communityGallery'), item);
    galleryItems.unshift({ id: reference.id, ...item, createdAt: null, updatedAt: null });
    galleryForm.reset();
    document.querySelector('[data-gallery-publisher]')?.removeAttribute('open');
    renderGallery();
    if (galleryFeedback) galleryFeedback.textContent = 'Publicação adicionada à Galeria EXBR.';
  } catch (error) {
    if (galleryFeedback) galleryFeedback.textContent = error.message || 'Não foi possível arquivar e publicar a imagem.';
  } finally {
    submit.disabled = false;
  }
});

const loadCommunity = async user => {
  try { viewerProfile = await ensureViewerPublicProfile(user); } catch (error) { /* O restante da comunidade ainda pode ser carregado. */ }
  const [rankResponse, snapshot, catalogSnapshot, gallerySnapshot] = await Promise.all([
    fetch('../data/patentes.json'),
    getDocs(collection(db, 'publicProfiles')),
    getDocs(collection(db, 'medalCatalog')),
    getDocs(collection(db, 'communityGallery')).catch(() => null)
  ]);
  const rankData = await rankResponse.json();
  ranks = new Map(rankData.patentes.map(rank => [rank.id, rank.nome]));
  medalDefinitions = new Map(catalogSnapshot.docs.map(item => [item.id, item.data()]));
  members = snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'pt-BR'));
  galleryItems = gallerySnapshot
    ? gallerySnapshot.docs.map(item => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    : [];
  render();
  renderGallery();
};

search?.addEventListener('input', render);
tabs.forEach(tab => tab.addEventListener('click', () => {
  const target = tab.dataset.communityTab;
  activeCommunityTab = target;
  tabs.forEach(item => item.setAttribute('aria-selected', String(item === tab)));
  panels.forEach(panel => { panel.hidden = panel.dataset.communityPanel !== target; });
  if (target === 'gallery') gallery?.querySelector('button, a, video')?.focus({ preventScroll: true });
  if (target === 'online') startHonuUpdates();
  else stopHonuUpdates();
}));
honuRefresh?.addEventListener('click', loadHonuActivity);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopHonuUpdates();
  else if (activeCommunityTab === 'online') startHonuUpdates();
});
onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.replace('login.html');
    return;
  }
  currentUser = user;
  try {
    await loadCommunity(user);
  } catch (error) {
    setFeedback('Não foi possível carregar a comunidade. Publique as regras atualizadas do Firestore.', 'error');
    if (list) list.innerHTML = '<div class="community-empty">Registro comunitário indisponível.</div>';
  }
});
