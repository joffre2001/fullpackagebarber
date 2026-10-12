document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.service-card').forEach(card => {
    const name = card.querySelector('h3').textContent.trim();
    const link = document.createElement('a');
    link.href = '#bookingForm';
    link.className = 'service-select';
    link.textContent = 'AGENDAR SERVIÇO ↗';
    link.setAttribute('aria-label', 'Agendar ' + name);
    link.addEventListener('click', () => { document.getElementById('service').value = name; });
    card.querySelector('.service-body').appendChild(link);
  });
  document.querySelectorAll('.price-card').forEach(card => {
    card.querySelector('a').addEventListener('click', () => {
      const name = card.querySelector('h3').textContent.trim();
      document.getElementById('service').value = name === 'Essencial' ? 'Corte Clássico' : name;
    });
  });
  document.querySelectorAll('a[href="#bookingForm"]').forEach(link => {
    link.addEventListener('click', () => {
      const name = document.getElementById('name');
      if (name) name.focus({ preventScroll: true });
    });
  });
  document.querySelectorAll('.navbar a[href^="#"]').forEach(link => {
    link.addEventListener('click', () => {
      const menu = document.getElementById('navbarNav');
      if (window.bootstrap && menu.classList.contains('show')) {
        window.bootstrap.Collapse.getOrCreateInstance(menu).hide();
      }
    });
  });
});

