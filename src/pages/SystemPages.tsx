import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Badge, Button, Card, Checkbox, Col, Descriptions, Drawer, Form,
  Input, List, message, Modal, Progress, Radio, Row, Select, Space, Statistic,
  Switch, Table, Tabs, Tag, Timeline, Tree,
} from 'antd';
import {
  ApiOutlined, AuditOutlined, CheckCircleFilled, EditOutlined, ExperimentOutlined,
  FileTextOutlined, LockOutlined, MailOutlined, PlusOutlined, ProjectOutlined,
  SafetyCertificateOutlined, SendOutlined, TeamOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { PageHeader, StatCard, StatusTag } from '../components/Common';
import { roles, type Role, useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import type { RecordType } from '../components/BusinessList';

function getPeople(projects:RecordType[],jobs:RecordType[]){
  const projectName=(index:number)=>String(projects[index]?.name||'未分配项目');
  const jobName=(index:number)=>String(jobs[index]?.name||'未分配岗位');
  return [
  {key:'1',name:'周谨言',role:'超级管理员',account:'zhou.jinyan',project:'全部项目',job:'全部岗位',scope:'全部组织数据',status:'启用'},
  {key:'2',name:'沈知行',role:'项目经理',account:'shen.zhixing',project:projectName(1),job:'项目下全部岗位',scope:'本人负责项目',status:'启用'},
  {key:'3',name:'顾清禾',role:'岗位负责人',account:'gu.qinghe',project:projectName(1),job:jobName(0),scope:'本人负责岗位',status:'启用'},
  {key:'4',name:'林嘉树',role:'项目经理',account:'lin.jiashu',project:projectName(2),job:'项目下全部岗位',scope:'本人负责项目',status:'启用'},
  {key:'5',name:'许昭',role:'招聘专员',account:'xu.zhao',project:projectName(1),job:jobName(0),scope:'已分配岗位',status:'启用'},
  {key:'6',name:'唐宁',role:'招聘专员',account:'tang.ning',project:projectName(0),job:jobName(1),scope:'已分配岗位',status:'启用'},
  {key:'7',name:'陈砚',role:'面试官',account:'chen.yan',project:projectName(1),job:jobName(0),scope:'参与的面试',status:'启用'},
  {key:'8',name:'苏晚',role:'审核人员',account:'su.wan',project:projectName(0),job:jobName(2),scope:'授权审核范围',status:'启用'},
  ];
}

export function OrganizationPage() {
  const {projects,jobs,updateRecord}=useData();
  const people=getPeople(projects,jobs);
  const [selected,setSelected]=useState(`p-${projects[0].key}`);
  const [drawer,setDrawer]=useState(false);
  const [form]=Form.useForm();
  const treeData=projects.map(project=>({key:`p-${project.key}`,title:String(project.name),icon:<ProjectOutlined />,children:jobs.filter(job=>job.project===project.name).map(job=>({key:`j-${job.key}`,title:String(job.name),icon:<TeamOutlined />}))}));
  const currentProject=selected.startsWith('p-')?projects.find(item=>`p-${item.key}`===selected):projects.find(item=>item.name===jobs.find(job=>`j-${job.key}`===selected)?.project);
  const currentJob=jobs.find(item=>`j-${item.key}`===selected);
  const roster=useMemo(()=>{
    const rows=currentJob?[{name:String(currentJob.owner||''),role:'岗位负责人'},{name:String(currentJob.recruiter||''),role:'招聘专员'}]:[
      {name:String(currentProject?.manager||''),role:'项目经理'},
      ...jobs.filter(job=>job.project===currentProject?.name).flatMap(job=>[{name:job.owner,role:'岗位负责人'},{name:job.recruiter,role:'招聘专员'}]),
    ];
    return rows.flatMap(row=>String(row.name).split('、').filter(Boolean).map(name=>({key:`${row.role}-${name}`,name,role:row.role,project:String(currentProject?.name||''),job:String(currentJob?.name||'项目下全部岗位'),scope:row.role==='项目经理'?'项目全量数据':'负责岗位数据',status:'启用'}))).filter((item,index,array)=>array.findIndex(other=>other.key===item.key)===index);
  },[currentJob,currentProject,jobs]);
  const save=async()=>{
    const values=await form.validateFields();
    if(values.job){
      const job=jobs.find(item=>item.name===values.job);
      if(job)await updateRecord('jobs',job.key,{owner:values.owners.join('、')});
    }else if(currentProject){
      await updateRecord('projects',currentProject.key,{manager:values.owners.join('、')});
    }
    setDrawer(false);
    message.success('负责人配置已保存');
  };
  return <div><PageHeader title="组织架构" description="按项目、岗位和负责人维护招聘组织与数据归属" extra={<Button type="primary" icon={<PlusOutlined />} onClick={()=>setDrawer(true)}>配置负责人</Button>} />
    <Row gutter={12} className="stats-row"><Col span={6}><StatCard label="项目节点" value={projects.length}/></Col><Col span={6}><StatCard label="岗位节点" value={jobs.length}/></Col><Col span={6}><StatCard label="岗位负责人" value="9"/></Col><Col span={6}><StatCard label="招聘专员" value="6"/></Col></Row>
    <div className="roster-layout"><Card className="roster-tree" title="项目 - 岗位"><Input.Search placeholder="搜索项目或岗位" /><Tree showIcon defaultExpandAll selectedKeys={[selected]} treeData={treeData} onSelect={keys=>keys[0]&&setSelected(String(keys[0]))} /></Card>
      <Card className="roster-content" title={<Space><b>{String(currentJob?.name||currentProject?.name||'未选择')}</b><Tag color="blue">{currentJob?'岗位':'项目'}</Tag></Space>} extra={<span>共 {roster.length} 人</span>}><Alert type="info" showIcon message={`当前数据范围：${currentJob?'该岗位':'该项目及下属岗位'}`} /><Table dataSource={roster} pagination={false} columns={[{title:'负责人',dataIndex:'name',render:value=><Space><Avatar size={30}>{value.slice(-1)}</Avatar><b>{value}</b></Space>},{title:'职责',dataIndex:'role',render:value=><Tag color={value==='项目经理'?'blue':'cyan'}>{value}</Tag>},{title:'所属项目',dataIndex:'project'},{title:'负责岗位',dataIndex:'job'},{title:'数据范围',dataIndex:'scope'},{title:'状态',dataIndex:'status',render:(value)=><StatusTag status={value}/>},{title:'操作',render:()=> <Button type="link" icon={<EditOutlined />} onClick={()=>setDrawer(true)}>调整</Button>}]} /></Card></div>
    <Drawer open={drawer} onClose={()=>setDrawer(false)} width={520} title="配置项目 / 岗位负责人" extra={<Button type="primary" onClick={()=>void save()}>保存</Button>}><Form form={form} layout="vertical" initialValues={{project:currentProject?.name,job:currentJob?.name,owners:roster.slice(0,2).map(item=>item.name),scope:'负责范围'}}><Form.Item name="project" label="项目" rules={[{required:true}]}><Select options={projects.map(item=>({value:String(item.name),label:String(item.name)}))}/></Form.Item><Form.Item name="job" label="岗位"><Select allowClear placeholder="不选择则配置项目负责人" options={jobs.filter(item=>item.project===currentProject?.name).map(item=>({value:String(item.name),label:String(item.name)}))}/></Form.Item><Form.Item name="owners" label="负责人" rules={[{required:true}]}><Select mode="multiple" options={people.map(item=>({value:item.name,label:`${item.name} · ${item.role}`}))}/></Form.Item><Form.Item name="scope" label="数据权限"><Radio.Group><Radio value="负责范围">负责范围</Radio><Radio value="只读">只读</Radio></Radio.Group></Form.Item><Alert type="warning" showIcon message="调整后将同步更新成员的数据可见范围和操作权限。" /></Form></Drawer>
  </div>;
}

export function RolesRosterPage() {
  const {setRole}=useApp();
  const {projects,jobs}=useData();
  const people=getPeople(projects,jobs);
  const [selectedRole,setSelectedRole]=useState<Role>('招聘专员');
  const roster=people.filter(item=>item.role===selectedRole || selectedRole==='超级管理员');
  const permissions=['首页工作台','面试控制台','项目与岗位','题库与评分','面试台账','数据看板','人才库','系统设置'].map((module,index)=>({key:module,module,view:true,create:index<7,edit:index<7,approve:[1,2].includes(index),export:index!==7,delete:selectedRole==='超级管理员'}));
  return <div><PageHeader title="角色与权限" description="按角色查看人员花名册、项目岗位归属和功能权限" extra={<Button type="primary" onClick={()=>{setRole(selectedRole);message.success(`已切换为${selectedRole}预览`);}}>以该角色预览系统</Button>} />
    <Row gutter={14}><Col span={6}><Card title="角色"><List dataSource={[...roles]} renderItem={(item:Role)=><List.Item className={`role-item ${selectedRole===item?'active':''}`} onClick={()=>setSelectedRole(item)}><Space><Avatar icon={<SafetyCertificateOutlined />}/><div><b>{item}</b><span>{people.filter(person=>person.role===item).length||Math.max(1,8-roles.indexOf(item))} 人</span></div></Space></List.Item>} /></Card></Col>
      <Col span={18}><Card><div className="role-summary"><div><h2>{selectedRole}</h2><p>当前角色成员及项目、岗位数据范围</p></div><Space><Tag color="blue">{roster.length} 名成员</Tag><Tag>{selectedRole==='超级管理员'?'全部组织数据':'按项目岗位授权'}</Tag></Space></div><Tabs items={[
        {key:'roster',label:'人员花名册',children:<Table dataSource={roster} columns={[{title:'成员',dataIndex:'name',render:value=><Space><Avatar size={28}>{value.slice(-1)}</Avatar><b>{value}</b></Space>},{title:'账号',dataIndex:'account'},{title:'负责项目',dataIndex:'project'},{title:'负责岗位',dataIndex:'job'},{title:'数据范围',dataIndex:'scope'},{title:'状态',dataIndex:'status',render:value=><StatusTag status={value}/>},{title:'操作',render:()=> <Button type="link">调整授权</Button>}]} />},
        {key:'permission',label:'功能权限',children:<Table dataSource={permissions} pagination={false} columns={[{title:'模块',dataIndex:'module'},{title:'查看',dataIndex:'view',render:value=><Checkbox defaultChecked={value}/>},{title:'新增',dataIndex:'create',render:value=><Checkbox defaultChecked={value}/>},{title:'编辑',dataIndex:'edit',render:value=><Checkbox defaultChecked={value}/>},{title:'审批',dataIndex:'approve',render:value=><Checkbox defaultChecked={value}/>},{title:'导出',dataIndex:'export',render:value=><Checkbox defaultChecked={value}/>},{title:'删除',dataIndex:'delete',render:value=><Checkbox defaultChecked={value} disabled={selectedRole!=='超级管理员'}/>}]} />},
      ]}/></Card></Col></Row>
  </div>;
}

export function NotificationTemplatesPage() {
  const {templates,createRecord,updateRecord}=useData();
  const [current,setCurrent]=useState<RecordType>();
  const [drawer,setDrawer]=useState(false);
  const [form]=Form.useForm();
  const open=(record?:RecordType)=>{
    setCurrent(record);
    form.resetFields();
    form.setFieldsValue(record||{type:'功能通知',channel:'站内信',audience:['全部用户'],status:'草稿'});
    setDrawer(true);
  };
  const save=async()=>{
    const values=await form.validateFields();
    if(current)await updateRecord('templates',current.key,values);
    else await createRecord('templates',values);
    setDrawer(false);
    message.success('模板已保存');
  };
  return <div><PageHeader title="通知模板" description="管理版本发布、功能通知、说明书和系统公告" extra={<Button type="primary" icon={<PlusOutlined />} onClick={()=>open()}>新建模板</Button>} />
    <Row gutter={12} className="stats-row"><Col span={6}><StatCard label="版本通知" value={templates.filter(item=>item.type==='版本通知').length}/></Col><Col span={6}><StatCard label="功能通知" value={templates.filter(item=>item.type==='功能通知').length}/></Col><Col span={6}><StatCard label="说明书" value={templates.filter(item=>item.type==='说明书').length}/></Col><Col span={6}><StatCard label="待发布" value={templates.filter(item=>item.status==='草稿').length} tone="orange"/></Col></Row>
    <Card><Tabs items={['全部','版本通知','功能通知','说明书','系统公告'].map(type=>({key:type,label:type,children:<Table dataSource={type==='全部'?templates:templates.filter(item=>item.type===type)} columns={[{title:'模板名称',dataIndex:'name'},{title:'内容类型',dataIndex:'type',render:value=><Tag color="blue">{value}</Tag>},{title:'通知渠道',dataIndex:'channel'},{title:'接收对象',dataIndex:'audience',render:value=>Array.isArray(value)?value.join('、'):value},{title:'内容摘要',dataIndex:'summary'},{title:'状态',dataIndex:'status',render:value=><StatusTag status={value}/>},{title:'更新时间',dataIndex:'updated'},{title:'操作',render:(_,record)=><Space><Button type="link" onClick={()=>open(record)}>编辑</Button><Button type="link" icon={<SendOutlined />} onClick={async()=>{await createRecord('notifications',{name:`测试通知：${String(record.name)}`,module:'通知模板',owner:'周谨言',status:'未读'});message.success('测试通知已进入发送队列');}}>测试</Button></Space>}]} />}))} /></Card>
    <Drawer open={drawer} onClose={()=>setDrawer(false)} width={620} title={current?'编辑通知模板':'新建通知模板'} extra={<Button type="primary" onClick={()=>void save()}>保存</Button>}><Form form={form} layout="vertical"><Form.Item name="name" label="模板名称" rules={[{required:true}]}><Input/></Form.Item><Row gutter={12}><Col span={12}><Form.Item name="type" label="内容类型"><Select options={['版本通知','功能通知','说明书','系统公告'].map(value=>({value,label:value}))}/></Form.Item></Col><Col span={12}><Form.Item name="audience" label="接收对象"><Select mode="multiple" options={['全部用户',...roles].map(value=>({value,label:value}))}/></Form.Item></Col></Row><Form.Item name="channel" label="通知渠道"><Select mode="multiple" options={['站内信','邮件','短信'].map(value=>({value,label:value}))}/></Form.Item><Form.Item name="summary" label="内容摘要" rules={[{required:true}]}><Input.TextArea rows={8}/></Form.Item><Form.Item name="status" label="状态"><Select options={['草稿','启用','停用'].map(value=>({value,label:value}))}/></Form.Item></Form></Drawer>
  </div>;
}

export function AuditLogPage() {
  const {auditLogs,downloadRecords}=useData();
  const [current,setCurrent]=useState<RecordType>();
  const [keyword,setKeyword]=useState('');
  const filtered=auditLogs.filter(item=>!keyword||JSON.stringify(item).includes(keyword));
  return <div><PageHeader title="审计日志" description="追踪删除、权限、飞书会议、结果回传及数据导出等敏感操作" extra={<Button icon={<FileTextOutlined />} onClick={()=>void downloadRecords('auditLogs')}>导出审计报告</Button>} /><Card className="filter-panel"><Input.Search allowClear value={keyword} onChange={event=>setKeyword(event.target.value)} placeholder="用户 / 业务对象 / 操作类型" /></Card><Card className="table-panel"><Table dataSource={filtered} columns={[{title:'操作时间',dataIndex:'time',width:150},{title:'用户',dataIndex:'user'},{title:'角色',dataIndex:'role'},{title:'模块',dataIndex:'module'},{title:'动作',dataIndex:'action',render:value=><Tag color={String(value).includes('删除')?'red':'blue'}>{value}</Tag>},{title:'业务对象',dataIndex:'object',width:190},{title:'操作摘要',dataIndex:'summary',width:220},{title:'IP',dataIndex:'ip'},{title:'结果',dataIndex:'result',render:value=><StatusTag status={value==='成功'?'已完成':'发送失败'}/>},{title:'操作',render:(_,record)=><Button type="link" onClick={()=>setCurrent(record)}>详情</Button>}]} /></Card><Drawer open={!!current} onClose={()=>setCurrent(undefined)} width={600} title="审计日志详情"><Descriptions bordered column={1} size="small">{Object.entries(current||{}).filter(([key])=>key!=='key').map(([key,value])=><Descriptions.Item key={key} label={key}>{String(value)}</Descriptions.Item>)}</Descriptions><Alert style={{marginTop:16}} type="info" showIcon message="日志不可编辑或删除，保留期限为 365 天。" /></Drawer></div>;
}

export function SystemConfigPage() {
  const {settings,updateSettings,testFeishu}=useData();
  const [form]=Form.useForm();
  const [saving,setSaving]=useState(false);
  useEffect(()=>{form.setFieldsValue(settings);},[form,settings]);
  const save=async()=>{
    setSaving(true);
    try{await updateSettings(form.getFieldsValue(true));message.success('系统配置已保存');}
    finally{setSaving(false);}
  };
  const test=async()=>{
    const result=await testFeishu();
    result.connected?message.success(`飞书连接正常，延迟 ${result.latency}ms`):message.error('飞书连接失败');
  };
  return <Form form={form} layout="vertical"><PageHeader title="系统配置" description="配置飞书会议、消息通道、登录安全和数据保留策略" extra={<Button loading={saving} type="primary" onClick={()=>void save()}>保存配置</Button>} /><Tabs className="system-tabs" items={[
    {key:'feishu',label:<Space><VideoCameraOutlined />飞书会议集成</Space>,children:<Row gutter={16}><Col span={16}><Card title="飞书开放平台连接" extra={<Badge status="success" text="API 已连接" />}><Alert type="warning" showIcon message="生产环境凭证必须由后端服务安全托管，前端仅提交更新值。" /><Row gutter={16}><Col span={12}><Form.Item name="feishuAppId" label="飞书 App ID"><Input /></Form.Item></Col><Col span={12}><Form.Item name="feishuSecret" label="App Secret"><Input.Password placeholder="未修改则留空" autoComplete="new-password" /></Form.Item></Col></Row><Form.Item name="callbackUrl" label="事件订阅回调地址"><Input addonBefore="POST" /></Form.Item><Space><Button type="primary" icon={<ApiOutlined />} onClick={()=>void test()}>测试连接</Button></Space></Card></Col><Col span={8}><Card title="面试结果同步链路"><Timeline items={[{dot:<CheckCircleFilled />,color:'green',children:'接收会议结束回调'},{dot:<ApiOutlined />,color:'blue',children:'拉取录制与妙记'},{dot:<ExperimentOutlined />,color:'blue',children:'汇总面试评价'},{dot:<AuditOutlined />,color:'gray',children:'写入面试台账'}]} /></Card></Col></Row>},
    {key:'message',label:<Space><MailOutlined />通知通道</Space>,children:<Row gutter={16}><Col span={12}><Card title="邮件通道"><Form.Item name="smtpHost" label="SMTP 服务"><Input/></Form.Item><Form.Item name="mailSender" label="发件账号"><Input/></Form.Item></Card></Col><Col span={12}><Card title="短信通道"><Form.Item name="smsProvider" label="服务商"><Select options={[{value:'火山引擎短信',label:'火山引擎短信'}]}/></Form.Item><Form.Item name="smsSignature" label="签名"><Input/></Form.Item></Card></Col></Row>},
    {key:'security',label:<Space><LockOutlined />登录与数据</Space>,children:<Row gutter={16}><Col span={12}><Card title="登录安全"><Form.Item name="ssoEnabled" label="统一登录" valuePropName="checked"><Switch /></Form.Item><Form.Item name="sessionHours" label="会话有效期"><Select options={[4,8,12].map(value=>({value,label:`${value} 小时`}))}/></Form.Item></Card></Col><Col span={12}><Card title="数据保留"><Form.Item name="dataRetentionDays" label="面试数据保留期限"><Select options={[180,365,730].map(value=>({value,label:`${value} 天`}))}/></Form.Item><Form.Item name="timezone" label="默认时区"><Select options={[{value:'Asia/Shanghai',label:'Asia/Shanghai (UTC+8)'}]}/></Form.Item></Card></Col></Row>},
  ]}/></Form>;
}
