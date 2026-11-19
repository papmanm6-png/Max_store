'use strict';
const FW={l:'Numéro WhatsApp'};
function baseProducts(){
  const P=[
   {id:'account',name:'Comptes Free Fire',cat:'Comptes',kind:'listing',desc:'Comptes disponibles — paiement sécurisé, livraison immédiate.',art:['#3b1d6e','#0d1b3d','🔥'],items:[{t:'REGION: N/A',d:'',p:28500},{t:'REGION: N/A',d:'',p:30500},{t:'Region : N/A',d:'ALL EMOTE VETERAN',p:62500},{t:'ff',d:'Full evos',p:14000}]},
   {id:'Ff2018',name:'Free Fire 2018',cat:'Freefire',kind:'offers',desc:'GADE TUTORIEL LA LEW FIN ACHTEL POU KA RANJEL',art:['#7a4a1c','#1d2a3d','🔫'],offers:[{l:'ANDROID 🤖',p:2000}],fields:[FW],tuto:'1. Choisis ANDROID.\n2. Entre ton numéro WhatsApp.\n3. Paie avec ton solde.\n4. Un membre de l\'équipe te contacte sur WhatsApp pour la livraison.'},
   {id:'Tiktok',name:'Boostage - TikTok',cat:'TikTok',kind:'offers',desc:'Booste tes vidéos et ton compte TikTok avec de vrais utilisateurs.',art:['#8b2fd0','#3a6df0','♪'],fields:[{l:'Lien du Video',req:1}],offers:[
     ...[['3K à 6K Vues (Réelles)',700],['7K à 12K Vues (Réelles)',1050],['10K à 20 Vues (Réelles)',1500],['20K à 50K Vues (Réelles)',5000],['60K à 100K Vues (Réelles)',8000]].map(x=>({l:x[0],p:x[1],g:'Vues'})),
     ...[['1K à 3K Likes ❤️ + Commentaires 💬 (Réels)',1500],['3K à 7K Likes ❤️ + Commentaires 💬 (Réels)',4000],['5K à 15K Likes ❤️ + Commentaires 💬 (Réels)',8500],['10K à 30K Likes ❤️ + Commentaires 💬 (Réels)',12500]].map(x=>({l:x[0],p:x[1],g:'Likes ❤️ Coms 💬'})),
     ...[['+300 à +500 Abonnés (Réels)',2500],['+400 à +700 Abonnés (Réels)',3500],['+500 à +1000 Abonnés (Réels)',5000],['+1000 à +1500 Abonnés (Réels)',7500]].map(x=>({l:x[0],p:x[1],g:'Abonnés'}))]},
   {id:'gta',name:'GTA 5',cat:'Jeux',kind:'listing',desc:'Comptes disponibles — paiement sécurisé.',art:['#2a6b3a','#15324a','🚓'],items:[{t:'GTA 5 🚓',d:'Original GTA 5 dispo sou ANDROID 🤖 ak IPHONE 📲',p:3500}]},
   {id:'sensi',name:'Sensi 🩸 + Config⚙️',cat:'Free Fire',kind:'offers',desc:'SENCI PA PANÈL SE PA HEADSHOT ILEGAL💯 SIW TE DEJA SÒT LI PAP FEW FÒ✅',art:['#ffffff','#e8eef2','🎯'],offers:[{l:'ANDROID',p:500},{l:'iPhone',p:750}],fields:[FW],tuto:'1. Choisis ANDROID ou iPhone.\n2. Entre ton numéro WhatsApp.\n3. Paie avec ton solde.\n4. Tu reçois la configuration sur WhatsApp.'},
   {id:'Capcut',name:'Capcut-Pro',cat:'Stream',kind:'offers',desc:'Libérez tout votre potentiel créatif avec Capcut-Pro : un accès officiel et garanti pour éditer vos vidéos sans limites et sans compromis sur la qualité.',art:['#1b1450','#7c2fd0','✂️'],offers:[{l:'CAPCUT 30 jours',p:750},{l:'CAPCUT 60 jours',p:1350},{l:'CAPCUT 90 jours',p:2000}],fields:[{l:'Email',req:1}]},
   {id:'Card',name:'CRÉATION CARTE',cat:'USD',kind:'offers',desc:'Obtenez votre carte bancaire virtuelle en toute sécurité : notre service de création est rapide, confidentiel et prêt à l\'emploi pour vos transactions en ligne.',art:['#ffffff','#dfe9f7','💳'],offers:[{l:'VISA',p:2500},{l:'MERU',p:2500}],fields:[{l:'Nom'},{l:'Prénom'},{l:'Numéro WhatsApp'},{l:'Email',req:1}],tuto:'1. Choisis VISA ou MERU.\n2. Remplis ton nom, prénom, WhatsApp et email.\n3. Paie avec ton solde.\n4. Ta carte est créée et envoyée par l\'équipe.'},
   {id:'Meru',name:'Recharge Meru',cat:'USD',kind:'recharge',rate:145,desc:'Recharge ta carte Meru en dollars.',art:['#000000','#0b2a1a','💸'],fields:[{l:'Email'},{l:'Nom d\'utilisateur'}]},
   {id:'crunchy',name:'Crunchyroll - abo +',cat:'Stream',kind:'offers',desc:'Abonnement Crunchyroll.',art:['#ffffff','#f3f3f3','▶️'],offers:[],fields:[{l:'Email',req:1}]},
   {id:'Efootball',name:'E-Football ⚽',cat:'Top Up',kind:'offers',desc:'Recharge ton compte eFootball et reçois tes coins immédiatement.',art:['#240a5c','#0b1b4a','⚽'],fields:[{l:'ID Efootball'},{l:'Email Efootball',req:1},{l:'Numero Whatsap'},{l:'Mot de passe Efootball'}],offers:[[130,253],[300,605],[550,990],[750,1485],[1040,1980],[2130,3740],[3250,5500],[5700,9020],[12800,17600]].map(x=>({l:x[0]+' 🪙',p:x[1],g:'TOP UP 🪙'})),tuto:'1. Choisis ton offre de coins.\n2. Entre ton ID et ton email eFootball.\n3. Paie avec ton solde.\n4. Les coins sont envoyés sur ton compte.'},
   {id:'Robux',name:'Roblox Top Up',cat:'Top Up',kind:'offers',desc:'Robux livrés rapidement sur ton compte Roblox.',art:['#1a1a4a','#6a2fd0','🧱'],fields:[{l:'Nom sur Roblox'},{l:'Numero Whatsap'},{l:'Email Roblox'},{l:'Mot de Passe'}],offers:[[120,550],[500,1100],[1000,1980],[2000,4395],[5250,9900],[11000,18700],[22500,38000]].map(x=>({l:x[0]+' ◈',p:x[1],g:'ROBUX ◈'})),tuto:'1. Choisis ton offre Robux.\n2. Entre ton nom Roblox, WhatsApp, email et mot de passe.\n3. Paie avec ton solde.\n4. Les Robux arrivent sur ton compte.'},
   {id:'Ffbeta',name:'FreeFire-beta',cat:'Free Fire',kind:'offers',desc:'Gen 2 tip FF Beta Bien pran sanw chwazi saw bezwen anh',art:['#1d6fd0','#0a1a3a','✅'],offers:[{l:'Sa ki ka jwe ✅',p:3000},{l:'Sa ki paka jwe a',p:2000}],fields:[FW]},
   {id:'cashapp',name:'Recharge Cash App',cat:'USD',kind:'recharge',rate:142,desc:'Recharge ton compte Cash App en dollars.',art:['#ffffff','#e9fbe9','$'],fields:[{l:'Lien Du Compte',req:1},{l:'Nom d\'utilisateur'}]},
   {id:'Chat',name:'Chat GPT plus',cat:'iA',kind:'offers',desc:'Boostez votre productivité avec un accès complet et sécurisé à ChatGPT Plus, bénéficiant d\'un support technique fiable et d\'une connexion permanente.',art:['#ffffff','#e6f6ff','💬'],offers:[{l:'Chat GPT plus 30 Jours',p:1000},{l:'Chat GPT plus 60 Jours',p:1900},{l:'Chat GPT plus 90 Jours',p:2800}],fields:[{l:'Email',req:1}]},
   {id:'robo',name:'Ti Robo Chans',cat:'Jeux',kind:'game',desc:'Tente ta chance : mise entre 25 et 4000 HTG.',art:['#e8501e','#f08a1e','🎡']}
  ];
  return P;
}
function extraProducts(){return[
 {id:'FFdiamant',name:'Top-up Freefire',cat:'Top Up',kind:'offers',desc:'Mete ID Freefire ou ak non kont ou, epi chwazi kantite dyaman ou bezwen.',art:['#7a4a1c','#1d2a3d','💎'],
  fields:[{l:'ID Freefire ou',req:1},{l:'Non kont Freefire ou'}],
  offers:[['100 + 10',160],['200 + 20',320],['300 + 41',500],['500 + 72',800],['600 + 82',1000],['1000 + 166',1600],['2000 + 398',3200],['3000 + 564',4800],['5000 + 1160',8000]].map(x=>({l:x[0]+'💎',p:x[1],g:'DIAMANTS 💎'})),
  tuto:'1. Mete ID Freefire ou ak non kont ou.\n2. Chwazi kantite dyaman ou bezwen.\n3. Peye avèk solde ou oswa NatCash/MonCash.\n4. Dyaman yo voye sou kont ou.'},
 {id:'Netflix',name:'Netflix',cat:'Abonnement',kind:'offers',desc:'Abònman Netflix. Chwazi lapèn ou bezwen an.',art:['#b20710','#221f1f','N'],fields:[{l:'Numéro WhatsApp'}],
  offers:[['30 jours',600],['60 jours',1100],['90 jours',1500],['180 jours',3000],['1 An',5250]].map(x=>({l:x[0],p:x[1],g:'ABONNEMENT'}))},
 {id:'PrimeVideo',name:'Prime Video',cat:'Abonnement',kind:'offers',desc:'Abonnement Prime Video. Choisis la durée qui te convient.',art:['#00a8e1','#0b2a6b','🎬'],fields:[{l:'Numéro WhatsApp'}],
  offers:[['1 mois',600],['3 mois',1800],['6 mois',3600],['1 an',7200]].map(x=>({l:x[0],p:x[1],g:'PRIX'}))}
]}

module.exports={baseProducts,extraProducts};
