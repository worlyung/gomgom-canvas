const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict'),ts=require('typescript');
function load(name,stubs={}){const file=path.resolve(__dirname,'../src/lib',name+'.ts'),m=new Module(file);m.require=id=>id in stubs?stubs[id]:require(id);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);return m.exports;}
(async()=>{
 const sizes=load('image-sizes');assert.equal(sizes.promptImageSize('16:9로 만들어줘'),'1536x864');assert.equal(sizes.promptImageSize('9:16 세로'),'864x1536');assert.equal(sizes.promptImageSize('16:9 또는 1:1'),null);assert('error' in sizes.normalizeSize(256,256));assert('error' in sizes.normalizeSize(3840,256));assert.equal(sizes.normalizeSize(1536,864).value,'1536x864');
 const output=load('canvas-output');assert.throws(()=>output.checkExportSize(35433,35433));output.checkExportSize(4961,7016);
 const old={elements:[{id:'old',type:'image',imageId:'old'}]},images=new Map([['old',{id:'old'}],['new',{id:'new'}]]);
 const db={getAll:async s=>s==='images'?[...images.values()]:[],delete:async(s,id)=>images.delete(id)};
 global.localStorage={getItem:()=>JSON.stringify(old),setItem:()=>{throw new DOMException('fixture quota','QuotaExceededError');}};
 const storage=load('storage',{idb:{openDB:async()=>db}}).canvasStorage;await storage.init();
 assert.throws(()=>storage.saveCanvasState({elements:[...old.elements,{id:'new',type:'image',imageId:'new'}]}),/fixture quota/);
 await new Promise(r=>setTimeout(r,20));assert(images.has('new'));assert(images.has('old'));
 console.log('PASS ambiguous ratio handling, valid exact size, invalid size/export rejection, quota failure preserves old and new images');
})().catch(e=>{console.error(e);process.exitCode=1;});
