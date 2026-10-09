// Fictional fixtures only. DOM storage failures; no model or network calls.
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {mkdir,symlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createInitialState} from '../src/domain/engine.js';
const out='/tmp/nexusscribe-storage-ui';await mkdir(out+'/node_modules',{recursive:true});
for(const name of ['react','react-dom','lucide-react'])try{await symlink(resolve('node_modules',name),out+'/node_modules/'+name)}catch(e){if(e.code!=='EEXIST')throw e}
await build({entryPoints:['src/App.tsx'],bundle:true,packages:'external',format:'esm',outfile:out+'/App.mjs',loader:{'.css':'empty'},jsx:'automatic'});
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/'});
for(const key of ['window','document','HTMLElement','Element','Node','MutationObserver','localStorage','getComputedStyle','File'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react');const {render,screen,cleanup,fireEvent}=await import('@testing-library/react');const user=(await import('@testing-library/user-event')).default.setup();const {default:App}=await import(out+'/App.mjs');
const KEY='nexusscribe.demo.v1',BACKUP=KEY+'.last-good';const fixture={format:1,serial:4,state:createInitialState(),editing:{},patch:null};
const proto=dom.window.Storage.prototype,write=proto.setItem;
render(React.createElement(App));proto.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError')};
fireEvent.change(screen.getByLabelText('章节正文'),{target:{value:'未保存的虚构正文'}});assert.equal(screen.getByLabelText('章节正文').value,'未保存的虚构正文');assert.match(screen.getByRole('alert').textContent,/尚未安全保存/);assert.ok(screen.getByText(/未保存 · 请导出当前内容/));assert.ok(screen.getByRole('button',{name:'导出当前内容（含暂存编辑）'}));assert.equal(localStorage.getItem(KEY),null);
proto.setItem=write;await user.click(screen.getByRole('button',{name:'重试保存'}));assert.equal(JSON.parse(localStorage.getItem(KEY)).editing.ch2,'未保存的虚构正文');assert.equal(screen.queryByRole('alert'),null);cleanup();
localStorage.setItem(KEY,'broken-fictional-json');localStorage.setItem(BACKUP,JSON.stringify(fixture));render(React.createElement(App));assert.equal(localStorage.getItem(KEY),'broken-fictional-json');fireEvent.change(screen.getByLabelText('章节正文'),{target:{value:'恢复前的新编辑'}});await user.click(screen.getByRole('button',{name:'检查并恢复存储'}));await user.click(screen.getByRole('button',{name:'取消恢复'}));assert.equal(localStorage.getItem(KEY),'broken-fictional-json');await user.click(screen.getByRole('button',{name:'检查并恢复存储'}));await user.click(screen.getByRole('button',{name:'保留原始数据并确认恢复'}));assert.equal(JSON.parse(localStorage.getItem(KEY)).editing.ch2,'恢复前的新编辑');assert.equal(localStorage.getItem(KEY+'.preserved'),'broken-fictional-json');cleanup();render(React.createElement(App));assert.equal(screen.getByLabelText('章节正文').value,'恢复前的新编辑');cleanup();
localStorage.clear();const read=proto.getItem;proto.getItem=function(){throw new DOMException('Denied','SecurityError')};render(React.createElement(App));assert.ok(screen.getByText(/未保存 · 请导出当前内容/));fireEvent.change(screen.getByLabelText('章节正文'),{target:{value:'安全异常下的编辑'}});assert.equal(screen.getByLabelText('章节正文').value,'安全异常下的编辑');cleanup();proto.getItem=read;
console.log('PASS DOM: quota retains edits and retry; recovery cancel/confirm/reload preserves edits and raw data; SecurityError does not crash');
