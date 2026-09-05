#!/usr/bin/env bash
# Production read-only SQL via Supabase Management API.
# Usage: prod_query.sh < file.sql   OR   prod_query.sh 'select ...'
set -euo pipefail
REF="cutcpkegxwhnafrvfbcd"
TOK="$(node -e "
const fs=require('fs');
const m=fs.readFileSync('.env.local','utf8').match(/SUPABASE_ACCESS_TOKEN=(\S+)/);
if(!m){console.error('no token');process.exit(1)}
process.stdout.write(m[1]);
")"
SQL="${1:-}"
if [ -z "$SQL" ]; then SQL="$(cat);"; fi
node -e "
const r=await fetch('https://api.supabase.com/v1/projects/$REF/database/query',{method:'POST',headers:{Authorization:'Bearer '+process.argv[1],'Content-Type':'application/json'},body:JSON.stringify({query:process.argv[2]})});
const t=await r.text();
if(r.status>=300){console.error('HTTP',r.status,t.slice(0,600));process.exit(1)}
const rows=JSON.parse(t);
if(rows.length===0){console.log('(0 rows)')}
else{for(const row of rows){console.log(JSON.stringify(row))}}
" "$TOK" "$SQL"
