import fs from 'node:fs/promises';

const headers={'user-agent':'Mozilla/5.0 (compatible; SantaTellMeDashboard/1.0)'};
async function get(url){const r=await fetch(url,{headers});if(!r.ok)throw new Error(`${url}: ${r.status}`);return r.text()}
const text=s=>s.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#8217;/g,'’').replace(/\s+/g,' ').trim();
const number=s=>Number(String(s).replace(/[^0-9]/g,''));

async function radio(){
  const html=await get('https://kworb.net/radio/');
  const row=html.match(/<tr[^>]*>[\s\S]*?Ariana Grande\s*-\s*Santa Tell Me[\s\S]*?<\/tr>/i)?.[0]||'';
  const cells=[...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>text(m[1]));
  if(!cells.length)return {value:'Below Top 100',note:'Not listed in Kworb’s latest Billboard Radio Songs estimates.'};
  const position=number(cells[0]);
  const audience=cells[6]||'';
  const change=cells[7]||'';
  return {value:position?`#${position}`:'Listed',note:`Kworb radio estimate${audience?`: ${audience}M audience`:''}${change?` (${change} daily)`:''}.`};
}

async function kworb(){
  const [artist,weekly]=await Promise.all([
    get('https://kworb.net/spotify/artist/66CXWjxzNUsdJxJ2JdwvnR_songs.html'),
    get('https://kworb.net/spotify/country/us_weekly.html')
  ]);
  const date=artist.match(/Last updated:\s*([0-9/]+)/i)?.[1]||'latest update';
  const row=artist.match(/<tr[^>]*>[\s\S]*?>Santa Tell Me<\/[\s\S]*?<\/tr>/i)?.[0]||'';
  const cells=[...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>text(m[1]));
  const daily=number(cells.at(-1));
  const wrow=weekly.match(/<tr[^>]*>[\s\S]*?Santa Tell Me[\s\S]*?<\/tr>/i)?.[0]||'';
  const wcells=[...wrow.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>text(m[1]));
  return {
    daily:{value:daily?daily.toLocaleString('en-US'):'Unavailable',note:`Global Spotify streams reported by Kworb for ${date}.`},
    us:wcells.length?{value:`#${number(wcells[0])||wcells[0]}`,note:`Listed on Kworb's latest U.S. weekly Spotify chart${wcells[6]?` with ${wcells[6]} streams`:''}.`}:{value:'Below Top 200',note:'Not listed on Kworb’s latest U.S. weekly Spotify chart; no exact free weekly total is published.'}
  };
}

const previous=await fs.readFile(new URL('../dashboard-data.json',import.meta.url),'utf8').then(JSON.parse).catch(()=>null);
const data={
  updatedAt:new Date().toISOString(),
  radio:previous?.radio||{value:'Unavailable',note:'Waiting for the next update.'},
  spotifyUS:previous?.spotifyUS||{value:'Unavailable',note:'Waiting for the next update.'},
  spotifyDaily:previous?.spotifyDaily||{value:'Unavailable',note:'Waiting for the next update.'},
  forecast:previous?.forecast||{value:'Watching',note:'Directional estimate based on Kworb streaming and radio signals.'},
  sources:{radio:'https://kworb.net/radio/',kworb:'https://kworb.net/spotify/artist/66CXWjxzNUsdJxJ2JdwvnR_songs.html'}
};
const errors=[];
try{data.radio=await radio()}catch(e){errors.push(String(e))}
try{const k=await kworb();data.spotifyUS=k.us;data.spotifyDaily=k.daily}catch(e){errors.push(String(e))}
if(data.radio.value==='Below Top 100'&&data.spotifyUS.value==='Below Top 200')data.forecast={value:'Outside likely Top 100',note:'Kworb currently shows the song below its radio Top 100 and U.S. weekly Spotify Top 200; this is a directional estimate, not an official chart prediction.'};
else if(data.radio.value.startsWith('#')||data.spotifyUS.value.startsWith('#'))data.forecast={value:'Chart momentum active',note:'At least one Kworb radio or U.S. streaming signal is charting. This is a directional estimate, not an official Billboard prediction.'};
data.errors=errors;
await fs.writeFile(new URL('../dashboard-data.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({updatedAt:data.updatedAt,radio:data.radio.value,spotifyUS:data.spotifyUS.value,spotifyDaily:data.spotifyDaily.value,forecast:data.forecast.value,errors}));

