'use strict';
const state={board:0,chip:0,metric:'temperature'};
const $=id=>document.getElementById(id);
let activeSnapshot=SNAPSHOT;
let liveHistory=[];
let liveUpdates=0;
let boards=activeSnapshot.boards;
const fmt=(n,d=2)=>Number(n).toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d});
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const stops=[[0,[35,88,197]],[.2,[6,182,231]],[.42,[24,185,109]],[.55,[32,186,59]],[.72,[236,198,43]],[.85,[241,128,35]],[1,[243,61,53]]];
function gradient(t){t=clamp(t,0,1);let j=1;while(j<stops.length-1&&t>stops[j][0])j++;const [a,c]=stops[j-1], [b,d]=stops[j],f=(t-a)/(b-a||1);return 'rgb('+c.map((v,i)=>Math.round(v+(d[i]-v)*f)).join(',')+')';}
function getChipValue(c){return state.metric==='temperature'?c.temperature_c:state.metric==='voltage'?c.voltage_raw:state.metric==='mw'?c.mw_raw:null;}
function metricColor(value,board){if(value===null||!Number.isFinite(value))return null;let min,max;if(state.metric==='temperature'){min=45;max=90;}else{const values=board.chips.map(getChipValue).filter(Number.isFinite);const center=avg(values);const spread=Math.max(1,(Math.max(...values)-Math.min(...values))/2);min=center-spread*1.8;max=center+spread*1.8;}return gradient((value-min)/(max-min));}
function updateMetric(){document.querySelectorAll('.metric').forEach(x=>x.classList.toggle('on',x.dataset.metric===state.metric));const notes={temperature:['Холоднее','Норма','Горячее','Относительная визуализация; 90°C используется только как верхняя граница шкалы, не как доказанный предел безопасности.'],voltage:['Ниже среднего','Среднее','Выше среднего','Необработанные PVT_V. Цвет показывает отклонение внутри выбранной платы, а не электрическую опасность.'],mw:['Ниже среднего','Среднее','Выше среднего','MW raw: назначение показателя не подтверждено; цветовая шкала только для сравнения.'],errors:['Нет данных','Нет данных','Нет данных','Поштучные ошибки недоступны в текущем снимке API. Невозможно назначить чипам критичность.']};let z=notes[state.metric];$('l-low').textContent=z[0];$('l-mid').textContent=z[1];$('l-high').textContent=z[2];$('legendNote').textContent=z[3];}
function pulse(el){
  if(!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  el.classList.remove('data-changed');void el.offsetWidth;el.classList.add('data-changed');
}
function setText(id,value,animate=true){const node=$(id),s=String(value);if(node.textContent!==s){node.textContent=s;if(animate)pulse(node);}}
function selectChip(i){
 const map=$('heatmap');const prev=map.children[state.chip];
 if(prev){prev.classList.remove('selected-chip');prev.setAttribute('aria-pressed','false');}
 state.chip=i;
 const next=map.children[i];if(next){next.classList.add('selected-chip');next.setAttribute('aria-pressed','true');}
 renderSelected();
}
function render(){
 const board=boards[state.board];
 document.querySelectorAll('.board-tab').forEach(x=>x.classList.toggle('on',Number(x.dataset.board)===state.board));
 updateMetric();const map=$('heatmap');
 // Reuse all 114 chip buttons: only update changed cells rather than recreate DOM.
 if(map.children.length!==board.chips.length){
   map.replaceChildren();const fragment=document.createDocumentFragment();
   board.chips.forEach((c,i)=>{const button=document.createElement('button');button.type='button';button.className='chip';button.dataset.index=i;button.innerHTML='<span class="chip-index"></span><span class="chip-value"></span>';button.addEventListener('click',()=>selectChip(i));fragment.append(button);});
   map.append(fragment);
 }
 board.chips.forEach((c,i)=>{
   const button=map.children[i],value=getChipValue(c),color=metricColor(value,board)||'';
   const display=value===null?'н/д':state.metric==='temperature'?value+'°C':String(value);
   if(button.style.backgroundColor!==color){const old=button.style.backgroundColor;button.style.backgroundColor=color;if(old)pulse(button);}
   if(button.children[0].textContent!==String(i+1).padStart(3,'0'))button.children[0].textContent=String(i+1).padStart(3,'0');
   if(button.children[1].textContent!==display){button.children[1].textContent=display;pulse(button);}
   button.classList.toggle('selected-chip',state.chip===i);
   button.classList.toggle('unknown-chip',value===null);
   button.setAttribute('aria-label',`Плата ${state.board+1}, чип ${i+1}: ${value??'нет данных'}`);
   button.setAttribute('aria-pressed',String(state.chip===i));
 });
 renderBoards();renderSelected();
}
function renderBoards(){let tbody=$('boards');tbody.replaceChildren();boards.forEach((b,i)=>{let tr=document.createElement('tr');tr.className=i===state.board?'active':'';const v=b.chips.map(c=>c.voltage_raw);[String(i+1),fmt(b.hashrate_ths),fmt(b.temperature_avg_c,1),b.temperature_max_c,Math.min(...v)+'–'+Math.max(...v)].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});tr.children[0].textContent='Плата '+(i+1);tr.tabIndex=0;tr.addEventListener('click',()=>{state.board=i;state.chip=0;render()});tr.addEventListener('keydown',e=>{if(e.key==='Enter'){state.board=i;state.chip=0;render()}});tbody.append(tr);});}
function renderSelected(){
 const b=boards[state.board],c=b.chips[state.chip],delta=c.temperature_c-avg(b.chips.map(x=>x.temperature_c));
 // The controller provides no per-chip HW error counters and no verified physical chip coordinates.
 const index=String(c.index).padStart(3,'0');
 $('details').innerHTML=`<div class="chip-data"><div class="chip-num">#${index}</div><dl><dt>Температура</dt><dd>${c.temperature_c} °C</dd><dt>PVT_V (raw)</dt><dd>${c.voltage_raw}</dd><dt>MW (raw)</dt><dd>${c.mw_raw}</dd></dl><dl><dt>Δ от средней</dt><dd>${delta>=0?'+':''}${fmt(delta,1)} °C</dd><dt>HW Errors чипа</dt><dd class="unknown" title="В заводском API обнаружен только общий счётчик HW Errors">N/A · API не отдаёт</dd><dt>Индекс в телеметрии</dt><dd>${index} / 114</dd></dl></div>`;
 updateDiagnostics();
}
function updateDiagnostics(){
 const chips=boards.reduce((n,b)=>n+b.chips.length,0);
 setText('diagCount',`${chips} / 342`,false);
 setText('diagHw',activeSnapshot.summary.hardware_errors ?? 'N/A',false);
 let anomalies=0;for(const b of boards){const mean=avg(b.chips.map(c=>c.temperature_c));anomalies+=b.chips.filter(c=>c.temperature_c-mean>=5).length;}
 setText('diagHot',String(anomalies)+' (ΔT ≥ 5 °C; текущий снимок)',false);
 const deltas=liveHistory.map(x=>Number(x.hardware_errors)).filter(Number.isFinite);
 setText('diagHwDelta',deltas.length>=2?String(Math.max(0,deltas[deltas.length-1]-deltas[0]))+' за историю Live':'N/A · нужна история',false);
}
function analyzeSelectedChip(){
 const b=boards[state.board],c=b.chips[state.chip],t=b.chips.map(x=>x.temperature_c),v=b.chips.map(x=>x.voltage_raw),m=b.chips.map(x=>x.mw_raw);
 const dt=c.temperature_c-avg(t),dv=c.voltage_raw-avg(v),dm=c.mw_raw-avg(m);
 const hot=dt>=5;const vspread=Math.max(...v)-Math.min(...v);
 $('analysisResult').innerHTML=`<strong>Плата ${state.board+1} · чип #${String(c.index).padStart(3,'0')}</strong> · температура ${fmt(c.temperature_c,1)} °C (${dt>=0?'+':''}${fmt(dt,1)} °C к средней платы).<br>Относительное отклонение PVT_V: ${dv>=0?'+':''}${fmt(dv,1)} raw; MW: ${dm>=0?'+':''}${fmt(dm,1)} raw. Размах PVT_V всей платы: ${vspread} raw.<br><span class="${hot?'warn':''}">${hot?'Внимание: локально горячий чип по исследовательскому порогу ΔT ≥ 5 °C.':'По текущему снимку локального превышения температуры ≥ 5 °C нет.'}</span> HW Errors конкретного чипа: N/A. Физические координаты и отдельное питание не установлены.`;
}
function simulateFactory(){
 const power=activeSnapshot.power_supply?.hashboard_output_w;const h=Number(activeSnapshot.summary.hashrate_5m_ths);
 const valid=Number.isFinite(Number(power))&&Number(power)>0&&h>0;
 const info=valid?`Выход хеш-плат: <strong>${fmt(power,0)} Вт</strong>; хешрейт 5m: <strong>${fmt(h,2)} TH/s</strong>; эффективность по выходу БП: <strong>${fmt(power/h,2)} J/TH</strong>.`:'Проверенные одновременные данные PS и TH/s пока отсутствуют.';
 $('analysisResult').innerHTML=`<strong>Adaptive Simulation · сравнительный анализ</strong><br>Заводской номинал: 3520 Вт, 106 TH/s, 33,2 J/TH.<br>${info}<br><span class="warn">Паспортные AC-ватты и выходную мощность хеш-плат напрямую не сравниваем. Снижение напряжения не моделируется количественно без испытаний других профилей. Запись в ASIC отключена.</span>`;
}

