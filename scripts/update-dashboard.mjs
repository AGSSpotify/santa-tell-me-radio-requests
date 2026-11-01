import fs from 'node:fs/promises';

const headers={'user-agent':'Mozilla/5.0 (compatible; SantaTellMeDashboard/1.0)'};
async function get(url){const r=await fetch(url,{headers});if(!r.ok)throw new Error(`${url}: ${r.status}`);return r.text()}
const text=s=>s.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#8217;/g,'’').replace(/\s+/g,' ').trim();
const number=s=>Number(String(s).replace(/[^0-9]/g,''));

async function billboard(){
  const html=await get('https://www.billboard.com/charts/hot-100/');
  const title='Santa Tell Me',i=html.toLowerCase().indexOf(title.toLowerCase());
  if(i<0)return {value:'Not charting',note:'Not present on the latest published Billboard Hot 100. Career peak: #5.'};
  const before=html.slice(Math.max(0,i-7000),i),matches=[...before.matchAll(/u-font-size-22[^>]*>\s*(\d{1,3})\s*</g)];
  const position=matches.at(-1)?.[1];
  return position?{value:`#${position}`,note:'Official position on the latest published Billboard Hot 100.'}:{value:'Charting',note:'The song appears on the latest Hot 100; the position parser needs review.'};
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
  billboard:previous?.billboard||{value:'Unavailable',note:'Waiting for the next update.'},
  spotifyUS:previous?.spotifyUS||{value:'Unavailable',note:'Waiting for the next update.'},
  spotifyDaily:previous?.spotifyDaily||{value:'Unavailable',note:'Waiting for the next update.'},
  sales:{value:'Not publicly reported',note:'No free source publishes verified total U.S. weekly song sales.'},
  forecast:{value:'No free forecast',note:'No rank is invented when a structured public prediction is unavailable.'},
  sources:{billboard:'https://www.billboard.com/charts/hot-100/',kworb:'https://kworb.net/spotify/artist/66CXWjxzNUsdJxJ2JdwvnR_songs.html'}
};
const errors=[];
try{data.billboard=await billboard()}catch(e){errors.push(String(e))}
try{const k=await kworb();data.spotifyUS=k.us;data.spotifyDaily=k.daily}catch(e){errors.push(String(e))}
data.errors=errors;
await fs.writeFile(new URL('../dashboard-data.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({updatedAt:data.updatedAt,billboard:data.billboard.value,spotifyUS:data.spotifyUS.value,spotifyDaily:data.spotifyDaily.value,errors}));

