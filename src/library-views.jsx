import {readLibraryAttachment} from './story-api.js';
import React, { useEffect, useRef } from 'react';
import { enabledCharacterFields, keywordTags, LibraryContent } from './library-content.jsx';

export const categories = ['世界觀','角色資料','人物關係','原作篇章／大綱','設定與規則','參考文件'];
export const fieldTypes = [
  ['text','文字'], ['longText','多行文字'], ['number','數字'], ['select','單選'], ['multi','多選'],
  ['date','日期'], ['media','檔案'], ['checkbox','布林'], ['url','連結'],
];

const legacyTypes = [['status','狀態'], ['person','人員']];
export const titleField = {id:'title',name:'名稱',type:'text'};
export const fileValue = value => !!value && typeof value==='object' && !Array.isArray(value) &&
  typeof value.name==='string' && value.name.length>0 && value.name.length<=255 &&
  typeof value.data==='string' && value.data.length<=699100 &&
  /^data:application\/octet-stream;base64,[A-Za-z0-9+/]*={0,2}$/.test(value.data);

export const attachmentReference = value => !!value && typeof value==='object' &&
  typeof value.name==='string' && typeof value.attachmentId==='string' && /^[a-f0-9]{64}$/.test(value.attachmentId);

function AttachmentDownload({value,t}){
  const [failed,setFailed]=React.useState(false);
  return <><button type="button" onClick={async()=>{
    setFailed(false);
    try{
      const {data}=await readLibraryAttachment(value.attachmentId);
      const link=document.createElement('a');
      link.href=data;link.download=value.name;link.click();
    }catch{setFailed(true)}
  }}>{value.name}</button>{failed&&<small role="alert">{t('無法下載附件')}</small>}</>;
}

const optionTypes = ['select','multi','status'];

export function viewsFor(work) {
  const views=work?.views ?? categories.map(id => ({
    id, name: id, layout: 'cards', group: id === '角色資料',
    fields: id === '角色資料'
      ? enabledCharacterFields(work).map(([key, name]) => ({ id: key, name, type: 'text' }))
      : [],
  }));
  return views.map(view=>view.customFields?view:{
    ...view,customFields:true,fields:[
      {...titleField,name:view.id==='角色資料'?'姓名':'名稱'},
      ...view.fields,
      ...(view.showContent!==false?[{id:'content',name:view.id==='角色資料'?'描述':'內容',type:'longText'}]:[]),
    ],
  });
}

export function validViews(views) {
  if (views === undefined) return true;
  if (!Array.isArray(views) || views.length > 100) return false;
  return new Set(views.map(view => view?.id)).size === views.length && views.every(view =>
    typeof view?.id === 'string' && !!view.id.trim() && view.id.length <= 100 &&
    typeof view.name === 'string' && !!view.name.trim() && view.name.length <= 100 &&
    ['cards','table'].includes(view.layout) && typeof view.group === 'boolean' &&
    (view.keywords === undefined || typeof view.keywords === 'boolean') &&
    (view.showContent === undefined || typeof view.showContent === 'boolean') &&
    (view.customFields === undefined || typeof view.customFields === 'boolean') &&
    Array.isArray(view.fields) && view.fields.length <= 32 &&
    new Set(view.fields.map(field => field?.id)).size === view.fields.length &&
    view.fields.every(field => typeof field?.id === 'string' && /^(field-[\da-f-]{36}|affiliation|species|rank|abilities|equipment|appearance|reveal|title|content)$/.test(field.id) &&
      typeof field.name === 'string' && !!field.name.trim() && field.name.length <= 100 &&
      [...fieldTypes,...legacyTypes].some(([type]) => type === field.type) &&
      ['aiEnabled','scheduleEnabled'].every(key=>field[key]===undefined||typeof field[key]==='boolean') &&
      ['aiPrompt','scheduleTask'].every(key=>field[key]===undefined||(typeof field[key]==='string'&&field[key].length<=4000)) &&
      (field.options===undefined||(typeof field.options==='string'&&field.options.length<=2000)))
  );
}

export function fieldValue(item, field) {
  return item.values?.[field.id] ?? (field.id==='title'?item.title:field.id==='content'?item.content:item.profile?.[field.id]) ?? '';
}