function drawBars(id,items,maxValue,unit){const cvs=$(id),ctx=cvs.getContext('2d'),w=cvs.width,h=cvs.height;ctx.clearRect(0,0,w,h);const vmax=maxValue||Math.max(...items)*1.15;for(let i=0;i<items.length;i++){let x=60+i*225,y=h-32-items[i]/vmax*(h-56);ctx.fillStyle='#143b25';ctx.fillRect(x,h-32,95,-(h-56));ctx.fillStyle='#39ff14';ctx.fillRect(x,y,95,h-32-y);ctx.fillStyle='#d4f5da';ctx.font='19px Segoe UI';ctx.fillText(fmt(items[i],1)+' '+unit,x,y-8);ctx.font='16px Segoe UI';ctx.fillText('Плата '+(i+1),x,h-9);}}
function init(){if(boards.length!==3||boards.some(b=>b.chips.length!==114))throw Error('Invalid snapshot shape');$('model').textContent='AvalonMiner '+activeSnapshot.device.model;$('controller').textContent=activeSnapshot.device.swtype+' / '+activeSnapshot.device.operating_system;$('stamp').textContent=activeSnapshot.source_collected_at;setText('avg',fmt(activeSnapshot.summary.hashrate_average_ths)+' TH/s');setText('five',fmt(activeSnapshot.summary.hashrate_5m_ths)+' TH/s');setText('accepted',activeSnapshot.summary.accepted);setText('rejected',activeSnapshot.summary.rejected);setText('hw',activeSnapshot.summary.hardware_errors);$('footStats').textContent=`Stale: ${activeSnapshot.summary.stale} · Accepted: ${activeSnapshot.summary.accepted} · Rejected: ${activeSnapshot.summary.rejected}`;
document.querySelectorAll('.board-tab').forEach(x=>x.addEventListener('click',()=>{state.board=Number(x.dataset.board);state.chip=0;render();}));document.querySelectorAll('.metric').forEach(x=>x.addEventListener('click',()=>{state.metric=x.dataset.metric;render();}));$('prev').addEventListener('click',()=>{state.chip=(state.chip+113)%114;render();});$('next').addEventListener('click',()=>{state.chip=(state.chip+1)%114;render();});$('analyzeChip').addEventListener('click',analyzeSelectedChip);$('simulate').addEventListener('click',simulateFactory);$('help').addEventListener('click',()=>document.getElementById('aboutDialog').showModal());
updateHardwareKpi();setupImport();render();drawBars('boardChart',boards.map(b=>b.hashrate_ths),35,'TH/s');drawBars('tempChart',boards.map(b=>b.temperature_avg_c),80,'°C');}
function updateHardwareKpi(){
  const fan=activeSnapshot.fan_snapshot;
  setText('fans',fan&&Number.isFinite(Number(fan.fan1_rpm))&&Number.isFinite(Number(fan.fan2_rpm))?`${fan.fan1_rpm} / ${fan.fan2_rpm} RPM`:'Нет данных');
  $('fans').title=fan?`Снимок: ${fan.source}`:'Показания вентиляторов отсутствуют';
  const wall=Number($('watts').value),hash=Number(activeSnapshot.summary.hashrate_5m_ths),ps=activeSnapshot.power_supply;
  const hasWall=String($('watts').value).trim()!==''&&Number.isFinite(wall)&&wall>0;
  const hasPS=ps&&Number.isFinite(Number(ps.hashboard_output_w))&&Number(ps.hashboard_output_w)>0;
  const w=hasWall?wall:hasPS?Number(ps.hashboard_output_w):null;
  setText('powerKpi',w===null?'— Вт':`${fmt(w,0)} Вт ${hasWall?'(ввод)':'(PS)'}`);
  setText('efficiency',w!==null&&hash>0?`${fmt(w/hash)} J/TH ${hasWall?'(AC)':'(PS)'}`:'— J/TH');
  $('powerKpi').title=hasWall?'Ручной ввод внешнего измерения AC':'PS: выходная мощность блока питания на хеш-платы. Не является потреблением из розетки';
  $('efficiency').title='PS J/TH не учитывает входные потери БП и вспомогательное потребление. Заводской ориентир 33,2 J/TH.';
  $('psSource').textContent=hasWall?'Источник: введённая мощность. Проверьте достоверность измерения.':hasPS?`Источник: ${ps.source}, ${ps.source_collected_at}; PS=${(ps.ps_raw||[]).join(' ')}. Поле PS[6] пока не расшифровано. Значение не подтверждено независимым ваттметром.`:'Мощность ASIC не обнаружена; заводской ориентир 3520 Вт / 33,2 J/TH.';
  renderControllerExtra();
}
function renderControllerExtra(){
 const ps=activeSnapshot.power_supply;
 const raw=ps?.ps_raw||[];
 const latest=activeSnapshot.source_collected_at||'Время снимка неизвестно';
 const notify=Array.isArray(activeSnapshot.notify)?activeSnapshot.notify:[];
 const rows=[
  ['Источник / снимок',latest],
  ['Заводской номинал','3520 Вт · 106 TH/s · 33,2 J/TH'],
  ['Активный профиль',`WORKMODE ${activeSnapshot.workmode_raw??'N/A'} · ${activeLevel()??'N/A'} Power Level`],
  ['Ошибки чипов','Не передаются поштучно (N/A)']
 ];
 if(raw.length>=6){
  rows.push(['PS статус · код',raw[0]],['PS питание контроллера',(raw[1]/100).toFixed(2)+' В'],
   ['PS напряжение плат',(raw[2]/100).toFixed(2)+' В'],['PS ток плат',raw[3]+' А'],
   ['PS выход хеш-плат',raw[4]+' Вт (не AC)'],['PS заданное напряжение',(raw[5]/100).toFixed(2)+' В']);
  if(raw.length>6)rows.push(['PS расширение (не расшифровано)',raw.slice(6).join(', ')]);
 }else rows.push(['PS','Нет достоверного полного массива']);
 const box=$('controllerExtra');box.replaceChildren();
 for(const [k,v] of rows){const item=document.createElement('div'),label=document.createElement('span'),value=document.createElement('b');label.textContent=k;value.textContent=String(v);item.append(label,value);box.append(item);}
 const old=document.getElementById('controllerEvents');if(old)old.remove();
 const section=document.createElement('section');section.id='controllerEvents';section.className='controller-events';section.setAttribute('aria-live','polite');
 const title=document.createElement('h3');title.textContent='Фактические события контроллера';section.append(title);
 const events=[];
 const stat=activeSnapshot.link_status;
 if(stat?.online===false)events.push({severity:'critical',text:'Нет актуальной связи с ASIC',detail:`Возраст данных: ${stat.age_seconds??'—'} сек; ${stat.error||'контроллер не ответил'}`});
 else if(stat?.online===true)events.push({severity:'ok',text:'Последний опрос контроллера успешен',detail:`Снимок: ${latest} · возраст ${stat.age_seconds??'—'} сек`});
 else events.push({severity:'unknown',text:'Состояние Live-подключения не подтверждено',detail:'Статический снимок или импорт JSONL'});
 for(const entry of notify){
   for(const [key,value] of Object.entries(entry)){
     if(!key.startsWith('*')||!Number.isFinite(Number(value))||Number(value)<=0)continue;
     events.push({severity:'critical',text:`CGMiner NOTIFY: ${key.replace(/^\*/, '')}`,detail:`Счётчик: ${value} · снимок ${latest}`});
   }
   if(entry['Reason Not Well']&&entry['Reason Not Well']!=='None')events.push({severity:'critical',text:'CGMiner: Reason Not Well',detail:String(entry['Reason Not Well'])});
 }
 const currentHW=Number(activeSnapshot.summary.hardware_errors);
 if(Number.isFinite(currentHW))events.push({severity:'info',text:'HW Errors всего (накопленный счётчик)',detail:String(currentHW)+' · не является ошибками отдельных чипов'});
 const history=liveHistory.map(x=>({value:Number(x.hardware_errors),ts:x.timestamp})).filter(x=>Number.isFinite(x.value));
 if(history.length>1){const first=history[0],last=history[history.length-1],delta=last.value-first.value;
  if(delta>0)events.push({severity:'warning',text:'За время Live-наблюдения увеличился HW Errors',detail:`+${delta} · с ${first.ts} по ${last.ts}`});
  else if(delta===0)events.push({severity:'ok',text:'Рост HW Errors за Live-наблюдение не обнаружен',detail:`${first.ts} → ${last.ts}`});
  else events.push({severity:'unknown',text:'Счётчик HW Errors сброшен',detail:`${first.value} → ${last.value}; вероятен сброс или перезапуск`});
 }else events.push({severity:'unknown',text:'Динамика HW Errors пока неизвестна',detail:'Нужны минимум два последовательных измерения'});
 if(!notify.length)events.push({severity:'unknown',text:'CGMiner NOTIFY не получен',detail:'Аварийные флаги нельзя считать равными нулю'});
 else if(!notify.some(e=>Object.entries(e).some(([k,v])=>k.startsWith('*')&&Number(v)>0)||e['Reason Not Well']&&e['Reason Not Well']!=='None'))events.push({severity:'ok',text:'CGMiner NOTIFY: активных аварийных счётчиков не обнаружено',detail:`Состояние на ${latest}`});
 for(const event of events){const line=document.createElement('div');line.className='controller-event '+event.severity;
  const h=document.createElement('strong');h.textContent=event.text;const d=document.createElement('small');d.textContent=event.detail;line.append(h,d);section.append(line);}
 const disclaimer=document.createElement('p');disclaimer.className='muted';disclaimer.textContent='События основаны только на ответах ASIC и изменении счётчиков. Отсутствие аварийного флага не гарантирует исправность. Предупреждения по неподтверждённым температурным порогам не генерируются.';section.append(disclaimer);
 box.parentElement.append(section);
}

