import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Badge, Button, Card, Checkbox, Col, Descriptions, Drawer, Form,
  Input, List, message, Modal, Progress, Radio, Row, Select, Space, Statistic,
  Switch, Table, Tabs, Tag, Timeline, Tooltip, Tree,
} from 'antd';
import {
  ApiOutlined, AuditOutlined, CheckCircleFilled, EditOutlined, ExperimentOutlined,
  FileTextOutlined, LockOutlined, MailOutlined, PlusOutlined, ProjectOutlined,
  SafetyCertificateOutlined, SendOutlined, TeamOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { PageHeader, StatCard, StatusTag } from '../components/Common';
import { roles, type Role } from '../context/AppContext';
import { useData } from '../context/DataContext';
import type { RecordType } from '../components/BusinessList';

export function OrganizationPage() {
  const {projects,jobs,users,updateRecord}=useData();
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
    <Drawer open={drawer} onClose={()=>setDrawer(false)} width={520} title="配置项目 / 岗位负责人" extra={<Button type="primary" onClick={()=>void save()}>保存</Button>}><Form form={form} layout="vertical" initialValues={{project:currentProject?.name,job:currentJob?.name,owners:roster.slice(0,2).map(item=>item.name),scope:'负责范围'}}><Form.Item name="project" label="项目" rules={[{required:true}]}><Select options={projects.map(item=>({value:String(item.name),label:String(item.name)}))}/></Form.Item><Form.Item name="job" label="岗位"><Select allowClear placeholder="不选择则配置项目负责人" options={jobs.filter(item=>item.project===currentProject?.name).map(item=>({value:String(item.name),label:String(item.name)}))}/></Form.Item><Form.Item name="owners" label="负责人" rules={[{required:true}]}><Select mode="multiple" options={users.map(item=>({value:String(item.name),label:`${String(item.name)} · ${String(item.role)}`}))}/></Form.Item><Form.Item name="scope" label="数据权限"><Radio.Group><Radio value="负责范围">负责范围</Radio><Radio value="只读">只读</Radio></Radio.Group></Form.Item><Alert type="warning" showIcon message="负责人字段将写入项目或岗位；登录数据范围由服务端账号配置决定。" /></Form></Drawer>
  </div>;
}

export function RolesRosterPage() {
  const {users}=useData();
  const [selectedRole,setSelectedRole]=useState<Role>('招聘专员');
  const roster=users.filter(item=>item.role===selectedRole);
  const permissions=['首页工作台','面试控制台','项目与岗位','题库与评分','面试台账','数据看板','人才库','系统设置'].map((module,index)=>({key:module,module,view:true,create:index<7,edit:index<7,approve:[1,2].includes(index),export:index!==7,delete:selectedRole==='超级管理员'}));
  return <div><PageHeader title="角色与权限" description="按角色查看人员花名册、项目岗位归属和功能权限；实际权限以登录账号为准" />
    <Row gutter={14}><Col span={6}><Card title="角色"><List dataSource={[...roles]} renderItem={(item:Role)=><List.Item className={`role-item ${selectedRole===item?'active':''}`} onClick={()=>setSelectedRole(item)}><Space><Avatar icon={<SafetyCertificateOutlined />}/><div><b>{item}</b><span>{users.filter(person=>person.role===item).length} 人</span></div></Space></List.Item>} /></Card></Col>
      <Col span={18}><Card><div className="role-summary"><div><h2>{selectedRole}</h2><p>当前角色成员及项目、岗位数据范围</p></div><Space><Tag color="blue">{roster.length} 名成员</Tag><Tag>{selectedRole==='超级管理员'?'全部组织数据':'按项目岗位授权'}</Tag></Space></div><Tabs items={[
        {key:'roster',label:'人员花名册',children:<Table dataSource={roster} columns={[{title:'成员',dataIndex:'name',render:value=><Space><Avatar size={28}>{value.slice(-1)}</Avatar><b>{value}</b></Space>},{title:'账号',dataIndex:'account'},{title:'部门',dataIndex:'department'},{title:'数据范围',dataIndex:'scope'},{title:'状态',dataIndex:'status',render:value=><StatusTag status={value}/>}]} />},
        {key:'permission',label:'功能权限',children:<Table dataSource={permissions} pagination={false} columns={[{title:'模块',dataIndex:'module'},{title:'查看',dataIndex:'view',render:value=><Checkbox checked={value} disabled/>},{title:'新增',dataIndex:'create',render:value=><Checkbox checked={value} disabled/>},{title:'编辑',dataIndex:'edit',render:value=><Checkbox checked={value} disabled/>},{title:'审批',dataIndex:'approve',render:value=><Checkbox checked={value} disabled/>},{title:'导出',dataIndex:'export',render:value=><Checkbox checked={value} disabled/>},{title:'删除',dataIndex:'delete',render:value=><Checkbox checked={value} disabled/>}]} />},
      ]}/></Card></Col></Row>
  </div>;
}

export function NotificationTemplatesPage() {
  const {templates,settings,createRecord,updateRecord,testNotifications}=useData();
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
    <Card><Tabs items={['全部','版本通知','功能通知','说明书','系统公告'].map(type=>({key:type,label:type,children:<Table dataSource={type==='全部'?templates:templates.filter(item=>item.type===type)} columns={[{title:'模板名称',dataIndex:'name'},{title:'内容类型',dataIndex:'type',render:value=><Tag color="blue">{value}</Tag>},{title:'通知渠道',dataIndex:'channel'},{title:'接收对象',dataIndex:'audience',render:value=>Array.isArray(value)?value.join('、'):value},{title:'内容摘要',dataIndex:'summary'},{title:'状态',dataIndex:'status',render:value=><StatusTag status={value}/>},{title:'更新时间',dataIndex:'updated'},{title:'操作',render:(_,record)=><Space><Button type="link" onClick={()=>open(record)}>编辑</Button><Tooltip title={settings.notificationProviderConfigured?'':'通知 Provider 未配置'}><Button disabled={!settings.notificationProviderConfigured} type="link" icon={<SendOutlined />} onClick={async()=>{await testNotifications();message.success('通知 Provider 连接正常');}}>测试</Button></Tooltip></Space>}]} />}))} /></Card>
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
    result.connected?message.success(`飞书连接正常：${result.userName||'身份验证通过'}`):message.error('飞书连接失败');
  };
  return <Form form={form} layout="vertical"><PageHeader title="系统配置" description="配置飞书会议、消息通道、登录安全和数据保留策略" extra={<Button loading={saving} type="primary" onClick={()=>void save()}>保存配置</Button>} /><Tabs className="system-tabs" items={[
    {key:'feishu',label:<Space><VideoCameraOutlined />飞书会议集成</Space>,children:<Row gutter={16}><Col span={16}><Card title="飞书开放平台连接" extra={<Badge status={settings.feishuConfigured?'success':'warning'} text={settings.feishuConfigured?'服务端已配置':'服务端未配置'} />}><Alert type="info" showIcon message="App ID、App Secret 和 Owner Open ID 只允许通过服务端环境变量配置，浏览器不会读取或保存密钥。" /><Space><Button type="primary" disabled={!settings.feishuConfigured} icon={<ApiOutlined />} onClick={()=>void test()}>测试连接</Button></Space></Card></Col><Col span={8}><Card title="面试结果同步链路"><Timeline items={[{dot:<CheckCircleFilled />,color:'green',children:'创建视频会议预约'},{dot:<ApiOutlined />,color:'blue',children:'查询会议详情与录制'},{dot:<ExperimentOutlined />,color:'blue',children:'关联飞书妙记'},{dot:<AuditOutlined />,color:'gray',children:'写入面试台账'}]} /></Card></Col></Row>},
    {key:'providers',label:<Space><MailOutlined />外部服务</Space>,children:<Row gutter={16}><Col span={8}><Card title="AI 面试 Provider"><Badge status={settings.interviewProviderConfigured?'success':'warning'} text={settings.interviewProviderConfigured?'已配置':'未配置'}/></Card></Col><Col span={8}><Card title="通知 Provider"><Badge status={settings.notificationProviderConfigured?'success':'warning'} text={settings.notificationProviderConfigured?'已配置':'未配置'}/></Card></Col><Col span={8}><Card title="简历解析 Provider"><Badge status={settings.resumeParserConfigured?'success':'warning'} text={settings.resumeParserConfigured?'已配置':'未配置'}/></Card></Col></Row>},
    {key:'security',label:<Space><LockOutlined />数据策略</Space>,children:<Row gutter={16}><Col span={12}><Card title="存储模式"><Descriptions column={1}><Descriptions.Item label="当前存储">{settings.databaseMode==='postgres'?'PostgreSQL 共享数据库':'本地 JSON（仅开发）'}</Descriptions.Item><Descriptions.Item label="登录会话">服务端 HttpOnly Cookie</Descriptions.Item></Descriptions></Card></Col><Col span={12}><Card title="数据保留"><Form.Item name="dataRetentionDays" label="面试数据保留期限"><Select options={[180,365,730].map(value=>({value,label:`${value} 天`}))}/></Form.Item><Form.Item name="timezone" label="默认时区"><Select options={[{value:'Asia/Shanghai',label:'Asia/Shanghai (UTC+8)'}]}/></Form.Item></Card></Col></Row>},
  ]}/></Form>;
}
