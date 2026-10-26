import assert from "node:assert/strict";
import { revisionLinks, imageCenter } from "../src/lib/revision-links.ts";

const source = { id: "original", src: "sample", x: 10, y: 20, width: 100, height: 60, rotation: 0 };
const result = { ...source, id: "edit", x: 200, generation: { prompt: "배경을 밝게", referenceIds: ["original", "original", "missing", "edit"] } };
assert.equal(revisionLinks([source,result]).length,1);
assert.equal(revisionLinks([source,result])[0].prompt,"배경을 밝게");
assert.equal(revisionLinks([result]).length,0,"deleted source has no dangling link");
assert.equal(revisionLinks([{...source,hidden:true},result]).length,0);
assert.equal(revisionLinks([source,{...result,hidden:true}]).length,0);
assert.equal(revisionLinks([source,{...result,generation:undefined}]).length,0,"old boards stay compatible");
assert.deepEqual(imageCenter(source),{x:60,y:50});
const rotated=imageCenter({...source,rotation:90});
assert(Math.abs(rotated.x+20)<1e-8 && Math.abs(rotated.y-70)<1e-8);
assert.equal(revisionLinks(JSON.parse(JSON.stringify([source,result]))).length,1,"metadata survives serialization");
console.log("PASS: revision links, missing/hidden/self/duplicate references, rotation, serialization");