function showSnapshot(){
  $('stamp').textContent=activeSnapshot.source_collected_at;
  setText('avg',fmt(activeSnapshot.summary.hashrate_average_ths)+' TH/s');
  setText('five',fmt(activeSnapshot.summary.hashrate_5m_ths)+' TH/s');
  setText('accepted',activeSnapshot.summary.accepted);
  setText('rejected',activeSnapshot.summary.rejected);
  setText('hw',activeSnapshot.summary.hardware_errors);
  $('footStats').textContent=`Stale: ${activeSnapshot.summary.stale} · Accepted: ${activeSnapshot.summary.accepted} · Rejected: ${activeSnapshot.summary.rejected}`;
  boards=activeSnapshot.boards;
  updateHardwareKpi();render();drawBars('boardChart',boards.map(b=>b.hashrate_ths),35,'TH/s');drawBars('tempChart',boards.map(b=>b.temperature_avg_c),80,'°C');
}
function convertTelemetry(t){
  if(!Array.isArray(t.boards)||t.boards.length!==3)throw Error('Ожидаются три платы');
  const converted=t.boards.map((b,i)=>{
    const ts=b.temperatures_c,vs=b.voltages_raw,ms=b.mw_raw;
    if(![ts,vs,ms].every(a=>Array.isArray(a)&&a.length===114))throw Error(`Неполные показания платы ${i+1}`);
    const chips=ts.map((temp,j)=>({index:j+1,temperature_c:temp,voltage_raw:vs[j],mw_raw:ms[j]}));
    return {board:i+1,hashrate_ths:b.hashrate_ths,temperature_avg_c:b.temperature_avg_c,temperature_max_c:b.temperature_max_c,chips};
  });
  return {workmode_raw:t.workmode_raw,power_level_profile_raw:t.power_level_profile_raw,source_collected_at:t.timestamp,device:{model:t.device?.model??'1326-106',swtype:t.device?.swtype??'MM317',operating_system:'FreeRTOS'},summary:{hashrate_average_ths:t.hashrate_average_ths,hashrate_5m_ths:t.hashrate_5m_ths,accepted:t.accepted,rejected:t.rejected,stale:t.stale,hardware_errors:t.hardware_errors},fan_snapshot:{fan1_rpm:t.fan1_rpm,fan2_rpm:t.fan2_rpm,source:t.timestamp},power_supply:t.power_supply??(Array.isArray(t.power_status_raw)&&t.power_status_raw.length>=6?{ps_raw:t.power_status_raw,hashboard_output_w:t.power_status_raw[4],source:'CGMiner PS',source_collected_at:t.timestamp}:null),notify:t.notify??[],link_status:t.link_status??null,boards:converted};
}
function setupImport(){
 $('watts').addEventListener('input',updateHardwareKpi);
 $('importJsonl').addEventListener('change',async e=>{
  const f=e.target.files?.[0];if(!f)return;
  try{const lines=(await f.text()).split(/\r?\n/).filter(x=>x.trim());let count=0,last=null;
   for(const line of lines){try{last=convertTelemetry(JSON.parse(line));count++;}catch(err){ /* ignore invalid/incomplete samples */ }}
   if(!last)throw Error('Нет полных записей телеметрии');
   activeSnapshot=last;showSnapshot();$('dataSource').textContent=`История JSONL: ${count} измерений`;
   $('importStatus').textContent=`Загружено ${count} полных измерений из ${lines.length}. Показан последний снимок; автоматического опроса ASIC нет.`;
  }catch(err){$('importStatus').textContent='Ошибка импорта: '+err.message;}
 });
}
init();
if($('liveStatus')) $('liveStatus').textContent='OFFLINE · сохранённый образец, ожидание реальных данных ASIC';


