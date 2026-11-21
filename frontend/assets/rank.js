/* NouriLab prototype: standalone, no backend needed (only research search needs internet).
   Rule-based screening from qualitative priors. NOT machine learning; scores are NOT probabilities.
   No measured functional values are loaded; missing data stays "unknown", never zero. */
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const li=a=>a.length?a.map(esc).join(", "):"none identified";
function toast(t){const x=$("#toast");x.textContent=t;x.style.display="block";clearTimeout(toast.t);toast.t=setTimeout(()=>x.style.display="none",3000)}

const PROPS={whc:"Water-holding capacity",oac:"Oil absorption",solubility:"Protein solubility",emulsification:"Emulsification",gelation:"Gelation",viscosity:"Viscosity control",foaming:"Foaming"};
const ING=[
 {id:"bambara",name:"Bambara groundnut",sci:"Vigna subterranea",cat:"African legume",origin:"West and Central Africa",desc:"An underutilised African legume with potential for protein-rich food ingredients."},
 {id:"cowpea",name:"Cowpea",sci:"Vigna unguiculata",cat:"African legume",origin:"Africa",desc:"A widely cultivated pulse used in traditional foods and potential plant-protein applications."},
 {id:"african-yam-bean",name:"African yam bean",sci:"Sphenostylis stenocarpa",cat:"African legume",origin:"Tropical Africa",desc:"An underutilised legume of interest for food and protein ingredient research."},
 {id:"egusi",name:"Egusi melon seed",sci:"Citrullus species (confirm per sample)",cat:"Oilseed",origin:"West Africa",desc:"Oil-rich edible seeds used in West African cuisines."},
 {id:"sesame",name:"Sesame",sci:"Sesamum indicum",cat:"Oilseed",origin:"Africa and Asia",desc:"Oilseed ingredient; defatting and processing form can affect functionality. Sesame is a major allergen."},
 {id:"soybean",name:"Soybean",sci:"Glycine max",cat:"Legume",origin:"Cultivated globally",desc:"Established plant protein source available as flour, concentrate and isolate. Soy is a major allergen."},
 {id:"pea",name:"Pea",sci:"Pisum sativum",cat:"Legume",origin:"Cultivated globally",desc:"Widely used source for plant protein ingredients."},
 {id:"chickpea",name:"Chickpea",sci:"Cicer arietinum",cat:"Legume",origin:"Cultivated globally",desc:"Pulse explored for protein and functional ingredient applications."},
 {id:"moringa",name:"Moringa seed",sci:"Moringa oleifera",cat:"Seed",origin:"Africa and Asia",desc:"Research candidate requiring careful safety and antinutritional-factor evaluation."}];
const NM=Object.fromEntries(ING.map(x=>[x.id,x.name])),NIG=["bambara","cowpea","african-yam-bean","egusi","sesame"];
const H=3,M=2;
const PRIORS={soybean:{gelation:H,emulsification:H,whc:M,oac:M},pea:{solubility:M,gelation:M,emulsification:M},chickpea:{whc:M,emulsification:M,gelation:M},bambara:{whc:M,gelation:M},cowpea:{whc:M,oac:M,gelation:M},"african-yam-bean":{whc:M},egusi:{oac:H,emulsification:M,solubility:M},sesame:{oac:M,solubility:M}};
const APPS={
 "Plant-based milk":{w:{solubility:5,emulsification:4,viscosity:3},why:"Milks need dispersion, solubility and emulsion stability; strong gelation is usually undesirable."},
 "Plant-based burger":{w:{whc:5,gelation:4,oac:3,emulsification:3},why:"Juiciness and binding depend on water/fat retention and a heat-set protein network."},
 "Plant-based yoghurt":{w:{gelation:5,whc:4,viscosity:3,solubility:2},why:"Acid-set gel structure and water retention drive texture and syneresis."},
 "Protein beverage":{w:{solubility:5,viscosity:4,emulsification:2},why:"Clarity, dispersion and low viscosity matter most."},
 "Bakery product":{w:{whc:5,gelation:3,foaming:2},why:"Water absorption, dough rheology and structure formation matter."}};
