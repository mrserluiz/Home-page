import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { auth, db } from './firebase-client.js';
import { archiveImage, shouldArchiveImage } from './cloudinary-images.js?v=20260912-1';
import { applyMedalImage, defaultMedalIcon, isImportableMedalImage, normalizeMedalIcon } from './medal-images.js?v=20260912-1';
import { createMediaElement, normalizeExternalUrl } from './community-media.js?v=20260911-1';
import { DEFAULT_AVATAR_ID, avatarSource, normalizeAvatarId } from './avatar-catalog.js?v=20260912-1';
import { DEFAULT_BANNER_ID, normalizeBannerId } from './banner-catalog.js?v=20260912-1';

const list = document.querySelector('[data-soldier-list]');
const search = document.querySelector('[data-soldier-search]');
const feedback = document.querySelector('[data-admin-feedback]');
const logoutButton = document.querySelector('[data-admin-logout]');
const dialog = document.querySelector('[data-medal-dialog]');
const dialogClose = document.querySelector('[data-medal-dialog-close]');
const medalTarget = document.querySelector('[data-medal-target]');
const medalSearch = document.querySelector('[data-medal-search]');
const medalCatalog = document.querySelector('[data-medal-catalog]');
const medalFeedback = document.querySelector('[data-medal-feedback]');
const operationField = document.querySelector('[data-medal-operation]');
const dateField = document.querySelector('[data-medal-date]');
const medalCreate = document.querySelector('[data-medal-create]');
const medalEditor = document.querySelector('[data-medal-editor]');
const medalEditorForm = document.querySelector('[data-medal-editor-form]');
const medalEditorTitle = document.querySelector('#medal-editor-title');
const medalEditorClose = document.querySelector('[data-medal-editor-close]');
const medalEditorFeedback = document.querySelector('[data-medal-editor-feedback]');
const adminTabs = [...document.querySelectorAll('[data-admin-tab]')];
const adminPanels = [...document.querySelectorAll('[data-admin-panel]')];
const adminMedalSearch = document.querySelector('[data-admin-medal-search]');
const adminMedalCatalog = document.querySelector('[data-admin-medal-catalog]');
const adminMedalFeedback = document.querySelector('[data-admin-medal-feedback]');
const adminMedalCreate = document.querySelector('[data-admin-medal-create]');
const adminTitle = document.querySelector('[data-admin-title]');
const galleryForm = document.querySelector('[data-gallery-form]');
const galleryAdminList = document.querySelector('[data-gallery-admin-list]');
const galleryAdminFeedback = document.querySelector('[data-gallery-admin-feedback]');
const premiumAvatarForm = document.querySelector('[data-premium-avatar-form]');
const premiumAvatarList = document.querySelector('[data-premium-avatar-list]');
const premiumAvatarFeedback = document.querySelector('[data-premium-avatar-feedback]');
const premiumAvatarCancel = document.querySelector('[data-premium-avatar-cancel]');

let users = [];
let ranks = [];
let medals = [];
let selectedUser = null;
let galleryItems = [];
let premiumAvatars = [];
let currentAdmin = null;
let stopUsersListener = null;

const setFeedback = (message, state = 'info') => {
  if (!feedback) return;
  feedback.textContent = message;
  feedback.dataset.state = state;
};

const setMedalFeedback = (message, state = 'info') => {
  if (!medalFeedback) return;
  medalFeedback.textContent = message;
  medalFeedback.dataset.state = state;
};

const setAdminMedalFeedback = (message, state = 'info') => {
  if (!adminMedalFeedback) return;
  adminMedalFeedback.textContent = message;
  adminMedalFeedback.dataset.state = state;
};

const localDateInputValue = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const rankName = rankId => ranks.find(rank => rank.id === rankId)?.nome || 'Soldado';

const publicProfileData = user => ({
  displayName: user.displayName || user.email?.split('@')[0] || 'Membro EXBR',
  rankId: user.rankId || 'soldado',
  avatarId: (user.premiumAvatarIds || []).includes(user.avatarId) ? user.avatarId : normalizeAvatarId(user.avatarId || DEFAULT_AVATAR_ID),
  premiumAvatarIds: Array.isArray(user.premiumAvatarIds) ? user.premiumAvatarIds : [],
  bannerId: normalizeBannerId(user.bannerId || DEFAULT_BANNER_ID),
  bio: user.bio || '',
  favoriteClass: user.favoriteClass || '',
  favoriteFaction: user.favoriteFaction || '',
  updatedAt: serverTimestamp()
});

