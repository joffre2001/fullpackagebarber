const RESERVATIONS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyyW9Z50EmNYSlRC3QFCbjq7z5BdOC4wpg8DnVLbwLz9UoeNFTyuzp3h-vJcm4bXe5D/exec';

const bookingsBody = document.getElementById('reservationsBody');
const refreshButton = document.getElementById('refreshButton');
const accessForm = document.getElementById('accessForm');
const accessCard = document.getElementById('accessCard');
const accessStatus = document.getElementById('accessStatus');
const reservationsCard = document.getElementById('reservationsCard');

let adminKey = sessionStorage.getItem('fullPacakageAdminKey') || '';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatDate = (value) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

const formatDateTime = (value) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const renderRows = (rows) => {
  if (!rows || rows.length === 0) {
    bookingsBody.innerHTML = '<tr><td colspan="7" class="text-center text-secondary">Nenhuma reserva encontrada.</td></tr>';
    return;
  }

  bookingsBody.innerHTML = rows.map((booking) => `
    <tr>
      <td>${escapeHtml(booking.name || '-')}</td>
      <td>${escapeHtml(booking.phone || '-')}</td>
      <td>${escapeHtml(booking.service || '-')}</td>
      <td>${formatDate(booking.date)}</td>
      <td>${escapeHtml(booking.time || '-')}</td>
      <td>${escapeHtml(booking.notes || '-')}</td>
      <td>${formatDateTime(booking.createdAt)}</td>
    </tr>
  `).join('');
};

const loadReservations = async () => {
  if (!RESERVATIONS_ENDPOINT || RESERVATIONS_ENDPOINT.includes('PASTE_')) {
    bookingsBody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Configure o endpoint do Google Apps Script antes de usar o painel.</td></tr>';
    return;
  }

  try {
    const response = await fetch(RESERVATIONS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ action: 'list', adminKey })
    });

    if (!response.ok) {
      throw new Error('Erro ao carregar reservas');
    }

    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.error || 'Acesso negado');
    }

    accessStatus.classList.add('d-none');
    accessCard.classList.add('d-none');
    reservationsCard.classList.remove('d-none');
    refreshButton.classList.remove('d-none');
    sessionStorage.setItem('fullPacakageAdminKey', adminKey);
    renderRows(data.bookings);
  } catch (error) {
    sessionStorage.removeItem('fullPacakageAdminKey');
    accessCard.classList.remove('d-none');
    reservationsCard.classList.add('d-none');
    refreshButton.classList.add('d-none');
    accessStatus.textContent = 'Chave inválida ou não foi possível carregar as reservas.';
    accessStatus.classList.remove('d-none');
  }
};

refreshButton.addEventListener('click', loadReservations);
accessForm.addEventListener('submit', (event) => {
  event.preventDefault();
  adminKey = new FormData(accessForm).get('adminKey')?.toString().trim() || '';
  loadReservations();
});

if (adminKey) {
  loadReservations();
}
