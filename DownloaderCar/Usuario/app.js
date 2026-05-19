// 🟢 Importamos Supabase directamente en el navegador (Sin npm, sin Node)
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const SUPABASE_URL = "https://npqmmxjvtynzkvugbkrg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wcW1teGp2dHluemt2dWdia3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNzcyMjMsImV4cCI6MjA5NDc1MzIyM30.uMiLhhhWg5ZL1qaBGYd1pO_0Oc1LFWVLzGMeBxlnAh4"; 
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- REGISTRO DEL SERVICE WORKER ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(() => console.log("Service Worker del Cliente listo."))
    .catch(err => console.error("Error al registrar SW:", err));
}

// --- SELECTORES DEL DOM ---
const downloadList = document.getElementById('download-list') || document.getElementById('video-list') || document.getElementById('videolist');
const loginSection = document.getElementById('login-section');
const playerSection = document.getElementById('player-section');
const loginForm = document.getElementById('login-form');
const statusContainer = document.getElementById('status-container');
const statusText = document.getElementById('status-text');
const progressFill = document.getElementById('progress-fill');
const logoutBtn = document.getElementById('logout-btn');

// Enrutamiento confirmado para tu versión de Cobalt (V7/V8)
const COBALT_API_URL = "https://cobalt-api-production-2724.up.railway.app/";

// --- SISTEMA DE LOGIN ---
// --- SISTEMA DE LOGIN DEL CLIENTE ---
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('username').value.trim(); // Correo del usuario
    const pass = document.getElementById('password').value;

    // Petición segura a los servidores de Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: pass,
    });

    if (error) {
      document.getElementById('login-error').innerText = "Credenciales incorrectas: " + error.message;
    } else {
      // Guardamos el estado de la sesión
      localStorage.setItem('isUserLoggedIn', 'true');
      
      // 🟢 SOLUCIÓN: Extraemos el nombre antes del '@' y llamamos a checkUserAuth()
      localStorage.setItem('username', data.user.email.split('@')[0]); 
      
      // 🟢 Cambiado checkAuth() por la función real de tu cliente:
      checkUserAuth();
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('isUserLoggedIn');
    localStorage.removeItem('username'); // 🟢 Limpiamos el usuario activo al salir
    checkUserAuth();
  });
}

function checkUserAuth() {
  if (localStorage.getItem('isUserLoggedIn') === 'true') {
    if (loginSection) loginSection.classList.add('hidden');
    if (playerSection) playerSection.classList.remove('hidden');
    loadVideosFromCloud();
  } else {
    if (loginSection) loginSection.classList.remove('hidden');
    if (playerSection) playerSection.classList.add('hidden');
  }
}

// --- RENDERIZAR TABLA DE DESCARGAS (Desde Supabase) ---
async function loadVideosFromCloud() {
  if (!downloadList) return;
  downloadList.innerHTML = '';

  const usuarioActivo = localStorage.getItem('username') || 'admin';

  // Traer solo los datos pertenecientes al usuario activo
  const { data: videos, error } = await supabase
    .from('videos')
    .select('*')
    .eq('creado_por', usuarioActivo)
    .order('id', { ascending: false });

  if (error) {
    console.error("Error al obtener datos:", error.message);
    return;
  }

  if (videos.length === 0) {
    downloadList.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px;">No tienes enlaces pendientes de descarga.</td></tr>`;
    return;
  }

  // 🟢 RESTAURADO: Bucle inyector que dibuja las filas y activa el botón Cobalt
  videos.forEach(video => {
    const tr = document.createElement('tr');
    const shortTitle = video.url.length > 25 ? video.url.slice(0, 25) + '...' : video.url;

    tr.innerHTML = `
      <td class="col-url">
        <span class="video-url-text" title="${video.url}">${shortTitle}</span>
      </td>
      <td class="col-date">${video.date || 'Reciente'}</td>
      <td class="col-actions">
        <button class="btn-download" onclick="downloadVideo('${btoa(video.url)}')">⬇️ Descargar</button>
      </td>
    `;
    downloadList.appendChild(tr);
  });
}

