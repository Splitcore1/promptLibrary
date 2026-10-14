import vinext from 'vinext';
import { defineConfig } from 'vite';
import hostingConfig from './.openai/hosting.json';
import { sites } from './build/sites-vite-plugin';
export default defineConfig(async () => {
 const { cloudflare } = await import('@cloudflare/vite-plugin');
 return { plugins: [vinext(), sites(), cloudflare({viteEnvironment:{name:'rsc',childEnvironments:['ssr']},inspectorPort:false,config:{main:'./build/sites-worker.ts',compatibility_flags:['nodejs_compat'],d1_databases:hostingConfig.d1?[{binding:hostingConfig.d1,database_name:'promptfolio',database_id:'00000000-0000-4000-8000-000000000000'}]:[],r2_buckets:hostingConfig.r2?[{binding:hostingConfig.r2,bucket_name:'promptfolio'}]:[]}})] };
});