const TREAT={
 "Soaking":[["solubility"],"Hydrates tissue and can leach some antinutritional factors.","Nutrient leaching; microbial risk if uncontrolled.","time, temperature, water ratio"],
 "Dehulling":[["solubility","viscosity"],"Removes fibre/polyphenol-rich hulls that affect colour and taste.","Yield loss.","dehulling efficiency"],
 "Roasting":[["oac","solubility"],"Can improve flavour; heat may denature protein.","Often lowers solubility; browning.","temperature, time"],
 "Controlled heat treatment":[["gelation","whc","viscosity"],"Can unfold proteins and inactivate heat-labile inhibitors.","Over-heating can aggregate protein and reduce solubility.","temperature, time, moisture"],
 "Germination":[["solubility","whc"],"May reduce some antinutrients and alter protein profile.","Variable outcome; microbial control needed.","germination time, temperature"],
 "Fermentation":[["solubility","gelation"],"May reduce off-flavours and some antinutrients.","Can change flavour and texture unpredictably.","strain, time, pH"],
 "Defatting":[["solubility","oac"],"Raises protein fraction in oilseeds and removes lipid that hinders hydration.","Solvent use; may change functionality.","residual fat, solvent"],
 "pH adjustment / alkaline extraction + isoelectric precipitation":[["solubility","emulsification"],"Protein solubility is strongly pH-dependent; extraction can give concentrates/isolates.","Harsh pH can modify protein and colour.","extraction pH, precipitation pH, yield"],
 "Enzymatic hydrolysis":[["solubility","foaming","emulsification"],"Partial hydrolysis can raise solubility.","Excess hydrolysis weakens gelation; bitterness.","enzyme, degree of hydrolysis"],
 "Ultrasound":[["solubility","emulsification"],"May disrupt aggregates and improve dispersion.","Oxidative damage possible.","power, time, temperature"],
 "High-pressure processing":[["gelation","whc"],"Can modify structure without much heat.","Equipment cost; protein-specific outcome.","pressure, hold time"]};

/* ---------- engines ---------- */
const tend=(i,p)=>(PRIORS[i]||{})[p];
function rank(app,w){
 const tw=Object.values(w).reduce((a,b)=>a+b,0);
 const out=NIG.map(i=>{const known=Object.entries(w).filter(([p,v])=>v>0&&tend(i,p)),kw=known.reduce((a,[,v])=>a+v,0);
  return{id:i,score:known.length?Math.round(1000*known.reduce((a,[p,v])=>a+v*tend(i,p),0)/(3*kw))/10:null,cov:tw?kw/tw:0,
   sup:known.map(([p])=>PROPS[p]),unk:Object.entries(w).filter(([p,v])=>v>0&&!tend(i,p)).map(([p])=>PROPS[p])}});
 out.sort((a,b)=>(a.score===null)-(b.score===null)||(b.score||0)-(a.score||0)||b.cov-a.cov);return out.slice(0,3)}
function processing(app){const w=APPS[app]?APPS[app].w:{};
 return Object.entries(TREAT).map(([t,v])=>({t,inf:v[0].map(p=>PROPS[p]),why:v[1],risk:v[2],measure:v[3],rel:v[0].some(p=>(w[p]||0)>0)})).sort((a,b)=>b.rel-a.rel)}
function complement(a,b){const sh=[],co=[],un=[];
 for(const [p,n] of Object.entries(PROPS)){const x=tend(a,p),y=tend(b,p);x&&y?(x===y?sh:co).push(n):un.push(n)}return{sh,co,un}}
function blend(parts,app){
 if(parts.length<2)throw Error("Select at least two ingredients.");
 if(new Set(parts.map(p=>p.id)).size!==parts.length)throw Error("Choose two different ingredients.");
 if(parts.some(p=>!(p.pct>=0&&p.pct<=100)))throw Error("Each proportion must be between 0 and 100%.");
 const t=parts.reduce((a,p)=>a+p.pct,0);if(Math.abs(t-100)>0.01)throw Error(`Proportions total ${t}%; they must equal exactly 100%.`);
 const w=APPS[app].w,est={};
 for(const p in w)if(w[p]&&parts.every(x=>tend(x.id,p)))est[PROPS[p]]=Math.round(100*parts.reduce((a,x)=>a+x.pct/100*tend(x.id,p),0))/100;
 return{est,contrib:parts.map(x=>({id:x.id,pct:x.pct,sup:Object.keys(PRIORS[x.id]||{}).filter(k=>(w[k]||0)>0).map(k=>PROPS[k])}))}}

