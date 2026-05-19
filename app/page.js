'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useNotifications, sendNotification } from '../lib/useNotifications'
import {
  Kanban, FolderGit2, Zap, GanttChart, CalendarDays, Scale, PieChart, Activity, Tags,
  Circle, Clock, CheckCircle2,
  Bell, ClipboardList, Plus, Search, LogOut, Hexagon,
  Sparkles, PenLine, ArrowRight, MessageSquare, Trash2,
  Moon, Sun, Menu, UserPlus, CloudDownload
} from 'lucide-react'
import CalendarView   from './CalendarView'
import TaskModal      from './TaskModal'
import NotificationPanel from './NotificationPanel'
import SprintView     from './SprintView'
import GanttView      from './GanttView'
import LabelsManager  from './LabelsManager'
import ProjectsView   from './ProjectsView'
import DashboardView  from './DashboardView'
import WorkloadView   from './WorkloadView'
import SapImportView  from './SapImportView'

const COLUMNS = [
  { id:'todo',  label:'Yapılacak',  color:'var(--text-tertiary)', icon:<Circle size={16} strokeWidth={2.5} /> },
  { id:'doing', label:'Devam Eden', color:'var(--accent)', icon:<Clock size={16} strokeWidth={2.5} /> },
  { id:'done',  label:'Tamamlandı', color:'var(--green)', icon:<CheckCircle2 size={16} strokeWidth={2.5} /> },
]
const PRIORITY = {
  low:  { label:'Düşük', dot:'#9b9b9b', bg:'#f0efec', color:'#6b6b6b' },
  mid:  { label:'Orta',  dot:'#f59e0b', bg:'#fffbeb', color:'#854d0e' },
  high: { label:'Acil',  dot:'#e5484d', bg:'#fff0f0', color:'#9f1239' },
}
const STATUS_LABELS = { todo:'Yapılacak', doing:'Devam Eden', done:'Tamamlandı' }