export function CategoryDialog({ draft, setDraft, onSave, onClose, t }) {
  const ref=useRef(null);
  useEffect(()=>{ref.current.showModal()},[]);
  return <dialog ref={ref} className="library-view-dialog" onCancel={e=>{e.preventDefault();onClose()}}>
    <form onSubmit={e=>{e.preventDefault();onSave()}}>
      <h2>{t(draft.id?'編輯分類':'新增分類')}</h2>
      <label>{t('分類名稱')}<input autoFocus required maxLength={100} value={draft.name}
        onChange={e=>setDraft(current=>({...current,name:e.target.value}))}/></label>
      <div className="view-dialog-actions"><button type="button" onClick={onClose}>{t('取消')}</button><button className="primary-action" type="submit">{t('儲存')}</button></div>
    </form>
  </dialog>;
}

export function ViewDialog({ draft, setDraft, onSave, onClose, t }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  const patch = value => setDraft(current => ({ ...current, ...value }));
  const updateField = (id, value) => setDraft(current => ({
    ...current, fields: current.fields.map(field => field.id === id ? { ...field, ...value } : field),
  }));
  return <dialog ref={ref} className="library-view-dialog" onCancel={e=>{e.preventDefault();onClose()}}>
    <form onSubmit={e=>{e.preventDefault();onSave()}}>
      <h2>{t(draft.id ? '編輯分頁' : '新增分頁')}</h2>
      <label>{t('分頁名稱')}<input autoFocus required maxLength={100} value={draft.name} onChange={e=>patch({name:e.target.value})}/></label>
      <label>{t('呈現方式')}<select value={draft.layout} onChange={e=>patch({layout:e.target.value})}>
        <option value="table">{t('表格')}</option><option value="cards">{t('卡片')}</option>
      </select></label>
      <div className="view-toggle-row">
        <label className="view-check"><input type="checkbox" checked={draft.group} onChange={e=>patch({group:e.target.checked})}/>{t('分組')}</label>
        <label className="view-check"><input type="checkbox" checked={draft.keywords!==false} onChange={e=>patch({keywords:e.target.checked})}/>{t('關鍵字')}</label>
      </div>
      {draft.group&&<p>{t('啟用後，每筆資料可填寫分組名稱。')}</p>}
      <fieldset><legend>{t('自訂欄位')}</legend>
        {draft.fields.map(field=><div className="view-field-row" key={field.id}>
          <input required maxLength={100} aria-label={t('欄位名稱')} placeholder={t('欄位名稱')} value={field.name} onChange={e=>updateField(field.id,{name:e.target.value})}/>
          <select aria-label={t('欄位類型')} value={field.type} onChange={e=>updateField(field.id,{type:e.target.value})}>
            {[...fieldTypes,...legacyTypes.filter(([type])=>type===field.type)].map(([type,label])=><option key={type} value={type}>{t(label)}</option>)}
          </select>
          <div className="view-field-features">
            {[['aiEnabled','AI'],['scheduleEnabled','排程']].map(([key,label])=><button key={key} type="button"
              aria-pressed={field[key]===true} onClick={()=>updateField(field.id,{[key]:!field[key]})}>{t(label)}</button>)}
          </div>
          <button type="button" aria-label={t('移除欄位')} onClick={()=>patch({fields:draft.fields.filter(item=>item.id!==field.id)})}>×</button>
          {optionTypes.includes(field.type)&&<label className="view-field-options">{t('選項（用逗號分隔）')}<input maxLength={2000}
            value={field.options||''} onChange={e=>updateField(field.id,{options:e.target.value})}/></label>}
        </div>)}
        <button type="button" disabled={draft.fields.length>=32} onClick={()=>patch({fields:[...draft.fields,{id:'field-'+crypto.randomUUID(),name:'',type:'text'}]})}>{t('＋新增欄位')}</button>
      </fieldset>
      <div className="view-dialog-actions"><button type="button" onClick={onClose}>{t('取消')}</button><button className="primary-action" type="submit">{t('儲存')}</button></div>
    </form>
  </dialog>;
}