/* ---------- UI ---------- */
function fillApps(){const o=Object.keys(APPS).map(a=>`<option>${a}</option>`).join("");["#mApp","#bApp","#sApp"].forEach(s=>$(s).innerHTML=o)}
function fillIng(){const o=ING.map(x=>`<option value="${x.id}">${x.name}</option>`).join("");["#cA","#cB","#blend1","#blend2"].forEach(s=>$(s).innerHTML=o);$("#cB").value="soybean";$("#blend2").value="cowpea"}
function sliders(){const w=APPS[$("#mApp").value].w;
 $("#sliders").innerHTML=Object.entries(PROPS).map(([k,n])=>`<label>${n.toUpperCase()} — <b id="sv_${k}">${w[k]||0}</b>/5</label><input type="range" min="0" max="5" step="1" data-k="${k}" value="${w[k]||0}">`).join("");
 document.querySelectorAll("#sliders input").forEach(i=>i.oninput=()=>$("#sv_"+i.dataset.k).textContent=i.value)}
$("#rankBtn").onclick=()=>{const w={};document.querySelectorAll("#sliders input").forEach(i=>w[i.dataset.k]=+i.value);const o=$("#rankOut");
 if(!Object.values(w).some(v=>v>0)){o.textContent="Set at least one weight above 0.";return}
 const app=$("#mApp").value,r=rank(app,w);
 o.innerHTML=`<p>${esc(APPS[app].why)}</p>`+r.map((x,n)=>`<p><a href="#" data-p="${x.id}"><strong>${n+1}. ${esc(NM[x.id])}</strong></a> · screening score ${x.score??"n/a"} · evidence coverage ${Math.round(x.cov*100)}% · measured values: 0<br><small>Supports: ${li(x.sup)}. Unknown: ${li(x.unk)}</small></p>`).join("")+"<small>Rule-based screening from qualitative priors. Not ML, not a probability. Validate experimentally. Click a candidate for processing options.</small>";
 o.querySelectorAll("[data-p]").forEach(a=>a.onclick=e=>{e.preventDefault();showProc(a.dataset.p,app,"#procOut");$("#procOut").scrollIntoView({behavior:"smooth",block:"center"})})};
function procHTML(id,app,n=6){return`<strong>${esc(NM[id])} — for ${esc(app)}</strong>`+processing(app).slice(0,n).map(t=>`<p><b>${esc(t.t)}</b>${t.rel?" ★":""}<br>${esc(t.why)}<br><small>Influences: ${li(t.inf)} · Risk: ${esc(t.risk)} · Measure: ${esc(t.measure)}</small></p>`).join("")+"<small>★ relevant to this application. No treatment is guaranteed to help; one property may improve while another worsens.</small>"}
function showProc(id,app,sel){$(sel).innerHTML=procHTML(id,app)}
$("#cBtn").onclick=()=>{const a=$("#cA").value,b=$("#cB").value,o=$("#cOut");if(a===b){o.textContent="Choose two different ingredients.";return}
 const d=complement(a,b);o.innerHTML=`<strong>${esc(NM[a])} + ${esc(NM[b])}: potential complementarity hypothesis</strong><p>Shared tendencies: ${li(d.sh)}<br>Potentially complementary: ${li(d.co)}<br>Needs data: ${li(d.un)}</p><small>Complementarity means different strengths. Synergy is a measured, better-than-expected interaction and cannot be inferred from differing properties. Test blends against single ingredients.</small>`};
function sync(c){let a=+$("#range1").value,b=+$("#range2").value;c===1?b=100-a:a=100-b;$("#range1").value=a;$("#range2").value=b;$("#v1").textContent=a+"%";$("#v2").textContent=b+"%"}
$("#range1").oninput=()=>sync(1);$("#range2").oninput=()=>sync(2);
function currentBlend(){return{app:$("#bApp").value,parts:[{id:$("#blend1").value,pct:+$("#range1").value},{id:$("#blend2").value,pct:+$("#range2").value}]}}
$("#analyseBlend").onclick=()=>{const o=$("#bOut"),c=currentBlend();
 try{const d=blend(c.parts,c.app),e=Object.entries(d.est);
 o.innerHTML=`<strong>Preliminary weighted-average estimate (scale 1–3, from qualitative priors)</strong><p>${d.contrib.map(x=>`${esc(NM[x.id])} ${x.pct}%: supports ${li(x.sup)}`).join("<br>")}</p><p>${e.length?e.map(([k,v])=>`${esc(k)}: ${v}`).join(" · "):"Not enough data to estimate any property for both ingredients."}</p><small>Weighted averages cannot capture protein interactions, phase behaviour or processing effects. This is not an optimal ratio. Check antinutritional factors, allergens (soy, sesame), beany/bitter flavour and colour. Suggested: measure each property for each ingredient and the blend under identical conditions.</small>`}
 catch(err){o.innerHTML=`<span style="color:#e8896a">⚠ ${esc(err.message)}</span>`}};
