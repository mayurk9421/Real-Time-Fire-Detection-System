/* script.js — UI interaction, particles, lottie, upload, charts, theme */
/* Configure backend URL here */
const BACKEND_UPLOAD_URL = "http://127.0.0.1:5000/detect"; // <-- change if needed

// ---------- Helpers ----------
const qs = sel => document.querySelector(sel);
const qsa = sel => document.querySelectorAll(sel);

// Theme toggle
function loadTheme() {
  const theme = localStorage.getItem('theme') || 'dark';
  if (theme === 'light') document.body.classList.add('light');
  else document.body.classList.remove('light');
}
function toggleTheme(){
  document.body.classList.toggle('light');
  localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
}

// Page transitions simple
function pageFadeIn(){ document.body.classList.add('page-enter'); setTimeout(()=>document.body.classList.add('page-enter-active'),10) }
function pageFadeOut(cb){ document.body.classList.remove('page-enter-active'); setTimeout(cb,300) }

// ---------- AOS & Lottie & Particles init ----------
function initAOS(){ if(window.AOS) AOS.init({duration:700, once:true, easing:'ease-out-cubic'}); }
function initLottie(){
  const lottieContainers = qsa('.lottie');
  lottieContainers.forEach(c=>{
    const path = c.dataset.path;
    if(!path) return;
    lottie.loadAnimation({ container:c, renderer:'svg', loop:true, autoplay:true, path });
  });
}

// particles.js config (fire embers)
function initParticles(){
  if(!window.particlesJS) return;
  particlesJS('particles-js', {
    "particles": {
      "number": {"value": 60, "density": {"enable": true, "value_area": 800}},
      "color": {"value": ["#ff8a00","#ff4d00","#ffd4a3"]},
      "shape": {"type": "circle"},
      "opacity": {"value":0.8,"random":true,"anim":{"enable":false}},
      "size": {"value":3,"random":true,"anim":{"enable":false}},
      "move": {"enable":true,"speed":1.6,"direction":"top","random":true,"straight":false,"out_mode":"out"}
    },
    "interactivity": {"events":{"onhover":{"enable":false},"onclick":{"enable":false}},"modes":{}},
    "retina_detect": true
  });
}

// Smoke SVG subtle animation is CSS via style.css (provided)

// ---------- Upload + Polling ----------
async function uploadVideoFile(file, onProgress){
  if(!file) throw new Error("No file");
  const form = new FormData();
  form.append('video', file);

  // Use XHR to track upload progress
  return new Promise((resolve, reject)=>{
    const xhr = new XMLHttpRequest();
    xhr.open('POST', BACKEND_UPLOAD_URL);
    xhr.upload.onprogress = function(e){
      if(e.lengthComputable && onProgress) onProgress(Math.round((e.loaded/e.total)*100));
    };
    xhr.onload = function(){
      if(xhr.status >=200 && xhr.status <300){
        try { resolve(JSON.parse(xhr.responseText)); }
        catch(err){ resolve({}); }
      } else reject(new Error('Upload failed: ' + xhr.status));
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(form);
  });
}

// UI: attach upload handler if present
function attachUploadHandlers(){
  const uploadBtn = qs('#uploadBtn');
  if(!uploadBtn) return;
  uploadBtn.addEventListener('click', async ()=>{
    const input = qs('#videoInput');
    if(!input.files[0]) { alert('Select a video first'); return; }
    const file = input.files[0];
    const loader = qs('#loader'); loader.style.display = 'block';
    const progressBar = qs('#progressBar'); progressBar.style.width = '0%';
    try {
      const res = await uploadVideoFile(file, pct => progressBar.style.width = pct + '%');
      loader.style.display = 'none';
      showResult(res);
    } catch(err){
      loader.style.display = 'none';
      alert('Upload failed. Check backend or network.');
      console.error(err);
    }
  });
}

// Show result (UI) — expects either { fire_detected, smoke_detected, timestamps, video_url, detections }
function showResult(data){
  const box = qs('#resultBox');
  const vid = qs('#processedVideo');
  box.innerHTML = '';
  let html = '';
  if(data.fire_detected){
    html += `<div class="result danger">🔥 Fire Detected</div>`;
  } else {
    html += `<div class="result success">✔ No Fire Detected</div>`;
  }
  if(data.smoke_detected){
    html += `<div class="result danger">💨 Smoke Detected</div>`;
  } else {
    html += `<div class="result success">✔ No Smoke Detected</div>`;
  }
  if(Array.isArray(data.timestamps) && data.timestamps.length){
    html += `<div style="margin-top:10px" class="muted">Detections:</div><ul class="muted">` + data.timestamps.map(t=>`<li>${t}</li>`).join('') + `</ul>`;
  }
  box.innerHTML = html;

  // show processed video if available
  if(data.video_url){
    vid.src = data.video_url;
    vid.style.display = 'block';
  }

  // draw detection boxes on overlay if detection boxes provided
  if(Array.isArray(data.detections) && data.detections.length){
    const overlay = qs('#overlayContainer'); overlay.innerHTML = '';
    const vidWrap = qs('.video-wrap');
    data.detections.forEach(det=>{
      // det: {x,y,w,h,label,score} with relative coords (0..1)
      const el = document.createElement('div');
      el.className = 'overlay-box';
      el.style.left = (det.x*100) + '%';
      el.style.top = (det.y*100) + '%';
      el.style.width = (det.w*100) + '%';
      el.style.height = (det.h*100) + '%';
      el.innerHTML = `<div class="overlay-label">${det.label} ${Math.round(det.score*100)}%</div>`;
      overlay.appendChild(el);
    });
  }

  // update chart if exists
  if(window.detectionChart && data.confidence){
    window.detectionChart.data.datasets[0].data = [data.confidence.fire||0, data.confidence.smoke||0];
    window.detectionChart.update();
  }
}

// ---------- Demo Chart (Chart.js) ----------
function initDetectionChart(){
  const ctx = qs('#chartCanvas');
  if(!ctx) return;
  window.detectionChart = new Chart(ctx, {
    type:'doughnut',
    data:{
      labels:['Fire','Smoke'],
      datasets:[{data:[0,0],backgroundColor:['#ff7a2a','#6aa6d6'],borderWidth:0}]
    },
    options:{plugins:{legend:{position:'bottom',labels:{color:getComputedStyle(document.body).color}}}}
  });
}

// ---------- page init ----------
function initAll(){
  loadTheme();
  initAOS();
  initLottie();
  initParticles();
  attachUploadHandlers();
  initDetectionChart();
  // attach theme toggle button
  const tgl = qs('#themeBtn'); if(tgl) tgl.addEventListener('click', toggleTheme);
  // FAB quick scroll to upload
  const fab = qs('#fab'); if(fab) fab.addEventListener('click', ()=>{ location.href='detect.html'; });
  pageFadeIn();
}

document.addEventListener('DOMContentLoaded', initAll);
