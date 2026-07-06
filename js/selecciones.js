const API_URL = 'http://localhost:3000/api/selecciones';
let teams = [];

const searchInput = document.getElementById('searchInput');
const groupFilter = document.getElementById('groupFilter');
const teamsGrid = document.getElementById('teamsGrid');
const teamModal = document.getElementById('teamModal');
const modalClose = document.getElementById('modalClose');
const modalFlag = document.getElementById('modalFlag');
const modalTeamName = document.getElementById('modalTeamName');
const modalGroupBadge = document.getElementById('modalGroupBadge');
const modalRanking = document.getElementById('modalRanking');
const modalCoach = document.getElementById('modalCoach');
const modalGroup = document.getElementById('modalGroup');
const modalStadium = document.getElementById('modalStadium');
const modalHistory = document.getElementById('modalHistory');
const modalPros = document.getElementById('modalPros');
const modalCons = document.getElementById('modalCons');
const modalMapLink = document.getElementById('modalMapLink');

function init() {
  searchInput.addEventListener('input', updateTeamList);
  groupFilter.addEventListener('change', updateTeamList);
  modalClose.addEventListener('click', closeModal);
  teamModal.addEventListener('click', (event) => {
    if (event.target === teamModal) {
      closeModal();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
    }
  });

  loadTeams();
}

function renderGroupFilter() {
  groupFilter.innerHTML = '<option value="all">Todos los grupos</option>';

  const groups = Array.from(new Set(teams.map(team => team.group))).sort();
  groups.forEach((group) => {
    const option = document.createElement('option');
    option.value = group;
    option.textContent = 'Grupo ' + group;
    groupFilter.appendChild(option);
  });
}

async function loadTeams() {
  renderLoading();

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const results = await response.json();
    teams = results.map(normalizeTeam);
    renderGroupFilter();
    renderTeams(teams);
  } catch (error) {
    renderError('No se pudo cargar la información desde la base de datos.');
    console.error('Error cargando selecciones:', error);
  }
}

function normalizeTeam(row) {
  return {
    id: row.id_seleccion,
    name: row.nombre_seleccion || 'Sin nombre',
    flag: row.bandera || '🏳️',
    group: row.nombre_grupo || 'Sin grupo',
    ranking: row.ranking || 'N/D',
    history: row.historia || 'Sin información disponible.',
    pros: parseList(row.ventajas),
    cons: parseList(row.desventajas),
    coach: row.entrenador || 'N/D',
    stadium: row.estadio || row.estadio_nombre || 'N/D',
    map: buildMapUrl(row.estadio || row.estadio_nombre || row.nombre_seleccion)
  };
}

function parseList(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return value
    .toString()
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function buildMapUrl(place) {
  const location = place || 'Estadio';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

function renderLoading() {
  teamsGrid.innerHTML = '<div class="loading">Cargando selecciones...</div>';
}

function renderError(message) {
  teamsGrid.innerHTML = '';
  const errorElement = document.createElement('div');
  errorElement.className = 'error-message';
  errorElement.textContent = message;
  teamsGrid.appendChild(errorElement);
}

function updateTeamList() {
  const searchValue = searchInput.value.toLowerCase().trim();
  const selectedGroup = groupFilter.value;

  const filteredTeams = teams.filter((team) => {
    const matchesName = team.name.toLowerCase().includes(searchValue);
    const matchesGroup = selectedGroup === 'all' || team.group === selectedGroup;
    return matchesName && matchesGroup;
  });

  renderTeams(filteredTeams);
}

function renderTeams(teamList) {
  teamsGrid.innerHTML = '';

  if (teamList.length === 0) {
    const noResult = document.createElement('div');
    noResult.className = 'no-results';
    noResult.textContent = 'No se encontró ninguna selección que coincida con la búsqueda.';
    teamsGrid.appendChild(noResult);
    return;
  }

  teamList.forEach((team) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'team-card';
    card.innerHTML = `
      <div class="flag">${team.flag}</div>
      <div class="team-name">${team.name}</div>
      <div class="team-meta">
        <span>${team.ranking}</span>
        <span class="badge">Grupo ${team.group}</span>
      </div>
      <button class="cta" type="button">Ver ficha</button>
    `;

    card.addEventListener('click', () => openModal(team));
    teamsGrid.appendChild(card);
  });
}

function openModal(team) {
  modalFlag.textContent = team.flag;
  modalTeamName.textContent = team.name;
  modalGroupBadge.textContent = 'Grupo ' + team.group;
  modalRanking.textContent = team.ranking;
  modalCoach.textContent = team.coach;
  modalGroup.textContent = team.group;
  modalStadium.textContent = team.stadium;
  modalHistory.textContent = team.history;
  modalPros.innerHTML = team.pros.map(item => `<li>${item}</li>`).join('');
  modalCons.innerHTML = team.cons.map(item => `<li>${item}</li>`).join('');
  modalMapLink.href = team.map;
  teamModal.classList.add('active');
  teamModal.querySelector('.modal-box').focus();
}

function closeModal() {
  teamModal.classList.remove('active');
}

init();