$("#saveBlend").onclick=()=>{const c=currentBlend();try{blend(c.parts,c.app)}catch(err){toast(err.message);return}
 try{const k="nourilab_blends",l=JSON.parse(localStorage.getItem(k)||"[]");l.push({...c,saved:new Date().toISOString(),note:"Preliminary concept; not validated."});localStorage.setItem(k,JSON.stringify(l));toast(`Blend saved on this device (${l.length} total)`)}
 catch(e){toast("Could not save in this browser.")}};
function showLib(){const q=$("#sq").value.toLowerCase().trim(),c=$("#sCat").value;
 const l=ING.filter(x=>(!c||x.cat===c)&&(x.name+" "+x.sci+" "+x.cat+" "+x.origin).toLowerCase().includes(q));
 $("#libOut").innerHTML=l.length?l.map(x=>`<article data-i="${x.id}"><small>${esc(x.cat)}</small><h3>${esc(x.name)}</h3><i>${esc(x.sci)}</i><p>${esc(x.origin)}</p></article>`).join(""):"No ingredients match your search.";
 $("#libOut").querySelectorAll("article").forEach(a=>a.onclick=()=>pick(a.dataset.i))}
let current=null;
function pick(id){current=id;const x=ING.find(v=>v.id===id),o=$("#profile");o.hidden=false;
 o.innerHTML=`<small>INGREDIENT PROFILE</small><h3>${esc(x.name)} <i>${esc(x.sci)}</i></h3><p>${esc(x.desc)}</p><p><b>Origin:</b> ${esc(x.origin)}<br><b>Category:</b> ${esc(x.cat)}<br><b>Functional measurements:</b> Data unavailable / not yet characterised<br><b>Screening priors:</b> ${li(Object.keys(PRIORS[id]||{}).map(k=>PROPS[k]))} (hypotheses, not measurements)</p><div>${procHTML(id,$("#sApp").value)}</div><button class="primary" id="toBlend" style="margin-top:12px">Use in Blend Studio ↗</button>`;
 $("#toBlend").onclick=()=>{$("#blend1").value=id;$("#blend").scrollIntoView({behavior:"smooth"})};o.scrollIntoView({behavior:"smooth",block:"nearest"})}
$("#sq").oninput=showLib;$("#sCat").onchange=showLib;$("#sApp").onchange=()=>current&&pick(current);

/* ---------- OpenAlex literature search ---------- */
async function search(){const o=$("#rOut"),q=$("#rq").value.trim();
 if(q.length<3){o.textContent="Enter at least 3 characters.";return}
 o.textContent="Searching OpenAlex…";const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),8000);
 try{const r=await fetch("https://api.openalex.org/works?"+new URLSearchParams({search:q,"per-page":6,select:"title,doi,publication_year,authorships,primary_location,id"}),{signal:ctl.signal});
  if(!r.ok)throw Error("Research service returned an error ("+r.status+").");
  const d=(await r.json()).results||[];
  o.innerHTML=d.length?d.map(w=>`<p><a href="${esc(w.doi||w.id)}" target="_blank" rel="noopener"><b>${esc(w.title||"Untitled")}</b></a><br><small>${esc((w.authorships||[]).slice(0,4).map(a=>a.author.display_name).join(", "))} · ${w.publication_year??""} · ${esc(((w.primary_location||{}).source||{}).display_name||"")}</small></p>`).join(""):"No results. Try broader terms.";
 }catch(e){o.innerHTML=`${e.name==="AbortError"?"The search timed out.":esc(e.message==="Failed to fetch"?"Network error. Check your internet connection.":e.message)} <a href="#" id="retry">Retry</a>`;$("#retry").onclick=ev=>{ev.preventDefault();search()}}
 finally{clearTimeout(t)}}
$("#rBtn").onclick=search;$("#rq").onkeydown=e=>{if(e.key==="Enter")search()};

$("#menu").onclick=()=>$("#nav").classList.toggle("open");
document.querySelectorAll("nav a").forEach(a=>a.addEventListener("click",()=>$("#nav").classList.remove("open")));
fillApps();fillIng();$("#mApp").onchange=sliders;sliders();showLib();
