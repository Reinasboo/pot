import path from "node:path";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia, renderStill, openBrowser } from "@remotion/renderer";
const require=createRequire(new URL("../../web/package.json",import.meta.url));
const executable=process.env.REMOTION_BROWSER_EXECUTABLE || require("playwright").chromium.executablePath();
const mode=process.argv[2]||"stills";
const root=process.cwd();
const out=path.resolve(root,"../../deliverables");
await fs.mkdir(path.join(out,"screenshots"),{recursive:true});
await fs.mkdir(path.join(out,"film-stills"),{recursive:true});
const serveUrl=await bundle({entryPoint:path.join(root,"src/index.tsx"),publicDir:path.join(root,"public")});
const browser=await openBrowser("chrome",{browserExecutable:executable});
const base={serveUrl,browserExecutable:executable,puppeteerInstance:browser};
const film=await selectComposition({...base,id:"Launch"});
if(mode==="video" || mode==="patch"){
 await fs.mkdir(path.join(root,"out"),{recursive:true});
 let last=-1;
 await renderMedia({...base,composition:film,frameRange:mode==="patch"?[1140,1707]:undefined,codec:"h264",crf:20,x264Preset:"fast",pixelFormat:"yuv420p",audioCodec:"aac",audioBitrate:"192k",concurrency:Number(process.env.REMOTION_CONCURRENCY || 3),outputLocation:mode==="patch"?path.join(root,"out/plan-scene.mp4"):path.join(out,"pot-product-film.mp4"),onProgress:({progress})=>{const step=Math.floor(progress*20);if(step!==last){console.log(`Rendering ${step*5}%`);last=step}}});
 if(mode==="patch") await renderStill({...base,composition:film,frame:1450,output:path.join(out,"film-stills/scene-03.png"),imageFormat:"png"});
}else if(mode==="screenshots"){
 for(let i=1;i<=6;i++){const composition=await selectComposition({...base,id:`ProductShot${i}`});await renderStill({...base,composition,frame:0,output:path.join(out,"screenshots",`pot-product-${i}.png`),imageFormat:"png"});console.log(`Screenshot ${i}/6`)}
}else{
 const frames=[220,950,1450,1900,2380,2680,3180,4060,4650,5200];
 for(let i=0;i<frames.length;i++){await renderStill({...base,composition:film,frame:frames[i],output:path.join(out,"film-stills",`scene-${String(i+1).padStart(2,"0")}.png`),imageFormat:"png"});console.log(`Scene still ${i+1}/10`)}
 await renderStill({...base,composition:film,frame:950,output:path.join(out,"cover.png"),imageFormat:"png"});
}
await browser.close({silent:true});
console.log(`Saved ${mode} to ${out}`);

process.exit(0);
