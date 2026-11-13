import React,{useEffect,useMemo,useState} from 'react';

const STORE_KEY='storyloom.frontend.v0.2';
const starterStories=[
 {id:'ST-01',title:'未命名的故事',genre:'原創世界',status:'進行中',summary:'',originalMode:'none'},
 {id:'ST-02',title:'新故事企劃',genre:'待設定',status:'草稿',summary:'',originalMode:'none'}
];
const welcome=[{role:'system',text:'故事工作台已就緒。這裡是互動小說的閱讀與操作空間。'},{role:'assistant',text:'午後的光線穿過窗沿，落在桌面上。遠處傳來街道的聲音，房間裡暫時沒有其他動靜。\n\n你可以描述玩家接下來的台詞、想法或行動。'}];
const emptyMessages=[{role:'system',text:'新故事空間已建立。請先完成故事設定，再開始正式劇情。'}];
const readStore=()=>{try{const raw=localStorage.getItem(STORE_KEY);if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed.stories)&&parsed.stories.length)return parsed}}catch{}return {stories:starterStories,activeId:'ST-01',messages:{'ST-01':welcome,'ST-02':emptyMessages}}};
export default function App(){
 const [initial]=useState(readStore);
 const [stories,setStories]=useState(initial.stories);
 const [active,setActive]=useState(initial.activeId||initial.stories[0]?.id);
 const [allMessages,setAllMessages]=useState(initial.messages||{});
 const [input,setInput]=useState('');
 const [tab,setTab]=useState('story');
 const [nav,setNav]=useState(false);
 const [details,setDetails]=useState(false);
 const [editing,setEditing]=useState(false);
 const [draft,setDraft]=useState(null);
 const [toast,setToast]=useState('');
 const story=stories.find(s=>s.id===active)||stories[0];
 const messages=allMessages[active]||welcome;
 const turns=useMemo(()=>messages.filter(m=>m.role==='user').length,[messages]);
 useEffect(()=>{try{localStorage.setItem(STORE_KEY,JSON.stringify({stories,activeId:active,messages:allMessages}))}catch{setToast('瀏覽器儲存空間不足，資料未能完整保存')}} ,[stories,active,allMessages]);
 const notify=t=>{setToast(t);window.setTimeout(()=>setToast(''),2600)};
 const create=()=>{const id='ST-'+Date.now().toString().slice(-6);const item={id,title:'新故事',genre:'待設定',status:'草稿',summary:'',originalMode:'none'};setStories(p=>[item,...p]);setAllMessages(p=>({...p,[id]:emptyMessages}));setActive(id);setTab('story');setNav(false);setDetails(true);setEditing(true);setDraft(item);notify('已建立故事；設定會自動保存在此瀏覽器')};
 const select=s=>{setActive(s.id);setTab('story');setNav(false);setEditing(false)};
 const openEditor=()=>{setDraft({...story});setEditing(true);setDetails(true)};
 const saveSettings=()=>{if(!draft.title.trim()){notify('請先輸入故事名稱');return}setStories(p=>p.map(s=>s.id===active?{...s,...draft,title:draft.title.trim()}:s));setEditing(false);notify('故事設定已保存')};
 const updateMessages=next=>setAllMessages(p=>({...p,[active]:typeof next==='function'?next(p[active]||welcome):next}));
 const send=()=>{if(!input.trim())return;const value=input.trim();updateMessages(p=>[...p,{role:'user',text:value},{role:'assistant',text:'已收到你的輸入。正式接上 AI 敘事引擎後，系統會先檢查玩家控制權、角色知情範圍、故事狀態與觸發條件，再生成後續正文。\n\n目前這是前端原型，尚未連接 AI API。'}]);setInput('')};
 const modeLabel=mode=>mode==='active'?'啟用原作線（C-2）':mode==='reference'?'只參照原作設定（C-3）':'無原作（C-1）';
 return <div className="app">
 <aside className={'sidebar '+(nav?'open':'')}><div className="brand"><div className="logo">S</div><div><b>Storyloom</b><small>AI NOVEL STUDIO</small></div><button className="mobile close" onClick={()=>setNav(false)}>×</button></div>
 <button className="new" onClick={create}>＋　建立新故事</button><div className="label">工作區</div>
 <button className={'nav '+(tab==='story'?'chosen':'')} onClick={()=>setTab('story')}>▤　故事工作台</button><button className={'nav '+(tab==='library'?'chosen':'')} onClick={()=>setTab('library')}>▧　原作資料庫</button><button className={'nav '+(tab==='archive'?'chosen':'')} onClick={()=>setTab('archive')}>◷　備份與結算</button>
 <div className="label">我的故事 <span>{stories.length}</span></div>{stories.map(s=><button key={s.id} className={'story '+(active===s.id?'current':'')} onClick={()=>select(s)}><i/><span>{s.title}<small>{s.status}</small></span>›</button>)}
 <div className="account"><div className="avatar">A</div><div>我的工作區<small>本機儲存模式</small></div></div></aside>
 {nav&&<button className="scrim" onClick={()=>setNav(false)}/>}
 <main><header><button className="hamb" onClick={()=>setNav(true)}>☰</button><div className="crumb">工作區　/　<b>{tab==='story'?'故事工作台':tab==='library'?'原作資料庫':'備份與結算'}</b></div><span className="mode">● 本機儲存</span><button className="info" onClick={()=>setDetails(!details)}>ⓘ</button></header>
 {tab==='story'?<div className="layout"><section className="content"><div className="heading"><div><div className="eyebrow">INTERACTIVE STORY　/　{story.id}</div><h1>{story.title}</h1><p>{story.summary||'建立你的世界，讓角色與故事自然發展。'}</p></div><button className="outline" onClick={openEditor}>編輯故事設定　⌄</button></div>
 <div className="meta"><span>● {story.status}</span><span>▣ 尚未分卷</span><span>◈ {modeLabel(story.originalMode)}</span><span>回合 {turns}</span></div>
 <div className="state"><div className="state-head">故事狀態 <span>時間與地點待設定</span></div><div className="state-grid"><div><small>故事時間</small><b>尚未設定</b></div><div><small>目前位置</small><b>尚未設定</b></div><div><small>目前卷數</small><b>未分卷</b></div></div></div>
 <div className="section-head"><div><h2>故事正文</h2><small>依照故事狀態持續發展</small></div><button onClick={()=>notify('文體設定模組將於後續階段加入')}>文體設定　⌄</button></div>
 <div className="messages">{messages.map((m,i)=><div className={'message '+m.role} key={i}>{m.role==='assistant'&&<div className="spark">✦</div>}{m.role==='system'?<div className="system">{m.text}</div>:<div className="bubble">{m.role==='assistant'&&<small>旁白 · 故事敘述</small>}{m.text.split('\n').map((line,j)=><p key={j}>{line||' '}</p>)}</div>}{m.role==='user'&&<div className="avatar">我</div>}</div>)}</div>
 <div className="composer"><div className="compose-top"><b>玩家輸入</b><span>AI 不會代替你決定行動</span></div><textarea rows="3" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="輸入你的台詞、想法（OS）或行動……"/><div className="compose-bottom"><small>Enter 送出 · Shift + Enter 換行</small><button disabled={!input.trim()} onClick={send}>送出　↑</button></div></div>
 <div className="footnote">✦　目前為前端原型；故事設定與輸入紀錄會保存在此瀏覽器，尚未連接 AI API 或雲端資料庫。</div></section>
 <aside className={'details '+(details?'show':'')}><div className="detail-head"><div><small>STORY COMPANION</small><h3>故事資訊</h3></div><button className="mobile close" onClick={()=>setDetails(false)}>×</button></div>
 {editing&&draft?<div className="detail-block editor"><b>編輯故事設定</b><label>故事名稱<input value={draft.title} maxLength="60" onChange={e=>setDraft(p=>({...p,title:e.target.value}))}/></label><label>故事類型<input value={draft.genre} maxLength="40" onChange={e=>setDraft(p=>({...p,genre:e.target.value}))} placeholder="例如：奇幻、校園、科幻"/></label><label>故事簡介<textarea rows="3" maxLength="300" value={draft.summary} onChange={e=>setDraft(p=>({...p,summary:e.target.value}))} placeholder="簡短描述故事世界與核心設定"/></label><label>原作模式<select value={draft.originalMode} onChange={e=>setDraft(p=>({...p,originalMode:e.target.value}))}><option value="none">C-1｜無原作，只使用原創故事線</option><option value="active">C-2｜啟用原作線，與玩家故事線並行</option><option value="reference">C-3｜只參照原作設定，不推進原作線</option></select></label><p className="field-note">原作模式目前只保存設定；原作資料檢查與事件引擎尚未接通。</p><div className="editor-actions"><button className="outline" onClick={()=>setEditing(false)}>取消</button><button className="save" onClick={saveSettings}>保存設定</button></div></div>:<><div className="detail-block"><b>故事設定</b><div className="row"><span>故事類型</span>{story.genre}</div><div className="row"><span>原作模式</span>{modeLabel(story.originalMode)}</div><div className="row"><span>故事識別碼</span>{story.id}</div><button className="edit-link" onClick={openEditor}>✎　編輯故事設定</button></div><div className="detail-block"><b>快速入口</b>{['角色與關係','劇情運作方向','觸發模組','故事狀態','回合備份'].map((x,i)=><button className="quick" key={x} onClick={()=>notify(x+'模組尚未接入')}><span>{['♙','◇','⌘','▤','◷'][i]}</span>{x}<i>›</i></button>)}</div><div className="callout"><b>✦　讓故事依自己的規則運作</b><p>玩家保有選擇權，角色依照各自已知資訊自主行動。</p></div></>}</aside></div>:<div className="empty"><div className="empty-icon">{tab==='library'?'▧':'◷'}</div><small>STORYLOOM WORKSPACE</small><h1>{tab==='library'?'原作資料庫':'備份與結算'}</h1><p>{tab==='library'?'集中管理原作設定、角色、篇章與每集大綱。':'管理正式正文備份、故事復原、結算與跨卷承接。'}</p><span>此模組將依照需求規格逐步開發</span><button className="outline" onClick={()=>setTab('story')}>返回故事工作台</button></div>}</main>{toast&&<div className="toast">{toast}</div>}</div>
}