const $ = id => document.getElementById(id);
const viewer = $("viewer"), loading = $("loading");
const MODEL_UID = "99c74d8fa7df42d984903868f6e593f6";
const state = { paint:"Arctic White", color:"#e8e9e7", finish:"gloss", wheel:"sport", brake:"#c7192d", carbon:true, wing:true, tint:true, lights:true, height:"Sport", track:false };
const wheelNames={sport:"RS Sport",silver:"GT Silver",gold:"Neodyme"};
const finishNames={gloss:"High gloss",matte:"Matte",metallic:"Metallic"};
let api=null, materials=[], nodes=[], ready=false, autoRotate=true, spinTimer=null, cameraState=null, originalMaterials=[];

function loadingMessage(title, detail) {
  loading.style.display="flex"; loading.replaceChildren();
  const spinner=document.createElement("span"); spinner.className="loader";
  const heading=document.createElement("b"); heading.textContent=title;
  const sub=document.createElement("small"); sub.textContent=detail;
  loading.append(spinner,heading,sub);
}
function loadingError(error) {
  loading.style.display="flex"; loading.replaceChildren();
  const wrap=document.createElement("div"); wrap.style.cssText="max-width:340px;padding:22px;text-align:center;line-height:1.6";
  const title=document.createElement("b"); title.textContent="3D preview unavailable"; title.style.display="block";
  const msg=document.createElement("p"); msg.textContent=(error?.message||"The Sketchfab viewer could not load. Check internet, cookies, or retry.")+" Customization summary remains available."; msg.style.color="#aab2bb";
  const retry=document.createElement("button"); retry.className="choice selected"; retry.textContent="Retry 3D preview"; retry.addEventListener("click",start3D);
  wrap.append(title,msg,retry); loading.append(wrap);
}
function setSelected(selector,key,value){document.querySelectorAll(selector).forEach(el=>el.classList.toggle("selected",el.dataset[key]===value));}
function summary(){
  $("paintName").textContent=state.paint;
  $("sumPaint").textContent=`${state.paint} · ${finishNames[state.finish]}`;
  $("sumWheel").textContent=wheelNames[state.wheel];
  const d=[]; if(state.carbon)d.push("Carbon");if(state.wing)d.push("GT Wing");if(state.tint)d.push("Tint");if(state.lights)d.push("LED");
  $("sumDetails").textContent=d.join(" · ")||"Standard";
  $("sumStance").textContent=state.height+(state.track?" · Track":"");
  $("heightValue").textContent=state.height;
}
function rgb(hex){return [parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255];}
function channelColor(material, channelName, color){
  const ch=material.channels?.[channelName];
  if(!ch)return false;
  ch.enable=true; ch.color=color;
  return true;
}
function channelScalar(material, channelName, value){
  const ch=material.channels?.[channelName]; if(!ch)return false;
  ch.enable=true;
  if("factor" in ch) ch.factor=value;
  else if("value" in ch) ch.value=value;
  else if("alpha" in ch) ch.alpha=value;
  return true;
}
function materialName(m){return (m.name||"").toLowerCase();}
function saveOriginals(){
  originalMaterials=materials.map(m=>JSON.parse(JSON.stringify(m)));
}
function applyMaterials(){
  if(!api||!ready)return;
  const paintRGB=rgb(state.color);
  const wheelColor=state.wheel==="silver"?[.73,.75,.77]:state.wheel==="gold"?[.62,.46,.25]:[.12,.13,.15];
  const carbonColor=state.carbon?[.07,.08,.09]:[.35,.37,.39];
  const brakeRGB=rgb(state.brake);
  materials.forEach((m,i)=>{
    const base=JSON.parse(JSON.stringify(originalMaterials[i]||m));
    const name=materialName(base);
    const isGlass=/glass|window|windshield|screen/.test(name);
    const isTire=/tire|tyre|rubber/.test(name);
    const isWheel=/wheel|rim|alloy/.test(name);
    const isBrake=/brake|caliper/.test(name);
    const isCarbon=/carbon|cf|fiber|fibre/.test(name);
    const isLight=/light|lamp|head.?lamp|tail.?lamp/.test(name);
    const isBody=/body|paint|exterior|shell|car.?paint|color/.test(name);
    // Use named materials first. If names are generic, cautiously tint materials
    // whose original base color is bright and not glass/rubber/metal.
    let bodyMatch=isBody;
    if(!bodyMatch&&!isGlass&&!isTire&&!isWheel&&!isBrake&&!isCarbon&&!isLight){
      const c=base.channels?.AlbedoPBR?.color||base.channels?.DiffuseColor?.color;
      bodyMatch=Array.isArray(c)&&c.length>=3&&Math.min(c[0],c[1],c[2])>.28&&Math.max(c[0],c[1],c[2])<.98;
    }
    if(isGlass){
      channelColor(base,"AlbedoPBR",state.tint?[.06,.10,.15]:[.42,.48,.53]);
      channelColor(base,"DiffuseColor",state.tint?[.06,.10,.15]:[.42,.48,.53]);
      channelScalar(base,"Opacity",state.tint?.92:.55);
    } else if(isWheel){
      channelColor(base,"AlbedoPBR",wheelColor);channelColor(base,"DiffuseColor",wheelColor);
    } else if(isBrake){
      channelColor(base,"AlbedoPBR",brakeRGB);channelColor(base,"DiffuseColor",brakeRGB);
    } else if(isCarbon){
      channelColor(base,"AlbedoPBR",carbonColor);channelColor(base,"DiffuseColor",carbonColor);
    } else if(isLight){
      if(!state.lights){channelColor(base,"AlbedoPBR",[.08,.08,.08]);channelColor(base,"DiffuseColor",[.08,.08,.08]);}
      else {channelColor(base,"EmitColor",[.9,.9,.9]);}
    } else if(bodyMatch){
      channelColor(base,"AlbedoPBR",paintRGB);channelColor(base,"DiffuseColor",paintRGB);
      if(base.channels?.RoughnessPBR){base.channels.RoughnessPBR.enable=true;base.channels.RoughnessPBR.factor=state.finish==="matte"?.78:state.finish==="metallic"?.18:.28;}
      if(base.channels?.MetalnessPBR){base.channels.MetalnessPBR.enable=true;base.channels.MetalnessPBR.factor=state.finish==="metallic"?.72:state.finish==="matte"?.08:.24;}
      if(base.channels?.ClearCoat){base.channels.ClearCoat.enable=true;base.channels.ClearCoat.factor=state.finish==="matte"?.08:.7;}
    }
    api.setMaterial(base);
  });
}
function applyNodes(){
  if(!api||!ready)return;
  nodes.forEach(n=>{
    const name=(n.name||"").toLowerCase();
    if(/wing|spoiler/.test(name)){ if(state.wing)api.show(n.instanceID);else api.hide(n.instanceID); }
    // Wheels named as individual nodes: track-width and ride-height adjustments
    // are applied to their node transforms only if the API exposes a transform.
    if(/wheel|rim|tire|tyre/.test(name)){
      api.getMatrix(n.instanceID,(err,matrix)=>{
        if(err||!matrix)return;
        const original=wheelMatrices.get(n.instanceID)||matrix.slice();
        wheelMatrices.set(n.instanceID,original.slice());
        matrix[12]=original[12]+(state.track?(original[12]>=0?.045:-.045):0);
        matrix[13]=original[13]+(state.height==="Low"?-.035:state.height==="High"?.035:0);
        api.setMatrix(n.instanceID,matrix);
      });
    }
  });
}
const wheelMatrices=new Map();
function update(){summary();applyMaterials();applyNodes();}
function configText(){
 return ["REVORA — 911 GT3 RS CONFIGURATION","",`Model: Porsche 911 GT3 RS (992) '23 — Sketchfab model`,`Exterior: ${state.paint} (${state.color})`,`Finish: ${finishNames[state.finish]}`,`Wheel selection: ${wheelNames[state.wheel]}`,`Brake calipers: ${state.brake}`,`Carbon-fibre accents: ${state.carbon?"Yes":"No"}`,`Rear GT wing: ${state.wing?"Yes":"No"}`,`Window tint: ${state.tint?"Yes":"No"}`,`Lights: ${state.lights?"On":"Off"}`,`Ride height: ${state.height}`,`Track setup: ${state.track?"Yes":"No"}`,"","Model credit: Mona x Supercars / Sketchfab, CC BY 4.0","https://sketchfab.com/3d-models/porsche-911-gt3-rs-992-23-99c74d8fa7df42d984903868f6e593f6","Independent concept configurator. Not affiliated with Porsche AG."].join("\n");
}
function downloadBuild(){
 const url=URL.createObjectURL(new Blob([configText()],{type:"text/plain;charset=utf-8"}));
 const a=document.createElement("a");a.href=url;a.download="REVORA-911-build.txt";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function copyBuild(){
 const b=$("share");try{
  if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(configText());
  else{const f=document.createElement("textarea");f.value=configText();f.style.cssText="position:fixed;opacity:0";document.body.append(f);f.select();const ok=document.execCommand("copy");f.remove();if(!ok)throw Error();}
  b.textContent="Copied ✓";
 }catch{b.textContent="Copy blocked";}
 setTimeout(()=>b.textContent="Copy configuration",1800);
}
function cameraPreset(view){
 if(!api)return;
 api.getCameraLookAt((err,cam)=>{
  if(err||!cam)return;
  const target=cam.target||[0,0,0], p=cam.position||[4,3,5];
  const distance=Math.hypot(p[0]-target[0],p[1]-target[1],p[2]-target[2])||5;
  const presets={front:[0,.12,1],side:[1,0,0],rear:[0,.12,-1],default:[.7,.4,.7]};
  const dir=presets[view]||presets.default;
  const y=view==="side"?Math.max(.12,(p[1]-target[1])/distance):dir[1];
  const norm=Math.hypot(dir[0],y,dir[2])||1;
  const pos=[target[0]+distance*dir[0]/norm,target[1]+distance*y/norm,target[2]+distance*dir[2]/norm];
  api.setCameraLookAt(pos,target,1.0);
 });
 const label={front:"FRONT",side:"SIDE",rear:"REAR",default:"EXTERIOR VIEW"}[view]||"EXTERIOR VIEW";
 const labelEl=document.querySelector(".view-label");labelEl.firstChild.textContent=label+" ";
 document.querySelectorAll(".view-tools .tool").forEach(b=>b.classList.remove("active"));
 if(view==="front")$("frontBtn").classList.add("active");
 if(view==="side")$("sideBtn").classList.add("active");
 if(view==="rear")$("rearBtn").classList.add("active");
 $("rotateBtn").classList.toggle("active",autoRotate);
}
function startSpinLoop(){
 if(spinTimer)clearInterval(spinTimer);
 if(api&&autoRotate){
  spinTimer=setInterval(()=>api.getCameraLookAt((err,c)=>{
   if(err||!c)return;
   const p=c.position,t=c.target;if(!p||!t)return;
   const dx=p[0]-t[0],dz=p[2]-t[2],a=Math.atan2(dz,dx)+.018,d=Math.hypot(dx,dz);
   api.setCameraLookAt([t[0]+Math.cos(a)*d,p[1],t[2]+Math.sin(a)*d],t,0);
  }),120);
 }
}
function toggleRotation(){
 autoRotate=!autoRotate;$("rotateBtn").classList.toggle("active",autoRotate);$("rotateBtn").setAttribute("aria-pressed",String(autoRotate));
 if(spinTimer){clearInterval(spinTimer);spinTimer=null;}
 if(autoRotate)startSpinLoop();
}
function resetBuild(){
 Object.assign(state,{paint:"Arctic White",color:"#e8e9e7",finish:"gloss",wheel:"sport",brake:"#c7192d",carbon:true,wing:true,tint:true,lights:true,height:"Sport",track:false});
 setSelected(".swatch","name","Arctic White");setSelected("[data-finish]","finish","gloss");setSelected(".wheel-card","wheel","sport");setSelected("[data-brake]","brake","#c7192d");
 ["carbon","wing","tint","lights"].forEach(id=>$(id).checked=true);$("track").checked=false;$("height").value=0;update();cameraPreset("default");
}
function bindUI(){
 document.querySelectorAll(".swatch").forEach(b=>b.addEventListener("click",()=>{state.paint=b.dataset.name;state.color=b.dataset.color;setSelected(".swatch","name",state.paint);update();}));
 document.querySelectorAll("[data-finish]").forEach(b=>b.addEventListener("click",()=>{state.finish=b.dataset.finish;setSelected("[data-finish]","finish",state.finish);update();}));
 document.querySelectorAll(".wheel-card").forEach(b=>b.addEventListener("click",()=>{state.wheel=b.dataset.wheel;setSelected(".wheel-card","wheel",state.wheel);update();}));
 document.querySelectorAll("[data-brake]").forEach(b=>b.addEventListener("click",()=>{state.brake=b.dataset.brake;setSelected("[data-brake]","brake",state.brake);update();}));
 ["carbon","wing","tint","lights","track"].forEach(id=>$(id).addEventListener("change",e=>{state[id]=e.target.checked;update();}));
 $("height").addEventListener("input",e=>{state.height=["Low","Sport","High"][Number(e.target.value)+1];update();});
 document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t===b));document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id===b.dataset.tab));}));
 $("resetTop").addEventListener("click",resetBuild);$("download").addEventListener("click",downloadBuild);$("share").addEventListener("click",copyBuild);
 $("rotateBtn").addEventListener("click",toggleRotation);
 $("frontBtn").addEventListener("click",()=>cameraPreset("front"));$("sideBtn").addEventListener("click",()=>cameraPreset("side"));$("rearBtn").addEventListener("click",()=>cameraPreset("rear"));
}
function start3D(){
 if(ready)return;
 loadingMessage("BUILDING YOUR 3D EXPERIENCE","Loading the Porsche 3D model…");
 const frame=document.createElement("iframe");frame.id="sketchfab-frame";frame.title="Interactive Porsche 911 GT3 RS 3D model";
 frame.allow="autoplay; fullscreen; xr-spatial-tracking";frame.setAttribute("allowfullscreen","");frame.setAttribute("loading","eager");
 viewer.insertBefore(frame,viewer.querySelector(".view-tools"));
 const apiScript=document.createElement("script");apiScript.src="https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js";
 apiScript.onload=()=>{
  try{
   const client=new Sketchfab(frame);
   client.init(MODEL_UID,{autostart:1,autospin:0,ui_controls:0,ui_infos:0,ui_watermark:1,ui_watermark_link:1,ui_theme:"dark",preload:1},
    {success:viewerAPI=>{api=viewerAPI;api.start(()=>{});api.addEventListener("viewerready",()=>{
      ready=true;loading.style.display="none";
      api.getMaterialList((err,list)=>{if(!err&&Array.isArray(list)){materials=list;saveOriginals();update();}});
      api.getNodeMap((err,list)=>{if(!err&&Array.isArray(list)){nodes=list;applyNodes();}});
      if(autoRotate)startSpinLoop();
      // Start at model's default framing and keep the camera controls supplied by the model viewer.
    });},error:()=>loadingError(Error("Sketchfab viewer initialization failed."))});
  }catch(e){loadingError(e);}
 };
 apiScript.onerror=()=>loadingError(Error("Could not load Sketchfab Viewer API."));
 document.head.appendChild(apiScript);
}
bindUI();update();start3D();
