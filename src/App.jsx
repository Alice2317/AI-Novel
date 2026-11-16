import { CategoryDialog, displayValue, fileValue, fieldValue, FieldInput, validViews, ViewDialog, ViewEntries, viewsFor, titleField } from './library-views.jsx';
import { characterFields, itemMatches, keywordTags, sortChapters } from './library-content.jsx';
import { libraryRequest, storyRequest, useStoryApi } from './story-api.js';
import { translate, readInterfaceLanguage, INTERFACE_LANGUAGE_KEY } from './i18n.js';
import React,{useEffect,useMemo,useRef,useState} from 'react';

const STORE_KEY='storyloom.frontend.v0.2';
const WORKSPACE_KEY='storyloom.visibleWorkspaces.v1';
const CATEGORY_KEY='storyloom.libraryCategories.v1';
const DEFAULT_LIBRARY_CATEGORIES=[{id:'source',name:'原作資料'},{id:'original',name:'原創資料'}];
const validLibraryCategories=value=>Array.isArray(value)&&value.length<=100&&
 new Set(value.map(category=>category?.id)).size===value.length&&value.every(category=>
  typeof category?.id==='string'&&category.id.trim()&&category.id.length<=100&&
  typeof category.name==='string'&&category.name.trim()&&category.name.length<=100);
const readLibraryCategories=()=>{
 try{
  const value=JSON.parse(localStorage.getItem(CATEGORY_KEY));
  if(validLibraryCategories(value))return value;
 }catch{}
 return DEFAULT_LIBRARY_CATEGORIES;
};
const LIBRARY_KEY='storyloom.library.v1';
const readLibrary=()=>{try{const v=JSON.parse(localStorage.getItem(LIBRARY_KEY));return Array.isArray(v)?v:[]}catch{return []}};
const DETAIL_FIELDS=[
 ['time','故事時間'],['location','目前地點'],['chapter','目前章節'],['phase','劇情階段'],
 ['characters','角色資料'],['summary','劇情摘要'],['world','世界觀設定'],['rules','規則與提示'],
 ['direction','劇情運作方向'],['triggers','觸發模組'],
];
const WORKSPACES=[{id:'story',name:'故事工作台',icon:'▤'},{id:'library',name:'原作資料庫',icon:'▧'},{id:'archive',name:'備份與結算',icon:'◷'}];
const starterStories=[
 {id:'ST-01',title:'未命名的故事',genre:'原創世界',status:'進行中',summary:'',originalMode:'none'},
 {id:'ST-02',title:'新故事企劃',genre:'待設定',status:'草稿',summary:'',originalMode:'none'}
];
const welcome=[{role:'system',text:'故事工作台已就緒。這裡是互動小說的閱讀與操作空間。'},{role:'assistant',text:'午後的光線穿過窗沿，落在桌面上。遠處傳來街道的聲音，房間裡暫時沒有其他動靜。\n\n你可以描述玩家接下來的台詞、想法或行動。'}];
const emptyMessages=[{role:'system',text:'新故事空間已建立。請先完成故事設定，再開始正式劇情。'}];
const readStore=()=>{try{const raw=localStorage.getItem(STORE_KEY);if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed.stories))return parsed}}catch{}return {stories:starterStories,activeId:'ST-01',messages:{'ST-01':welcome,'ST-02':emptyMessages}}};
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const hasTextFields=(value,fields)=>isRecord(value)&&fields.every(field=>typeof value[field]==='string');
const hasUniqueIds=items=>items.every(item=>item.id.trim())&&new Set(items.map(item=>item.id)).size===items.length;

function validateBackup(data){
 if(!isRecord(data)||data.format!=='storyloom-backup-v1')throw Error('備份格式不正確');
 if(!Array.isArray(data.stories)||
    !data.stories.every(story=>hasTextFields(story,['id','title','genre','status','summary','originalMode'])&&
      ['none','active','reference'].includes(story.originalMode))||!hasUniqueIds(data.stories)){
  throw Error('備份中的故事資料不正確');
 }
 const ids=new Set(data.stories.map(story=>story.id));
 if((ids.size? !ids.has(data.activeId): data.activeId!==null)||!isRecord(data.messages)||
    !Object.entries(data.messages).every(([id,messages])=>ids.has(id)&&Array.isArray(messages)&&
      messages.every(message=>hasTextFields(message,['role','text'])&&
        ['system','assistant','user'].includes(message.role)&&
        (message.mode===undefined||['mixed','dialogue','os','action'].includes(message.mode))))){
  throw Error('備份中的對話紀錄或故事關聯不正確');
 }
 const categories=data.libraryCategories===undefined?DEFAULT_LIBRARY_CATEGORIES:data.libraryCategories;
 if(!validLibraryCategories(categories)||!Array.isArray(data.library)||!data.library.every(entry=>
    hasTextFields(entry,['id','type','name','description'])&&validViews(entry.views)&&
    (entry.characterFields===undefined||(Array.isArray(entry.characterFields)&&
      new Set(entry.characterFields).size===entry.characterFields.length&&
      entry.characterFields.every(key=>characterFields.some(([field])=>field===key))))&&categories.some(category=>category.id===entry.type)&&
    Array.isArray(entry.items)&&(entry.introItemId==null||entry.items.some(item=>item?.id===entry.introItemId))&&entry.items.every(item=>
      hasTextFields(item,['id','category','title','content'])&&viewsFor(entry).some(view=>view.id===item.category)&&
      (item.values===undefined||(isRecord(item.values)&&Object.values(item.values).every(value=>typeof value==='string'||typeof value==='boolean'||(Array.isArray(value)&&value.every(text=>typeof text==='string'))||fileValue(value))))&&
      (item.keywords===undefined||typeof item.keywords==='string'||(Array.isArray(item.keywords)&&item.keywords.length<=50&&item.keywords.every(tag=>typeof tag==='string'&&tag.trim()&&tag.length<=500)))&&
      (item.group===undefined||typeof item.group==='string')&&
      (item.order===undefined||(Number.isInteger(item.order)&&item.order>=1&&item.order<=1000000))&&
      (item.profile===undefined||(isRecord(item.profile)&&Object.entries(item.profile).every(
       ([key,value])=>characterFields.some(([field])=>field===key)&&typeof value==='string'
      ))))&&
    hasUniqueIds(entry.items)&&
    (entry.boundWorkIds===undefined||(Array.isArray(entry.boundWorkIds)&&
      new Set(entry.boundWorkIds).size===entry.boundWorkIds.length&&
      entry.boundWorkIds.every(id=>id!==entry.id&&data.library.some(work=>work?.id===id)))))||!hasUniqueIds(data.library)){
  throw Error('備份中的資料庫內容不正確');
 }
}