const setPremiumAvatarFeedback = (message, state = 'info') => {
  if (!premiumAvatarFeedback) return;
  premiumAvatarFeedback.textContent = message;
  premiumAvatarFeedback.dataset.state = state;
};

const premiumAvatarDefinition = avatarId => premiumAvatars.find(avatar => avatar.id === avatarId);
const userAvatarSource = user => premiumAvatarDefinition(user.avatarId)?.imageUrl || avatarSource(user.avatarId, 'thumb');

const publicMedal = medal => {
  const definition = medals.find(item => item.id === medal.catalogId);
  return {
    catalogId: medal.catalogId || '',
    name: definition?.nome || medal.name || 'Medalha EXBR',
    description: definition?.description || medal.description || '',
    operationName: medal.operationName || 'Operação EXBR',
    operationDate: medal.operationDate || null,
    iconUrl: normalizeMedalIcon(definition?.iconUrl || medal.iconUrl)
  };
};

const syncPublicMedals = async userId => {
  const [snapshot, profileSnapshot] = await Promise.all([
    getDocs(collection(db, 'users', userId, 'medals')),
    getDoc(doc(db, 'users', userId))
  ]);
  const allMedals = snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (b.operationDate?.seconds || 0) - (a.operationDate?.seconds || 0));
  const profile = profileSnapshot.data() || {};
  const byId = new Map(allMedals.map(medal => [medal.id, medal]));
  const selected = Object.hasOwn(profile, 'featuredMedalIds')
    ? (profile.featuredMedalIds || []).map(id => byId.get(id)).filter(Boolean)
    : allMedals.slice(0, 5);
  const featuredMedals = selected.slice(0, 5).map(publicMedal);
  await setDoc(doc(db, 'publicProfiles', userId), { featuredMedals, updatedAt: serverTimestamp() }, { merge: true });
};

const openProfile = uid => {
  window.location.href = `perfil.html?uid=${encodeURIComponent(uid)}`;
};

const renderUsers = () => {
  if (!list) return;
  const term = search?.value.trim().toLocaleLowerCase('pt-BR') || '';
  const visibleUsers = users.filter(user => {
    const searchable = `${user.displayName || ''} ${user.email || ''} ${rankName(user.rankId)}`.toLocaleLowerCase('pt-BR');
    return searchable.includes(term);
  });

  list.replaceChildren();
  if (!visibleUsers.length) {
    const empty = document.createElement('div');
    empty.className = 'admin-empty';
    empty.textContent = term ? 'Nenhum soldado encontrado.' : 'Nenhum membro cadastrado.';
    list.append(empty);
    return;
  }

  visibleUsers.forEach(user => {
    const row = document.createElement('article');
    row.className = 'soldier-row';
    row.tabIndex = 0;
    row.setAttribute('aria-label', `${user.displayName || 'Membro EXBR'}, ${rankName(user.rankId)}. Pressione Enter para abrir o perfil.`);

    const avatar = document.createElement('img');
    avatar.src = userAvatarSource(user);
    avatar.alt = '';

    const copy = document.createElement('div');
    copy.className = 'soldier-copy';
    const name = document.createElement('strong');
    name.textContent = user.displayName || user.email || 'Membro EXBR';
    const currentRank = document.createElement('span');
    currentRank.textContent = rankName(user.rankId);
    copy.append(name, currentRank);

    const select = document.createElement('select');
    select.className = 'rank-select';
    select.setAttribute('aria-label', `Alterar patente de ${name.textContent}`);
    ranks.forEach(rank => {
      const option = document.createElement('option');
      option.value = rank.id;
      option.textContent = rank.nome;
      option.selected = rank.id === user.rankId;
      select.append(option);
    });
    select.addEventListener('click', event => event.stopPropagation());
    select.addEventListener('dblclick', event => event.stopPropagation());
    select.addEventListener('change', async event => {
      event.stopPropagation();
      const previousRank = user.rankId;
      select.disabled = true;
      setFeedback(`Atualizando patente de ${name.textContent}…`);
      try {
        await updateDoc(doc(db, 'users', user.id), {
          rankId: select.value,
          updatedAt: serverTimestamp()
        });
        user.rankId = select.value;
        currentRank.textContent = rankName(user.rankId);
        try {
          await setDoc(doc(db, 'publicProfiles', user.id), publicProfileData(user), { merge: true });
        } catch (error) {
          // A patente privada foi salva e o perfil público será sincronizado depois.
        }
        setFeedback(`Patente de ${name.textContent} salva automaticamente.`, 'success');
      } catch (error) {
        select.value = previousRank;
        setFeedback('Não foi possível alterar a patente.', 'error');
      } finally {
        select.disabled = false;
      }
    });

    const medalButton = document.createElement('button');
    medalButton.className = 'add-medal-button';
    medalButton.type = 'button';
    medalButton.textContent = '+ Adicionar medalha';
    medalButton.addEventListener('click', event => {
      event.stopPropagation();
      openMedalDialog(user);
    });
    medalButton.addEventListener('dblclick', event => event.stopPropagation());

    row.addEventListener('dblclick', () => openProfile(user.id));
    row.addEventListener('keydown', event => {
      if (event.key === 'Enter') openProfile(user.id);
    });
    row.append(avatar, copy, select, medalButton);
    list.append(row);
  });
};

