const API_URL = 'https://api.github.com/repos/mamuluxgeo-cmd/zgapariyo/contents/data/orders.json';
const RAW_URL = 'data/orders.json?cache=';
const IMGBB_KEY = '9bae22f8073c39773f9ce6190ef54fe2';

// აქ ჩასვი შენი GitHub token ბრჭყალებს შორის
const GITHUB_TOKEN = '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';

let orders = [];
let currentSha = '';
let currentFilter = 'all';

const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);

document.addEventListener('DOMContentLoaded', () => {
  bind();
  loadOrders();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
  }
});

function bind() {
  $('#openModalBtn').onclick = () => openModal();
  $('#closeModalBtn').onclick = closeModal;
  $('#refreshBtn').onclick = loadOrders;

  $('#orderForm').addEventListener('submit', saveOrder);
  $('#searchInput').addEventListener('input', renderOrders);

  $$('.filter').forEach(button => {
    button.onclick = () => {
      $$('.filter').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      currentFilter = button.dataset.filter;
      renderOrders();
    };
  });

  $('#photoInput').addEventListener('change', handlePhotoUpload);
}

async function loadOrders() {
  $('#ordersList').innerHTML = '<p>იტვირთება...</p>';

  try {
    const file = await getGitHubFile();
    currentSha = file.sha;

    const content = decodeBase64(file.content || '');
    orders = JSON.parse(content || '[]');

    if (!Array.isArray(orders)) {
      orders = [];
    }

    localStorage.setItem('zgapariyo_orders_cache', JSON.stringify(orders));
  } catch (error) {
    try {
      const response = await fetch(RAW_URL + Date.now(), { cache: 'no-store' });
      orders = await response.json();

      if (!Array.isArray(orders)) {
        orders = [];
      }
    } catch (fallbackError) {
      orders = JSON.parse(localStorage.getItem('zgapariyo_orders_cache') || '[]');
    }
  }

  renderOrders();
}

