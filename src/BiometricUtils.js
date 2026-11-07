import * as faceapi from '@vladmandic/face-api';

export const FACE_MODELS_URL = '/models';

// Share one model-loading promise across every image in this browser session.
let modelsPromise = null;
export async function loadFaceModels() {
  if (!modelsPromise) {
    modelsPromise = (async () => {
      try { await faceapi.tf.setBackend('webgl'); } catch (_) {
        try { await faceapi.tf.setBackend('cpu'); } catch (_) {}
      }
      await faceapi.tf.ready();
      if (!faceapi.nets.tinyFaceDetector.params) await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODELS_URL);
      if (!faceapi.nets.faceLandmark68Net.params) await faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODELS_URL);
      if (!faceapi.nets.faceRecognitionNet.params) await faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODELS_URL);
    })().catch((error) => { modelsPromise = null; throw error; });
  }
  return modelsPromise;
}

export async function descriptorFromImage(fileOrImage) {
  await loadFaceModels();
  let img;
  if (typeof fileOrImage === 'string') img = await faceapi.fetchImage(fileOrImage);
  else {
    const url = URL.createObjectURL(fileOrImage);
    try { img = await faceapi.fetchImage(url); } finally { URL.revokeObjectURL(url); }
  }
  const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  if (detections.length !== 1) throw new Error(detections.length === 0 ? 'لم يتم العثور على وجه واضح.' : 'يجب أن تحتوي الصورة على وجه واحد فقط.');
  return Array.from(detections[0].descriptor, Number);
}

export function euclideanDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += (Number(a[i]) - Number(b[i])) ** 2;
  return Math.sqrt(sum);
}

// درجة تشغيلية للمطابقة وليست احتمالاً إحصائياً لهوية الشخص.
// تمت مواءمة حد 85 مع حد المسافة الشائع 0.60 في face-api؛ يلزم اختبارها
// على صور البوابة الفعلية قبل الاعتماد النهائي.
export function faceMatch(liveDescriptor, storedDescriptor, threshold = 85) {
  const distance = euclideanDistance(liveDescriptor, storedDescriptor);
  let score = 0;
  if (Number.isFinite(distance)) {
    if (distance <= 0.60) score = 100 - (distance / 0.60) * 15;
    else score = Math.max(0, 85 - ((distance - 0.60) / 0.60) * 85);
  }
  score = Math.round(score * 10) / 10;
  return { matched: Number.isFinite(distance) && score >= threshold, distance, score, threshold };
}


export async function descriptorFromVideo(video) {
  await loadFaceModels();
  const result = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.55 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!result) throw new Error('لم يتم العثور على وجه واضح داخل الإطار.');
  return Array.from(result.descriptor, Number);
}
