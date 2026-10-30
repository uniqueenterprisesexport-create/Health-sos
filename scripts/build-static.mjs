import {cp,rm,mkdir} from 'node:fs/promises';
const output=new URL('../dist/',import.meta.url);
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});await cp(new URL('../public/',import.meta.url),output,{recursive:true});
console.log('Static browser sandbox prepared in dist/');