async function getGitHubFile() {
  const response = await fetch(API_URL + '?ref=main&cache=' + Date.now(), {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + GITHUB_TOKEN,
      Accept: 'application/vnd.github+json'
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

async function saveDatabase() {
  const freshFile = await getGitHubFile();
  currentSha = freshFile.sha;

  const content = encodeBase64(JSON.stringify(orders, null, 2) + '\n');

  const response = await fetch(API_URL, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + GITHUB_TOKEN,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: 'Update Zgapariyo orders database',
      content,
      sha: currentSha,
      branch: 'main'
    })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json();

  if (data.content && data.content.sha) {
    currentSha = data.content.sha;
  }

  localStorage.setItem('zgapariyo_orders_cache', JSON.stringify(orders));
}

function renderOrders() {
  const query = $('#searchInput').value.toLowerCase().trim();

  let list = [...orders];

  if (currentFilter !== 'all') {
    list = list.filter(order => order.status === currentFilter);
  }

  if (query) {
    list = list.filter(order => {
      return [
        order.id,
        order.parentName,
        order.phone
      ].join(' ').toLowerCase().includes(query);
    });
  }

  $('#ordersList').innerHTML = list.map(orderCard).join('') || '<p>შეკვეთები არ არის.</p>';

  updateSummary();
}

function updateSummary() {
  const current = orders.filter(order => order.status === 'მიმდინარე').length;
  const sent = orders.filter(order => order.status === 'გაგზავნილი').length;
  const left = orders.reduce((sum, order) => sum + (Number(order.leftAmount) || 0), 0);

  $('#currentCount').textContent = current;
  $('#sentCount').textContent = sent;
  $('#leftSum').textContent = left.toFixed(2) + ' ₾';
}

function orderCard(order) {
  const badgeClass = order.status === 'გაგზავნილი' ? 'sent' : 'current';

  return `
    <div class="order">
      <div class="order-header">
        <div>
          <strong>${escapeHtml(order.id)}</strong>
          <div class="meta">
            შექმნა: ${escapeHtml(order.createdAt || '')}
            ${order.daysLeft ? '<br>' + escapeHtml(order.daysLeft) : ''}
          </div>
        </div>
        <span class="badge ${badgeClass}">${escapeHtml(order.status || '')}</span>
      </div>

      <div class="meta">
        <b>${escapeHtml(order.parentName)}</b><br>
        ${escapeHtml(order.phone)}<br>
        ${escapeHtml(order.address)}<br>
        ფასი: ${num(order.totalPrice)} ₾ |
        გადახდილი: ${num(order.paidAmount)} ₾ |
        დარჩენილი: ${num(order.leftAmount)} ₾
      </div>

      ${order.note ? `<div class="meta"><br>${escapeHtml(order.note)}</div>` : ''}

      ${order.photoUrl ? `<img class="thumb" loading="lazy" src="${escapeHtml(order.photoUrl)}" alt="photo">` : ''}

      <div class="actions">
        <button class="action-btn" onclick="editOrder('${escapeForJs(order.id)}')">რედაქტირება</button>
        <button class="action-btn" onclick="addPaymentPrompt('${escapeForJs(order.id)}')">+ გადახდა</button>
        ${order.status !== 'გაგზავნილი'
          ? `<button class="action-btn" onclick="markSent('${escapeForJs(order.id)}')">გაგზავნილია</button>`
          : ''
        }
      </div>
    </div>
  `;
}

function openModal(order = null) {
  $('#modal').classList.remove('hidden');
  $('#formMessage').textContent = '';
  $('#orderForm').reset();

  $('#paidAmount').value = 0;
  $('#status').value = 'მიმდინარე';
  $('#orderId').value = '';
  $('#modalTitle').textContent = 'ახალი შეკვეთა';

  if (order) {
    $('#modalTitle').textContent = 'რედაქტირება';
    $('#orderId').value = order.id || '';
    $('#parentName').value = order.parentName || '';
    $('#phone').value = order.phone || '';
    $('#address').value = order.address || '';
    $('#totalPrice').value = order.totalPrice || '';
    $('#paidAmount').value = order.paidAmount || 0;
    $('#dueDate').value = order.dueDateRaw || '';
    $('#photoUrl').value = order.photoUrl || '';
    $('#note').value = order.note || '';
    $('#status').value = order.status || 'მიმდინარე';
  }
}

function closeModal() {
  $('#modal').classList.add('hidden');
}

async function saveOrder(event) {
  event.preventDefault();

  const id = $('#orderId').value;
  const total = Number($('#totalPrice').value || 0);
  const paid = Number($('#paidAmount').value || 0);
  const due = $('#dueDate').value;

  const existing = id ? orders.find(order => order.id === id) : null;

  const order = {
    id: id || nextId(),
    createdAt: existing ? existing.createdAt : nowText(),
    parentName: $('#parentName').value.trim(),
    phone: $('#phone').value.trim(),
    address: $('#address').value.trim(),
    totalPrice: total,
    paidAmount: paid,
    leftAmount: Math.max(total - paid, 0),
    dueDate: due ? formatDate(due) : '',
    dueDateRaw: due,
    daysLeft: due ? daysLeftText(due) : '',
    photoUrl: $('#photoUrl').value.trim(),
    note: $('#note').value.trim(),
    status: $('#status').value,
    updatedAt: nowText()
  };

  $('#formMessage').textContent = 'ინახება...';

  try {
    upsertLocal(order);
    renderOrders();

    await saveDatabase();

    $('#formMessage').textContent = 'შენახულია ✓';
    closeModal();
  } catch (error) {
    $('#formMessage').textContent = 'შეცდომა: ' + error.message;
    alert('შეკვეთა ეკრანზე დაემატა, მაგრამ GitHub-ში ვერ ჩაიწერა:\n\n' + error.message);
  }
}

function upsertLocal(order) {
  const index = orders.findIndex(item => item.id === order.id);

  if (index >= 0) {
    orders[index] = order;
  } else {
    orders.unshift(order);
  }

  localStorage.setItem('zgapariyo_orders_cache', JSON.stringify(orders));
}

function editOrder(id) {
  const order = orders.find(item => item.id === id);

  if (order) {
    openModal(order);
  }
}

async function addPaymentPrompt(id) {
  const amount = Number(prompt('რამდენი გადაიხადა?') || 0);

  if (!amount) {
    return;
  }

  const order = orders.find(item => item.id === id);

  if (!order) {
    return;
  }

  order.paidAmount = Number(order.paidAmount || 0) + amount;
  order.leftAmount = Math.max(Number(order.totalPrice || 0) - Number(order.paidAmount || 0), 0);
  order.updatedAt = nowText();

  try {
    upsertLocal(order);
    renderOrders();
    await saveDatabase();
  } catch (error) {
    alert('შეცდომა: ' + error.message);
  }
}

async function markSent(id) {
  const order = orders.find(item => item.id === id);

  if (!order) {
    return;
  }

  order.status = 'გაგზავნილი';
  order.updatedAt = nowText();

  try {
    upsertLocal(order);
    renderOrders();
    await saveDatabase();
  } catch (error) {
    alert('შეცდომა: ' + error.message);
  }
}

async function handlePhotoUpload() {
  const file = $('#photoInput').files[0];

  if (!file) {
    return;
  }

  $('#formMessage').textContent = 'ფოტო იტვირთება...';

  try {
    const base64 = await fileToBase64(file);
    const cleanBase64 = base64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

    const formData = new FormData();
    formData.append('image', cleanBase64);

    const response = await fetch('https://api.imgbb.com/1/upload?key=' + IMGBB_KEY, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      $('#photoUrl').value = data.data.url;
      $('#formMessage').textContent = 'ფოტო ატვირთულია ✓';
    } else {
      $('#formMessage').textContent = 'ატვირთვა ვერ მოხერხდა';
    }
  } catch (error) {
    $('#formMessage').textContent = 'ატვირთვა ვერ მოხერხდა';
  }
}

function nextId() {
  let max = 0;

  orders.forEach(order => {
    const number = Number(String(order.id || '').replace('ZG-', ''));

    if (!isNaN(number) && number > max) {
      max = number;
    }
  });

  return 'ZG-' + String(max + 1).padStart(4, '0');
}

function daysLeftText(dateValue) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dateValue);
  due.setHours(0, 0, 0, 0);

  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff > 0) {
    return 'დარჩა ' + diff + ' დღე';
  }

  if (diff === 0) {
    return 'დღეს არის ვადა';
  }

  return 'ვადა გადაცდა ' + Math.abs(diff) + ' დღით';
}

function nowText() {
  return new Date().toLocaleString('ka-GE', {
    hour12: false
  });
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('ka-GE');
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function encodeBase64(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

function decodeBase64(base64) {
  return decodeURIComponent(escape(atob(String(base64).replace(/\n/g, ''))));
}

function num(value) {
  return Number(value || 0).toFixed(2);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, match => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[match]));
}

function escapeForJs(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
