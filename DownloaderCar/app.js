import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const SUPABASE_URL = "https://npqmmxjvtynzkvugbkrg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wcW1teGp2dHluemt2dWdia3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNzcyMjMsImV4cCI6MjA5NDc1MzIyM30.uMiLhhhWg5ZL1qaBGYd1pO_0Oc1LFWVLzGMeBxlnAh4"; 
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- SELECTORES DEL DOM ---
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const videoForm = document.getElementById('video-form');
const videoUrlInput = document.getElementById('video-url');
const videoIdInput = document.getElementById('video-id'); 
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');
const videoList = document.getElementById('video-list') || document.getElementById('video-table');
const logoutBtn = document.getElementById('logout-btn');

let localVideosArray = []; // Copia para edición rápida

// --- SISTEMA DE LOGIN DE MULTIUSUARIOS ---
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('username').value.trim(); // Ahora usarían su correo
  const pass = document.getElementById('password').value;

  // Petición segura a los servidores de Supabase
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: pass,
  });

  if (error) {
    document.getElementById('login-error').innerText = "Credenciales incorrectas: " + error.message;
  } else {
    // Supabase genera un token JWT seguro y maneja la sesión por ti
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('username', data.user.email.split('@')[0]); // Guarda 'admin' o 'user2'
    checkAuth();
  }
});

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username'); // Limpiamos al salir
    checkAuth();
  });
}

function checkAuth() {
  if (localStorage.getItem('isLoggedIn') === 'true') {
    if (loginSection) loginSection.classList.add('hidden');
    if (dashboardSection) dashboardSection.classList.remove('hidden');
    renderVideos();
  } else {
    if (loginSection) loginSection.classList.remove('hidden');
    if (dashboardSection) dashboardSection.classList.add('hidden');
  }
}

// --- LEER Y RENDERIZAR FILTRADO DESDE SUPABASE ---
async function renderVideos() {
  if (!videoList) return;
  videoList.innerHTML = '';

  const usuarioActivo = localStorage.getItem('username') || 'admin';

  // 🟢 Traemos SOLO los enlaces que pertenecen al usuario logueado
  const { data: videos, error } = await supabase
    .from('videos')
    .select('*')
    .eq('creado_por', usuarioActivo)
    .order('id', { ascending: false });

  if (error) {
    console.error("Error al obtener datos:", error.message);
    return;
  }

  localVideosArray = videos;

  if (videos.length === 0) {
    videoList.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px;">No tienes enlaces guardados aún.</td></tr>`;
    return;
  }

  // 🟢 Completado el bucle forEach para pintar la tabla correctamente
  videos.forEach(video => {
    const tr = document.createElement('tr');
    const shortTitle = video.url.length > 25 ? video.url.slice(0, 25) + '...' : video.url;

    tr.innerHTML = `
      <td class="col-url">
        <span class="video-url-text" title="${video.url}">${shortTitle}</span>
      </td>
      <td class="col-date">${video.date || 'Reciente'}</td>
      <td class="col-actions">
        <button class="btn-edit" onclick="prepararEdicion(${video.id})">✏️</button>
        <button class="btn-delete" onclick="eliminarVideo(${video.id})">❌</button>
      </td>
    `;
    videoList.appendChild(tr);
  });
}

// --- CREAR O EDITAR ENLACE ---
if (videoForm) {
  videoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = videoUrlInput.value.trim();
    const id = videoIdInput ? videoIdInput.value : '';
    const usuarioActivo = localStorage.getItem('username') || 'admin';
    
    if (!url) return;

    if (id) {
      // MODO EDICIÓN
      const { error } = await supabase
        .from('videos')
        .update({ url: url })
        .eq('id', id);

      if (error) console.error("Error al actualizar:", error.message);
      resetForm();
    } else {
      // MODO CREACIÓN
      const { error } = await supabase.from('videos').insert([
        { 
          url: url, 
          thumbnail: "", 
          date: new Date().toLocaleDateString(),
          creado_por: usuarioActivo // Guardamos explícitamente quién lo creó
        }
      ]);
      if (error) console.error("Error al guardar:", error.message);
      videoUrlInput.value = '';
    }

    renderVideos();
  });
}

// --- PREPARAR FORMULARIO PARA EDITAR ---
window.prepararEdicion = function(id) {
  const video = localVideosArray.find(v => v.id === id);
  if (video) {
    videoUrlInput.value = video.url;
    if (videoIdInput) videoIdInput.value = video.id;
    if (submitBtn) submitBtn.innerText = "Actualizar Enlace";
    if (cancelBtn) cancelBtn.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

// --- ELIMINAR ENLACE ---
window.eliminarVideo = async function(id) {
  if (confirm("¿Seguro que deseas eliminar este enlace?")) {
    const { error } = await supabase.from('videos').delete().eq('id', id);
    if (error) console.error("Error al eliminar:", error.message);
    else renderVideos();
  }
};

// --- CANCELAR/RESET FORM ---
if (cancelBtn) {
  cancelBtn.addEventListener('click', resetForm);
}

function resetForm() {
  videoUrlInput.value = '';
  if (videoIdInput) videoIdInput.value = '';
  if (submitBtn) submitBtn.innerText = "Guardar Enlace";
  if (cancelBtn) cancelBtn.classList.add('hidden');
}

// Inicialización de la Autenticación al cargar la página
checkAuth();