export function FieldInput({ field, value, onChange, t }) {
  const inputType = {number:'number',date:'date',url:'url',media:'url'}[field.type] || 'text';
  const label = t(field.name);
  if (field.type === 'checkbox') return <label className="view-check">
    <input type="checkbox" checked={value===true} onChange={e=>onChange(e.target.checked)}/>{label}
  </label>;
  if (field.type==='media') return <label>{label}
    {(fileValue(value)||attachmentReference(value))&&<span>{value.name}</span>}
    {typeof value==='string'&&value&&<span>{value}</span>}
    <input type="file" onChange={e=>{
      const input=e.currentTarget;
      const file=input.files?.[0];
      if(!file)return;
      if(file.size>512*1024){input.value='';input.setCustomValidity(t('檔案大小上限為 512 KB'));input.reportValidity();return}
      input.setCustomValidity('');
      const reader=new FileReader();
      reader.onload=()=>{
        if(input.isConnected&&input.files?.[0]===file){
          onChange({name:file.name,data:'data:application/octet-stream;base64,'+String(reader.result).split(',')[1]});
        }
      };
      reader.readAsDataURL(file);
    }}/>
  </label>;
  const options = [...new Set((field.options||'').split(/[,，、]/).map(option=>option.trim()).filter(Boolean))];
  if (optionTypes.includes(field.type)&&(field.type!=='status'||options.length)) {
    const multiple=field.type==='multi';
    const selected=Array.isArray(value)?value:typeof value==='string'&&value
      ?(multiple?value.split(/[,，、]/).map(option=>option.trim()):[value]):[];
    const choices=field.type==='select'?options:[...new Set([...options,...selected])];
    return <label>{label}<select multiple={multiple} value={multiple?selected:choices.includes(selected[0])?selected[0]:''}
      onChange={e=>onChange(multiple?Array.from(e.target.selectedOptions,option=>option.value):e.target.value)}>
      {!multiple&&(field.type==='select'?<option value="">{t('無')}</option>:<option value="" hidden disabled/>)}
      {choices.map(option=><option key={option}>{option}</option>)}
    </select></label>;
  }
  const display = Array.isArray(value)?value.join(', '):typeof value==='string'?value:'';
  if(field.type==='longText') return <label>{label}<textarea rows={5} maxLength={field.id==='content'?50000:2000} value={display}
    onChange={e=>onChange(e.target.value)}/></label>;
  return <label>{label}<input type={inputType} lang={field.type==='date'?'en-CA':undefined} step={field.type==='number'?'any':undefined} maxLength={500}
    placeholder={field.type==='media'?t('貼上檔案網址'):field.type==='multi'?t('用逗號分隔'):undefined}
    value={display} onChange={e=>onChange(e.target.value)}/></label>;
}

export function displayValue(item, field, t) {
  const value = fieldValue(item, field);
  if (field.type==='media'&&attachmentReference(value)) return <AttachmentDownload value={value} t={t}/>;
  if (field.type==='media'&&fileValue(value)) return <a href={value.data} download={value.name}>{value.name}</a>;
  if (field.id==='content'&&field.type==='longText'&&typeof value==='string') return <LibraryContent content={value}/>;
  if (field.type==='checkbox') return value===true?'✓':value===false?'—':String(value);
  if (Array.isArray(value)) return value.join('、');
  if ((field.type==='url'||field.type==='media') && /^https?:\/\//i.test(value)) {
    return <a href={value} target="_blank" rel="noreferrer">{field.type==='media'?t('開啟檔案'):value}</a>;
  }
  return field.type==='longText'?<span style={{whiteSpace:'pre-wrap'}}>{String(value)}</span>:String(value);
}

export function ViewEntries({ view, items, renderCard, renderActions, t }) {
  const renderItems = rows => view.layout === 'table' ? <div className="library-table-scroll"><table className="library-view-table">
    <thead><tr>{view.keywords!==false&&<th scope="col">{t('關鍵字')}</th>}{view.fields.map(field=><th key={field.id} scope="col">{t(field.name)}</th>)}<th scope="col">{t('操作')}</th></tr></thead>
    <tbody>{rows.map(item=><tr key={item.id}>{view.keywords!==false&&<td>{keywordTags(item.keywords).map(tag=>'#'+tag).join(' ')}</td>}
      {view.fields.map(field=><td key={field.id}>{displayValue(item,field,t)}</td>)}
      <td><div className="library-item-actions">{renderActions(item)}</div></td></tr>)}</tbody>
  </table></div> : <div className="library-view-cards">{rows.map(renderCard)}</div>;
  if (!view.group) return renderItems(items);
  const groups = new Map();
  for (const item of items) {
    const group = item.group ?? (view.id==='角色資料' ? item.profile?.affiliation : '') ?? '';
    const key = group.trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups].map(([key,rows])=><details className="library-character-group" key={key} open>
    <summary>{key||t('未分組')} ({rows.length})</summary>{renderItems(rows)}
  </details>);
}
