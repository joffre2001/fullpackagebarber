document.addEventListener('DOMContentLoaded', () => {
  const yearElement = document.getElementById('currentYear');
  const BOOKING_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyyW9Z50EmNYSlRC3QFCbjq7z5BdOC4wpg8DnVLbwLz9UoeNFTyuzp3h-vJcm4bXe5D/exec';

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  const bookingForm = document.getElementById('bookingForm');
  const bookingStatus = document.getElementById('bookingStatus');

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
    const phone = '5542999999999';
    const text = encodeURIComponent(createBookingMessage(booking));
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const sendEmail = (booking) => {
    const subject = encodeURIComponent(`Agendamento - ${booking.service}`);
    const body = encodeURIComponent(createBookingMessage(booking));
    window.location.href = `mailto:EMAIL_PLACEHOLDER?subject=${subject}&body=${body}`;
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

  const saveBooking = async (booking) => {
    const payload = {
      ...booking,
      createdAt: new Date().toISOString()
    };

    const localBookings = JSON.parse(localStorage.getItem('fullPacakageBookings') || '[]');
    localBookings.push(payload);
    localStorage.setItem('fullPacakageBookings', JSON.stringify(localBookings));

    if (!BOOKING_ENDPOINT || BOOKING_ENDPOINT.includes('PASTE_')) {
      return;
    }

    try {
      await fetch(BOOKING_ENDPOINT, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Unable to sync booking to remote server:', error);
    }
  };

  if (bookingForm) {
    bookingForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const formData = new FormData(bookingForm);
      const booking = Object.fromEntries(formData.entries());

      if (!booking.name || !booking.phone || !booking.service || !booking.date || !booking.time) {
        bookingStatus.textContent = 'Preencha todos os campos obrigatórios antes de confirmar o agendamento.';
        bookingStatus.classList.remove('d-none', 'text-success');
        bookingStatus.classList.add('text-danger');
        return;
      }

      await saveBooking(booking);

      bookingStatus.textContent = 'Agendamento salvo. WhatsApp, e-mail e calendário foram preparados para concluir a reserva.';
      bookingStatus.classList.remove('d-none', 'text-danger');
      bookingStatus.classList.add('text-success');
      bookingForm.reset();

      setTimeout(() => openWhatsApp(booking), 200);
      setTimeout(() => sendEmail(booking), 500);
      setTimeout(() => {
        openGoogleCalendar(booking);
        downloadIcsFile(booking);
      }, 800);
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
