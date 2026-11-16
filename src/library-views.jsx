import React, { useEffect, useRef } from 'react';
import { enabledCharacterFields, keywordTags, LibraryContent } from './library-content.jsx';

export const categories = ['世界觀','角色資料','人物關係','原作篇章／大綱','設定與規則','參考文件'];
export const fieldTypes = [
  ['text','文字'], ['number','數字'], ['select','選取'], ['multi','多選'],
  ['status','狀態'], ['date','日期'], ['person','人員'], ['media','檔案和媒體'],
  ['checkbox','核取方塊'], ['url','網址'],
];

const optionTypes = ['select','multi','status'];

export function viewsFor(work) {
  return work?.views ?? categories.map(id => ({
    id, name: id, layout: 'cards', group: id === '角色資料',
    fields: id === '角色資料'
      ? enabledCharacterFields(work).map(([key, name]) => ({ id: key, name, type: 'text' }))
      : [],
  }));
}

export function validViews(views) {
  if (views === undefined) return true;
  if (!Array.isArray(views) || views.length > 100) return false;
  return new Set(views.map(view => view?.id)).size === views.length && views.every(view =>
    typeof view?.id === 'string' && !!view.id.trim() && view.id.length <= 100 &&
    typeof view.name === 'string' && !!view.name.trim() && view.name.length <= 100 &&
    ['cards','table'].includes(view.layout) && typeof view.group === 'boolean' &&
    (view.keywords === undefined || typeof view.keywords === 'boolean') &&
    Array.isArray(view.fields) && view.fields.length <= 30 &&
    new Set(view.fields.map(field => field?.id)).size === view.fields.length &&
    view.fields.every(field => typeof field?.id === 'string' && /^(field-[\da-f-]{36}|affiliation|species|rank|abilities|equipment|appearance|reveal)$/.test(field.id) &&
      typeof field.name === 'string' && !!field.name.trim() && field.name.length <= 100 &&
      fieldTypes.some(([type]) => type === field.type) &&
      (field.options===undefined||(typeof field.options==='string'&&field.options.length<=2000)))
  );
}

export function fieldValue(item, field) {
  return item.values?.[field.id] ?? item.profile?.[field.id] ?? '';
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
      <label className="view-check"><input type="checkbox" checked={draft.group} onChange={e=>patch({group:e.target.checked})}/>{t('開啟分組')}</label>
      {draft.group&&<p>{t('啟用後，每筆資料可填寫分組名稱。')}</p>}
      <label className="view-check"><input type="checkbox" checked={draft.keywords!==false} onChange={e=>patch({keywords:e.target.checked})}/>{t('開啟關鍵字')}</label>
      <fieldset><legend>{t('自訂欄位')}</legend>
        {draft.fields.map(field=><div className="view-field-row" key={field.id}>
          <input required maxLength={100} aria-label={t('欄位名稱')} placeholder={t('欄位名稱')} value={field.name} onChange={e=>updateField(field.id,{name:e.target.value})}/>
          <select aria-label={t('欄位類型')} value={field.type} onChange={e=>updateField(field.id,{type:e.target.value})}>
            {fieldTypes.map(([type,label])=><option key={type} value={type}>{t(label)}</option>)}
          </select>
          <button type="button" aria-label={t('移除欄位')} onClick={()=>patch({fields:draft.fields.filter(item=>item.id!==field.id)})}>×</button>
          {optionTypes.includes(field.type)&&<label className="view-field-options">{t('選項（用逗號分隔）')}<input maxLength={2000}
            value={field.options||''} onChange={e=>updateField(field.id,{options:e.target.value})}/></label>}
        </div>)}
        <button type="button" disabled={draft.fields.length>=30} onClick={()=>patch({fields:[...draft.fields,{id:'field-'+crypto.randomUUID(),name:'',type:'text'}]})}>{t('＋新增欄位')}</button>
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
  const options = [...new Set((field.options||'').split(/[,，、]/).map(option=>option.trim()).filter(Boolean))];
  if (optionTypes.includes(field.type)&&options.length) {
    const multiple=field.type==='multi';
    const selected=Array.isArray(value)?value:typeof value==='string'&&value
      ?(multiple?value.split(/[,，、]/).map(option=>option.trim()):[value]):[];
    const choices=[...new Set([...options,...selected])];
    return <label>{label}<select multiple={multiple} value={multiple?selected:selected[0]||''}
      onChange={e=>onChange(multiple?Array.from(e.target.selectedOptions,option=>option.value):e.target.value)}>
      {!multiple&&<option value="">—</option>}
      {choices.map(option=><option key={option}>{option}</option>)}
    </select></label>;
  }
  const display = Array.isArray(value)?value.join(', '):typeof value==='boolean'?'':value;
  return <label>{label}<input type={inputType} step={field.type==='number'?'any':undefined} maxLength={500}
    placeholder={field.type==='media'?t('貼上檔案網址'):field.type==='multi'?t('用逗號分隔'):undefined}
    value={display} onChange={e=>onChange(e.target.value)}/></label>;
}

export function displayValue(item, field, t) {
  const value = fieldValue(item, field);
  if (field.type==='checkbox') return value===true?'✓':value===false?'—':String(value);
  if (Array.isArray(value)) return value.join('、');
  if ((field.type==='url'||field.type==='media') && /^https?:\/\//i.test(value)) {
    return <a href={value} target="_blank" rel="noreferrer">{field.type==='media'?t('開啟檔案'):value}</a>;
  }
  return String(value);
}

export function ViewEntries({ view, items, renderCard, renderActions, t }) {
  const renderItems = rows => view.layout === 'table' ? <div className="library-table-scroll"><table className="library-view-table">
    <thead><tr><th scope="col">{t('名稱')}</th>{view.keywords!==false&&<th scope="col">{t('關鍵字')}</th>}{view.fields.map(field=><th key={field.id} scope="col">{t(field.name)}</th>)}<th scope="col">{t('內容')}</th><th scope="col">{t('操作')}</th></tr></thead>
    <tbody>{rows.map(item=><tr key={item.id}><th scope="row">{item.title}</th>{view.keywords!==false&&<td>{keywordTags(item.keywords).map(tag=>'#'+tag).join(' ')}</td>}
      {view.fields.map(field=><td key={field.id}>{displayValue(item,field,t)}</td>)}
      <td>{item.content&&<LibraryContent content={item.content}/>}</td><td><div className="library-item-actions">{renderActions(item)}</div></td></tr>)}</tbody>
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
