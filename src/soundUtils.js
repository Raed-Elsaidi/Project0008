const audioCache = new Map();

function getAudio(path) {
  if (!audioCache.has(path)) {
    const audio = new Audio(path);
    audio.preload = 'auto';
    audioCache.set(path, audio);
  }
  return audioCache.get(path);
}

export function playSound(path, volume = 0.5) {
  try {
    const audio = getAudio(path);
    audio.pause();
    audio.currentTime = 0;
    audio.volume = volume;
    const promise = audio.play();
    if (promise?.catch) promise.catch(() => {});
  } catch (_) {}
}

export function playMenuHoverSound() {
  playSound('/sound/01_soft_chime_menu.mp3', 0.24);
}

export function playIncomingMessageSound() {
  playSound('/sound/02_incoming_message.mp3', 0.55);
}

export function playNotebookAlarmSound() {
  playSound('/sound/03_notebook_alarm.mp3', 0.62);
}

export function playMessageSentSound() {
  playSound('/sound/04_message_sent.mp3', 0.45);
}

// صوت مستقل لوصول رسائل الطلاب إلى موظف الدعم الفني.
export function playStudentIncomingMessageSound() {
  playSound('/sound/message-alert.mp3', 0.55);
}
