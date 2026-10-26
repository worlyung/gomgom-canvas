const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), assert = require('node:assert/strict'), ts = require('typescript');
const cache = {};
function load(name) {
  if (cache[name]) return cache[name].exports;
  const file = path.resolve(__dirname, '../src/lib', name + '.ts'), m = new Module(file);
  cache[name] = m;
  m.require = id => id.startsWith('./') ? load(id.slice(2)) : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText, file);
  return m.exports;
}
const {newDeck, parseDeck, makeCard, paintCard} = load('cardnews');
const deck = newDeck();
assert.equal(parseDeck(deck).cards[0].logo, undefined);
deck.cards[0].logo = {src:'data:image/png;base64,AAAA',name:'예술숲',x:80,y:1100,width:280,height:90};
assert.deepEqual(parseDeck(JSON.parse(JSON.stringify(deck))).cards[0].logo,deck.cards[0].logo);
const copy = makeCard('outro',deck.cards[0]);
copy.logo.x=100;
assert.equal(deck.cards[0].logo.x,80);
for (const patch of [{src:'https://invalid/logo.png'},{x:1070},{width:-1},{height:Infinity}]) {
  const bad = structuredClone(deck); Object.assign(bad.cards[0].logo,patch); assert.throws(()=>parseDeck(bad));
}
const calls=[],ctx={clearRect(){},save(){},scale(){},fillRect(){},fillText(){},measureText(){return {width:10}},drawImage(...args){calls.push(args)},restore(){}};
const logo = {};
paintCard({width:1080,height:1350,getContext:()=>ctx},deck.cards[0],1,3,null,logo);
assert.deepEqual(calls,[[logo,80,1100,280,90]]);
console.log('PASS legacy load, logo roundtrip, layout copy independence, validation, PNG painting');