function WorkBindings({work, library, categories, onChange, t}){
 const [category,setCategory]=useState('');
 const ids=work.boundWorkIds||[];
 const options=library.filter(item=>item.type===category&&item.id!==work.id&&!ids.includes(item.id));
 return <fieldset><legend>{t("綁定")}</legend>
  <label>{t("資料分類")}<select value={category} onChange={e=>setCategory(e.target.value)}>
   <option value="">{t("無")}</option>
   {categories.map(item=><option key={item.id} value={item.id}>{t(item.name)}</option>)}
  </select></label>
  <label>{t("作品")}<select value="" disabled={!category} onChange={e=>{if(e.target.value)onChange([...ids,e.target.value])}}>
   <option value="">{t("無")}</option>
   {options.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
  </select></label>
  <div className="library-tags">{ids.map(id=><span className="library-tag" key={id}>
   {library.find(item=>item.id===id)?.name||id}
   <button type="button" aria-label={t("解除綁定")+' '+(library.find(item=>item.id===id)?.name||id)}
    onClick={()=>onChange(ids.filter(value=>value!==id))}>×</button>
  </span>)}</div>
 </fieldset>;
}

export default function App(){
 const [uiLanguage,setUiLanguage]=useState(readInterfaceLanguage);
 const t=message=>translate(uiLanguage,message);
 useEffect(()=>{
  document.documentElement.lang=uiLanguage;
  try{localStorage.setItem(INTERFACE_LANGUAGE_KEY,uiLanguage)}catch{}
 },[uiLanguage]);
 const [initial]=useState(readStore);
 const [localStories,setStories]=useState(()=>initial.stories.map(story=>({storyLanguage:'zh-TW',...story})));
 const [remoteStories,setRemoteStories]=useState([]);
 const stories=[...remoteStories,...localStories.filter(local=>!remoteStories.some(remote=>remote.id===local.id))];
 const busyStoryRequest=useRef(false);
 const [active,setActive]=useState(initial.activeId||initial.stories[0]?.id);
 const [allMessages,setAllMessages]=useState(initial.messages||{});
 const [draftInputs,setDraftInputs]=useState({});
 const input=Object.hasOwn(draftInputs,active)?draftInputs[active]:'';
 const setInput=value=>setDraftInputs(current=>({...current,[active]:value}));
 const inputRef=useRef(null);
 const [tab,setTab]=useState('story');
 const [visibleWorkspaces,setVisibleWorkspaces]=useState(()=>{try{const saved=JSON.parse(localStorage.getItem(WORKSPACE_KEY));if(Array.isArray(saved))return saved.filter(id=>WORKSPACES.some(w=>w.id===id)).slice(0,3)}catch{}return WORKSPACES.slice(0,3).map(w=>w.id)});
 const [workspaceMenu,setWorkspaceMenu]=useState(null);
 const [library,setLibrary]=useState(readLibrary);
 const [libraryCategories,setLibraryCategories]=useState(readLibraryCategories);
 const [selectedLibraryType,setLibraryType]=useState('source');
 const [categoryDraft,setCategoryDraft]=useState(null);
 const activeCategory=libraryCategories.find(category=>category.id===selectedLibraryType)||libraryCategories[0];
 const libraryType=activeCategory?.id;
 const [viewDraft,setViewDraft]=useState(null);
 const [keywordInput,setKeywordInput]=useState('');
 const [librarySelected,setLibrarySelected]=useState(null);
 const [selectedCategory,setLibraryCategory]=useState('世界觀');
 const currentWork=library.find(entry=>entry.id===librarySelected);
 const libraryViews=viewsFor(currentWork);
 const activeView=libraryViews.find(view=>view.id===selectedCategory)||libraryViews[0];
 const libraryCategory=activeView?.id;
 const [itemSearch,setItemSearch]=useState({scope:null,text:''});
 const itemSearchScope=JSON.stringify([librarySelected,libraryCategory]);
 const itemQuery=itemSearch.scope===itemSearchScope?itemSearch.text:'';
 const [libraryQuery,setLibraryQuery]=useState('');
 const [libraryEdit,setLibraryEdit]=useState(null);
 const editingView=libraryViews.find(view=>view.id===libraryEdit?.category);
 const [libraryMobileDetail,setLibraryMobileDetail]=useState(false);
 const [archiveView,setArchiveView]=useState('backup');
 const [importText,setImportText]=useState('');
 const [nav,setNav]=useState(false);
 const [details,setDetails]=useState(false);
 const [leftOpen,setLeftOpen]=useState(true);
 const [statusOpen,setStatusOpen]=useState(true);
 const [sections,setSections]=useState({characters:false,summary:false,world:false,rules:false});
 const [editing,setEditing]=useState(false);
 const [draft,setDraft]=useState(null);
 const [toast,setToast]=useState('');
 const [contextMenu,setContextMenu]=useState(null);
 const [sidebarWidth,setSidebarWidth]=useState(250);
 const [detailWidth,setDetailWidth]=useState(290);
 const [dragging,setDragging]=useState(null);
 useEffect(()=>{if(!dragging)return;const move=e=>{if(window.innerWidth<=1050)return;const maxLeft=Math.min(480,window.innerWidth-(details?detailWidth:0)-380);if(dragging==='left')setSidebarWidth(Math.max(190,Math.min(maxLeft,e.clientX)));else if(dragging==='right')setDetailWidth(Math.max(240,Math.min(520,window.innerWidth-e.clientX)))};const stop=()=>setDragging(null);window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop);return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop)}},[dragging,details,detailWidth]);
 useEffect(()=>{try{localStorage.setItem(WORKSPACE_KEY,JSON.stringify(visibleWorkspaces))}catch{}},[visibleWorkspaces]);
 const switchWorkspace=id=>{setTab(id);setWorkspaceMenu(null);setNav(false);setDetails(false)};
 const toggleWorkspace=id=>setVisibleWorkspaces(current=>current.includes(id)?current.filter(x=>x!==id):current.length<3?[...current,id]:current);
 useEffect(()=>{try{localStorage.setItem(LIBRARY_KEY,JSON.stringify(library));localStorage.setItem(CATEGORY_KEY,JSON.stringify(libraryCategories))}catch{setToast(t("資料庫儲存失敗：請檢查瀏覽器空間"))}},[library,libraryCategories]);
 const libraryVersion=useRef(null);
 const librarySaving=useRef(false);
 useEffect(()=>{
  if(!useStoryApi)return;
  const controller=new AbortController();
  libraryRequest({signal:controller.signal}).then(snapshot=>{
   libraryVersion.current=snapshot.version;
   if(snapshot.version>1){setLibrary(snapshot.entries);setLibraryCategories(snapshot.categories??DEFAULT_LIBRARY_CATEGORIES)}
  }).catch(error=>{
   if(error.name!=='AbortError')setToast("無法讀取資料庫，請確認後端已啟動");
  });
  return ()=>controller.abort();
 },[]);
 const changeLibrary=async (change,categories=libraryCategories)=>{
  if(librarySaving.current)return false;
  const next=change(library);
  const ids=new Set(next.map(work=>work.id));
  const entries=next.map(work=>({
   ...work,
   ...(work.introItemId&&!work.items.some(item=>item.id===work.introItemId)?{introItemId:null}:{}),
   ...(work.boundWorkIds?{boundWorkIds:work.boundWorkIds.filter(id=>ids.has(id))}:{}),
  }));
  if(useStoryApi){
   if(libraryVersion.current===null){notify(t("無法讀取資料庫，請確認後端已啟動"));return false}
   librarySaving.current=true;
   try{
    const snapshot=await libraryRequest({method:'PUT',body:{entries,categories,version:libraryVersion.current}});
    libraryVersion.current=snapshot.version;
    setLibrary(snapshot.entries);setLibraryCategories(snapshot.categories??categories);
    setLibrarySelected(current=>snapshot.idMappings?.find(mapping=>mapping.previousId===current)?.id??current);
    return snapshot;
   }catch(error){
    notify(t(error.status===409?"資料庫已變更，請重新整理再儲存":"無法儲存到資料庫"));
    return false;
   }finally{librarySaving.current=false}
  }else{setLibrary(entries);setLibraryCategories(categories)}
  return {entries,idMappings:[]};
 };
 const selectCategory=id=>{
  setLibraryType(id);setLibrarySelected(null);setLibraryEdit(null);setLibraryMobileDetail(false);setLibraryQuery('');
 };
 const saveCategory=async()=>{
  const name=categoryDraft.name.trim();
  if(!name){notify(t("請輸入分類名稱"));return}
  const id=categoryDraft.id||'category-'+crypto.randomUUID();
  const categories=categoryDraft.id?libraryCategories.map(category=>category.id===id?{id,name}:category):[...libraryCategories,{id,name}];
  if(!validLibraryCategories(categories)){notify(t("無法儲存分類"));return}
  if(!await changeLibrary(entries=>entries,categories))return;
  if(!categoryDraft.id)selectCategory(id);
  setCategoryDraft(null);
 };
 const removeCategory=async category=>{
  const count=library.filter(entry=>entry.type===category.id).length;
  if(!window.confirm(t("確定刪除此分類及其中所有作品？")+' '+t(category.name)+' ('+count+')'))return;
  if(!await changeLibrary(entries=>entries.filter(entry=>entry.type!==category.id),libraryCategories.filter(item=>item.id!==category.id)))return;
  if(libraryType===category.id)selectCategory(null);
 };
 const activeLibrary=library.find(x=>x.id===librarySelected);
 const boundWorks=(activeLibrary?.boundWorkIds||[]).map(id=>library.find(work=>work.id===id)).filter(Boolean);

 const saveView=async()=>{
  const name=viewDraft.name.trim();
  const fields=viewDraft.fields.map(field=>({...field,name:field.name.trim()}));
  const view={...viewDraft,id:viewDraft.id||'view-'+crypto.randomUUID(),name,fields};
  const next=viewDraft.id?libraryViews.map(item=>item.id===view.id?view:item):[...libraryViews,view];
  if(!validViews(next)){notify(t("請填寫分頁和欄位名稱"));return}
  if(!await changeLibrary(entries=>entries.map(entry=>entry.id===librarySelected?{...entry,views:next}:entry)))return;
  setLibraryCategory(view.id);setViewDraft(null);
 };
 const removeView=async view=>{
  const count=activeLibrary.items.filter(item=>item.category===view.id).length;
  if(!window.confirm(t("確定刪除分頁及其中所有資料？")+' '+t(view.name)+' ('+count+')'))return;
  const views=libraryViews.filter(item=>item.id!==view.id);
  await changeLibrary(entries=>entries.map(entry=>entry.id===librarySelected
   ?{...entry,views,items:entry.items.filter(item=>item.category!==view.id)}:entry));
 };
 const addKeywords=()=>{
  const tags=keywordTags([...keywordTags(libraryEdit.keywords),...keywordTags(keywordInput)]);
  if(tags.length>50){notify(t("每筆資料最多 50 個關鍵字"));return}
  setLibraryEdit(current=>({...current,keywords:tags}));
  setKeywordInput('');
 };
 const categoryItems=(activeLibrary?.items||[]).filter(item=>item.category===libraryCategory);
 const itemSearchLabel=t("搜尋資料…");
 const matchingItems=categoryItems.filter(item=>itemMatches({...item,title:activeView?.fields.some(field=>field.id==='title')?item.title:undefined,content:activeView?.fields.some(field=>field.id==='content')?item.content:undefined,keywords:activeView?.keywords===false?undefined:item.keywords},itemQuery));
 const isChapterCategory=libraryCategory==='原作篇章／大綱';
 const filteredLibrary=library.filter(x=>x.type===libraryType&&(x.name.toLowerCase().includes(libraryQuery.toLowerCase())||x.description?.toLowerCase().includes(libraryQuery.toLowerCase())));
 const newLibrary=()=>{const item={id:crypto.randomUUID(),type:libraryType,name:'',description:'',items:[],views:[]};setLibraryEdit(item);setLibrarySelected(null);setLibraryMobileDetail(true)};
 const saveLibrary=async()=>{
  if(!libraryEdit?.name.trim()){notify(t("請輸入名稱"));return}
  const item={...libraryEdit,name:libraryEdit.name.trim()};
  const saved=await changeLibrary(entries=>entries.some(work=>work.id===item.id)
   ?entries.map(work=>work.id===item.id?item:work):[item,...entries]);
  if(!saved)return;
  setLibrarySelected(saved.idMappings?.find(mapping=>mapping.previousId===item.id)?.id??item.id);
  setLibraryEdit(null);notify(t("資料已儲存"));
 };
 const removeLibrary=async work=>{
  if(!window.confirm(t("確定刪除「")+work.name+t("」及其中所有資料？此操作無法復原。")))return;
  if(!await changeLibrary(entries=>entries.filter(entry=>entry.id!==work.id)))return;
  if(librarySelected===work.id){
   setLibrarySelected(null);setLibraryEdit(null);setViewDraft(null);setLibraryMobileDetail(false);
  }
 };
 const saveLibraryItem=async()=>{
  if(!editingView)return;
  const keywords=editingView.keywords===false?libraryEdit.keywords:keywordTags([...keywordTags(libraryEdit.keywords),...keywordTags(keywordInput)]);
  if(Array.isArray(keywords)&&keywords.length>50){notify(t("每筆資料最多 50 個關鍵字"));return}
  if(libraryEdit.category==='原作篇章／大綱'&&libraryEdit.order!==undefined&&libraryEdit.order!==''&&
    (!Number.isInteger(Number(libraryEdit.order))||Number(libraryEdit.order)<1||Number(libraryEdit.order)>1000000)){
   notify(t("篇章排序請輸入正整數"));return;
  }
  const titleConfig=editingView.fields.find(field=>field.id==='title');
  if(titleConfig?.type==='text'&&!libraryEdit.title.trim()){notify(t("請填寫資料名稱"));return}
  const item={id:libraryEdit.id||'ITEM-'+Date.now(),category:libraryEdit.category,title:libraryEdit.title.trim(),content:libraryEdit.content||'',keywords,
  group:(libraryEdit.group??libraryEdit.profile?.affiliation??'').trim(),profile:libraryEdit.profile||{},values:libraryEdit.values||{},
  ...(libraryEdit.category==='原作篇章／大綱'&&libraryEdit.order!==undefined&&libraryEdit.order!==''?{order:Number(libraryEdit.order)}:{})};if(!await changeLibrary(p=>p.map(x=>x.id===librarySelected?{...x,items:(x.items||[]).some(v=>v.id===item.id)?x.items.map(v=>v.id===item.id?item:v):[...(x.items||[]),item]}:x)))return;setLibraryEdit(null);notify(t("資料已儲存"))};
 const renderItemActions=x=><>
  <button aria-label={t("編輯")+x.title} title={t("編輯")} onClick={()=>{setKeywordInput('');setLibraryEdit({...x})}}>✎</button>
  <button aria-label={t("刪除")+x.title} title={t("刪除")} onClick={()=>{
   if(window.confirm(t("確定刪除「")+x.title+'」？'))changeLibrary(entries=>entries.map(
    entry=>entry.id===librarySelected?{...entry,items:entry.items.filter(item=>item.id!==x.id)}:entry
   ));
  }}>×</button>
 </>;
 const renderLibraryItem=x=><article className="library-item" key={x.id}>
  <div>

   {activeView.keywords!==false&&keywordTags(x.keywords).length>0&&<div className="library-tags">{keywordTags(x.keywords).map(tag=><span className="library-tag" key={tag}>#{tag}</span>)}</div>}
   {activeView.fields.some(field=>fieldValue(x,field)!=='')&&<dl className="character-fields">
    {activeView.fields.filter(field=>fieldValue(x,field)!=='').map(field=>
     <div key={field.id}><dt>{t(field.name)}</dt><dd>{displayValue(x,field,t)}</dd></div>)}</dl>}

  </div>
  {renderItemActions(x)}
 </article>;
 const downloadJson=(data,filename)=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),500)};
 const exportBackup=()=>downloadJson({format:'storyloom-backup-v1',exportedAt:new Date().toISOString(),stories:localStories,activeId:localStories.some(s=>s.id===active)?active:localStories[0]?.id??null,messages:Object.fromEntries(Object.entries(allMessages).filter(([id])=>localStories.some(s=>s.id===id))),library,libraryCategories},'storyloom-backup-'+new Date().toISOString().slice(0,10)+'.json');
 const importBackup=async()=>{try{const data=JSON.parse(importText);validateBackup(data);if(!window.confirm(t("匯入將覆蓋目前瀏覽器中的故事及資料庫。請先匯出備份，確定繼續？")))return;if(!await changeLibrary(()=>data.library,data.libraryCategories??DEFAULT_LIBRARY_CATEGORIES))return;setStories(data.stories.map(story=>({storyLanguage:'zh-TW',...story})));setActive(data.stories.some(x=>x.id===data.activeId)?data.activeId:data.stories[0]?.id??null);selectCategory(null);setAllMessages(data.messages);setDraftInputs({});setImportText('');notify(t("已還原備份"))}catch(e){notify(e instanceof SyntaxError?t("備份格式不正確"):t(e.message||"匯入失敗"))}};
 useEffect(()=>{
  if(!useStoryApi)return;
  const controller=new AbortController();
  storyRequest('',{signal:controller.signal}).then(rows=>setRemoteStories(current=>[...current,...rows.filter(row=>!current.some(item=>item.id===row.id))])).catch(error=>{
   if(error.name!=='AbortError')setToast("無法連線到故事 API，請確認後端已啟動");
  });
  return ()=>controller.abort();
 },[]);
 const story=stories.find(s=>s.id===active)||stories[0];
 const messages=allMessages[active]||[];
 const turns=useMemo(()=>messages.filter(m=>m.role==='user').length,[messages]);
 useEffect(()=>{try{localStorage.setItem(STORE_KEY,JSON.stringify({stories:localStories,activeId:active,messages:allMessages}))}catch{setToast(t("瀏覽器儲存空間不足，資料未能完整保存"))}} ,[localStories,active,allMessages]);
 const notify=t=>{setToast(t);window.setTimeout(()=>setToast(''),2600)};
 const create=async()=>{
  const fields={title:'新故事',storyLanguage:'zh-TW',genre:'待設定',status:'草稿',summary:'',originalMode:'none'};
  let item;
  if(useStoryApi){
   if(busyStoryRequest.current)return;
   busyStoryRequest.current=true;
   try{
    item=await storyRequest('',{method:'POST',body:fields});
    setRemoteStories(current=>[item,...current.filter(s=>s.id!==item.id)]);
   }catch{
    notify("無法新增故事，請確認後端已啟動");
    return;
   }finally{busyStoryRequest.current=false}
  }else{
   item={...fields,id:'ST-'+Date.now().toString().slice(-6)};
   setStories(current=>[item,...current]);
  }
  setAllMessages(current=>({...current,[item.id]:emptyMessages}));
  setActive(item.id);setTab('story');setNav(false);setDetails(true);setEditing(true);setDraft(item);
  notify(t(useStoryApi?"故事已存入資料庫":"已建立故事；設定會自動保存在此瀏覽器"));
 };
 const select=s=>{setActive(s.id);setTab('story');setNav(false);setEditing(false);setDetails(false);setContextMenu(null)};
 const showMenu=(event,s)=>{event.preventDefault();event.stopPropagation();const width=190,height=115;setContextMenu({id:s.id,x:Math.max(8,Math.min(event.clientX,window.innerWidth-width-8)),y:Math.max(8,Math.min(event.clientY,window.innerHeight-height-8))})};
 const openStoryMenu=(event,s)=>{const rect=event.currentTarget.getBoundingClientRect();showMenu({preventDefault:()=>{},stopPropagation:()=>{},clientX:rect.left,clientY:rect.bottom+5},s)};
 const deleteStory=async()=>{if(!contextMenu)return;const target=stories.find(s=>s.id===contextMenu.id);if(!target)return;setContextMenu(null);if(!window.confirm(t("確定刪除「")+target.title+t("」？\n這會一併刪除該故事在此瀏覽器的對話紀錄，且無法復原。")))return;if(useStoryApi&&remoteStories.some(s=>s.id===target.id)){
  if(busyStoryRequest.current)return;
  busyStoryRequest.current=true;
  try{
   await storyRequest('/'+target.id,{method:'DELETE',body:{version:target.version}});
   setRemoteStories(current=>current.filter(s=>s.id!==target.id));
  }catch(error){
   notify(error.status===409?"故事已變更，請重新整理再刪除":"無法刪除資料庫中的故事");
   return;
  }finally{busyStoryRequest.current=false}
 }const remaining=stories.filter(s=>s.id!==target.id);setStories(current=>current.filter(s=>s.id!==target.id));setDraftInputs(current=>{const next={...current};delete next[target.id];return next});setAllMessages(p=>{const next={...p};delete next[target.id];return next});if(active===target.id){setActive(remaining[0]?.id??null);setDetails(false);setEditing(false);setDraft(null)}notify(t("已刪除故事"))};
 const menuAction=action=>{if(!contextMenu)return;const selected=stories.find(s=>s.id===contextMenu.id);if(!selected)return;setActive(selected.id);setTab('story');setNav(false);setDetails(true);setEditing(false);setDraft(null);setContextMenu(null)};
 useEffect(()=>{const dismiss=e=>{if(e.key==='Escape')setContextMenu(null)};window.addEventListener('keydown',dismiss);return ()=>window.removeEventListener('keydown',dismiss)},[]);
 const openEditor=()=>{setDraft({...story});setEditing(true);setDetails(true)};
 const cancelEditor=()=>{setEditing(false);setDraft(null)};
 const saveSettings=async()=>{
  if(!draft.title.trim()){notify(t("請先輸入故事名稱"));return}
  const fields={...draft,title:draft.title.trim()};
  if(useStoryApi&&remoteStories.some(s=>s.id===draft.id)){
   if(busyStoryRequest.current)return;
   busyStoryRequest.current=true;
   try{
    const saved=await storyRequest('/'+draft.id,{method:'PUT',body:fields});
    setRemoteStories(current=>current.map(s=>s.id===saved.id?saved:s));
   }catch(error){
    notify(error.status===409?"故事已變更，請重新整理再儲存":"無法儲存到資料庫");
    return;
   }finally{busyStoryRequest.current=false}
  }else setStories(current=>current.map(s=>s.id===draft.id?{...s,...fields}:s));
  setDraft(current=>current===draft?null:current);
  notify(t("故事設定已保存"));
 };
 const updateMessages=next=>setAllMessages(p=>({...p,[active]:typeof next==='function'?next(p[active]||[]):next}));
 const insertMarker=kind=>{const field=inputRef.current;const start=field?.selectionStart??input.length;const end=field?.selectionEnd??start;const before=input.slice(0,start);const after=input.slice(end);let marker,offset;if(kind==='dialogue'){marker='""';offset=1}else if(kind==='os'){marker=(before.length&&!before.endsWith('\n')?'\n':'')+'OS ';offset=marker.length}else{marker='\n';offset=1}setInput(before+marker+after);requestAnimationFrame(()=>{field?.focus();const pos=start+offset;field?.setSelectionRange(pos,pos)})};
 const [chatHistory,setChatHistory]=useState({});
 const [chatPending,setChatPending]=useState({});
 const chatRequests=useRef(new Map());
 const remoteChat=useStoryApi&&remoteStories.some(item=>item.id===active);
 useEffect(()=>{
  if(!remoteChat)return;
  const controller=new AbortController();
  storyRequest('/'+active+'/chat',{signal:controller.signal}).then(rows=>{
   setChatHistory(current=>({...current,[active]:current[active]||rows}));
  }).catch(error=>{
   if(error.name!=='AbortError')notify(t("無法讀取角色對話"));
  });
  return ()=>controller.abort();
 },[active,remoteChat]);
 const chatMessages=remoteChat?[
  ...messages.filter(message=>message.role!=='system'),
  ...(chatHistory[active]||[]).flatMap(exchange=>[
   {role:'user',text:exchange.playerText,mode:'mixed'},
   {role:'assistant',text:exchange.reply,chat:true},
  ]),
 ]:messages;
 const send=async()=>{
  const value=input.trim();
  if(!value)return;
  if(!remoteChat){
   updateMessages(p=>[...p,{role:'user',text:value,mode:'mixed'}]);
   setInput('');notify(t("輸入已記錄；OS 文字屬玩家私有資訊，未來故事引擎需依此規則隔離。"));
   return;
  }
  const previous=chatRequests.current.get(active);
  if(previous?.pending)return;
  const requestId=previous?.text===value?previous.requestId:crypto.randomUUID();
  chatRequests.current.set(active,{text:value,requestId,pending:true});
  setChatPending(current=>({...current,[active]:true}));
  try{
   await storyRequest('/'+active+'/chat',{method:'POST',body:{text:value,requestId}});
   const rows=await storyRequest('/'+active+'/chat');
   setChatHistory(current=>({...current,[active]:rows}));
   setDraftInputs(current=>current[active]===input?{...current,[active]:''}:current);
   chatRequests.current.delete(active);
  }catch{
   chatRequests.current.set(active,{text:value,requestId,pending:false});
   notify(t("角色回覆讀取失敗，可以再次送出"));
  }finally{setChatPending(current=>({...current,[active]:false}))}
 };
 const modeLabel=mode=>mode==='active'?t("啟用原作線（C-2）"):mode==='reference'?t("只參照原作設定（C-3）"):t("無原作（C-1）");
 return <div onClick={()=>contextMenu&&setContextMenu(null)} style={{'--sidebar-width':sidebarWidth+'px','--detail-width':detailWidth+'px'}} className={'app '+(leftOpen?'':'sidebar-collapsed')+' '+(details?'':'details-collapsed')+(dragging?' is-resizing':'')}>
 <aside className={'sidebar '+(nav?'open':'')}>
 <div className="sidebar-head"><span>{t("工作區")}</span><button className="sidebar-toggle" onClick={()=>{setLeftOpen(false);setNav(false)}} title={t("收合故事清單")} aria-label={t("收合故事清單")}>×</button></div><div className="workspace-heading"><span>{t("工作區")}</span><button className="workspace-config-trigger" title={t("自訂工作區顯示")} aria-label={t("自訂工作區顯示")} aria-expanded={workspaceMenu==='config'} onClick={()=>setWorkspaceMenu(p=>p==='config'?null:'config')}>⚙</button></div>
 {workspaceMenu==='config'&&<div className="workspace-config"><label className="workspace-language"><span>{t("介面語言")}</span><select value={uiLanguage} onChange={e=>setUiLanguage(e.target.value)}><option value="zh-TW" lang="zh-TW">繁體中文</option><option value="en" lang="en">English</option></select></label><div className="workspace-config-title">{t("選擇完整顯示的工作區")} <small>{visibleWorkspaces.length}/3</small></div>{WORKSPACES.map(w=><label key={w.id}><input type="checkbox" checked={visibleWorkspaces.includes(w.id)} disabled={!visibleWorkspaces.includes(w.id)&&visibleWorkspaces.length>=3} onChange={()=>toggleWorkspace(w.id)}/><span>{w.icon}　{t(w.name)}</span></label>)}<p>{t("最多顯示 3 個，其餘放在「…其他」。")}</p></div>}
 {WORKSPACES.filter(w=>visibleWorkspaces.includes(w.id)).map(w=><button key={w.id} className={'nav '+(tab===w.id?'chosen':'')} onClick={()=>switchWorkspace(w.id)}>{w.icon}　{t(w.name)}</button>)}
 {WORKSPACES.some(w=>!visibleWorkspaces.includes(w.id))&&<div className="workspace-other-wrap"><button className={'nav '+(!visibleWorkspaces.includes(tab)?'chosen':'')} aria-expanded={workspaceMenu==='other'} onClick={()=>setWorkspaceMenu(p=>p==='other'?null:'other')}>{t("⋯　其他")} <span className="other-chevron">⌄</span></button>{workspaceMenu==='other'&&<div className="workspace-other">{WORKSPACES.filter(w=>!visibleWorkspaces.includes(w.id)).map(w=><button key={w.id} onClick={()=>switchWorkspace(w.id)}>{w.icon}　{t(w.name)}</button>)}</div>}</div>}
 {tab==='story'&&<><div className="label">{t("我的故事")} <span className="story-list-actions"><span>{stories.length}</span><button className="create-story-icon" onClick={create} title={t("建立新故事")} aria-label={t("建立新故事")}>＋</button></span></div><div className="story-list">{stories.map(s=><div key={s.id} className={'story-row '+(active===s.id?'current':'')} onContextMenu={e=>showMenu(e,s)}><button className="story" onClick={()=>select(s)}><i/><span>{s.title}<small>{t(s.status)}</small></span></button></div>)}</div></>}</aside>{leftOpen&&<div className="resize-handle left-resize" role="separator" aria-orientation="vertical" aria-label={t("調整故事清單寬度")} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();setDragging('left')}}/>}
 {nav&&<button className="scrim" onClick={()=>setNav(false)}/>}
 <main><header><button className="hamb" onClick={()=>setNav(true)}>☰</button>{!leftOpen&&<button className="desktop-toggle" onClick={()=>setLeftOpen(true)} title={t("展開故事清單")} aria-label={t("展開故事清單")}>☰</button>}<div className="crumb">{tab==='story'&&story?<button className="story-title-menu" onClick={e=>openStoryMenu(e,story)} onContextMenu={e=>showMenu(e,story)} aria-label={t("開啟")+story.title+t("的故事選單")}>{story.title}<span aria-hidden="true">⌄</span></button>:<b>{tab==='story'?t("故事工作台"):tab==='library'?t("原作資料庫"):t("備份與結算")}</b>}</div></header>
 {tab==='story'?story?<div className="layout"><section className="content"><div className="story-fixed"><div className="fixed-status"><button className="fixed-status-title" onClick={()=>setStatusOpen(!statusOpen)} aria-expanded={statusOpen}><span>{t("◷　故事狀態")}</span><span>{statusOpen?"⌃":"⌄"}</span></button>{statusOpen&&<div className="fixed-status-grid"><div><small>{t("故事時間")}</small><b>{story.details?.time||t("尚未設定")}</b></div><div><small>{t("目前地點")}</small><b>{story.details?.location||t("尚未設定")}</b></div><div><small>{t("目前章節")}</small><b>{story.details?.chapter||t("尚未分卷")}</b></div><div><small>{t("劇情階段")}</small><b>{story.details?.phase||t("尚未設定")}</b></div></div>}</div></div><div className="story-scroll">
 <div className="messages">{chatMessages.filter(m=>m.role!=='system').map((m,i)=><div className={'message '+m.role} key={i}>{m.role==='assistant'&&<div className="spark">✦</div>}{m.role==='system'?<div className="system">{m.text}</div>:<div className="bubble">{m.role==='assistant'&&<small>{t(m.chat?"角色 · 測試回覆":"旁白 · 示範正文（非正式劇情）")}</small>}{m.role==='user'&&<small className="player-mode">{m.mode==='mixed'?t("玩家輸入（混合）"):m.mode==='dialogue'?t("玩家台詞"):m.mode==='os'?t("玩家 OS（私有）"):t("玩家行動")}{m.mode==='os'?' · 不提供給 NPC':''}</small>}{m.text.split('\n').map((line,j)=><p key={j}>{line||' '}</p>)}</div>}{m.role==='user'&&<div className="avatar">{t("我")}</div>}</div>)}</div></div>
 <div className="compose-dock"><div className="composer"><div className="compose-top"><b>{t("玩家輸入")}</b><span>{t("玩家保有所有決定權")}</span></div><div className="input-modes"><button type="button" onClick={()=>insertMarker('dialogue')} title={t("插入雙引號並將游標移至中間")}>{t("對話")}</button><button type="button" onClick={()=>insertMarker('os')} title={t("換到下一行並插入 OS 前綴")}>OS</button><button type="button" onClick={()=>insertMarker('newline')} title={t("在游標位置插入換行")}>{t("換行 ↵")}</button></div><textarea ref={inputRef} rows="3" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&e.nativeEvent.keyCode!==229){e.preventDefault();send()}}} placeholder={t("輸入玩家的對話、行動或 OS，可在同一則訊息中混合使用……")}/><div className="compose-bottom"><small>{t("Enter 送出 · Shift + Enter 換行")}</small><button disabled={!input.trim()||chatPending[active]} onClick={send}>{t("送出　↑")}</button></div></div>
 <div className="footnote">{t(remoteChat?(chatPending[active]?"角色回覆中…":"聊天室測試模式：回覆由本機產生。"):"✦　展示模式：輸入會保存在此瀏覽器，但尚未連接 AI API，不會生成新劇情。")}</div></div></section>
 {details&&<div className="resize-handle right-resize" role="separator" aria-orientation="vertical" aria-label={t("調整故事資訊寬度")} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();setDragging('right')}}/>}<aside className={'details '+(details?'show':'')}><div className="detail-head"><h3>{t("故事資訊")}</h3><button className="detail-close" onClick={()=>{setDetails(false);cancelEditor()}} aria-label={t("收合故事資訊")}>×</button></div> {editing&&draft&&draft.id===active?<div className="detail-block editor"><div className="detail-edit-head"><b>{t("故事設定")}</b><span>{t("編輯中")}</span></div><label>{t("故事名稱")}<input value={draft.title} maxLength="60" onChange={e=>setDraft(p=>({...p,title:e.target.value}))}/></label><label>{t("故事類型")}<input value={draft.genre} maxLength="40" onChange={e=>setDraft(p=>({...p,genre:e.target.value}))} placeholder={t("例如：奇幻、校園、科幻")}/></label><label>{t("故事簡介")}<textarea rows="3" maxLength="300" value={draft.summary} onChange={e=>setDraft(p=>({...p,summary:e.target.value}))} placeholder={t("簡短描述故事世界與核心設定")}/></label><label>{t("原作模式")}<select value={draft.originalMode} onChange={e=>setDraft(p=>({...p,originalMode:e.target.value}))}><option value="none">{t("C-1｜無原作，只使用原創故事線")}</option><option value="active">{t("C-2｜啟用原作線，與玩家故事線並行")}</option><option value="reference">{t("C-3｜只參照原作設定，不推進原作線")}</option></select></label><p className="field-note">{t("原作模式目前只保存設定；原作資料檢查與事件引擎尚未接通。")}</p>{DETAIL_FIELDS.map(([key,label])=><label key={key}>{t(label)}<textarea rows="2" maxLength={2000} value={draft.details?.[key]||''} onChange={e=>setDraft(p=>({...p,details:{...p.details,[key]:e.target.value}}))}/></label>)}<div className="editor-actions"><button className="outline" onClick={cancelEditor}>{t("取消")}</button><button className="save" onClick={saveSettings}>{t("保存設定")}</button></div></div>:<><div className="detail-block"><div className="detail-edit-head"><b>{t("故事設定")}</b><button className="icon-edit" onClick={openEditor} aria-label={t("編輯故事設定")} title={t("編輯故事設定")}>✎</button></div><div className="row"><span>{t("故事名稱")}</span>{story.title}</div><div className="row"><span>{t("故事類型")}</span>{t(story.genre)}</div><div className="row"><span>{t("故事狀態")}</span>{t(story.status)}</div><div className="row"><span>{t("故事簡介")}</span>{story.summary||t("未設定")}</div><div className="row"><span>{t("原作模式")}</span>{modeLabel(story.originalMode)}</div><div className="row"><span>{t("故事識別碼")}</span>{story.id}</div><div className="row"><span>{t("玩家回合")}</span>{turns}</div></div><div className="detail-block"><b>{t("其他資訊")}</b>{[['characters',t("角色資料"),t("角色與關係模組尚未接入")],['summary',t("劇情摘要"),t("劇情摘要模組尚未接入")],['world',t("世界觀設定"),t("世界觀設定模組尚未接入")],['rules',t("規則與提示"),t("規則模組尚未接入")]].map(([key,label,placeholder])=><div key={key} className="subsection"><button className="section-toggle" onClick={()=>setSections(p=>({...p,[key]:!p[key]}))} aria-expanded={sections[key]}><span>{label}</span><span>{sections[key]?'⌃':'⌄'}</span></button>{sections[key]&&<p className="field-note">{story.details?.[key]||placeholder}</p>}</div>)}<b>{t("快速入口")}</b>{[t("角色與關係"),t("劇情運作方向"),t("觸發模組"),t("故事狀態"),t("回合備份")].map((x,i)=><button className="quick" key={x} onClick={()=>{if(i===4){switchWorkspace('archive');setArchiveView('backup')}else if(i===0)setSections(p=>({...p,characters:!p.characters}));else if(i===3)setStatusOpen(true);else notify(story.details?.[i===1?'direction':'triggers']||x+t("模組尚未接入"))}}><span>{['♙','◇','⌘','▤','◷'][i]}</span>{x}<i>›</i></button>)}</div></>}<div className="detail-block storage-detail"><b>{t("儲存方式")}</b><div className="row"><span>{t("目前儲存位置")}</span>{t("此瀏覽器")}</div><p className="field-note">{t("資料僅儲存在目前瀏覽器，尚未提供跨裝置同步或雲端備份；清除網站資料可能導致資料遺失。")}</p></div></aside></div>:<div className="empty"><h1>{t("目前沒有故事")}</h1><p>{t("點故事清單旁的＋建立故事。")}</p></div>:<div className="workspace-page">{tab==='library'?<><div className="workspace-top"><div><h1>{t("資料庫")}</h1><p>{t("原作與原創分開管理，建立可重複使用的故事設定。")}</p></div></div><div className="library-categories library-collection-tabs">
 <button className="library-add-view" title={t("新增分類")} aria-label={t("新增分類")} onClick={()=>setCategoryDraft({name:''})}>＋</button>
 {libraryCategories.map(category=><div key={category.id} className={'library-view-tab'+(libraryType===category.id?' selected':'')}>
  <button className={libraryType===category.id?'selected':''} onClick={()=>selectCategory(category.id)}>{t(category.name)}</button>
  <button title={t("編輯分類")} aria-label={t("編輯分類")+' '+t(category.name)} onClick={()=>setCategoryDraft({...category})}>✎</button>
  <button title={t("刪除分類")} aria-label={t("刪除分類")+' '+t(category.name)} onClick={()=>removeCategory(category)}>×</button>
 </div>)}
 </div>
 {categoryDraft&&<CategoryDialog draft={categoryDraft} setDraft={setCategoryDraft} onClose={()=>setCategoryDraft(null)} onSave={saveCategory} t={t}/>}
 <div className="library-grid"><div className="library-collection"><div className="library-search-row"><input className="library-search" value={libraryQuery} onChange={e=>setLibraryQuery(e.target.value)} placeholder={t("搜尋名稱或描述…")} aria-label={t("搜尋資料庫")}/><button type="button" className="primary-action library-add-work" title={t("＋ 新增作品")} aria-label={t("＋ 新增作品")} onClick={newLibrary} disabled={!activeCategory}>＋</button></div><div className="library-collection-list">{filteredLibrary.length?filteredLibrary.map(work=><div key={work.id} className={'library-work-row'+(librarySelected===work.id?' selected':'')}>
 <button className="library-work-select" onClick={()=>{setLibrarySelected(work.id);setLibraryCategory('世界觀');setLibraryEdit(null);setLibraryMobileDetail(true)}}>
  <b>{work.name}</b><small className="library-work-id">ID: {work.id}</small><small>{(work.items||[]).length} {t("筆資料")}</small>
 </button>
 <div className="library-head-actions">
  <button title={t("編輯基本資訊")} aria-label={t("編輯基本資訊")+' '+work.name} onClick={()=>{setLibrarySelected(work.id);setLibraryEdit({...work});setLibraryMobileDetail(true)}}>✎</button>
  <button title={t("刪除")} aria-label={t("刪除")+' '+work.name} onClick={()=>removeLibrary(work)}>×</button>
 </div>
 </div>):<div className="library-blank">{t("尚無資料，點擊右上角＋開始建立。")}</div>}</div></div><div className={'library-detail '+(libraryMobileDetail?'mobile-show':'')}>{libraryEdit?<div className="library-form"><div className="library-form-heading"><h2>{libraryEdit.title!==undefined?t("編輯資料"):t("編輯基本資訊")}</h2><button onClick={()=>setLibraryEdit(null)}>×</button></div>{libraryEdit.title!==undefined?<><label>{t("資料分類")}<select value={libraryEdit.category} onChange={e=>setLibraryEdit(p=>({...p,category:e.target.value}))}>{libraryViews.map(view=><option key={view.id} value={view.id}>{t(view.name)}</option>)}</select></label>{editingView&&editingView.keywords!==false&&<><label htmlFor="library-keyword">{t("關鍵字")}</label>
 <div className="library-tags">{keywordTags(libraryEdit.keywords).map(tag=><span className="library-tag" key={tag}>
  #{tag}<button type="button" aria-label={t("移除關鍵字")+' '+tag} onClick={()=>setLibraryEdit(p=>({...p,keywords:keywordTags(p.keywords).filter(value=>value!==tag)}))}>×</button>
 </span>)}</div>
 <div className="library-keyword-input"><input id="library-keyword" maxLength={500} value={keywordInput} placeholder="#1235" onChange={e=>setKeywordInput(e.target.value)} onKeyDown={e=>{
  if(e.key==='Enter'&&!e.nativeEvent.isComposing&&e.nativeEvent.keyCode!==229){e.preventDefault();addKeywords()}
 }}/><button className="outline" type="button" onClick={addKeywords} disabled={!keywordTags(keywordInput).length}>{t("新增關鍵字")}</button></div></>}
 {editingView?.group&&<label>{t("分組")}<input maxLength={100} value={libraryEdit.group??libraryEdit.profile?.affiliation??''} onChange={e=>setLibraryEdit(p=>({...p,group:e.target.value}))}/></label>}
 {editingView?.fields.filter(field=>field.name.trim()).map(field=><FieldInput key={field.id}
  field={field} value={fieldValue(libraryEdit,field)} t={t}
  onChange={value=>setLibraryEdit(current=>{
   if((field.id==='title'||field.id==='content')&&typeof value==='string'&&
     (field.type==='text'||field.type==='longText')){
    const values={...current.values};delete values[field.id];
    return {...current,[field.id]:value,values};
   }
   return {...current,values:{...current.values,[field.id]:value}};
  })}/>)}
 {libraryEdit.category==='原作篇章／大綱'&&<label>{t("篇章排序")}<input type="number" min="1" step="1" max="1000000" value={libraryEdit.order??''} onChange={e=>setLibraryEdit(p=>({...p,order:e.target.value}))}/></label>}
 <button className="primary-action" onClick={saveLibraryItem}>{t("儲存資料")}</button></>:<><label>{t("名稱")}<input value={libraryEdit.name} onChange={e=>setLibraryEdit(p=>({...p,name:e.target.value}))} placeholder={t("例如：作品名稱／原創世界名稱")}/></label><WorkBindings key={libraryEdit.id} work={libraryEdit} library={library} categories={libraryCategories} t={t}
 onChange={boundWorkIds=>setLibraryEdit(current=>({...current,boundWorkIds}))}/><button className="primary-action" onClick={saveLibrary}>{t("儲存")}</button></>}</div>:activeLibrary?<><div className="library-detail-head"><div><small>{t(activeCategory?.name||"資料庫")}</small><h2>{activeLibrary.name}</h2><small className="library-work-id">ID: {activeLibrary.id}</small>
 {boundWorks.length>0&&<div className="library-tags">{boundWorks.map(work=><button type="button" className="outline" key={work.id}
 onClick={()=>{selectCategory(work.type);setLibrarySelected(work.id);setLibraryCategory('世界觀');setLibraryMobileDetail(true)}}>{work.name}</button>)}</div>}</div><div className="library-head-actions"><button className="mobile-library-close" onClick={()=>setLibraryMobileDetail(false)}>×</button></div></div><div className="library-categories">
 <button className="library-add-view" title={t("新增分頁")} aria-label={t("新增分頁")} onClick={()=>setViewDraft({name:'',layout:'table',group:false,keywords:false,customFields:true,fields:[{...titleField}]})}>＋</button>
 {libraryViews.map(view=><div className={'library-view-tab'+(libraryCategory===view.id?' selected':'')} key={view.id}>
  <button className={libraryCategory===view.id?'selected':''} onClick={()=>setLibraryCategory(view.id)}>{t(view.name)}</button>
  <button aria-label={t("編輯分頁")+' '+t(view.name)} title={t("編輯分頁")} onClick={()=>setViewDraft({...view})}>✎</button>
  <button aria-label={t("刪除分頁")+' '+t(view.name)} title={t("刪除分頁")} onClick={()=>removeView(view)}>×</button>
 </div>)}
 </div>
 {viewDraft&&<ViewDialog draft={viewDraft} setDraft={setViewDraft} onSave={saveView} onClose={()=>setViewDraft(null)} t={t}/>}
 {activeView&&<>
 <div className="library-items-head"><h3>{t(activeView.name)}</h3>{activeView.fields.length>0&&<button onClick={()=>{setKeywordInput('');setLibraryEdit({id:null,category:libraryCategory,title:'',content:''})}}>{t("＋ 新增資料")}</button>}</div>
 <input className="library-search library-item-search" value={itemQuery} onChange={e=>setItemSearch({scope:itemSearchScope,text:e.target.value})} placeholder={itemSearchLabel} aria-label={itemSearchLabel}/>
 <div className="library-items">{matchingItems.length?
  <ViewEntries view={activeView} items={isChapterCategory?sortChapters(matchingItems):matchingItems} renderCard={renderLibraryItem} renderActions={renderItemActions} t={t}/>:
  <div className="library-blank">{t(itemQuery.trim()?"找不到符合的資料。":"此分類尚無資料。")}</div>}</div></>}
</>:<div className="library-detail-empty">{t("選擇左側資料，查看世界觀、角色與設定。")}</div>}</div></div></>:<><div className="workspace-top"><div><h1>{t("備份與結算")}</h1><p>{t("備份、匯入及故事結算紀錄。")}</p></div></div><div className="library-tabs"><button className={archiveView==='backup'?'selected':''} onClick={()=>setArchiveView('backup')}>{t("資料備份")}</button><button className={archiveView==='ending'?'selected':''} onClick={()=>setArchiveView('ending')}>{t("故事結算")}</button></div>{archiveView==='backup'?<div className="archive-panels"><div className="archive-card"><h2>{t("匯出完整備份")}</h2><p>{t("下載目前瀏覽器中的故事、對話紀錄及原作／原創資料庫 JSON 檔案。")}</p><button className="primary-action" onClick={exportBackup}>{t("↓ 匯出 JSON 備份")}</button></div><div className="archive-card"><h2>{t("匯入備份")}</h2><p>{t("選擇先前由本網站匯出的 JSON 檔案。匯入會覆蓋目前資料，請先備份。")}</p><input type="file" accept=".json,application/json" onChange={async e=>{const f=e.target.files?.[0];if(f){if(f.size>5*1024*1024){notify(t("檔案超過 5MB"));return}setImportText(await f.text())}}}/><button className="primary-action" disabled={!importText} onClick={importBackup}>{t("還原備份")}</button></div></div>:<div className="archive-card"><h2>{t("故事結算紀錄")}</h2><p>{t("此區預留故事結局、回合結算與跨卷承接功能。故事引擎尚未接入，目前沒有正式結算紀錄。")}</p><div className="archive-story-count">{t("目前故事數：")}{stories.length}</div></div>}</>}</div>}</main>{contextMenu&&<div className="story-context" role="menu" style={{left:contextMenu.x,top:contextMenu.y}} onClick={e=>e.stopPropagation()}><button role="menuitem" onClick={()=>menuAction('info')}>{t("ⓘ　故事資訊")}</button><button role="menuitem" className="delete-story" onClick={deleteStory}>{t("♲　刪除故事")}</button></div>}{toast&&<div className="toast">{t(toast)}</div>}</div>
}