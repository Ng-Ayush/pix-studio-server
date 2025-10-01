const path = require('path');
const faceapi = require('face-api.js');
const canvas = require('canvas');
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });
const CONCURRENCY_LIMIT = 5; // Adjust for your CPU

const loadModels = async () => {
  try {
    const modelsPath = path.join(__dirname);
    await faceapi.nets.tinyFaceDetector.loadFromDisk(modelsPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);
    console.log('Face-api.js models loaded successfully');
  } catch (error) {
    console.error('Error loading models', error);
  }
};

const extractFaceDescriptor = async (imageUrl) => {
  try {
    const img = await canvas.loadImage(imageUrl);
    const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!detection) return null;
    return Array.from(detection.descriptor);
  } catch (error) {
    console.error('Error extracting face descriptor:', error);
    return null;
  }
};

// Helper concurrency pool function
async function asyncPool(limit, array, iteratorFn) {
  const ret = [];
  const executing = [];

  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);

    if (limit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

// New function to process many photos concurrently
const processUploadedPhotosConcurrently = async (photoUrls,folder_id,uploaded_by) => {
  const results = await asyncPool(CONCURRENCY_LIMIT, photoUrls, async (photo) => {
    const descriptor = await extractFaceDescriptor(photo.url);
    if (descriptor) {
      return {
        photo_url: photo.url,
        photo_name: photo.name,
        folder_id,
        uploaded_by,
        face_descriptor: JSON.stringify(descriptor),
      };
    }
    return null;
  });
  return results.filter(r => r !== null);
};

module.exports = {
  loadModels,
  extractFaceDescriptor,
  processUploadedPhotosConcurrently,
};