const AVATAR_COLORS=[['#dbeafe','#1d4ed8'],['#fce7f3','#be185d'],['#dcfce7','#15803d'],['#fef3c7','#b45309'],['#ede9fe','#7c3aed'],['#fee2e2','#b91c1c'],['#e0f2fe','#0369a1'],['#fdf4ff','#7e22ce']]
function strColor(s=''){let h=0;for(let c of s)h=(h*31+c.charCodeAt(0))%AVATAR_COLORS.length;return AVATAR_COLORS[h]}
function Avatar({initials='?',size=22}){const[bg,fg]=strColor(initials);return<div style={{width:size,height:size,borderRadius:'50%',background:bg,color:fg,fontSize:size*.38,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{initials}</div>}

function dueDateStatus(d,status){
  if(!d||status==='done')return null
  const today=new Date();today.setHours(0,0,0,0)
  const due=new Date(d+'T00:00:00')
  const diff=Math.floor((due-today)/86400000)
  if(diff<0)return{label:`${Math.abs(diff)}g gecikti`,color:'#e5484d',bg:'#fff0f0'}
  if(diff===0)return{label:'Bugün',color:'#d97706',bg:'#fffbeb'}
  if(diff<=2)return{label:`${diff}g kaldı`,color:'#d97706',bg:'#fffbeb'}
  return null
}

function timeAgo(ts){
  const d=Date.now()-new Date(ts).getTime()
  if(d<60000)return'az önce'
  if(d<3600000)return`${Math.floor(d/60000)}dk önce`
  if(d<86400000)return`${Math.floor(d/3600000)}sa önce`
  if(d<604800000)return`${Math.floor(d/86400000)}g önce`
  return new Date(ts).toLocaleDateString('tr-TR',{day:'numeric',month:'short'})
}

function actionMeta(a){return({created:{icon:<Sparkles size={13}/>,bg:'#dcfce7'},updated:{icon:<PenLine size={13}/>,bg:'#fef3c7'},moved:{icon:<ArrowRight size={13}/>,bg:'#dbeafe'},note:{icon:<MessageSquare size={13}/>,bg:'#ede9fe'},deleted:{icon:<Trash2 size={13}/>,bg:'#fee2e2'}}[a])||{icon:<Circle size={13}/>,bg:'#f0efec'}}

async function createNextRecurring(task){
  if(!task.recurrence||!task.due_date)return
  const due=new Date(task.due_date+'T00:00:00')
  const offsets={daily:1,weekly:7,biweekly:14,monthly:30}
  const newDue=new Date(due);newDue.setDate(newDue.getDate()+(offsets[task.recurrence]||7))
  const newDueStr=newDue.toISOString().split('T')[0]
  if(task.recurrence_end&&newDueStr>task.recurrence_end)return
  await supabase.from('tasks').insert({title:task.title,status:'todo',priority:task.priority,assignee_id:task.assignee_id,user_id:task.user_id,tags:task.tags,notes:[],due_date:newDueStr,start_date:task.start_date||null,recurrence:task.recurrence,recurrence_end:task.recurrence_end,project_id:task.project_id||null,parent_recurring_id:task.parent_recurring_id||task.id})
}

export default function Board(){
  const router=useRouter()
  const{user,profile,loading:authLoading}=useAuth()
  const{notifications,unreadCount,markRead,markAllRead}=useNotifications(user?.id)

  const[tasks,setTasks]=useState([])
  const[profiles,setProfiles]=useState([])
  const[projects,setProjects]=useState([])
  const[activity,setActivity]=useState([])
  const[dependencies,setDependencies]=useState([])
  const[subtaskCounts,setSubtaskCounts]=useState({})
  const[templates,setTemplates]=useState([])
  const[loading,setLoading]=useState(true)
  const[modal,setModal]=useState(null)
  const[form,setForm]=useState({})
  const[search,setSearch]=useState('')
  const[filterPriority,setFilterPriority]=useState('')
  const[filterAssignee,setFilterAssignee]=useState('')
  const[filterProject,setFilterProject]=useState('')
  const[dragging,setDragging]=useState(null)
  const[dragOver,setDragOver]=useState(null)
  const[view,setView]=useState('board')
  const[showNotif,setShowNotif]=useState(false)
  const[showTemplates,setShowTemplates]=useState(false)
  const[theme,setTheme]=useState('light')
  const[mobileMenuOpen,setMobileMenuOpen]=useState(false)

  useEffect(()=>{
    if(typeof window!=='undefined'){
      const t=localStorage.getItem('ekip-theme')||'light'
      setTheme(t)
      document.documentElement.setAttribute('data-theme',t)
    }
  },[])

  function toggleTheme(){
    const t=theme==='light'?'dark':'light'
    setTheme(t)
    localStorage.setItem('ekip-theme',t)
    document.documentElement.setAttribute('data-theme',t)
  }

  const isAdmin=profile?.role==='admin'

  useEffect(()=>{if(!authLoading&&!user)router.push('/login')},[authLoading,user,router])

  const log=useCallback(async(taskId,taskTitle,action,detail='')=>{
    await supabase.from('activity').insert({task_id:taskId,task_title:taskTitle,action,detail})
  },[])

  const fetchTasks=useCallback(async()=>{const{data}=await supabase.from('tasks').select('*').order('created_at',{ascending:false});setTasks(data||[]);setLoading(false)},[])
  const fetchProfiles=useCallback(async()=>{const{data}=await supabase.from('profiles').select('*').order('full_name');setProfiles(data||[])},[])
  const fetchProjects=useCallback(async()=>{const{data}=await supabase.from('projects').select('*').order('created_at');setProjects(data||[])},[])
  const fetchActivity=useCallback(async()=>{const{data}=await supabase.from('activity').select('*').order('created_at',{ascending:false}).limit(60);setActivity(data||[])},[])
  const fetchDeps=useCallback(async()=>{const{data}=await supabase.from('task_dependencies').select('*');setDependencies(data||[])},[])
  const fetchSubtaskCounts=useCallback(async()=>{
    const{data}=await supabase.from('subtasks').select('task_id,completed')
    if(!data)return
    const c={};data.forEach(s=>{if(!c[s.task_id])c[s.task_id]={total:0,done:0};c[s.task_id].total++;if(s.completed)c[s.task_id].done++})
    setSubtaskCounts(c)
  },[])
  const fetchTemplates=useCallback(async()=>{const{data}=await supabase.from('task_templates').select('*').order('name');setTemplates(data||[])},[])

  const checkDeadlines=useCallback(async(taskList,profileData)=>{
    if(!profileData)return
    const today=new Date();today.setHours(0,0,0,0)
    for(const task of taskList){
      if(!task.due_date||task.status==='done'||task.assignee_id!==profileData.id)continue
      const diff=Math.floor((new Date(task.due_date+'T00:00:00')-today)/86400000)
      if(diff===1)await sendNotification(supabase,{userId:profileData.id,type:'deadline',taskId:task.id,taskTitle:task.title,message:`"${task.title}" görevinin son tarihi yarın!`})
    }
  },[])

  useEffect(()=>{
    if(!user)return
    fetchTasks();fetchProfiles();fetchProjects();fetchActivity();fetchDeps();fetchSubtaskCounts();fetchTemplates()
    const c1=supabase.channel('t-v7').on('postgres_changes',{event:'*',schema:'public',table:'tasks'},fetchTasks).subscribe()
    const c2=supabase.channel('a-v7').on('postgres_changes',{event:'*',schema:'public',table:'activity'},fetchActivity).subscribe()
    const c3=supabase.channel('s-v7').on('postgres_changes',{event:'*',schema:'public',table:'subtasks'},fetchSubtaskCounts).subscribe()
    const c4=supabase.channel('d-v7').on('postgres_changes',{event:'*',schema:'public',table:'task_dependencies'},fetchDeps).subscribe()
    const c5=supabase.channel('p-v7').on('postgres_changes',{event:'*',schema:'public',table:'projects'},fetchProjects).subscribe()
    return()=>{[c1,c2,c3,c4,c5].forEach(c=>supabase.removeChannel(c))}
  },[user,fetchTasks,fetchProfiles,fetchProjects,fetchActivity,fetchDeps,fetchSubtaskCounts,fetchTemplates])

  useEffect(()=>{if(tasks.length&&profile)checkDeadlines(tasks,profile)},[tasks,profile,checkDeadlines])

  async function signOut(){await supabase.auth.signOut();router.push('/login')}

  function openNew(opts={}){
    setForm({title:'',status:'todo',priority:'mid',assignee_id:profile?.id||'',tags:'',start_date:opts.start_date||'',due_date:opts.due_date||'',recurrence:'',recurrence_end:'',project_id:filterProject||opts.project_id||''})
    setModal('new');setShowTemplates(false)
  }

  function openFromTemplate(tmpl){
    const d=tmpl.defaults||{}
    setForm({title:d.title||`[${tmpl.name}] `,status:'todo',priority:d.priority||'mid',assignee_id:d.assignee_id!==undefined?d.assignee_id:(profile?.id||''),tags:(d.tags||[]).join(', '),start_date:'',due_date:'',recurrence:'',recurrence_end:'',project_id:filterProject||'',_templateChecklist:d.checklist||[]})
    setModal('new');setShowTemplates(false)
  }

  function openEdit(task){
    setForm({title:task.title,status:task.status,priority:task.priority,assignee_id:task.assignee_id||'',tags:(task.tags||[]).join(', '),start_date:task.start_date||'',due_date:task.due_date||'',recurrence:task.recurrence||'',recurrence_end:task.recurrence_end||'',project_id:task.project_id||''})
    setModal(task)
  }

  async function saveTask(form){
    if(!form.title?.trim())return
    const tags=form.tags?form.tags.split(',').map(s=>s.trim()).filter(Boolean):[]
    const payload={
      title:form.title.trim(),status:form.status,priority:form.priority,
      assignee_id:form.assignee_id||null,tags,
      start_date:form.start_date||null,due_date:form.due_date||null,
      recurrence:form.recurrence||null,recurrence_end:form.recurrence_end||null,
      project_id:form.project_id||null,updated_at:new Date().toISOString(),
      description:form.description||null,estimated_hours:form.estimated_hours?parseFloat(form.estimated_hours):null,
      customer:form.customer||null,ticket_no:form.ticket_no||null
    }

    if(modal==='new'){
      payload.notes=[];payload.user_id=user.id
      const{data}=await supabase.from('tasks').insert(payload).select().single()
      if(data){
        await log(data.id,data.title,'created',`${STATUS_LABELS[data.status]} kolonuna eklendi`)
        if(data.assignee_id&&data.assignee_id!==user.id)await sendNotification(supabase,{userId:data.assignee_id,type:'assigned',taskId:data.id,taskTitle:data.title,message:`${profile?.full_name||'Biri'} sana bir görev atadı: "${data.title}"`})
        if(form._templateChecklist?.length){
          await supabase.from('subtasks').insert(form._templateChecklist.map((item,i)=>({task_id:data.id,title:item.title,position:i})))
        }
      }
    }else{
      const changed=[]
      if(modal.status!==form.status){
        changed.push(`${STATUS_LABELS[modal.status]} → ${STATUS_LABELS[form.status]}`)
        if(form.status==='done'&&modal.recurrence)await createNextRecurring({...modal,...payload})
        if(form.status==='done'){
          const{data:deps}=await supabase.from('task_dependencies').select('task_id').eq('depends_on',modal.id)
          for(const dep of deps||[]){
            const depTask=tasks.find(t=>t.id===dep.task_id)
            if(depTask?.assignee_id&&depTask.assignee_id!==user.id)await sendNotification(supabase,{userId:depTask.assignee_id,type:'dependency_done',taskId:depTask.id,taskTitle:depTask.title,message:`Bağımlılık tamamlandı: "${modal.title}"`})
          }
        }
      }
      if(modal.priority!==form.priority)changed.push(`öncelik: ${PRIORITY[modal.priority].label} → ${PRIORITY[form.priority||'mid'].label}`)
      if((modal.assignee_id||null)!==(form.assignee_id||null)){
        changed.push('atanan değişti')
        if(form.assignee_id&&form.assignee_id!==user.id)await sendNotification(supabase,{userId:form.assignee_id,type:'assigned',taskId:modal.id,taskTitle:payload.title,message:`${profile?.full_name||'Biri'} sana bir görev atadı: "${payload.title}"`})
      }
      if((modal.due_date||null)!==(form.due_date||null))changed.push('bitiş tarihi güncellendi')
      if((modal.project_id||null)!==(form.project_id||null))changed.push('proje değişti')
      await supabase.from('tasks').update(payload).eq('id',modal.id)
      if(changed.length)await log(modal.id,payload.title,'updated',changed.join(' · '))
    }
    setModal(null)
  }

  async function deleteTask(taskId){
    const task=tasks.find(t=>t.id===taskId)
    if(task)await log(task.id,task.title,'deleted','görev silindi')
    await supabase.from('tasks').delete().eq('id',taskId)
    setModal(null)
  }

  async function handleDrop(targetStatus){
    if(!dragging)return
    const task=tasks.find(t=>t.id===dragging)
    if(!task){setDragging(null);setDragOver(null);return}

    if(targetStatus==='pool'){
      if(task.status==='todo' && !task.assignee_id){setDragging(null);setDragOver(null);return}
      await supabase.from('tasks').update({status:'todo', assignee_id:null, updated_at:new Date().toISOString()}).eq('id',dragging)
      await log(task.id,task.title,'moved',`Havuza bırakıldı`)
    } else {
      let updates = {status:targetStatus, updated_at:new Date().toISOString()}
      let logMsg = `${STATUS_LABELS[task.status]} → ${STATUS_LABELS[targetStatus]}`
      
      if (task.status==='todo' && !task.assignee_id) {
         updates.assignee_id = user.id
         logMsg = `Havuzdan alındı ve ${STATUS_LABELS[targetStatus]} kolonuna taşındı`
      } else if (task.status===targetStatus) {
         setDragging(null);setDragOver(null);return
      }
      
      await supabase.from('tasks').update(updates).eq('id',dragging)
      await log(task.id,task.title,'moved', logMsg)
      if(targetStatus==='done'&&task.recurrence)await createNextRecurring(task)
    }
    setDragging(null);setDragOver(null)
  }

  const filtered=tasks.filter(t=>{
    const q=search.toLowerCase()
    return(!q||t.title.toLowerCase().includes(q)||(t.tags||[]).some(g=>g.toLowerCase().includes(q)))
      &&(!filterPriority||t.priority===filterPriority)
      &&(!filterAssignee||t.assignee_id===filterAssignee)
      &&(!filterProject||t.project_id===filterProject)
  })

  const hasFilters=search||filterPriority||filterAssignee||filterProject
  const overdue=tasks.filter(t=>t.due_date&&t.status!=='done'&&new Date(t.due_date+'T00:00:00')<new Date().setHours(0,0,0,0)).length

  if(authLoading||loading||!profile)return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:12,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <div style={{width:28,height:28,border:'2px solid rgba(0,0,0,0.1)',borderTopColor:'#5e6ad2',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>
      <span style={{fontSize:13,color:'#9b9b9b'}}>Yükleniyor…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const NAV=[
    {id:'board',    icon:<Kanban size={18} strokeWidth={2}/>,  label:'Pano'},
    {id:'projects', icon:<FolderGit2 size={18} strokeWidth={2}/>, label:'Projeler'},
    {id:'sprint',   icon:<Zap size={18} strokeWidth={2}/>, label:'Sprint'},
    {id:'gantt',    icon:<GanttChart size={18} strokeWidth={2}/>,  label:'Gantt'},
    {id:'calendar', icon:<CalendarDays size={18} strokeWidth={2}/>,  label:'Takvim'},
    {id:'workload', icon:<Scale size={18} strokeWidth={2}/>, label:'İş Yükü'},
    {id:'dashboard',icon:<PieChart size={18} strokeWidth={2}/>, label:'Dashboard'},
    {id:'activity', icon:<Activity size={18} strokeWidth={2}/>,  label:'Aktivite'},
    {id:'sap-import', icon:<CloudDownload size={18} strokeWidth={2}/>, label:'SAP Aktarım'},
    ...(isAdmin?[{id:'labels',icon:<Tags size={18} strokeWidth={2}/>,label:'Etiketler'}]:[]),
  ]

  const FULL_HEIGHT_VIEWS=['calendar','gantt','sprint','projects']

  return(
    <>
      <style>{`
        .filtersel{height:34px;border:1px solid var(--border);border-radius:var(--radius-md);font-size:13px;background:var(--bg-tertiary);padding:0 8px;outline:none;cursor:pointer;color:var(--text-secondary);transition:all var(--transition-normal)}
        .filtersel:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-light)}
        input[type=date]::-webkit-calendar-picker-indicator{opacity:0.4;cursor:pointer}
      `}</style>

      <div style={{display:'flex',height:'100vh',overflow:'hidden'}}>

        {/* MOBILE OVERLAY */}
        <div className={`mobile-overlay ${mobileMenuOpen?'open':''}`} onClick={()=>setMobileMenuOpen(false)}></div>

        {/* SIDEBAR */}
        <div className={`sidebar ${mobileMenuOpen?'open':''}`} style={{width:240,background:'var(--bg)',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',padding:'24px 14px',flexShrink:0,overflowY:'auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'0 6px',marginBottom:28}}>
            <div style={{width:32,height:32,borderRadius:8,background:'linear-gradient(135deg, var(--accent), #a855f7)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'var(--shadow-md)'}}>
              <Hexagon size={18} strokeWidth={2.5} color="white" fill="rgba(255,255,255,0.2)"/>
            </div>
            <span style={{fontSize:16,fontWeight:700,letterSpacing:'-0.02em',color:'var(--text-primary)'}}>Ekip Panosu</span>
          </div>

          <div style={{fontSize:11,fontWeight:700,color:'var(--text-tertiary)',textTransform:'uppercase',letterSpacing:'0.07em',padding:'0 10px',marginBottom:10}}>Görünüm</div>
          {NAV.map(v=>(
            <button key={v.id} className={`sidebar-link ${view===v.id?'active':''}`} onClick={()=>setView(v.id)}>
              <span className="icon">{v.icon}</span>{v.label}
            </button>
          ))}

          <div style={{marginTop:'auto',paddingTop:12}}>
            <div style={{padding:'12px 8px',borderTop:'1px solid rgba(0,0,0,0.07)',marginBottom:8}}>
              <div style={{fontSize:11,color:'#9b9b9b',marginBottom:8,fontWeight:500}}>Özet</div>
              {[
                {label:'Toplam',val:tasks.length,color:'#1a1a1a'},
                {label:'Tamamlandı',val:tasks.filter(t=>t.status==='done').length,color:'#22c55e'},
                overdue>0&&{label:'Gecikmiş',val:overdue,color:'#e5484d'},
                tasks.filter(t=>t.recurrence).length>0&&{label:'Tekrarlayan',val:tasks.filter(t=>t.recurrence).length,color:'#5e6ad2'},
              ].filter(Boolean).map(row=>(
                <div key={row.label} style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5}}>
                  <span style={{color:'#6b6b6b'}}>{row.label}</span>
                  <span style={{fontWeight:600,color:row.color}}>{row.val}</span>
                </div>
              ))}
            </div>
            <div style={{padding:'12px 8px',borderTop:'1px solid var(--border)',display:'flex',alignItems:'center',gap:10,marginTop:10}}>
              <Avatar initials={profile.initials} size={32}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile.full_name}</div>
                <span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:99,background:isAdmin?'var(--accent-light)':'var(--bg-tertiary)',color:isAdmin?'var(--accent-hover)':'var(--text-secondary)'}}>{isAdmin?'Admin':'Üye'}</span>
              </div>
              <button onClick={signOut} title="Çıkış" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-tertiary)',padding:6,transition:'color 0.2s'}} onMouseEnter={e=>e.currentTarget.style.color='var(--red)'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-tertiary)'}>
                <LogOut size={16}/>
              </button>
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

          {/* Topbar */}
          <div style={{height:64,borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',padding:'0 24px',gap:12,background:'var(--glass-bg)',backdropFilter:'var(--glass-blur)',WebkitBackdropFilter:'var(--glass-blur)',flexShrink:0,zIndex:10}}>
            <button className="hide-on-desktop" onClick={()=>setMobileMenuOpen(true)} style={{background:'none',border:'none',color:'var(--text-primary)',cursor:'pointer',display:'none'}}><Menu size={20}/></button>
            {view==='board'&&<>
              <div className="search-box" style={{position:'relative',flex:1,maxWidth:280}}>
                <Search style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--text-tertiary)',pointerEvents:'none'}} size={16} strokeWidth={2.5}/>
                <input placeholder="Görev ara…" value={search} onChange={e=>setSearch(e.target.value)}
                  className="modern-input"
                  style={{paddingLeft:38,paddingRight:12,height:38,background:'var(--bg-tertiary)',border:'1px solid transparent'}}
                />
              </div>
              <select className="filtersel" value={filterPriority} onChange={e=>setFilterPriority(e.target.value)}>
                <option value="">Öncelik</option><option value="high">Acil</option><option value="mid">Orta</option><option value="low">Düşük</option>
              </select>
              {isAdmin&&<select className="filtersel" value={filterAssignee} onChange={e=>setFilterAssignee(e.target.value)}>
                <option value="">Kişi</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>}
              <select className="filtersel" value={filterProject} onChange={e=>setFilterProject(e.target.value)}>
                <option value="">Proje</option>{projects.map(p=><option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
              </select>
              {hasFilters&&<button onClick={()=>{setSearch('');setFilterPriority('');setFilterAssignee('');setFilterProject('')}} style={{height:32,padding:'0 10px',border:'1px solid rgba(0,0,0,0.1)',borderRadius:6,fontSize:12,color:'#6b6b6b',background:'none',cursor:'pointer'}}>Temizle ×</button>}
            </>}

            <div className="topbar-right" style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
              <button onClick={toggleTheme} title="Tema Değiştir" style={{width:36,height:36,borderRadius:8,border:'1px solid var(--border)',background:'var(--bg)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-secondary)'}}>
                {theme==='dark' ? <Sun size={18} strokeWidth={2.5}/> : <Moon size={18} strokeWidth={2.5}/>}
              </button>
              {/* Notifs */}
              <div style={{position:'relative'}}>
                <button onClick={()=>setShowNotif(v=>!v)} style={{width:36,height:36,borderRadius:8,border:'1px solid var(--border)',background:showNotif?'var(--bg-hover)':'var(--bg)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-secondary)',position:'relative'}}>
                  <Bell size={18} strokeWidth={2.5}/>{unreadCount>0&&<span style={{position:'absolute',top:-4,right:-4,width:16,height:16,borderRadius:'50%',background:'#e5484d',color:'#fff',fontSize:9,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',border:'1.5px solid #fff'}}>{unreadCount>9?'9+':unreadCount}</span>}
                </button>
                {showNotif&&<NotificationPanel notifications={notifications} unreadCount={unreadCount} markRead={markRead} markAllRead={markAllRead} onClose={()=>setShowNotif(false)}/>}
              </div>

              {/* Templates */}
              <div style={{position:'relative'}}>
                <button onClick={()=>setShowTemplates(v=>!v)} style={{height:36,padding:'0 14px',background:showTemplates?'var(--bg-hover)':'var(--bg)',border:'1px solid var(--border)',borderRadius:8,fontSize:13,cursor:'pointer',color:'var(--text-secondary)',display:'flex',alignItems:'center',gap:6,fontWeight:500}}>
                  <ClipboardList size={16} strokeWidth={2.5}/> Şablon
                </button>
                {showTemplates&&(
                  <div style={{position:'absolute',top:40,right:0,width:240,background:'#fff',border:'1px solid rgba(0,0,0,0.1)',borderRadius:10,boxShadow:'0 4px 20px rgba(0,0,0,0.1)',zIndex:300,overflow:'hidden'}}>
                    <div style={{padding:'10px 14px',borderBottom:'1px solid rgba(0,0,0,0.07)',fontSize:12,fontWeight:600,color:'#1a1a1a'}}>Görev Şablonları</div>
                    {templates.map(tmpl=>(
                      <div key={tmpl.id} onClick={()=>openFromTemplate(tmpl)}
                        style={{padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid rgba(0,0,0,0.05)',transition:'background 120ms'}}
                        onMouseEnter={e=>e.currentTarget.style.background='#f7f7f5'}
                        onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                        <div style={{fontSize:13,fontWeight:500,color:'#1a1a1a',marginBottom:2}}>{tmpl.name}</div>
                        {tmpl.description&&<div style={{fontSize:11,color:'#9b9b9b'}}>{tmpl.description}</div>}
                        {tmpl.defaults?.checklist?.length>0&&<div style={{fontSize:10,color:'#9b9b9b',marginTop:2}}>✓ {tmpl.defaults.checklist.length} alt görev</div>}
                      </div>
                    ))}
                    <div onClick={()=>openNew()} style={{padding:'10px 14px',cursor:'pointer',fontSize:13,color:'#5e6ad2',fontWeight:500,display:'flex',alignItems:'center',gap:6}}
                      onMouseEnter={e=>e.currentTarget.style.background='#f7f7f5'}
                      onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                      <Plus size={14} strokeWidth={3}/> Boş görev
                    </div>
                  </div>
                )}
              </div>

              <button onClick={()=>openNew()} className="btn-primary" style={{height:36,padding:'0 16px'}}>
                <Plus size={16} strokeWidth={3}/>
                Yeni İş
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{flex:1,overflow:FULL_HEIGHT_VIEWS.includes(view)?'hidden':'auto',padding:view==='board'?18:view==='gantt'||view==='sprint'||view==='projects'?0:view==='calendar'?'18px 18px 8px':0,display:'flex',flexDirection:'column'}}>

            {view==='sap-import'&&<SapImportView profiles={profiles} user={user} projects={projects} />}
            {view==='projects'&&<ProjectsView tasks={tasks} profiles={profiles} projects={projects} isAdmin={isAdmin} onTaskClick={openEdit} subtaskCounts={subtaskCounts}/>}
            {view==='dashboard'&&<DashboardView tasks={tasks} profiles={profiles} projects={projects} activity={activity}/>}
            {view==='workload'&&<WorkloadView tasks={tasks} profiles={profiles} onTaskClick={openEdit}/>}
            {view==='calendar'&&<CalendarView tasks={filtered} profiles={profiles} onTaskClick={openEdit} onTaskUpdate={async(id,updates)=>{await supabase.from('tasks').update({...updates,updated_at:new Date().toISOString()}).eq('id',id)}} openNewWithDate={(date)=>openNew({start_date:date,due_date:date})}/>}
            {view==='sprint'&&<SprintView tasks={tasks} profiles={profiles} isAdmin={isAdmin} onTaskClick={openEdit}/>}
            {view==='gantt'&&<div style={{flex:1,overflow:'auto',padding:18}}><GanttView tasks={filtered} profiles={profiles} dependencies={dependencies} onTaskClick={openEdit} onTaskUpdate={async(id,updates)=>{await supabase.from('tasks').update({...updates,updated_at:new Date().toISOString()}).eq('id',id)}}/></div>}
            {view==='labels'&&<div style={{padding:18,overflow:'auto',flex:1}}><LabelsManager isAdmin={isAdmin}/></div>}

            {view==='activity'&&(
              <div style={{padding:18,maxWidth:580,margin:'0 auto',width:'100%'}}>
                <h2 style={{fontSize:15,fontWeight:600,marginBottom:16,letterSpacing:'-0.02em'}}>Aktivite Geçmişi</h2>
                {activity.length===0&&<div style={{textAlign:'center',padding:'48px 0',color:'#9b9b9b',fontSize:13}}>Henüz aktivite yok</div>}
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {activity.map(a=>{const m=actionMeta(a.action);return(
                    <div key={a.id} style={{display:'flex',gap:12,padding:'10px 14px',borderRadius:10,background:'#fff',border:'1px solid rgba(0,0,0,0.07)',alignItems:'flex-start'}}>
                      <div style={{width:26,height:26,borderRadius:'50%',background:m.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:12}}>{m.icon}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:500,color:'#1a1a1a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.task_title}</div>
                        <div style={{fontSize:12,color:'#6b6b6b',marginTop:2}}>{a.detail}</div>
                      </div>
                      <div style={{fontSize:11,color:'#9b9b9b',whiteSpace:'nowrap',paddingTop:2}}>{timeAgo(a.created_at)}</div>
                    </div>
                  )})}
                </div>
              </div>
            )}

            {view==='board'&&(
              <div style={{display:'flex',flexDirection:'column',gap:20,padding:'4px'}}>
                {/* Job Pool */}
                <div style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:'16px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <UserPlus size={16} strokeWidth={2.5} color="var(--accent)"/>
                      <span style={{fontSize:14,fontWeight:600,color:'var(--text-primary)'}}>İş Havuzu (Atanmamış)</span>
                      <span style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',background:'var(--bg)',padding:'2px 10px',borderRadius:99,border:'1px solid var(--border)'}}>{filtered.filter(t=>t.status==='todo'&&!t.assignee_id).length}</span>
                    </div>
                    <button onClick={()=>openNew({assignee_id:''})} className="btn-primary" style={{padding:'6px 14px',fontSize:12,height:30}}><Plus size={14} strokeWidth={2.5}/> Havuza Ekle</button>
                  </div>
                  <div onDragOver={e=>{e.preventDefault();setDragOver('pool')}} onDragLeave={()=>setDragOver(null)} onDrop={()=>handleDrop('pool')}
                    style={{display:'flex',gap:16,overflowX:'auto',paddingBottom:8,minHeight:100,border:`2px dashed ${dragOver==='pool'?'var(--accent)':'transparent'}`,transition:'all var(--transition-fast)',borderRadius:'var(--radius-md)',background:dragOver==='pool'?'var(--accent-light)':'transparent'}}>
                    {filtered.filter(t=>t.status==='todo'&&!t.assignee_id).length===0 && <div style={{fontSize:12,color:'var(--text-tertiary)',fontStyle:'italic',padding:'20px 10px'}}>Havuzda bekleyen iş yok.</div>}
                    {filtered.filter(t=>t.status==='todo'&&!t.assignee_id).map(task=>{
                      const p=PRIORITY[task.priority]||PRIORITY.mid
                      const proj=projects.find(pr=>pr.id===task.project_id)
                      return (
                        <div key={task.id} className="kanban-card animate-slide-up" draggable onDragStart={()=>setDragging(task.id)} onDragEnd={()=>{setDragging(null);setDragOver(null)}} onClick={()=>openEdit(task)}
                          style={{width:260,flexShrink:0,padding:'14px',opacity:dragging===task.id?0.4:1}}>
                          {proj&&<div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><span style={{fontSize:12}}>{proj.icon}</span><span style={{fontSize:11,color:proj.color,fontWeight:600,letterSpacing:'0.02em',textTransform:'uppercase'}}>{proj.name}</span></div>}
                          <div style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:7}}><div style={{width:7,height:7,borderRadius:'50%',background:p.dot,flexShrink:0,marginTop:5}}/><span style={{fontSize:13,fontWeight:500,color:'var(--text-primary)',lineHeight:1.45,flex:1}}>{task.title}</span></div>
                          {task.tags?.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:4,marginLeft:15,marginBottom:7}}>{task.tags.map(tag=><span key={tag} style={{fontSize:11,color:'var(--text-secondary)',background:'var(--bg-tertiary)',padding:'1px 7px',borderRadius:4,border:'1px solid var(--border)'}}>{tag}</span>)}</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="board-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20,alignItems:'start'}}>
                  {COLUMNS.map(col=>{
                    const colTasks=filtered.filter(t=>t.status===col.id && !(col.id==='todo' && !t.assignee_id))
                  const over=dragOver===col.id
                  return(
                    <div key={col.id}
                      onDragOver={e=>{e.preventDefault();setDragOver(col.id)}}
                      onDragLeave={()=>setDragOver(null)}
                      onDrop={()=>handleDrop(col.id)}
                      style={{background:over?'var(--accent-light)':'transparent',borderRadius:'var(--radius-lg)',padding:0,border:`2px dashed ${over?'var(--accent)':'transparent'}`,transition:'all var(--transition-normal)',minHeight:460}}>
                      <div className="col-header" style={{'--column-color':col.color}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{color:col.color,fontSize:16,textShadow:'0 2px 4px rgba(0,0,0,0.1)'}}>{col.icon}</span>
                          <span style={{fontSize:14,fontWeight:600,color:'var(--text-primary)'}}>{col.label}</span>
                        </div>
                        <span style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',background:'var(--bg)',padding:'2px 10px',borderRadius:99,boxShadow:'var(--shadow-sm)',border:'1px solid var(--border)'}}>{colTasks.length}</span>
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:12,padding:'2px'}}>
                        {colTasks.length===0&&<div style={{textAlign:'center',padding:'28px 0',fontSize:12,color:'#9b9b9b',border:'1px dashed rgba(0,0,0,0.1)',borderRadius:8}}>{hasFilters?'Eşleşen yok':'Kart yok'}</div>}
                        {colTasks.map(task=>{
                          const due=dueDateStatus(task.due_date,task.status)
                          const p=PRIORITY[task.priority]||PRIORITY.mid
                          const assigneeProf=profiles.find(pr=>pr.id===task.assignee_id)
                          const sc=subtaskCounts[task.id]
                          const proj=projects.find(pr=>pr.id===task.project_id)
                          return(
                            <div key={task.id} className="kanban-card animate-slide-up"
                              draggable onDragStart={()=>setDragging(task.id)} onDragEnd={()=>{setDragging(null);setDragOver(null)}}
                              onClick={()=>openEdit(task)}
                              style={{padding:'16px',opacity:dragging===task.id?0.4:1,animationDelay:`${Math.min(100, colTasks.indexOf(task) * 20)}ms`}}>
                              {proj&&<div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><span style={{fontSize:12}}>{proj.icon}</span><span style={{fontSize:11,color:proj.color,fontWeight:600,letterSpacing:'0.02em',textTransform:'uppercase'}}>{proj.name}</span></div>}
                              <div style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:7}}>
                                <div style={{width:7,height:7,borderRadius:'50%',background:p.dot,flexShrink:0,marginTop:5}}/>
                                <span style={{fontSize:13,fontWeight:500,color:'#1a1a1a',lineHeight:1.45,flex:1}}>{task.title}</span>
                                {task.recurrence&&<span style={{fontSize:11,flexShrink:0}}>🔁</span>}
                              </div>
                              {task.tags?.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:4,marginLeft:15,marginBottom:7}}>{task.tags.map(tag=><span key={tag} style={{fontSize:11,color:'#9b9b9b',background:'#f7f7f5',padding:'1px 7px',borderRadius:4,border:'1px solid rgba(0,0,0,0.07)'}}>{tag}</span>)}</div>}
                              {sc&&sc.total>0&&(
                                <div style={{marginLeft:15,marginBottom:8}}>
                                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}><span style={{fontSize:10,color:'#9b9b9b'}}>{sc.done}/{sc.total} alt görev</span><span style={{fontSize:10,color:'#9b9b9b'}}>{Math.round(sc.done/sc.total*100)}%</span></div>
                                  <div style={{height:3,background:'#f0efec',borderRadius:99,overflow:'hidden'}}><div style={{height:'100%',background:'#22c55e',borderRadius:99,width:`${Math.round(sc.done/sc.total*100)}%`,transition:'width 300ms'}}/></div>
                                </div>
                              )}
                              {task.notes?.length>0&&<div style={{fontSize:11,color:'#9b9b9b',marginLeft:15,marginBottom:7,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',lineHeight:1.5,fontStyle:'italic'}}>{task.notes[task.notes.length-1].text}</div>}
                              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginLeft:15,marginTop:6}}>
                                <div style={{display:'flex',alignItems:'center',gap:6}}>
                                  <Avatar initials={assigneeProf?.initials||'?'} size={20}/>
                                  {isAdmin&&assigneeProf&&<span style={{fontSize:11,color:'#9b9b9b'}}>{assigneeProf.full_name.split(' ')[0]}</span>}
                                  {due&&<span style={{fontSize:10,fontWeight:500,color:due.color,background:due.bg,padding:'1px 7px',borderRadius:99}}>{due.label}</span>}
                                </div>
                                <span style={{fontSize:10,color:'#9b9b9b'}}>{timeAgo(task.created_at)}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {modal&&<TaskModal modal={modal} form={form} setForm={setForm} setModal={setModal} profiles={profiles} allTasks={tasks} user={user} profile={profile} isAdmin={isAdmin} onSave={saveTask} onDelete={deleteTask} activity={activity} projects={projects}/>}
    </>
  )
}
