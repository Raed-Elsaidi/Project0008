import * as faceapi from '@vladmandic/face-api';

export const FACE_MODELS_URL = '/models';

export async function loadFaceModels() {
  try { await faceapi.tf.setBackend('webgl'); } catch (_) {}
  await faceapi.tf.ready();
  if (!faceapi.nets.tinyFaceDetector.params) await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODELS_URL);
  if (!faceapi.nets.faceLandmark68Net.params) await faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODELS_URL);
  if (!faceapi.nets.faceRecognitionNet.params) await faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODELS_URL);
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

export function faceMatch(liveDescriptor, storedDescriptor, threshold = 0.60) {
  const distance = euclideanDistance(liveDescriptor, storedDescriptor);
  return { matched: Number.isFinite(distance) && distance <= threshold, distance, threshold };
}

export async function descriptorFromVideo(video) {
  await loadFaceModels();
  const result = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.55 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!result) throw new Error('لم يتم العثور على وجه واضح داخل الإطار.');
  return Array.from(result.descriptor, Number);
}
