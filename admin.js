const RESERVATIONS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzsD76pZcDMS9sZkAMwlMycc0AKZ1g_8MpgZCWkrcm1YYc-87PgBnInj6VdBHHRmPjV/exec';

const bookingsBody = document.getElementById('reservationsBody');
const refreshButton = document.getElementById('refreshButton');

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
      <td>${booking.name || '-'}</td>
      <td>${booking.phone || '-'}</td>
      <td>${booking.service || '-'}</td>
      <td>${formatDate(booking.date)}</td>
      <td>${booking.time || '-'}</td>
      <td>${booking.notes || '-'}</td>
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
    const response = await fetch(RESERVATIONS_ENDPOINT);

    if (!response.ok) {
      throw new Error('Erro ao carregar reservas');
    }

    const data = await response.json();
    renderRows(data);
  } catch (error) {
    bookingsBody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Não foi possível carregar as reservas.</td></tr>';
  }
};

refreshButton.addEventListener('click', loadReservations);
loadReservations();