// Live polling is optional: static HTML remains usable if backend is not running.
function drawHistory(canvasId,field,label){
 const canvas=$(canvasId);if(!canvas||!liveHistory.length)return;
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 ctx.clearRect(0,0,w,h);const pts=liveHistory.map(x=>Number(x[field])).filter(Number.isFinite);
 if(!pts.length)return;
 let mn=Math.min(...pts),mx=Math.max(...pts);if(mx<=mn)mx=mn+1;
 const pad=25;ctx.lineWidth=2;ctx.strokeStyle='#39ff14';ctx.beginPath();
 pts.forEach((v,i)=>{const x=pad+i*(w-2*pad)/Math.max(1,pts.length-1),y=h-pad-(v-mn)/(mx-mn)*(h-2*pad);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();
 ctx.font='17px Segoe UI';ctx.fillStyle='#a8ff9c';ctx.fillText(`${label}: ${fmt(pts[pts.length-1],1)}`,pad,18);
}
async function refreshLive(){
 try{
  const response=await fetch('/api/state',{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const result=await response.json();const snapshot=result.snapshot;
  if(!snapshot){$('liveStatus').textContent='OFFLINE · ожидаем данные ASIC'+(result.status.error?' · '+result.status.error:'');return;}
  if(snapshot.timestamp!==window.lastLiveTimestamp){
   window.lastLiveTimestamp=snapshot.timestamp;liveUpdates+=1;
   activeSnapshot=convertTelemetry({...snapshot,link_status:result.status});showSnapshot();
  }
  activeSnapshot.link_status=result.status;try{renderControllerExtra();}catch(diagErr){console.error('Controller diagnostics:',diagErr);}
  $('liveStatus').textContent=result.status.online?`LIVE · CGMiner · опрос #${liveUpdates} · ${result.status.age_seconds} с назад · ${snapshot.timestamp}`:`STALE / OFFLINE · ${result.status.error||'данные устарели'}`;
  $('dataSource').textContent=`CGMiner API · обновление каждые ${result.status.interval_seconds} сек`;
  const r=await fetch('/api/history',{cache:'no-store'});
  if(r.ok){const history=await r.json();liveHistory=history.samples||[];updateDiagnostics();
   renderControllerExtra();
   if(liveHistory.length>1){drawHistory('boardChart','hashrate_5m_ths','TH/s 5m');drawHistory('tempChart','temperature_max_c','Tmax °C');}}
 }catch(err){activeSnapshot.link_status={online:false,error:String(err.message||err),age_seconds:null};renderControllerExtra();$('liveStatus').textContent='Live Backend недоступен · '+String(err.message||err);}
}
refreshLive();setInterval(refreshLive,10000);

// Factory-mode browser: never sends writes to CGMiner or CGI.
const FACTORY_PROFILES = Object.freeze({
  0:{name:'Normal Mode',freq:'456 / 476 / 496 / 516',voltage:'1296',note:'ATAOPTS0: заводской набор, наблюдавшийся на A1326'},
  1:{name:'High Performance',freq:'570 / 590 / 610 / 630',voltage:'1333',note:'ATAOPTS1: заводской набор, наблюдавшийся на A1326'},
  2:{name:'Power Mode',freq:'426 / 446 / 466 / 486',voltage:'1263',note:'ATAOPTS2: активный при измерении Power Level 4; другие уровни НЕ измерены'}
});
function activeMode(){const n=Number.parseInt(String(activeSnapshot.workmode_raw??'2').replace(/[^0-9]/g,''),10);return n in FACTORY_PROFILES?n:2;}
function activeLevel(){const found=String(activeSnapshot.power_level_profile_raw||'').match(/--power-level\s+(\d+)/);return found?Number(found[1]):null;}
function showFactoryProfile(){
  const mode=Number($('factoryMode').value),level=Number($('factoryLevel').value),profile=FACTORY_PROFILES[mode];
  $('factoryLevel').disabled=mode!==2;
  let note=profile.note;
  if(mode===2&&level!==4)note='Для Power Level '+level+' нет подтверждённых показаний частоты/напряжения. Ниже отображён только известный заводской профиль уровня 4, НЕ параметры выбранного уровня.';
  $('factoryPreview').innerHTML='<b>'+profile.name+'</b> · режим '+mode+(mode===2?' · выбранный Power Level '+level:'')+'<br>Частоты ATAOPTS (из известного снимка): '+profile.freq+'<br>Voltage Level (условные единицы): '+profile.voltage+'<br><span class="muted">'+note+'</span>';
}
function currentFactory(){const mode=activeMode();$('factoryMode').value=String(mode);$('factoryLevel').value=String(activeLevel()??4);showFactoryProfile();$('factoryResult').textContent='Выведены параметры последнего снимка контроллера. Состояние кнопок не меняет ASIC.';}
$('factoryMode').addEventListener('change',showFactoryProfile);
$('factoryLevel').addEventListener('change',showFactoryProfile);
$('factoryCurrent').addEventListener('click',currentFactory);
$('factoryCompare').addEventListener('click',()=>{
 const mode=Number($('factoryMode').value),level=Number($('factoryLevel').value),live=activeMode(),liveLevel=activeLevel();
 $('factoryResult').textContent='Текущий по снимку: '+FACTORY_PROFILES[live].name+' (Power Level '+(liveLevel??'не определён')+'). Кандидат: '+FACTORY_PROFILES[mode].name+(mode===2?' (Power Level '+level+')':'')+'. '+(mode===2&&level!==4?'Для выбранного уровня нет проверенных рабочих параметров. ':'')+'Прогноз TH/s и экономии невозможен без измеренного теста этого режима. Изменения не отправлены.';
});
$('factoryNav').addEventListener('click',()=>$('factoryProfiles').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}));
$('aboutClose').addEventListener('click',()=>$('aboutDialog').close());
$('aboutOkay').addEventListener('click',()=>$('aboutDialog').close());
$('aboutDialog').addEventListener('click',e=>{if(e.target===$('aboutDialog'))$('aboutDialog').close()});
currentFactory();
