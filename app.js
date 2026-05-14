const API_URL='https://script.google.com/macros/s/AKfycbwq5E37ppvTLWuDjm55EyI2VLuDfaQB3g2BHKXDNOjyaGj8u7_zI9Ve_quH6T8SStD8/exec';
const DATA_URL='data/orders.json?cache=';
let orders=[];let currentFilter='all';
const $=s=>document.querySelector(s);const $$=s=>document.querySelectorAll(s);
document.addEventListener('DOMContentLoaded',()=>{bind();loadOrders();if('serviceWorker'in navigator){navigator.serviceWorker.register('service-worker.js');}});
function bind(){
  $('#openModalBtn').onclick=()=>openModal();$('#closeModalBtn').onclick=closeModal;$('#refreshBtn').onclick=loadOrders;
  $('#orderForm').addEventListener('submit',saveOrder);$('#searchInput').addEventListener('input',renderOrders);
  $$('.filter').forEach(b=>b.onclick=()=>{$$('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');currentFilter=b.dataset.filter;renderOrders();});
  $('#photoInput').addEventListener('change',handlePhotoUpload);
}
async function api(action,data={}){const res=await fetch(API_URL,{method:'POST',body:JSON.stringify({action,...data})});return res.json();}
async function loadOrders(){
  $('#ordersList').innerHTML='<p>იტვირთება...</p>';
  try{
    const res=await fetch(DATA_URL+Date.now(),{cache:'no-store'});
    orders=await res.json();
    if(!Array.isArray(orders))orders=[];
    localStorage.setItem('zgapariyo_orders_cache',JSON.stringify(orders));
  }catch(e){
    orders=JSON.parse(localStorage.getItem('zgapariyo_orders_cache')||'[]');
  }
  renderOrders();
}
function renderOrders(){const q=$('#searchInput').value.toLowerCase().trim();let list=[...orders];if(currentFilter!=='all')list=list.filter(o=>o.status===currentFilter);if(q)list=list.filter(o=>[o.id,o.parentName,o.phone].join(' ').toLowerCase().includes(q));$('#ordersList').innerHTML=list.map(orderCard).join('')||'<p>შეკვეთები არ არის.</p>';updateSummary();}
function updateSummary(){const current=orders.filter(o=>o.status==='მიმდინარე').length;const sent=orders.filter(o=>o.status==='გაგზავნილი').length;const left=orders.reduce((s,o)=>s+(Number(o.leftAmount)||0),0);$('#currentCount').textContent=current;$('#sentCount').textContent=sent;$('#leftSum').textContent=left.toFixed(2)+' ₾';}
function orderCard(o){const badge=o.status==='გაგზავნილი'?'sent':'current';return `<div class='order'><div class='order-header'><div><strong>${o.id}</strong><div class='meta'>შექმნა: ${o.createdAt}${o.daysLeft?'<br>'+o.daysLeft:''}</div></div><span class='badge ${badge}'>${o.status}</span></div><div class='meta'><b>${escapeHtml(o.parentName)}</b><br>${escapeHtml(o.phone)}<br>${escapeHtml(o.address)}<br>ფასი: ${num(o.totalPrice)} ₾ | გადახდილი: ${num(o.paidAmount)} ₾ | დარჩენილი: ${num(o.leftAmount)} ₾</div>${o.note?`<div class='meta'><br>${escapeHtml(o.note)}</div>`:''}${o.photoUrl?`<img class='thumb' loading='lazy' src='${o.photoUrl}' alt='photo'>`:''}<div class='actions'><button class='action-btn' onclick='editOrder("${o.id}")'>რედაქტირება</button><button class='action-btn' onclick='addPaymentPrompt("${o.id}")'>+ გადახდა</button>${o.status!=='გაგზავნილი'?`<button class='action-btn' onclick='markSent("${o.id}")'>გაგზავნილია</button>`:''}</div></div>`;}
function openModal(order=null){$('#modal').classList.remove('hidden');$('#formMessage').textContent='';$('#orderForm').reset();$('#paidAmount').value=0;$('#status').value='მიმდინარე';$('#orderId').value='';$('#modalTitle').textContent='ახალი შეკვეთა';if(order){$('#modalTitle').textContent='რედაქტირება';$('#orderId').value=order.id;$('#parentName').value=order.parentName||'';$('#phone').value=order.phone||'';$('#address').value=order.address||'';$('#totalPrice').value=order.totalPrice||'';$('#paidAmount').value=order.paidAmount||0;$('#dueDate').value=order.dueDateRaw||'';$('#photoUrl').value=order.photoUrl||'';$('#note').value=order.note||'';$('#status').value=order.status||'მიმდინარე';}}
function closeModal(){$('#modal').classList.add('hidden');}
async function saveOrder(e){e.preventDefault();const id=$('#orderId').value;const order={parentName:$('#parentName').value,phone:$('#phone').value,address:$('#address').value,totalPrice:Number($('#totalPrice').value||0),paidAmount:Number($('#paidAmount').value||0),dueDate:$('#dueDate').value,photoUrl:$('#photoUrl').value,note:$('#note').value,status:$('#status').value};$('#formMessage').textContent='ინახება...';let data;if(id){data=await api('updateOrder',{id,order});}else{data=await api('createOrder',{order});}if(data&&data.ok&&data.order){upsertLocal(data.order);}$('#formMessage').textContent='შენახულია ✓';closeModal();renderOrders();setTimeout(loadOrders,1200);}
function upsertLocal(order){const i=orders.findIndex(o=>o.id===order.id);if(i>=0)orders[i]=order;else orders.unshift(order);localStorage.setItem('zgapariyo_orders_cache',JSON.stringify(orders));}
async function editOrder(id){const order=orders.find(o=>o.id===id);if(order)openModal(order);}
async function addPaymentPrompt(id){const amount=prompt('რამდენი გადაიხადა?');if(!amount)return;const data=await api('addPayment',{id,amount:Number(amount)});if(data&&data.ok&&data.order)upsertLocal(data.order);renderOrders();setTimeout(loadOrders,1200);}
async function markSent(id){const data=await api('markSent',{id});if(data&&data.ok&&data.order)upsertLocal(data.order);renderOrders();setTimeout(loadOrders,1200);}
async function handlePhotoUpload(){const file=$('#photoInput').files[0];if(!file)return;$('#formMessage').textContent='ფოტო იტვირთება...';const base64=await fileToBase64(file);const data=await api('uploadImage',{imageBase64:base64});if(data.url){$('#photoUrl').value=data.url;$('#formMessage').textContent='ფოტო ატვირთულია ✓';}else{$('#formMessage').textContent='ატვირთვა ვერ მოხერხდა';}}
function fileToBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});}
function num(v){return Number(v||0).toFixed(2);}function escapeHtml(s){return String(s||'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
