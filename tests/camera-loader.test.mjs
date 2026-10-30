import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCV} from '../public/camera.js';
test('legacy Emscripten self-resolving thenable is wrapped without hanging',async()=>{
 const module={Mat:class{},then(callback){callback(this);return this;}};
 globalThis.window={cv:module};globalThis.document={createElement:()=>({dataset:{}}),head:{appendChild(script){queueMicrotask(()=>script.onload());}}};
 try{const wrapper=await loadCV();assert.equal(wrapper.cv,module);assert.notEqual(wrapper,module);}finally{delete globalThis.window;delete globalThis.document;}
});
