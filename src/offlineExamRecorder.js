const DB_NAME = 'exam_monitoring_offline_v1';
const STORE = 'chunks';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('session', 'sessionId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveOfflineChunk(chunk) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(chunk);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function listOfflineChunks(sessionId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).index('session').getAll(sessionId);
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function removeOfflineChunk(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export function createMonitoringSessionId(studentId, examId) {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${studentId || 'unknown'}_${examId || 'unknown'}_${Date.now()}_${suffix}`;
}

export async function syncOfflineChunks({ supabase, sessionId, studentId, examId }) {
  if (!supabase || !navigator.onLine) return { uploaded: 0 };
  const chunks = await listOfflineChunks(sessionId);
  let uploaded = 0;
  for (const item of chunks.sort((a,b) => a.sequence - b.sequence)) {
    try {
      const path = `exam-monitoring/${examId}/${studentId}/${sessionId}/${item.sequence}.webm`;
      const { error } = await supabase.storage.from('exam-monitoring').upload(path, item.blob, { contentType: item.mimeType || 'video/webm', upsert: true });
      if (error) throw error;
      await supabase.from('exam_monitoring_recordings').upsert({
        student_id: studentId,
        exam_id: examId,
        session_id: sessionId,
        chunk_sequence: item.sequence,
        storage_path: path,
        mime_type: item.mimeType || 'video/webm',
        captured_at: item.capturedAt,
        uploaded_at: new Date().toISOString()
      }, { onConflict: 'session_id,chunk_sequence' });
      await removeOfflineChunk(item.id);
      uploaded += 1;
    } catch (error) {
      console.warn('Offline monitoring sync delayed:', error);
      break;
    }
  }
  return { uploaded };
}
