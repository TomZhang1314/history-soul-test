// 无依赖验证：node verify.cjs
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
class Element{
 constructor(){this.children=[];this.style={};this.attrs={};this.hidden=false;this.disabled=false;this.textContent='';this.open=false}
 setAttribute(k,v){this.attrs[k]=v} append(...children){this.children.push(...children)} replaceChildren(...children){this.children=children} focus(){} click(){this.onclick?.()} remove(){} showModal(){this.open=true} close(){this.open=false}
}
const elements=new Map(),storage=new Map();let writesBlocked=false;
const doc={getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id)},createElement(){return new Element()},addEventListener(){},querySelector(){return [...elements.values()].find(e=>e.open)||null},body:new Element()};
const sandbox={document:doc,window:{scrollTo(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){if(writesBlocked)throw Error('blocked');storage.set(k,v)}},setTimeout:()=>0,clearTimeout(){},getComputedStyle:()=>({getPropertyValue:()=> 'serif'}),console};
vm.createContext(sandbox);vm.runInContext(script,sandbox);
const run=s=>vm.runInContext(s,sandbox);
assert.equal(run('QUESTIONS.length'),40);assert.equal(run('PEOPLE.length'),14);
assert.equal(run('new Set(PEOPLE.map(p=>p.role)).size'),7);
for(let axis=0;axis<5;axis++)assert.equal(run(`QUESTIONS.filter(q=>q.axis===${axis}).length`),8);
assert(run('QUESTIONS.every(q=>q.options.length===4 && new Set(q.options.map(o=>o.value)).size===4 && q.options.every(o=>o.text.length>0))'));
assert(run('PEOPLE.every(p=>[p.traits,p.strength,p.egg,p.quote].every(Boolean)&&p.v.length===5&&p.v.every(v=>v>=0&&v<=100))'));
assert.throws(()=>run('score(Array(40).fill(null))'));assert.throws(()=>run('score(Array(39).fill(0))'));assert.throws(()=>run('score(Array(40).fill(4))'));
assert.equal(run('score(QUESTIONS.map(q=>q.options.findIndex(o=>o.value===-3))).vector.every(v=>v===0)'),true);
assert.equal(run('score(QUESTIONS.map(q=>q.options.findIndex(o=>o.value===3))).vector.every(v=>v===100)'),true);
// 用离散可达向量近似每个原型，验证14种结果均能由真实的40题答案命中。
const witnesses=run(`PEOPLE.map(p=>{
 const plans=p.v.map(target=>{let best=null;for(let a=0;a<=8;a++)for(let b=0;b<=8-a;b++)for(let c=0;c<=8-a-b;c++){const d=8-a-b-c,s=-3*a-b+c+3*d,error=Math.abs((s+24)/48*100-target);if(!best||error<best.error)best={error,values:[...Array(a).fill(-3),...Array(b).fill(-1),...Array(c).fill(1),...Array(d).fill(3)]}}return best.values});
 const count=[0,0,0,0,0];const a=QUESTIONS.map(q=>{const value=plans[q.axis][count[q.axis]++];return q.options.findIndex(o=>o.value===value)});return {expected:p.name,actual:score(a).person.name,answers:a};})`);
for(const w of witnesses)assert.equal(w.actual,w.expected,'原型不可达：'+w.expected);
// 可复现伪随机模拟：稳定性、取值范围和所有结果可达。
run('let seed=20261125;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}');
const distribution=run(`(()=>{const hits={};for(let i=0;i<50000;i++){const a=QUESTIONS.map(()=>Math.floor(random()*4)),r=score(a);if(r.vector.some(v=>!Number.isFinite(v)||v<0||v>100))throw Error('Invalid vector');if(i<100&&score(a).person.name!==r.person.name)throw Error('Unstable');hits[r.person.name]=(hits[r.person.name]||0)+1}return hits})()`);
assert.equal(Object.keys(distribution).length,14);
// 完整交互：禁用跳过、上一题保留、完成、重看改答、重置、存储不可用。
const el=id=>doc.getElementById(id);
el('startBtn').click();assert.equal(el('nextBtn').disabled,true);run('next()');assert.equal(run('current'),0);
run('select(2); next()');assert.equal(run('current'),1);el('prevBtn').click();assert.equal(run('answers[0]'),2);
run('reset();for(let i=0;i<40;i++){select(i%4);next()}');assert.equal(run('active'),'result');assert(el('personName').textContent);assert.equal(el('dimensions').children.length,5);
el('reviewBtn').click();assert.equal(run('current'),0);run('select(1);current=39;next()');assert.equal(run('active'),'result');
run('show("home")');el('resumeBtn').click();assert.equal(run('active'),'result');
run('reset();select(3);current=1;persist();answers=Array(40).fill(null);restore()');assert.equal(run('answers[0]'),3);assert.equal(run('current'),1);
writesBlocked=true;run('reset();select(0);next()');assert.equal(run('current'),1);writesBlocked=false;
assert.equal((html.match(/id="[^"]+"/g)||[]).length,new Set(html.match(/id="[^"]+"/g)).size,'Duplicate IDs');
assert(!/\b(?:fetch\(|https?:\/\/|<script[^>]+src=|<link[^>]+href=)/.test(html),'Unexpected external dependency');
const report={passed:true,questions:40,profiles:14,categories:7,simulationSamples:50000,allProfilesReachable:true,distribution,note:'随机模拟仅用于健全性检查，不代表真实人群分布；五维等权距离为趣味规则，无心理测量效度。',checks:['JavaScript语法','40题4选项，五维各8题','0与100边界','未完成/非法答案拒绝','14原型真实答案可达','50000组随机答案范围与稳定性','完整答题、返回修改、重测、续答','存储禁用降级','无外部依赖、无重复元素ID']};
fs.writeFileSync(__dirname+'/validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