// --- PROCESAR ENLACE Y DESCARGA BINARIA CON COBALT ---
window.downloadVideo = async function(encodedUrl) {
  const realVideoUrl = atob(encodedUrl).trim();
  
  if (!realVideoUrl) {
    alert("Error: La URL del video no es válida.");
    return;
  }

  updateStatusContainer("Conectando con el servidor Cobalt...", "20%");

  try {
    const response = await fetch(COBALT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        url: realVideoUrl,
        videoQuality: "720",
        youtubeVideoCodec: "h264"
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Error sin respuesta de texto");
      throw new Error(`Servidor respondió con código ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log("🔄 Respuesta nativa de Cobalt:", data);

    let streamUrl = "";

    if (data.status === "redirect" || data.status === "stream") {
      streamUrl = data.url;
    } else if (data.status === "picker" && data.picker && data.picker.length > 0) {
      streamUrl = data.picker[0].url; 
    }

    if (!streamUrl) {
      streamUrl = data.url || data.text;
    }

    if (!streamUrl) {
      throw new Error("El servidor de Cobalt procesó el enlace pero no generó una URL de descarga compatible.");
    }

    updateStatusContainer("Descargando flujo binario del video...", "50%");
    
    try {
      const videoRes = await fetch(streamUrl);
      if (!videoRes.ok) throw new Error("Fallo de red al obtener el binario");
      const videoBlob = await videoRes.blob();

      if ('showSaveFilePicker' in window) {
        const handle = await window.showSaveFilePicker({
          suggestedName: `video_${data.filename || 'download'}.mp4`,
          types: [{ description: 'Video MP4', accept: {'video/mp4': ['.mp4']} }]
        });
        const writable = await handle.createWritable();
        await writable.write(videoBlob);
        await writable.close();
      } else {
        const blobUrl = URL.createObjectURL(videoBlob);
        triggerNativeDownload(blobUrl, `video_${data.filename || 'download'}.mp4`);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      }
      
    } catch (blobError) {
      console.warn("⚠️ No se pudo procesar como Blob, usando descarga directa:", blobError);
      updateStatusContainer("Redirigiendo a descarga directa nativa...", "85%");
      triggerNativeDownload(streamUrl, `video_${data.filename || 'download'}.mp4`);
    }

    updateStatusContainer("¡Video guardado con éxito!", "100%");
    setTimeout(hideStatusContainer, 3000);

  } catch (error) {
    console.error("Error en el proceso de descarga:", error);
    alert(`No se pudo procesar la descarga: ${error.message}`);
    hideStatusContainer();
  }
};

// --- INYECTOR DE DESCARGA DIRECTA (FALLBACK) ---
function triggerNativeDownload(streamUrl, filename) {
  const anchor = document.createElement('a');
  anchor.href = streamUrl;
  anchor.setAttribute('download', filename);
  anchor.target = "_blank"; 
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

// --- COMPONENTES VISUALES DE ESTADO ---
function updateStatusContainer(text, percentage) {
  if (statusContainer && statusText && progressFill) {
    statusContainer.classList.remove('hidden');
    statusText.innerText = text;
    progressFill.style.width = percentage;
  }
}

function hideStatusContainer() {
  if (statusContainer && progressFill) {
    statusContainer.classList.add('hidden');
    progressFill.style.width = "0%";
  }
}

// Inicialización de la aplicación
checkUserAuth();

// // ⚡ ESCUCHADOR EN TIEMPO REAL (REALTIME)
// // Nos suscribimos a cualquier cambio (INSERT, UPDATE, DELETE) en la tabla 'videos'
// supabase
//   .channel('cambios-en-videos') // Nombre del canal que quieras
//   .on(
//     'postgres_changes', 
//     { 
//       event: '*', // Escucha inserciones, ediciones y eliminaciones
//       schema: 'public', 
//       table: 'videos' 
//     }, 
//     (payload) => {
//       console.log("¡Cambio detectado en la nube en tiempo real!", payload);
      
//       // 🟢 Si el usuario tiene la sesión iniciada, refrescamos la tabla automáticamente
//       if (localStorage.getItem('isUserLoggedIn') === 'true') {
//         loadVideosFromCloud(); 
//       }
//     }
//   )
//   .subscribe();