const renderMedalList = (container, term = '', allowAward = false) => {
  if (!container) return;
  const visibleMedals = medals.filter(medal => medal.nome.toLocaleLowerCase('pt-BR').includes(term));
  container.replaceChildren();

  if (!visibleMedals.length) {
    const empty = document.createElement('div');
    empty.className = 'admin-empty';
    empty.textContent = term ? 'Nenhuma medalha encontrada.' : 'Nenhuma medalha cadastrada.';
    container.append(empty);
    return;
  }

  visibleMedals.forEach(medal => {
    const item = document.createElement('article');
    item.className = 'catalog-medal';

    const icon = document.createElement('span');
    icon.className = 'catalog-medal-icon';
    icon.setAttribute('aria-hidden', 'true');
    const image = document.createElement('img');
    applyMedalImage(image, medal.iconUrl);
    icon.append(image);

    const copy = document.createElement('span');
    copy.className = 'catalog-medal-copy';
    const name = document.createElement('strong');
    name.textContent = medal.nome;
    const detail = document.createElement('small');
    detail.textContent = medal.description || 'Condecoração oficial da EXBR.';
    copy.append(name, detail);

    const actions = document.createElement('span');
    actions.className = 'catalog-medal-actions';
    const edit = document.createElement('button');
    edit.className = 'catalog-medal-edit';
    edit.type = 'button';
    edit.textContent = '✎';
    edit.setAttribute('aria-label', `Editar ${medal.nome}`);
    edit.addEventListener('click', () => openMedalEditor(medal));
    actions.append(edit);
    if (allowAward) {
      const add = document.createElement('button');
      add.className = 'catalog-medal-add';
      add.type = 'button';
      add.textContent = '+';
      add.setAttribute('aria-label', `Conceder ${medal.nome}`);
      add.addEventListener('click', () => addMedal(medal, add));
      actions.append(add);
    }
    item.append(icon, copy, actions);
    container.append(item);
  });
};

const renderMedals = () => {
  const awardTerm = medalSearch?.value.trim().toLocaleLowerCase('pt-BR') || '';
  const adminTerm = adminMedalSearch?.value.trim().toLocaleLowerCase('pt-BR') || '';
  renderMedalList(medalCatalog, awardTerm, true);
  renderMedalList(adminMedalCatalog, adminTerm, false);
};

const setGalleryFeedback = (message, state = 'info') => {
  if (!galleryAdminFeedback) return;
  galleryAdminFeedback.textContent = message;
  galleryAdminFeedback.dataset.state = state;
};

const renderGalleryAdmin = () => {
  if (!galleryAdminList) return;
  galleryAdminList.replaceChildren();
  if (!galleryItems.length) {
    const empty = document.createElement('div');
    empty.className = 'admin-empty';
    empty.textContent = 'Nenhum registro visual publicado.';
    galleryAdminList.append(empty);
    return;
  }
  galleryItems.forEach(item => {
    const card = document.createElement('article');
    card.className = 'gallery-admin-item';
    const visual = document.createElement('div');
    visual.className = 'gallery-admin-visual';
    const media = createMediaElement(item);
    if (media) visual.append(media);
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = item.title || 'Registro da comunidade';
    const url = document.createElement('a');
    url.href = item.url;
    url.target = '_blank';
    url.rel = 'noopener noreferrer';
    url.textContent = item.type === 'video' ? 'Abrir vídeo externo' : 'Abrir imagem externa';
    copy.append(title, url);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remover';
    remove.addEventListener('click', async () => {
      if (!window.confirm(`Remover ${title.textContent} da galeria?`)) return;
      remove.disabled = true;
      try {
        await deleteDoc(doc(db, 'communityGallery', item.id));
        galleryItems = galleryItems.filter(entry => entry.id !== item.id);
        renderGalleryAdmin();
        setGalleryFeedback('Registro removido da galeria.', 'success');
      } catch (error) {
        remove.disabled = false;
        setGalleryFeedback('Não foi possível remover o registro.', 'error');
      }
    });
    card.append(visual, copy, remove);
    galleryAdminList.append(card);
  });
};

