const menuButton = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('#navLinks');

if (menuButton && navLinks) {
  menuButton.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('is-open');
    document.body.classList.toggle('menu-open', isOpen);
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('is-open');
      document.body.classList.remove('menu-open');
      menuButton.setAttribute('aria-expanded', 'false');
    });
  });
}

const sampleGallery = document.querySelector('#sampleGallery');

const samples = [
  {
    title: 'ანიმაციური 3D ზღაპრის ნიმუში',
    text: 'ფერადი, თბილი და ბავშვური ვიზუალი — იდეალურია მხიარული ზღაპრისთვის.',
    icon: '🏰',
    image: 'samples/sample-1.jpg'
  },
  {
    title: 'რეალისტური ზღაპრული ნიმუში',
    text: 'ნაზი და ბუნებრივი გამოსახულება, სადაც ბავშვი რეალურ ზღაპრის გმირს ჰგავს.',
    icon: '🌙',
    image: 'samples/sample-2.jpg'
  },
  {
    title: 'დაბეჭდილი წიგნის მაგალითი',
    text: 'საშუალოდ 16 გვერდიანი ზღაპარი, რომელიც იკვრება წიგნად და იგზავნება კურიერით.',
    icon: '📖',
    image: 'samples/sample-3.jpg'
  }
];

function createSampleCard(sample) {
  const card = document.createElement('article');
  card.className = 'sample-card';

  const imageWrap = document.createElement('div');
  imageWrap.className = 'sample-image';

  const img = document.createElement('img');
  img.src = sample.image;
  img.alt = sample.title;
  img.loading = 'lazy';

  const placeholder = document.createElement('div');
  placeholder.className = 'sample-placeholder';
  placeholder.textContent = sample.icon;

  img.addEventListener('load', () => {
    placeholder.remove();
  });

  img.addEventListener('error', () => {
    img.remove();
  });

  imageWrap.append(img, placeholder);

  const content = document.createElement('div');
  content.className = 'sample-content';
  content.innerHTML = `<h3>${sample.title}</h3><p>${sample.text}</p>`;

  card.append(imageWrap, content);
  return card;
}

if (sampleGallery) {
  samples.forEach((sample) => sampleGallery.appendChild(createSampleCard(sample)));
}
