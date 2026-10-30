import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const url='https://docs.opencv.org/4.13.0/opencv.js';
const expected='63366510248adf3a7eddf3e793dd825404efb7df3749f4d6f8557c7fa4ca8aa0';
const r=await fetch(url);if(!r.ok)throw Error(`OpenCV download failed: ${r.status}`);
const bytes=Buffer.from(await r.arrayBuffer());const sha=createHash('sha256').update(bytes).digest('hex');
if(sha!==expected)throw Error(`OpenCV checksum changed. Expected ${expected}, got ${sha}. Review the official source before updating.`);
await mkdir(new URL('../public/vendor/',import.meta.url),{recursive:true});await writeFile(new URL('../public/vendor/opencv.js',import.meta.url),bytes);
console.log(`OpenCV.js 4.13.0 installed (${bytes.length} bytes). SHA-256 ${sha}`);