const saveGalleryItem = async event => {
  event.preventDefault();
  if (!galleryForm || !currentAdmin) return;
  const submit = galleryForm.querySelector('[type="submit"]');
  const url = normalizeExternalUrl(galleryForm.elements.url.value);
  if (!url) {
    setGalleryFeedback('Informe uma URL HTTPS válida.', 'error');
    return;
  }
  submit.disabled = true;
  setGalleryFeedback('Publicando registro visual…');
  const type = galleryForm.elements.type.value === 'video' ? 'video' : 'image';
  const item = {
    type,
    url,
    title: galleryForm.elements.title.value.trim(),
    description: galleryForm.elements.description.value.trim(),
    createdBy: currentAdmin.uid,
    authorName: currentAdmin.displayName || 'Administração EXBR',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  try {
    if (type === 'image') {
      setGalleryFeedback('Arquivando imagem permanentemente…');
      item.url = await archiveImage(url);
    }
    const reference = await addDoc(collection(db, 'communityGallery'), item);
    galleryItems.unshift({ id: reference.id, ...item, createdAt: null, updatedAt: null });
    galleryForm.reset();
    renderGalleryAdmin();
    setGalleryFeedback('Registro publicado na Galeria EXBR.', 'success');
  } catch (error) {
    setGalleryFeedback(error.message || 'Não foi possível publicar a imagem.', 'error');
  } finally {
    submit.disabled = false;
  }
};

const migrateGalleryImages = async items => Promise.all(items.map(async item => {
  if (item.type !== 'image' || !shouldArchiveImage(item.url)) return item;
  try {
    const url = await archiveImage(item.url);
    await setDoc(doc(db, 'communityGallery', item.id), { url, updatedAt: serverTimestamp() }, { merge: true });
    return { ...item, url };
  } catch (error) {
    return item;
  }
}));

const migrateOperationImages = async () => {
  let snapshot;

  try {
    snapshot = await getDocs(collection(db, 'operations'));
  } catch (error) {
    return 0;
  }

  let migrated = 0;

  for (const operationDocument of snapshot.docs) {
    const operation = operationDocument.data();
    if (!shouldArchiveImage(operation.imageUrl)) continue;

    try {
      const imageUrl = await archiveImage(operation.imageUrl);
      await setDoc(operationDocument.ref, {
        imageUrl,
        updatedAt: serverTimestamp()
      }, { merge: true });
      migrated += 1;
    } catch (error) {
      // Mantém a URL original e tenta novamente no próximo acesso administrativo.
    }
  }

  return migrated;
};

const addMedal = async (medal, button) => {
  if (!selectedUser) return;
  button.disabled = true;
  setMedalFeedback(`Adicionando ${medal.nome}…`);

  try {
    const dateValue = dateField?.value || localDateInputValue();
    const operationDate = Timestamp.fromDate(new Date(`${dateValue}T12:00:00`));
    await addDoc(collection(db, 'users', selectedUser.id, 'medals'), {
      catalogId: medal.id,
      name: medal.nome,
      description: medal.description || '',
      operationName: operationField?.value.trim() || medal.operationName || 'Operação EXBR',
      operationDate,
      iconUrl: normalizeMedalIcon(medal.iconUrl),
      awardedAt: serverTimestamp()
    });
    try {
      await syncPublicMedals(selectedUser.id);
    } catch (error) {
      // A concessão permanece válida mesmo se o resumo comunitário estiver indisponível.
    }
    setMedalFeedback(`${medal.nome} adicionada ao perfil. É possível concedê-la novamente em outra operação.`, 'success');
    button.disabled = false;
  } catch (error) {
    setMedalFeedback('Não foi possível salvar a medalha.', 'error');
    button.disabled = false;
  }
};

const openMedalEditor = (medal = null) => {
  if (!medalEditor || !medalEditorForm) return;
  medalEditorForm.reset();
  medalEditorForm.elements.medalId.value = medal?.id || '';
  medalEditorForm.elements.name.value = medal?.nome || '';
  medalEditorForm.elements.description.value = medal?.description || '';
  medalEditorForm.elements.iconUrl.value = normalizeMedalIcon(medal?.iconUrl) === defaultMedalIcon ? '' : (medal?.iconUrl || '');
  if (medalEditorTitle) medalEditorTitle.textContent = medal ? 'Editar medalha' : 'Nova medalha';
  if (medalEditorFeedback) {
    medalEditorFeedback.textContent = medal ? 'Altere os dados e salve o catálogo.' : 'Cadastre uma nova condecoração para a EXBR.';
    medalEditorFeedback.dataset.state = 'info';
  }
  medalEditor.showModal();
};

const saveMedalDefinition = async event => {
  event.preventDefault();
  if (!medalEditorForm) return;
  const iconUrlInput = medalEditorForm.elements.iconUrl.value.trim();
  if (iconUrlInput && !isImportableMedalImage(iconUrlInput)) {
    medalEditorFeedback.textContent = 'Informe um caminho local ou uma URL HTTPS de imagem.';
    medalEditorFeedback.dataset.state = 'error';
    return;
  }

  const submit = medalEditorForm.querySelector('[type="submit"]');
  const existingId = medalEditorForm.elements.medalId.value;
  const reference = existingId ? doc(db, 'medalCatalog', existingId) : doc(collection(db, 'medalCatalog'));
  const definition = {
    nome: medalEditorForm.elements.name.value.trim(),
    description: medalEditorForm.elements.description.value.trim(),
    iconUrl: iconUrlInput ? '' : defaultMedalIcon,
    updatedAt: serverTimestamp()
  };
  if (!existingId) definition.createdAt = serverTimestamp();

  submit.disabled = true;
  medalEditorFeedback.textContent = iconUrlInput ? 'Arquivando imagem e salvando medalha…' : 'Salvando medalha…';
  medalEditorFeedback.dataset.state = 'info';
  try {
    definition.iconUrl = iconUrlInput
      ? normalizeMedalIcon(await archiveImage(iconUrlInput))
      : defaultMedalIcon;
    await setDoc(reference, definition, { merge: true });
    const saved = { id: reference.id, ...definition, updatedAt: null, createdAt: null };
    const index = medals.findIndex(medal => medal.id === reference.id);
    if (index >= 0) medals[index] = { ...medals[index], ...saved };
    else medals.push(saved);
    medals.sort((first, second) => first.nome.localeCompare(second.nome, 'pt-BR'));
    renderMedals();
    medalEditor.close();
    setMedalFeedback(`${definition.nome} salva no catálogo.`, 'success');
    setAdminMedalFeedback(`${definition.nome} salva no catálogo.`, 'success');
  } catch (error) {
    medalEditorFeedback.textContent = error.message || 'Não foi possível arquivar e salvar a medalha.';
    medalEditorFeedback.dataset.state = 'error';
  } finally {
    submit.disabled = false;
  }
};

const loadMedalCatalog = async () => {
  const response = await fetch('../data/medalhas.json');
  const data = await response.json();
  const defaults = data.medalhas.map(medal => ({ ...medal, iconUrl: normalizeMedalIcon(medal.iconUrl) }));
  let snapshot;
  try {
    snapshot = await getDocs(collection(db, 'medalCatalog'));
    if (!snapshot.empty) {
      const storedMedals = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      return Promise.all(storedMedals.map(async medal => {
        if (!shouldArchiveImage(medal.iconUrl)) return medal;
        try {
          const iconUrl = await archiveImage(medal.iconUrl);
          await setDoc(doc(db, 'medalCatalog', medal.id), { iconUrl, updatedAt: serverTimestamp() }, { merge: true });
          return { ...medal, iconUrl };
        } catch (error) {
          return medal;
        }
      }));
    }
  } catch (error) {
    return defaults;
  }

  const batch = writeBatch(db);
  defaults.forEach(medal => {
    const { id, ...definition } = medal;
    batch.set(doc(db, 'medalCatalog', id), {
      ...definition,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });
  try {
    await batch.commit();
  } catch (error) {
    setMedalFeedback('Catálogo local carregado. Publique as regras do Firestore para habilitar a edição.', 'error');
  }
  return defaults;
};

const openMedalDialog = user => {
  if (!dialog) return;
  selectedUser = user;
  if (medalTarget) medalTarget.textContent = user.displayName || user.email || 'Membro EXBR';
  if (medalSearch) medalSearch.value = '';
  if (operationField) operationField.value = 'Operação EXBR';
  if (dateField) dateField.value = localDateInputValue();
  setMedalFeedback('Use + para conceder uma medalha. A remoção é feita no perfil do membro.');
  dialog.showModal();
  renderMedals();
};

const resetPremiumAvatarForm = () => {
  if (!premiumAvatarForm) return;
  premiumAvatarForm.reset();
  premiumAvatarForm.elements.avatarId.value = '';
  if (premiumAvatarCancel) premiumAvatarCancel.hidden = true;
};

const editPremiumAvatar = avatar => {
  if (!premiumAvatarForm) return;
  premiumAvatarForm.elements.avatarId.value = avatar.id;
  premiumAvatarForm.elements.name.value = avatar.name || '';
  premiumAvatarForm.elements.imageUrl.value = avatar.imageUrl || '';
  if (premiumAvatarCancel) premiumAvatarCancel.hidden = false;
  setPremiumAvatarFeedback(`Editando ${avatar.name}.`);
  premiumAvatarForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const grantPremiumAvatar = async (avatar, userId, button) => {
  const user = users.find(item => item.id === userId);
  if (!user) return;
  const nextIds = [...new Set([...(user.premiumAvatarIds || []), avatar.id])];
  button.disabled = true;
  setPremiumAvatarFeedback(`Concedendo ${avatar.name} para ${user.displayName || user.email}…`);
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', user.id), { premiumAvatarIds: nextIds, updatedAt: serverTimestamp() });
    batch.set(doc(db, 'publicProfiles', user.id), { premiumAvatarIds: nextIds, updatedAt: serverTimestamp() }, { merge: true });
    await batch.commit();
    user.premiumAvatarIds = nextIds;
    renderPremiumAvatars();
    setPremiumAvatarFeedback(`${avatar.name} liberado para ${user.displayName || user.email}.`, 'success');
  } catch (error) {
    setPremiumAvatarFeedback('Não foi possível conceder o avatar premium.', 'error');
    button.disabled = false;
  }
};

const revokePremiumAvatar = async (avatar, user, button) => {
  if (!window.confirm(`Remover o acesso de ${user.displayName || user.email} ao avatar ${avatar.name}?`)) return;
  const nextIds = (user.premiumAvatarIds || []).filter(id => id !== avatar.id);
  const wasSelected = user.avatarId === avatar.id;
  button.disabled = true;
  setPremiumAvatarFeedback(`Removendo ${avatar.name} de ${user.displayName || user.email}…`);
  try {
    const privateUpdate = { premiumAvatarIds: nextIds, updatedAt: serverTimestamp() };
    const publicUpdate = { premiumAvatarIds: nextIds, updatedAt: serverTimestamp() };
    if (wasSelected) {
      privateUpdate.avatarId = DEFAULT_AVATAR_ID;
      publicUpdate.avatarId = DEFAULT_AVATAR_ID;
    }
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', user.id), privateUpdate);
    batch.set(doc(db, 'publicProfiles', user.id), publicUpdate, { merge: true });
    await batch.commit();
    user.premiumAvatarIds = nextIds;
    if (wasSelected) user.avatarId = DEFAULT_AVATAR_ID;
    renderPremiumAvatars();
    renderUsers();
    setPremiumAvatarFeedback('Acesso premium removido.', 'success');
  } catch (error) {
    setPremiumAvatarFeedback('Não foi possível remover o acesso premium.', 'error');
    button.disabled = false;
  }
};

const deletePremiumAvatar = async avatar => {
  if (!window.confirm(`Excluir ${avatar.name} do catálogo premium e remover o acesso de todos os jogadores?`)) return;
  setPremiumAvatarFeedback(`Excluindo ${avatar.name}…`);
  try {
    const batch = writeBatch(db);
    users.forEach(user => {
      if (!(user.premiumAvatarIds || []).includes(avatar.id)) return;
      const nextIds = user.premiumAvatarIds.filter(id => id !== avatar.id);
      const privateUpdate = { premiumAvatarIds: nextIds, updatedAt: serverTimestamp() };
      const publicUpdate = { premiumAvatarIds: nextIds, updatedAt: serverTimestamp() };
      if (user.avatarId === avatar.id) {
        privateUpdate.avatarId = DEFAULT_AVATAR_ID;
        publicUpdate.avatarId = DEFAULT_AVATAR_ID;
        user.avatarId = DEFAULT_AVATAR_ID;
      }
      user.premiumAvatarIds = nextIds;
      batch.update(doc(db, 'users', user.id), privateUpdate);
      batch.set(doc(db, 'publicProfiles', user.id), publicUpdate, { merge: true });
    });
    batch.delete(doc(db, 'premiumAvatarCatalog', avatar.id));
    await batch.commit();
    premiumAvatars = premiumAvatars.filter(item => item.id !== avatar.id);
    resetPremiumAvatarForm();
    renderPremiumAvatars();
    renderUsers();
    setPremiumAvatarFeedback(`${avatar.name} excluído do catálogo.`, 'success');
  } catch (error) {
    setPremiumAvatarFeedback('Não foi possível excluir o avatar premium.', 'error');
  }
};

const renderPremiumAvatars = () => {
  if (!premiumAvatarList) return;
  premiumAvatarList.replaceChildren();
  if (!premiumAvatars.length) {
    const empty = document.createElement('div');
    empty.className = 'admin-empty';
    empty.textContent = 'Nenhum avatar premium cadastrado.';
    premiumAvatarList.append(empty);
    return;
  }

  premiumAvatars.forEach(avatar => {
    const card = document.createElement('article');
    card.className = 'premium-avatar-card';
    const visual = document.createElement('div');
    visual.className = 'premium-avatar-visual';
    const image = document.createElement('img');
    image.src = avatar.imageUrl;
    image.alt = avatar.name;
    const badge = document.createElement('span');
    badge.textContent = 'PREMIUM';
    visual.append(image, badge);

    const content = document.createElement('div');
    content.className = 'premium-avatar-content';
    const heading = document.createElement('div');
    heading.className = 'premium-avatar-heading';
    const name = document.createElement('strong');
    name.textContent = avatar.name;
    const actions = document.createElement('div');
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Editar';
    edit.addEventListener('click', () => editPremiumAvatar(avatar));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Excluir';
    remove.addEventListener('click', () => deletePremiumAvatar(avatar));
    actions.append(edit, remove);
    heading.append(name, actions);

    const eligibleUsers = users.filter(user => !(user.premiumAvatarIds || []).includes(avatar.id));
    const grant = document.createElement('div');
    grant.className = 'premium-avatar-grant';
    const select = document.createElement('select');
    select.setAttribute('aria-label', `Escolher jogador para ${avatar.name}`);
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = eligibleUsers.length ? 'Selecionar jogador…' : 'Todos os jogadores já autorizados';
    select.append(placeholder);
    eligibleUsers.forEach(user => {
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = user.displayName || user.email || 'Membro EXBR';
      select.append(option);
    });
    const grantButton = document.createElement('button');
    grantButton.type = 'button';
    grantButton.textContent = 'Conceder';
    grantButton.disabled = !eligibleUsers.length;
    grantButton.addEventListener('click', () => {
      if (!select.value) {
        setPremiumAvatarFeedback('Selecione um jogador para conceder o avatar.', 'error');
        return;
      }
      grantPremiumAvatar(avatar, select.value, grantButton);
    });
    grant.append(select, grantButton);

    const assignments = document.createElement('div');
    assignments.className = 'premium-assignments';
    const assignedUsers = users.filter(user => (user.premiumAvatarIds || []).includes(avatar.id));
    if (!assignedUsers.length) {
      const empty = document.createElement('span');
      empty.className = 'premium-assignments-empty';
      empty.textContent = 'Ainda não concedido a nenhum jogador.';
      assignments.append(empty);
    } else {
      assignedUsers.forEach(user => {
        const assignment = document.createElement('span');
        assignment.className = 'premium-assignment';
        assignment.append(document.createTextNode(user.displayName || user.email || 'Membro EXBR'));
        const revoke = document.createElement('button');
        revoke.type = 'button';
        revoke.textContent = '×';
        revoke.setAttribute('aria-label', `Remover ${avatar.name} de ${user.displayName || user.email}`);
        revoke.addEventListener('click', () => revokePremiumAvatar(avatar, user, revoke));
        assignment.append(revoke);
        assignments.append(assignment);
      });
    }
    content.append(heading, grant, assignments);
    card.append(visual, content);
    premiumAvatarList.append(card);
  });
};

const savePremiumAvatar = async event => {
  event.preventDefault();
  if (!premiumAvatarForm) return;
  const submit = premiumAvatarForm.querySelector('[type="submit"]');
  const avatarId = premiumAvatarForm.elements.avatarId.value;
  const name = premiumAvatarForm.elements.name.value.trim();
  const sourceUrl = premiumAvatarForm.elements.imageUrl.value.trim();
  submit.disabled = true;
  setPremiumAvatarFeedback('Arquivando a imagem no Cloudinary…');
  try {
    const imageUrl = await archiveImage(sourceUrl);
    const reference = avatarId ? doc(db, 'premiumAvatarCatalog', avatarId) : doc(collection(db, 'premiumAvatarCatalog'));
    const data = { name, imageUrl, updatedAt: serverTimestamp() };
    if (!avatarId) data.createdAt = serverTimestamp();
    await setDoc(reference, data, { merge: true });
    const saved = { id: reference.id, name, imageUrl };
    const index = premiumAvatars.findIndex(avatar => avatar.id === reference.id);
    if (index >= 0) premiumAvatars[index] = { ...premiumAvatars[index], ...saved };
    else premiumAvatars.push(saved);
    premiumAvatars.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    resetPremiumAvatarForm();
    renderPremiumAvatars();
    renderUsers();
    setPremiumAvatarFeedback(`${name} salvo no catálogo premium.`, 'success');
  } catch (error) {
    setPremiumAvatarFeedback(error.message || 'Não foi possível salvar o avatar premium.', 'error');
  } finally {
    submit.disabled = false;
  }
};

const loadData = async () => {
  const [rankResponse, medalDefinitions, gallerySnapshot, premiumAvatarSnapshot] = await Promise.all([
    fetch('../data/patentes.json'),
    loadMedalCatalog(),
    getDocs(collection(db, 'communityGallery')).catch(() => null),
    getDocs(collection(db, 'premiumAvatarCatalog')).catch(() => null)
  ]);
  const rankData = await rankResponse.json();
  ranks = [...rankData.patentes].sort((a, b) => a.ordem - b.ordem);
  medals = medalDefinitions.sort((first, second) => first.nome.localeCompare(second.nome, 'pt-BR'));
  galleryItems = gallerySnapshot
    ? gallerySnapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    : [];
  premiumAvatars = premiumAvatarSnapshot
    ? premiumAvatarSnapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'))
    : [];
  galleryItems = await migrateGalleryImages(galleryItems);
  await migrateOperationImages();
  renderMedals();
  renderGalleryAdmin();
  renderPremiumAvatars();
  setAdminMedalFeedback(`${medals.length} ${medals.length === 1 ? 'medalha disponível' : 'medalhas disponíveis'} para edição.`, 'success');

  stopUsersListener?.();
  stopUsersListener = onSnapshot(collection(db, 'users'), async usersSnapshot => {
    users = usersSnapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    users.sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '', 'pt-BR'));
    renderUsers();
    renderPremiumAvatars();
    setFeedback(`${users.length} membro${users.length === 1 ? '' : 's'} no registro. Atualização automática ativa.`, 'success');

    const publicBatch = writeBatch(db);
    users.forEach(user => publicBatch.set(doc(db, 'publicProfiles', user.id), publicProfileData(user), { merge: true }));
    if (users.length) {
      try { await publicBatch.commit(); } catch (error) { /* A lista privada permanece atualizada. */ }
    }
  }, () => {
    setFeedback('A atualização automática da lista foi interrompida. Recarregue o painel.', 'error');
  });
};

search?.addEventListener('input', renderUsers);
medalSearch?.addEventListener('input', renderMedals);
adminMedalSearch?.addEventListener('input', renderMedals);
medalCreate?.addEventListener('click', () => openMedalEditor());
adminMedalCreate?.addEventListener('click', () => openMedalEditor());
premiumAvatarForm?.addEventListener('submit', savePremiumAvatar);
premiumAvatarCancel?.addEventListener('click', () => {
  resetPremiumAvatarForm();
  setPremiumAvatarFeedback('Edição cancelada.');
});
adminTabs.forEach(tab => tab.addEventListener('click', () => {
  const target = tab.dataset.adminTab;
  adminTabs.forEach(item => item.setAttribute('aria-selected', String(item === tab)));
  adminPanels.forEach(panel => { panel.hidden = panel.dataset.adminPanel !== target; });
  if (adminTitle) adminTitle.textContent = target === 'medals'
    ? 'Gestão de medalhas'
    : target === 'premium-avatars'
      ? 'Gestão de avatares premium'
      : target === 'gallery'
        ? 'Gestão da galeria'
        : 'Gestão de soldados';
  if (target === 'medals') renderMedals();
  if (target === 'premium-avatars') renderPremiumAvatars();
}));
galleryForm?.addEventListener('submit', saveGalleryItem);
[...document.querySelectorAll('input[type="date"]')].forEach(field => field.addEventListener('click', () => {
  try { field.showPicker?.(); } catch (error) { /* O campo continua editável quando showPicker não está disponível. */ }
}));
dialogClose?.addEventListener('click', () => dialog?.close());
dialog?.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
});
medalEditorClose?.addEventListener('click', () => medalEditor?.close());
medalEditor?.addEventListener('click', event => {
  if (event.target === medalEditor) medalEditor.close();
});
medalEditorForm?.addEventListener('submit', saveMedalDefinition);
logoutButton?.addEventListener('click', async () => {
  logoutButton.disabled = true;
  await signOut(auth);
  window.location.replace('login.html');
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.replace('login.html');
    return;
  }

  try {
    const snapshot = await getDoc(doc(db, 'users', user.uid));
    if (!snapshot.exists() || snapshot.data().role !== 'admin') {
      window.location.replace('perfil.html');
      return;
    }
    currentAdmin = user;
    await loadData();
  } catch (error) {
    setFeedback('Não foi possível abrir o painel administrativo.', 'error');
  }
});
