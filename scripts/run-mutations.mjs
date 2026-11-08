import { spawn, spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, relative, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { mutations } from './mutation-catalog.mjs';
import { classifyMutation } from './mutation-results.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = 'frontend';
const selectedId = process.argv.find(value=>value.startsWith('--id='))?.slice(5);
const cases = mutations.filter(item=>item.target===target && (!selectedId || item.id===selectedId));
if (!cases.length) throw new Error('No mutations selected');
if (process.argv.includes('--list')) { for (const item of cases) console.log(`${item.id}: ${item.description}`); process.exit(0); }
const project = root;
const workspace = join(project,'.mutation-work',randomUUID());
const reportDir = join(project,'mutation-report',selectedId ?? '');
const originals = new Map();
const hash = text=>createHash('sha256').update(text).digest('hex');
const summary = { target, generatedAt:new Date().toISOString(), scope:'Hand-seeded, fixed critical-behavior catalog; not exhaustive automatic mutation coverage', baseline:null, results:[] };
async function test(id,tests,env) {
  const outputFile=join(reportDir,`${id}.json`);
  await rm(outputFile,{force:true});
  const result=await new Promise(resolveResult=>{
    const child=spawn(process.execPath,[join(project,'node_modules/vitest/vitest.mjs'),'run',...tests,'--reporter=json',`--outputFile=${outputFile}`],{cwd:workspace,env,stdio:['ignore','pipe','pipe']});
    let output='',timedOut=false;
    child.stdout.on('data',value=>{output+=value;});child.stderr.on('data',value=>{output+=value;});
    const timer=setTimeout(()=>{timedOut=true;child.kill();},120000);
    child.once('error',error=>{clearTimeout(timer);resolveResult({error:String(error),code:null,output,timedOut});});
    child.once('close',code=>{clearTimeout(timer);resolveResult({code,output,timedOut});});
  });
  if(result.error || result.timedOut) return {...result,status:result.timedOut?'timeout':'invalid'};
  let report;
  try { report=JSON.parse(await readFile(outputFile,'utf8')); } catch { return {...result,status:'invalid'}; }
  return {...classifyMutation(report,result.code),code:result.code,output:result.output.slice(-3000)};
}
try {
  await mkdir(workspace,{recursive:true});await mkdir(reportDir,{recursive:true});
  const entries=['src','test','package.json','vitest.config.ts','tsconfig.json'];
  for(const entry of entries)await cp(join(project,entry),join(workspace,entry),{recursive:true});
  for(const item of cases){const text=await readFile(join(project,item.file),'utf8');if(text.split(item.before).length!==2)throw new Error(`${item.id}: expected exactly one source anchor`);originals.set(item.file,text);}
  const env={...process.env};delete env.TEST_DATABASE_URL;
  summary.baseline=await test('baseline',[...new Set(cases.flatMap(item=>item.tests))],env);
  if(summary.baseline.status!=='survived'||summary.baseline.skipped)throw new Error('Baseline must pass without skipped tests: '+JSON.stringify(summary.baseline));
  console.log(`BASELINE PASS ${target}: ${summary.baseline.passed} tests`);
  for(const item of cases){
    const original=originals.get(item.file);let result;
    try{await writeFile(join(workspace,item.file),original.replace(item.before,item.after));result=await test(item.id,item.tests,env);}
    finally{await writeFile(join(workspace,item.file),original);}
    summary.results.push({id:item.id,description:item.description,file:item.file,before:item.before,after:item.after,...result});
    console.log(`${result.status.toUpperCase()} ${item.id}: ${item.description}`);
  }
  summary.counts=Object.fromEntries(['killed','survived','invalid','timeout'].map(status=>[status,summary.results.filter(item=>item.status===status).length]));
  console.log(JSON.stringify(summary.counts));
  if(summary.results.some(item=>item.status!=='killed'))process.exitCode=1;
} catch(error){summary.error=String(error);console.error(summary.error);process.exitCode=1;}
finally{
  summary.sourceUnchanged = true;
  for(const [file,original] of originals)if(hash(await readFile(join(project,file),'utf8'))!==hash(original)){summary.sourceUnchanged=false;summary.error='Original source changed during run: '+file;process.exitCode=1;}
  await writeFile(join(reportDir,'summary.json'),JSON.stringify(summary,null,2)+'\n');
  const allowed=join(project,'.mutation-work')+sep;
  if(!workspace.startsWith(allowed)||relative(project,workspace).startsWith('..'))throw new Error('Unsafe cleanup path');
  await rm(workspace,{recursive:true,force:true});
}
