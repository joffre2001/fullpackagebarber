document.addEventListener('DOMContentLoaded', () => {
  const yearElement = document.getElementById('currentYear');
  const BOOKING_ENDPOINT = 'https://script.google.com/macros/s/AKfycbw5CUgGI4QOFa5w_ni8_7DRLNPVIHI5aO_O1OBTIClFaNpkFQ5AqIaZrL-x12xTxI0w/exec';

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  const bookingForm = document.getElementById('bookingForm');
  const bookingStatus = document.getElementById('bookingStatus');

  const generateBookingId = () => {
    if (window.crypto && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const createBookingMessage = (booking) => {
    const notes = booking.notes ? `\nObservações: ${booking.notes}` : '';
    return `Olá! Gostaria de agendar um serviço.\n\nNome: ${booking.name}\nTelefone: ${booking.phone}\nServiço: ${booking.service}\nData: ${formatDateForDisplay(booking.date)}\nHorário: ${booking.time}${notes}`;
  };

  const openWhatsApp = (booking) => {
    const phone = '5549984044553';
    const text = encodeURIComponent(createBookingMessage(booking));
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const sendEmail = (booking) => {
    const subject = encodeURIComponent(`Agendamento - ${booking.service}`);
    const body = encodeURIComponent(createBookingMessage(booking));
    window.location.href = `mailto:visaosoinesewilmane@gmail.com?subject=${subject}&body=${body}`;
  };

  const openGoogleCalendar = (booking) => {
    const startDate = new Date(`${booking.date}T${booking.time}:00`);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const formatCalendarDate = (date) => {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      const seconds = String(date.getUTCSeconds()).padStart(2, '0');
      return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
    };

    const details = encodeURIComponent(createBookingMessage(booking));
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Agendamento FullPacakage Barber')}&details=${details}&location=${encodeURIComponent('Rua Cunha Porã, 2625, Efapi, Chapecó - SC')}&dates=${formatCalendarDate(startDate)}/${formatCalendarDate(endDate)}`;
    window.open(url, '_blank');
  };

  const downloadIcsFile = (booking) => {
    const startDate = new Date(`${booking.date}T${booking.time}:00`);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const formatIcs = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const description = createBookingMessage(booking).replace(/\n/g, '\\n');

    const calendarData = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `UID:${Date.now()}@fullpacakagebarber`,
      `DTSTAMP:${formatIcs(new Date())}`,
      `DTSTART:${formatIcs(startDate)}`,
      `DTEND:${formatIcs(endDate)}`,
      'SUMMARY:Agendamento FullPacakage Barber',
      `DESCRIPTION:${description}`,
      'LOCATION:Rua Cunha Porã, 2625, Efapi, Chapecó - SC',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([calendarData], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'agendamento-fullpacakage-barber.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  let submitting = false;
  let retryPayload = null;
  let retryFingerprint = '';
  const saveBooking = async (booking) => {
    const fingerprint = JSON.stringify(booking);
    if (!retryPayload || fingerprint !== retryFingerprint) {
      retryFingerprint = fingerprint;
      retryPayload = { ...booking, id: generateBookingId(), status: 'pending' };
    }
    const payload = retryPayload;
    if (!BOOKING_ENDPOINT || BOOKING_ENDPOINT.includes('PASTE_')) {
      throw new Error('O agendamento online ainda não está configurado.');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(BOOKING_ENDPOINT, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'save', ...payload }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error('O servidor respondeu com erro HTTP ' + response.status + '. Tente novamente.');
      const result = await response.json();
      if (result.ok !== true) throw new Error(result.error || 'O servidor não confirmou o agendamento.');
      // Keep a local copy only after the server has acknowledged the save.
      // A storage failure must not turn a confirmed reservation into an error.
      try {
        const stored = JSON.parse(localStorage.getItem('fullPacakageBookings') || '[]');
        if (Array.isArray(stored) && !stored.some(item => item.id === payload.id)) {
          stored.push({ ...payload, syncedAt: new Date().toISOString() });
          localStorage.setItem('fullPacakageBookings', JSON.stringify(stored));
        }
      } catch (_) { /* Remote save is authoritative. */ }
      retryPayload = null;
      retryFingerprint = '';
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  };

  if (bookingForm) {
    bookingStatus.textContent = 'Preencha os campos e clique em Confirmar agendamento para enviar à barbearia.';
    bookingStatus.classList.remove('d-none');
    bookingForm.addEventListener('invalid', (event) => {
      const label = event.target.labels && event.target.labels[0];
      bookingStatus.textContent = 'Confira o campo ' + (label ? label.textContent : 'obrigatório') + ' antes de enviar.';
      bookingStatus.classList.remove('d-none', 'text-success');
      bookingStatus.classList.add('text-danger');
    }, true);
    bookingForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submitting || !bookingForm.reportValidity()) return;
      const booking = Object.fromEntries(new FormData(bookingForm).entries());
      const submit = bookingForm.querySelector('[type="submit"]');
      const originalLabel = submit.textContent;
      submitting = true;
      submit.disabled = true;
      submit.textContent = 'Enviando…';
      bookingStatus.textContent = 'Enviando sua solicitação para a barbearia…';
      bookingStatus.classList.remove('d-none', 'text-danger', 'text-success');
      try {
        const savedBooking = await saveBooking(booking);
        bookingStatus.textContent = 'Solicitação recebida pela barbearia. Aguarde a confirmação do horário.';
        bookingStatus.classList.add('text-success');
        bookingForm.reset();
        setTimeout(() => openWhatsApp(savedBooking), 200);
        setTimeout(() => sendEmail(savedBooking), 500);
        setTimeout(() => {
          openGoogleCalendar(savedBooking);
          downloadIcsFile(savedBooking);
        }, 800);
      } catch (error) {
        bookingStatus.textContent = error.name === 'AbortError'
          ? 'O servidor demorou a responder. Seus dados foram mantidos. Tente novamente nesta página para verificar o envio sem duplicar a reserva.'
          : error instanceof TypeError
            ? 'Não foi possível conectar à barbearia. Seus dados foram mantidos; verifique sua conexão e tente novamente.'
            : error instanceof SyntaxError
              ? 'O servidor retornou uma resposta inválida. Verifique a implantação do agendamento com a barbearia.'
              : error.message;
        bookingStatus.classList.add('text-danger');
      } finally {
        submitting = false;
        submit.disabled = false;
        submit.textContent = originalLabel;
      }
    });
  }

  const sections = Array.from(document.querySelectorAll('main section[id]'));
  const navLinks = Array.from(document.querySelectorAll('.nav-link'));

  const updateActiveNavLink = () => {
    let currentId = 'home';

    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();

      if (rect.top <= 180 && rect.bottom >= 180) {
        currentId = section.id;
      }
    });

    navLinks.forEach((link) => {
      const isActive = link.getAttribute('href') === `#${currentId}`;
      link.classList.toggle('active', isActive);
    });
  };

  updateActiveNavLink();
  window.addEventListener('scroll', updateActiveNavLink, { passive: true });
});

