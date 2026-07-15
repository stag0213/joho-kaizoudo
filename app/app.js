'use strict';

const fileInput        = document.getElementById('fileInput');
const uploadZone       = document.getElementById('uploadZone');
const canvasOriginal   = document.getElementById('canvasOriginal');
const canvasResized    = document.getElementById('canvasResized');
const originalBox      = document.getElementById('originalBox');
const resizedBox       = document.getElementById('resizedBox');
const placeholderOrig  = document.getElementById('placeholderOriginal');
const placeholderRsz   = document.getElementById('placeholderResized');
const slider           = document.getElementById('scaleSlider');
const sliderValueEl    = document.getElementById('sliderValue');

const origResEl     = document.getElementById('origRes');
const origSizeEl    = document.getElementById('origSize');
const origFormatEl  = document.getElementById('origFormat');
const newResEl      = document.getElementById('newRes');
const newSizeEl     = document.getElementById('newSize');
const reductionEl   = document.getElementById('reduction');
const downloadBtn   = document.getElementById('downloadBtn');

const state = { img: null, meta: null, scale: 100, estimatedBlob: null };

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return bytes.toFixed(0) + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function detectFormat(mime, filename) {
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'JPEG';
  if (mime === 'image/png') return 'PNG';
  if (mime === 'image/webp') return 'WebP';
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'JPEG';
  if (lower.endsWith('.png')) return 'PNG';
  if (lower.endsWith('.webp')) return 'WebP';
  return 'UNKNOWN';
}

const COMPRESSION_FACTOR = { JPEG: 0.15, WEBP: 0.12, PNG: 0.85 };

function estimateBlobSize(origBytes, origW, origH, newW, newH, mime) {
  const pixelRatio = (newW * newH) / (origW * origH);
  const fmt = detectFormat(mime);
  const factor = COMPRESSION_FACTOR[fmt] ?? 0.3;
  return Math.round(origBytes * pixelRatio * factor);
}

function handleFile(file) {
  if (!file) return;
  const fmt = detectFormat(file.type, file.name);
  if (fmt === 'UNKNOWN') {
    alert('対応していない形式です。JPEG / PNG / WebP を選択してください。');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      state.img = img;
      state.meta = {
        name: file.name, size: file.size,
        type: file.type || ('image/' + fmt.toLowerCase()),
        width: img.naturalWidth, height: img.naturalHeight
      };
      origResEl.textContent    = `${img.naturalWidth} × ${img.naturalHeight} px`;
      origSizeEl.textContent   = formatBytes(file.size);
      origFormatEl.textContent = fmt;

      placeholderOrig.style.display = 'none';
      placeholderRsz.style.display  = 'none';
      originalBox.classList.add('has-image');
      resizedBox.classList.add('has-image');

      drawOriginal();
      updateResized(100);
      downloadBtn.disabled = false;
    };
    img.onerror = () => alert('画像の読み込みに失敗しました。');
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function drawOriginal() {
  if (!state.img) return;
  const ctx = canvasOriginal.getContext('2d');
  const w = state.meta.width, h = state.meta.height;
  canvasOriginal.width = w; canvasOriginal.height = h;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(state.img, 0, 0, w, h);
}

function updateResized(scalePct) {
  if (!state.img) return;
  state.scale = scalePct;
  sliderValueEl.textContent = scalePct + '%';

  const origW = state.meta.width, origH = state.meta.height;
  const newW = Math.max(1, Math.round(origW * scalePct / 100));
  const newH = Math.max(1, Math.round(origH * scalePct / 100));

  newResEl.textContent = `${newW} × ${newH} px`;
  const estBytes = estimateBlobSize(state.meta.size, origW, origH, newW, newH, state.meta.type);
  newSizeEl.textContent = formatBytes(estBytes);
  const reduce = ((1 - (newW * newH) / (origW * origH)) * 100);
  reductionEl.textContent = reduce.toFixed(1) + ' %';

  const ctx = canvasResized.getContext('2d');
  canvasResized.width = newW; canvasResized.height = newH;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = scalePct < 50 ? 'low' : 'high';
  ctx.clearRect(0, 0, newW, newH);
  ctx.drawImage(state.img, 0, 0, newW, newH);

  const mime = state.meta.type;
  canvasResized.toBlob(
    (blob) => { state.estimatedBlob = blob; },
    mime,
    mime === 'image/png' ? undefined : 0.92
  );
}

fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

['dragenter', 'dragover'].forEach(ev => {
  uploadZone.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation();
    uploadZone.classList.add('drag-over');
  });
});
['dragleave', 'drop'].forEach(ev => {
  uploadZone.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation();
    uploadZone.classList.remove('drag-over');
  });
});
uploadZone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

let rafQueued = false;
slider.addEventListener('input', () => {
  if (rafQueued) return;
  rafQueued = true;
  requestAnimationFrame(() => {
    updateResized(parseInt(slider.value, 10));
    rafQueued = false;
  });
});

downloadBtn.addEventListener('click', () => {
  if (!state.estimatedBlob || !state.meta) return;
  const url = URL.createObjectURL(state.estimatedBlob);
  const a = document.createElement('a');
  const dotIdx = state.meta.name.lastIndexOf('.');
  const base = dotIdx > 0 ? state.meta.name.slice(0, dotIdx) : state.meta.name;
  const ext  = dotIdx > 0 ? state.meta.name.slice(dotIdx) : '';
  a.href = url;
  a.download = `${base}_resized${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
