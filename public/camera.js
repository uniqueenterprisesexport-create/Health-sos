let stream=null, cvPromise=null;
export async function startCamera(video){
  stopCamera();if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera requires HTTPS or localhost. You can upload an image instead.');
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});video.srcObject=stream;await video.play();return stream;
}
export function stopCamera(){stream?.getTracks().forEach(t=>t.stop());stream=null;}
export function capture(video){if(!video.videoWidth)throw Error('Camera is not ready.');const canvas=document.createElement('canvas');canvas.width=Math.min(video.videoWidth,1280);canvas.height=Math.round(video.videoHeight*canvas.width/video.videoWidth);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.85);}
export async function readImage(file){if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG or WebP image.');if(file.size>5*1024*1024)throw Error('Choose an image under 5 MB.');const bmp=await createImageBitmap(file);if(bmp.width*bmp.height>24000000){bmp.close();throw Error('Choose an image under 24 megapixels.');}const c=document.createElement('canvas'),ratio=Math.min(1,1280/bmp.width);c.width=Math.round(bmp.width*ratio);c.height=Math.round(bmp.height*ratio);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);bmp.close();return c.toDataURL('image/jpeg',.85);}
export function loadCV(){
  if(cvPromise)return cvPromise;
  cvPromise=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('OpenCV did not load. Check your connection or use the Python-enabled local server.')),45000);
    // Older Emscripten modules are self-resolving thenables. Never await or
    // resolve a Promise with the module itself: that can starve the UI thread.
    const ready=cv=>{if(!cv?.Mat)return false;clearTimeout(timeout);resolve({cv});return true;};
    const script=document.createElement('script');script.src='/vendor/opencv.js';script.async=true;
    window.Module={onRuntimeInitialized:()=>ready(window.cv)};
    script.onload=()=>{const cv=window.cv;if(ready(cv))return;if(cv&&typeof cv.then==='function')cv.then(module=>ready(module||cv));else if(cv){const previous=cv.onRuntimeInitialized;cv.onRuntimeInitialized=()=>{previous?.();ready(cv);};}};
    script.onerror=()=>{if(!script.dataset.fallback){script.dataset.fallback='true';script.src='https://docs.opencv.org/4.13.0/opencv.js';}else{clearTimeout(timeout);reject(Error('OpenCV runtime unavailable. Run the Python camera service or check the bundled asset.'));}};
    document.head.appendChild(script);
  }).catch(e=>{cvPromise=null;throw e;});return cvPromise;
}
export async function analyzeBrowser(image){
  const {cv}=await loadCV(),img=new Image();img.src=image;await img.decode();
  const scale=Math.min(1,640/img.width),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  let src,gray,lap,mean,std,edges;
  try{src=cv.imread(canvas);gray=new cv.Mat();lap=new cv.Mat();mean=new cv.Mat();std=new cv.Mat();edges=new cv.Mat();cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);cv.Laplacian(gray,lap,cv.CV_64F);cv.meanStdDev(lap,mean,std);cv.Canny(gray,edges,60,140);
    const brightness=cv.mean(gray)[0],sharpness=std.doubleAt(0,0)**2,warnings=[];
    if(brightness<45)warnings.push('Low light: improve lighting if safe.');if(brightness>225)warnings.push('Overexposed: reduce glare if safe.');if(sharpness<60)warnings.push('Low detail or blur: hold the camera steady if safe.');
    return {engine:'OpenCV.js · '+cv.getBuildInformation().split('\n').find(x=>x.includes('OpenCV'))?.trim(),width:img.width,height:img.height,brightness:Math.round(brightness*10)/10,sharpness:Math.round(sharpness*10)/10,edgeDensity:cv.countNonZero(edges)/(gray.rows*gray.cols),warnings,clinicalAssessment:false,imageSaved:false,note:'Engineering image-quality heuristics only.'};
  }finally{[src,gray,lap,mean,std,edges].forEach(m=>m?.delete());}
}
