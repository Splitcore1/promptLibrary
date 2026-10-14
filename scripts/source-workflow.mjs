// Portable source/publishing adapter for an environment without installed Sites helpers.
// Credentials are received only on hidden stdin and passed to Git in process memory.
import { readFileSync, existsSync, mkdtempSync, cpSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
const project = JSON.parse(readFileSync('.openai/hosting.json','utf8'));
if (!project.project_id) throw new Error('Missing Site identity');
if (process.stdin.isTTY) spawnSync('stty',['-echo'],{stdio:['inherit','ignore','ignore']});
process.stdout.write('Ready for Site workflow JSON on stdin (input is hidden).\n');
const input = await new Promise(resolveInput => createInterface({input:process.stdin}).once('line', line => resolveInput(line)));
let credential;
try {
 const value=JSON.parse(input);
 credential=value.credential;
 if(!credential?.token || credential.auth_mode!=='http_extra_header')throw new Error('Unsupported source credential');
 const gitEnv={...process.env,GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'http.extraHeader',GIT_CONFIG_VALUE_0:'Authorization: Bearer '+credential.token};
 const run=(args,{capture=false}={})=>{
 const result=spawnSync('git',args,{env:gitEnv,encoding:'utf8',stdio:capture?'pipe':'inherit'});
 if(result.status!==0)throw new Error('Git operation failed: '+args[0]);
 return result.stdout?.trim();
 };
 if(!existsSync('.git'))run(['init','-b',credential.branch]);
 run(['config','user.name','Codex']);
 run(['config','user.email','codex@local.invalid']);
 const remotes=run(['remote'],{capture:true});
 run(['remote',remotes.split('\n').includes('origin')?'set-url':'add','origin',credential.remote_url]);
 run(['add','.']);
 const status=run(['status','--porcelain'],{capture:true});
 if(status)run(['commit','-m','Build personal prompt library MVP']);
 for(const command of value.commands||[]){
 const result=spawnSync(command[0],command.slice(1),{env:process.env,stdio:'inherit'});
 if(result.status!==0)throw new Error('Build or validation command failed');
 }
 if(run(['status','--porcelain'],{capture:true}))throw new Error('Source changed after committing; check generated files before publishing');
 const commit=run(['rev-parse','HEAD'],{capture:true});
 const built=JSON.parse(readFileSync('dist/.openai/hosting.json','utf8'));
 if(built.project_id!==project.project_id)throw new Error('Build belongs to another Site');
 const archive=resolve(value.archivePath);
 const stage=mkdtempSync(join(tmpdir(),'promptfolio-package-'));
 cpSync('dist',join(stage,'dist'),{recursive:true});
 cpSync('dist/.openai',join(stage,'.openai'),{recursive:true});
 const tar=spawnSync('tar',['-czf',archive,'-C',stage,'.'],{stdio:'inherit'});
 if(tar.status!==0)throw new Error('Packaging failed');
 run(['push','-u','origin','HEAD:'+credential.branch]);
 process.stdout.write(JSON.stringify({project_id:project.project_id,commit_sha:commit,archive})+'\n');
}catch(error){process.stderr.write((error instanceof Error?error.message:'Workflow failed')+'\n');process.exitCode=1;}
finally{credential=null;if(process.stdin.isTTY)spawnSync('stty',['echo'],{stdio:['inherit','ignore','ignore']});process.exit(process.exitCode||0);}
